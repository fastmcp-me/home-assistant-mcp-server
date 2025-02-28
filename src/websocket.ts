import * as hassWs from 'home-assistant-js-websocket';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Store active subscriptions
interface Subscription {
  unsubscribe: () => void;
  entityIds: string[];
}

export class HassWebSocket {
  private connection: hassWs.Connection | null = null;
  private entityCache: Map<string, hassWs.HassEntity> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private mcp: McpServer;
  private hassUrl: string;
  private hassToken: string;
  private useMock: boolean;
  private isConnected: boolean = false;
  private connectionPromise: Promise<hassWs.Connection> | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private lastEntityChanged: Date | null = null;

  constructor(mcp: McpServer, hassUrl: string, hassToken: string, useMock: boolean = false) {
    this.mcp = mcp;
    this.hassUrl = hassUrl;
    this.hassToken = hassToken;
    this.useMock = useMock;

    // Register MCP tools for WebSocket functionality
    this.registerTools();
  }

  /**
   * Register WebSocket-specific tools with the MCP server
   */
  private registerTools() {
    // Subscribe to entity changes
    this.mcp.tool(
      "subscribe_entities",
      "Subscribe to entity state changes and get updates in real-time",
      {
        entity_ids: z.array(z.string()).describe("Array of entity IDs to subscribe to (e.g., ['light.living_room', 'switch.kitchen'])"),
        subscription_id: z.string().describe("Unique identifier for this subscription for later reference"),
      },
      async ({ entity_ids, subscription_id }) => {
        try {
          if (this.useMock) {
            return {
              content: [
                {
                  type: "text",
                  text: "Mock subscription created for: " + entity_ids.join(", "),
                },
              ],
            };
          }

          // Create subscription
          const result = await this.subscribeEntities(entity_ids, subscription_id);

          return {
            content: [
              {
                type: "text",
                text: result,
              },
            ],
          };
        } catch (error) {
          console.error("Error subscribing to entities:", error);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error subscribing to entities: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    // Unsubscribe from entity changes
    this.mcp.tool(
      "unsubscribe_entities",
      "Unsubscribe from entity state changes",
      {
        subscription_id: z.string().describe("The ID of the subscription to cancel"),
      },
      async ({ subscription_id }) => {
        try {
          if (this.useMock) {
            return {
              content: [
                {
                  type: "text",
                  text: "Mock subscription removed: " + subscription_id,
                },
              ],
            };
          }

          // Remove subscription
          const result = this.unsubscribeEntities(subscription_id);

          return {
            content: [
              {
                type: "text",
                text: result,
              },
            ],
          };
        } catch (error) {
          console.error("Error unsubscribing from entities:", error);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error unsubscribing from entities: ${error.message}`,
              },
            ],
          };
        }
      }
    );

    // Get recent state changes
    this.mcp.tool(
      "get_recent_changes",
      "Get recent entity state changes since last check",
      {},
      async () => {
        try {
          if (this.useMock) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify([
                    {
                      entity_id: "light.living_room",
                      state: "on",
                      attributes: {
                        friendly_name: "Living Room Light",
                        brightness: 255,
                      },
                      last_changed: new Date().toISOString(),
                      last_updated: new Date().toISOString(),
                    }
                  ], null, 2),
                },
              ],
            };
          }

          // Get changes since last check
          const changes = this.getRecentChanges();

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(changes, null, 2),
              },
            ],
          };
        } catch (error) {
          console.error("Error getting recent changes:", error);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error getting recent changes: ${error.message}`,
              },
            ],
          };
        }
      }
    );
  }

  /**
   * Connect to Home Assistant WebSocket API
   */
  async connect(): Promise<hassWs.Connection> {
    if (this.connection) {
      return this.connection;
    }

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise(async (resolve, reject) => {
      try {
        console.error(`Connecting to Home Assistant WebSocket API at ${this.hassUrl}`);

        // Create auth object for Home Assistant using createLongLivedTokenAuth instead of Auth constructor
        const auth = hassWs.createLongLivedTokenAuth(this.hassUrl, this.hassToken);

        // Connect to WebSocket API
        const connection = await hassWs.createConnection({ auth });
        console.error("Connected to Home Assistant WebSocket API");

        // Store connection
        this.connection = connection;
        this.isConnected = true;

        // Handle connection closing
        connection.addEventListener("ready", () => {
          console.error("WebSocket connection ready");
        });

        connection.addEventListener("disconnected", () => {
          console.error("WebSocket disconnected, will try to reconnect");
          this.isConnected = false;
          this.setupReconnect();
        });

        // Subscribe to all entities to maintain a cache
        hassWs.subscribeEntities(connection, (entities) => {
          // Update entity cache
          for (const [entityId, entity] of Object.entries(entities)) {
            this.entityCache.set(entityId, entity);
          }

          // Mark as changed
          this.lastEntityChanged = new Date();
        });

        resolve(connection);
      } catch (error) {
        console.error("Error connecting to Home Assistant WebSocket API:", error);
        this.connectionPromise = null;
        this.isConnected = false;
        this.setupReconnect();
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Setup reconnection logic
   */
  private setupReconnect() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }

    this.reconnectInterval = setInterval(async () => {
      if (!this.isConnected) {
        try {
          this.connectionPromise = null;
          this.connection = null;
          await this.connect();

          // Resubscribe to all active subscriptions
          for (const [subId, subscription] of this.subscriptions.entries()) {
            await this.subscribeEntities(subscription.entityIds, subId);
          }

          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        } catch (error) {
          console.error("Error reconnecting to Home Assistant WebSocket API:", error);
        }
      } else {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
    }, 10000); // Try every 10 seconds
  }

  /**
   * Subscribe to entity changes
   */
  async subscribeEntities(entityIds: string[], subscriptionId: string): Promise<string> {
    try {
      // If we already have a subscription with this ID, unsubscribe it first
      if (this.subscriptions.has(subscriptionId)) {
        this.unsubscribeEntities(subscriptionId);
      }

      // Connect to WebSocket if not already connected
      const connection = await this.connect();

      // Create subscription for these entities
      const unsub = hassWs.subscribeEntities(connection, (entities) => {
        // Filter only the entities we're interested in
        const filteredEntities = Object.entries(entities)
          .filter(([entityId]) => entityIds.includes(entityId))
          .reduce((obj, [entityId, entity]) => {
            obj[entityId] = entity;
            return obj;
          }, {});

        // Update the cache
        for (const [entityId, entity] of Object.entries(filteredEntities)) {
          // Type assertion to fix the TypeScript error
          this.entityCache.set(entityId, entity as hassWs.HassEntity);
        }

        // Mark as changed
        this.lastEntityChanged = new Date();
      });

      // Store subscription
      this.subscriptions.set(subscriptionId, {
        unsubscribe: unsub,
        entityIds,
      });

      return `Successfully subscribed to ${entityIds.length} entities with ID: ${subscriptionId}`;
    } catch (error) {
      throw new Error(`Failed to subscribe to entities: ${error.message}`);
    }
  }

  /**
   * Unsubscribe from entity changes
   */
  unsubscribeEntities(subscriptionId: string): string {
    const subscription = this.subscriptions.get(subscriptionId);

    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(subscriptionId);
      return `Successfully unsubscribed from subscription: ${subscriptionId}`;
    } else {
      return `No subscription found with ID: ${subscriptionId}`;
    }
  }

  /**
   * Get recent entity changes
   */
  getRecentChanges(): any[] {
    // If no changes since last check or no cache
    if (!this.lastEntityChanged || this.entityCache.size === 0) {
      return [];
    }

    // Convert cache to array for return
    const entities = Array.from(this.entityCache.values()).map(entity => {
      // Convert entity to plain object that can be stringified
      return {
        entity_id: entity.entity_id,
        state: entity.state,
        attributes: entity.attributes,
        last_changed: entity.last_changed,
        last_updated: entity.last_updated,
      };
    });

    // Reset last changed timestamp
    this.lastEntityChanged = null;

    return entities;
  }

  /**
   * Close the WebSocket connection
   */
  async close() {
    if (this.connection) {
      // Unsubscribe from all subscriptions
      for (const [subId] of this.subscriptions.entries()) {
        this.unsubscribeEntities(subId);
      }

      // Close connection
      this.connection.close();
      this.connection = null;
      this.isConnected = false;
      this.connectionPromise = null;

      // Clear reconnect interval if set
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
    }
  }
}
