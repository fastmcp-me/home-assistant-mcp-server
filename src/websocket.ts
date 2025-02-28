import * as hassWs from "home-assistant-js-websocket";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiCache } from "./utils.js";

// Enhanced subscription interface
interface Subscription {
  unsubscribe: () => void;
  entityIds: string[];
  filters?: SubscriptionFilter;
  lastChecked: Date;
  expiresAt?: Date;
  callbackId?: string;
}

// New interface for subscription filters
interface SubscriptionFilter {
  stateChange?: boolean;
  attributeChanges?: string[];
  minStateChangeAge?: number; // in milliseconds
}

// Simplified entity for JSON serialization
interface SimplifiedHassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  changed_attributes?: string[]; // New field to track which attributes changed
}

// Interface to extend McpServer with notification capability
interface McpServerWithNotifications extends McpServer {
  sendNotification: (notification: {
    title: string;
    message: string;
    data: unknown;
    callbackId: string;
  }) => void;
}

export class HassWebSocket {
  private connection: hassWs.Connection | null = null;
  private entityCache: Map<string, hassWs.HassEntity> = new Map();
  private previousEntityStates: Map<string, hassWs.HassEntity> = new Map(); // Track previous states
  private subscriptions: Map<string, Subscription> = new Map();
  private mcp: McpServer;
  private hassUrl: string;
  private hassToken: string;
  private useMock: boolean;
  private isConnected: boolean = false;
  private connectionPromise: Promise<hassWs.Connection> | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private lastEntityChanged: Date | null = null;
  private entityChangeCallbacks: Map<
    string,
    (entities: SimplifiedHassEntity[]) => void
  > = new Map();

  constructor(
    mcp: McpServer,
    hassUrl: string,
    hassToken: string,
    useMock: boolean = false,
  ) {
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
    // Enhanced subscription with filtering options
    this.mcp.tool(
      "subscribe_entities",
      "Subscribe to entity state changes with advanced filtering",
      {
        entity_ids: z
          .array(z.string())
          .describe(
            "Array of entity IDs to subscribe to (e.g., ['light.living_room', 'switch.kitchen'])",
          ),
        subscription_id: z
          .string()
          .describe(
            "Unique identifier for this subscription for later reference",
          ),
        filters: z
          .object({
            state_change: z
              .boolean()
              .optional()
              .describe("Only notify on state changes"),
            attribute_changes: z
              .array(z.string())
              .optional()
              .describe("Only notify on changes to these specific attributes"),
            min_state_change_age: z
              .number()
              .optional()
              .describe(
                "Minimum time in seconds between state changes to notify (debounce)",
              ),
          })
          .optional()
          .describe("Optional filters to apply to the subscription"),
        expires_in: z
          .number()
          .optional()
          .describe(
            "Optional expiration time in seconds for this subscription",
          ),
        callback_id: z
          .string()
          .optional()
          .describe("Optional callback ID for real-time notifications"),
      },
      async ({
        entity_ids,
        subscription_id,
        filters,
        expires_in,
        callback_id,
      }) => {
        try {
          if (this.useMock) {
            return {
              content: [
                {
                  type: "text",
                  text:
                    "Mock subscription created for: " + entity_ids.join(", "),
                },
              ],
            };
          }

          // Format filters for internal use
          const subscriptionFilters = filters
            ? {
                stateChange: filters.state_change,
                attributeChanges: filters.attribute_changes,
                minStateChangeAge: filters.min_state_change_age
                  ? filters.min_state_change_age * 1000
                  : undefined,
              }
            : undefined;

          // Create subscription with the new parameters
          const result = await this.subscribeEntities(
            entity_ids,
            subscription_id,
            subscriptionFilters,
            expires_in,
            callback_id,
          );

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
      },
    );

    // Get recent changes with filtering by subscription ID or entity IDs
    this.mcp.tool(
      "get_recent_changes",
      "Get recent entity state changes with advanced filtering",
      {
        subscription_id: z
          .string()
          .optional()
          .describe(
            "Optional subscription ID to get changes only for that subscription",
          ),
        entity_ids: z
          .array(z.string())
          .optional()
          .describe("Optional array of entity IDs to filter changes"),
        include_unchanged: z
          .boolean()
          .optional()
          .describe("Include entities that haven't changed since last check"),
      },
      async ({ subscription_id, entity_ids, include_unchanged }) => {
        try {
          if (this.useMock) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    [
                      {
                        entity_id: "light.living_room",
                        state: "on",
                        attributes: {
                          friendly_name: "Living Room Light",
                          brightness: 255,
                        },
                        last_changed: new Date().toISOString(),
                        last_updated: new Date().toISOString(),
                        changed_attributes: ["brightness"],
                      },
                    ],
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          // Get changes with filtering options
          const changes = this.getRecentChanges(
            subscription_id,
            entity_ids,
            include_unchanged || false,
          );

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
      },
    );

    // Register for real-time callbacks on entity changes
    this.mcp.tool(
      "register_callback",
      "Register a callback for real-time entity state change notifications",
      {
        callback_id: z.string().describe("Unique identifier for this callback"),
      },
      async ({ callback_id }) => {
        try {
          if (this.useMock) {
            return {
              content: [
                {
                  type: "text",
                  text: "Mock callback registered with ID: " + callback_id,
                },
              ],
            };
          }

          // Register a callback function
          this.entityChangeCallbacks.set(callback_id, (entities) => {
            // Send entity changes as notifications
            // Using type assertion since we're extending the SDK's capabilities
            (this.mcp as McpServerWithNotifications).sendNotification({
              title: "Entity State Change",
              message: `${entities.length} entities changed states`,
              data: entities,
              callbackId: callback_id,
            });
          });

          return {
            content: [
              {
                type: "text",
                text: `Successfully registered callback with ID: ${callback_id}`,
              },
            ],
          };
        } catch (error) {
          console.error("Error registering callback:", error);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error registering callback: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // Remove a callback
    this.mcp.tool(
      "unregister_callback",
      "Unregister a callback for real-time notifications",
      {
        callback_id: z.string().describe("The ID of the callback to remove"),
      },
      async ({ callback_id }) => {
        try {
          if (this.useMock) {
            return {
              content: [
                {
                  type: "text",
                  text: "Mock callback unregistered: " + callback_id,
                },
              ],
            };
          }

          // Remove the callback
          if (this.entityChangeCallbacks.has(callback_id)) {
            this.entityChangeCallbacks.delete(callback_id);
            return {
              content: [
                {
                  type: "text",
                  text: `Successfully unregistered callback: ${callback_id}`,
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `No callback found with ID: ${callback_id}`,
                },
              ],
            };
          }
        } catch (error) {
          console.error("Error unregistering callback:", error);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error unregistering callback: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // List active subscriptions
    this.mcp.tool(
      "list_subscriptions",
      "List all active entity subscriptions",
      {},
      async () => {
        try {
          if (this.useMock) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    [
                      {
                        subscription_id: "mock-sub-1",
                        entity_ids: ["light.living_room", "switch.kitchen"],
                        filters: { state_change: true },
                        last_checked: new Date().toISOString(),
                      },
                    ],
                    null,
                    2,
                  ),
                },
              ],
            };
          }

          // Format subscriptions for display
          const subscriptionsInfo = Array.from(
            this.subscriptions.entries(),
          ).map(([id, sub]) => ({
            subscription_id: id,
            entity_ids: sub.entityIds,
            filters: sub.filters,
            last_checked: sub.lastChecked.toISOString(),
            expires_at: sub.expiresAt?.toISOString(),
            has_callback: !!sub.callbackId,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(subscriptionsInfo, null, 2),
              },
            ],
          };
        } catch (error) {
          console.error("Error listing subscriptions:", error);
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error listing subscriptions: ${error.message}`,
              },
            ],
          };
        }
      },
    );

    // Keep the original unsubscribe_entities tool
    this.mcp.tool(
      "unsubscribe_entities",
      "Unsubscribe from entity state changes",
      {
        subscription_id: z
          .string()
          .describe("The ID of the subscription to cancel"),
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
      },
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

    this.connectionPromise = new Promise((resolve, reject) => {
      const connectToHass = async () => {
        try {
          console.error(
            `Connecting to Home Assistant WebSocket API at ${this.hassUrl}`,
          );

          // Create auth object for Home Assistant using createLongLivedTokenAuth instead of Auth constructor
          const auth = hassWs.createLongLivedTokenAuth(
            this.hassUrl,
            this.hassToken,
          );

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
            // Check for expired subscriptions every time we get updates
            this.checkExpiredSubscriptions();

            // Store previous state before updating
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for (const [entityId, _entity] of Object.entries(entities)) {
              if (this.entityCache.has(entityId)) {
                this.previousEntityStates.set(
                  entityId,
                  this.entityCache.get(entityId),
                );
              }
            }

            // Update entity cache
            for (const [entityId, entity] of Object.entries(entities)) {
              this.entityCache.set(entityId, entity);
            }

            // Check for changes that match subscriptions and trigger callbacks
            this.processEntityChanges(entities);

            // Mark as changed
            this.lastEntityChanged = new Date();
          });

          return connection;
        } catch (error) {
          console.error(
            "Error connecting to Home Assistant WebSocket API:",
            error,
          );
          this.connectionPromise = null;
          this.isConnected = false;
          this.setupReconnect();
          throw error;
        }
      };

      connectToHass().then(resolve).catch(reject);
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
          console.error(
            "Error reconnecting to Home Assistant WebSocket API:",
            error,
          );
        }
      } else {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
    }, 10000); // Try every 10 seconds
  }

  /**
   * Subscribe to entity changes with enhanced options
   */
  async subscribeEntities(
    entityIds: string[],
    subscriptionId: string,
    filters?: SubscriptionFilter,
    expiresIn?: number,
    callbackId?: string,
  ): Promise<string> {
    try {
      // If we already have a subscription with this ID, unsubscribe it first
      if (this.subscriptions.has(subscriptionId)) {
        this.unsubscribeEntities(subscriptionId);
      }

      // Connect to WebSocket if not already connected
      const connection = await this.connect();

      // Create subscription for these entities
      const unsub = hassWs.subscribeEntities(connection, () => {
        // We handle the actual subscription logic in the global entity subscription handler
      });

      // Calculate expiration date if provided
      const expiresAt = expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : undefined;

      // Store subscription with enhanced options
      this.subscriptions.set(subscriptionId, {
        unsubscribe: unsub,
        entityIds,
        filters,
        lastChecked: new Date(),
        expiresAt,
        callbackId,
      });

      // Build response message
      let responseMsg = `Successfully subscribed to ${entityIds.length} entities with ID: ${subscriptionId}`;

      if (filters) {
        const filterDetails = [];
        if (filters.stateChange) filterDetails.push("state changes only");
        if (filters.attributeChanges?.length)
          filterDetails.push(
            `attribute changes for: ${filters.attributeChanges.join(", ")}`,
          );
        if (filters.minStateChangeAge)
          filterDetails.push(
            `min change age: ${filters.minStateChangeAge / 1000}s`,
          );

        if (filterDetails.length > 0) {
          responseMsg += ` (filtering by ${filterDetails.join(", ")})`;
        }
      }

      if (expiresAt) {
        responseMsg += `, expires at ${expiresAt.toISOString()}`;
      }

      if (callbackId) {
        responseMsg += `, with real-time notifications`;
      }

      return responseMsg;
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
   * Get recent entity changes with filtering options
   */
  getRecentChanges(
    subscriptionId?: string,
    entityIds?: string[],
    includeUnchanged: boolean = false,
  ): SimplifiedHassEntity[] {
    // If no changes since last check or no cache
    if (
      (!this.lastEntityChanged && !includeUnchanged) ||
      this.entityCache.size === 0
    ) {
      return [];
    }

    let entitiesToReturn: hassWs.HassEntity[] = [];

    // If subscription ID is provided, use that subscription's entity list
    if (subscriptionId) {
      const subscription = this.subscriptions.get(subscriptionId);
      if (!subscription) {
        return [];
      }

      // Mark this subscription as checked
      subscription.lastChecked = new Date();

      // Get the entities for this subscription
      entitiesToReturn = subscription.entityIds
        .filter((id) => this.entityCache.has(id))
        .map((id) => this.entityCache.get(id));
    }
    // If entity IDs provided, filter by those
    else if (entityIds && entityIds.length > 0) {
      entitiesToReturn = entityIds
        .filter((id) => this.entityCache.has(id))
        .map((id) => this.entityCache.get(id));
    }
    // Otherwise return all entities
    else {
      entitiesToReturn = Array.from(this.entityCache.values());
    }

    // Convert to simplified entities
    const entities = entitiesToReturn.map((entity) => {
      // Get previous state to check for changes
      const prevEntity = this.previousEntityStates.get(entity.entity_id);

      // Identify which attributes changed
      const changedAttributes: string[] = [];
      if (prevEntity) {
        for (const [attr, value] of Object.entries(entity.attributes)) {
          if (value !== prevEntity.attributes[attr]) {
            changedAttributes.push(attr);
          }
        }
      }

      // Convert entity to plain object that can be stringified
      return {
        entity_id: entity.entity_id,
        state: entity.state,
        attributes: entity.attributes,
        last_changed: entity.last_changed,
        last_updated: entity.last_updated,
        changed_attributes:
          changedAttributes.length > 0 ? changedAttributes : undefined,
      } as SimplifiedHassEntity;
    });

    // Skip clearing lastEntityChanged if we're including unchanged entities
    if (!includeUnchanged) {
      // Reset last changed timestamp only if we're not doing an includeUnchanged query
      this.lastEntityChanged = null;
    }

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

  /**
   * Check for and remove expired subscriptions
   */
  private checkExpiredSubscriptions() {
    const now = new Date();
    for (const [subId, subscription] of this.subscriptions.entries()) {
      if (subscription.expiresAt && now > subscription.expiresAt) {
        console.error(`Subscription ${subId} expired, removing`);
        this.unsubscribeEntities(subId);
      }
    }
  }

  /**
   * Process entity changes and trigger callbacks
   */
  private processEntityChanges(entities: Record<string, hassWs.HassEntity>) {
    // Group entities by subscription
    const subscriptionChanges: Map<string, SimplifiedHassEntity[]> = new Map();
    const callbackChanges: Map<string, SimplifiedHassEntity[]> = new Map();

    // Track changed entities for cache invalidation
    const changedEntityIds: string[] = [];

    // Process each subscription
    for (const [subId, subscription] of this.subscriptions.entries()) {
      const changedEntities: SimplifiedHassEntity[] = [];

      // Check each entity in the subscription
      for (const entityId of subscription.entityIds) {
        const entity = entities[entityId];
        if (!entity) continue;

        const prevEntity = this.previousEntityStates.get(entityId);

        // Skip if no previous state (first update)
        if (!prevEntity) continue;

        let shouldInclude = false;
        const changedAttributes: string[] = [];

        // Check if state changed and if we should filter on that
        const stateChanged = entity.state !== prevEntity.state;

        // Track changed entities for cache invalidation
        if (stateChanged || this.hasAttributeChanges(entity, prevEntity)) {
          if (!changedEntityIds.includes(entityId)) {
            changedEntityIds.push(entityId);
          }
        }

        // If filter specifies stateChange and state didn't change, skip
        if (subscription.filters?.stateChange === true && !stateChanged) {
          continue;
        }

        if (stateChanged) {
          shouldInclude = true;
        }

        // Check for attribute changes if we have attribute filters
        if (subscription.filters?.attributeChanges) {
          for (const attr of subscription.filters.attributeChanges) {
            // If attribute exists and is different from previous
            if (entity.attributes[attr] !== prevEntity.attributes[attr]) {
              shouldInclude = true;
              changedAttributes.push(attr);
            }
          }

          // If we have attribute filters but none matched, skip
          if (
            subscription.filters.attributeChanges.length > 0 &&
            changedAttributes.length === 0
          ) {
            shouldInclude = false;
          }
        }

        // Check for minimum state change age
        if (shouldInclude && subscription.filters?.minStateChangeAge) {
          const lastUpdated = new Date(entity.last_updated);
          const timeSinceChange = Date.now() - lastUpdated.getTime();

          if (timeSinceChange < subscription.filters.minStateChangeAge) {
            shouldInclude = false;
          }
        }

        if (shouldInclude) {
          // Create a simplified entity with changed attributes info
          const simplifiedEntity: SimplifiedHassEntity = {
            entity_id: entity.entity_id,
            state: entity.state,
            attributes: entity.attributes,
            last_changed: entity.last_changed,
            last_updated: entity.last_updated,
            changed_attributes:
              changedAttributes.length > 0 ? changedAttributes : undefined,
          };

          changedEntities.push(simplifiedEntity);
        }
      }

      if (changedEntities.length > 0) {
        // Update last checked time
        subscription.lastChecked = new Date();

        // Add to subscription changes for later retrieval
        subscriptionChanges.set(subId, changedEntities);

        // If this subscription has a callback ID, add to callback changes
        if (
          subscription.callbackId &&
          this.entityChangeCallbacks.has(subscription.callbackId)
        ) {
          if (!callbackChanges.has(subscription.callbackId)) {
            callbackChanges.set(subscription.callbackId, []);
          }
          callbackChanges.get(subscription.callbackId).push(...changedEntities);
        }
      }
    }

    // Trigger callbacks
    for (const [callbackId, entities] of callbackChanges.entries()) {
      const callback = this.entityChangeCallbacks.get(callbackId);
      if (callback) {
        callback(entities);
      }
    }

    // Invalidate cache for changed entities
    this.invalidateCacheForEntities(changedEntityIds);
  }

  /**
   * Check if any attributes have changed between two entity states
   */
  private hasAttributeChanges(
    newEntity: hassWs.HassEntity,
    prevEntity: hassWs.HassEntity,
  ): boolean {
    const newAttrs = newEntity.attributes || {};
    const prevAttrs = prevEntity.attributes || {};

    // Simple check: different number of attributes
    if (Object.keys(newAttrs).length !== Object.keys(prevAttrs).length) {
      return true;
    }

    // Check each attribute
    for (const [key, value] of Object.entries(newAttrs)) {
      if (JSON.stringify(value) !== JSON.stringify(prevAttrs[key])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Invalidate cache for changed entities
   */
  private invalidateCacheForEntities(entityIds: string[]): void {
    if (entityIds.length === 0) return;

    console.error(
      `Invalidating cache for ${entityIds.length} changed entities`,
    );

    // Invalidate individual entity caches
    for (const entityId of entityIds) {
      apiCache.handleEntityUpdate(entityId);
    }

    // If too many entities changed, consider invalidating all states
    if (entityIds.length > 10) {
      console.error("Many entities changed, invalidating all states");
      apiCache.invalidate("/states");
    }
  }
}
