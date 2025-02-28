import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiLogger } from "../logger.js";
import { HassWebSocket } from "../websocket.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register WebSocket/subscription-related tools with the MCP server
 * @param server The MCP server instance
 * @param websocket The HassWebSocket instance
 */
export function registerWebSocketTools(
  server: McpServer,
  websocket: HassWebSocket
) {
  // Subscribe to entity state changes
  server.tool(
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
        .describe("Unique identifier for this subscription for later reference"),
      callback_id: z
        .string()
        .optional()
        .describe("Optional callback ID for real-time notifications"),
      expires_in: z
        .number()
        .optional()
        .describe("Optional expiration time in seconds for this subscription"),
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
    },
    async (params) => {
      try {
        apiLogger.info("Executing subscribe_entities tool", {
          entityIds: params.entity_ids,
          subscriptionId: params.subscription_id,
        });

        const result = await websocket.subscribeEntities(
          params.entity_ids,
          params.subscription_id,
          params.filters,
          params.expires_in,
          params.callback_id
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Successfully subscribed to updates for ${params.entity_ids.length} entities`,
                  subscription_id: params.subscription_id,
                  entity_ids: params.entity_ids,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        handleToolError("subscribe_entities", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error subscribing to entities: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Get recent entity state changes
  server.tool(
    "recent_changes",
    "Get recent entity state changes with advanced filtering",
    {
      entity_ids: z
        .array(z.string())
        .optional()
        .describe("Optional array of entity IDs to filter changes"),
      subscription_id: z
        .string()
        .optional()
        .describe("Optional subscription ID to get changes only for that subscription"),
      include_unchanged: z
        .boolean()
        .optional()
        .describe("Include entities that haven't changed since last check"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing recent_changes tool", {
          entityIds: params.entity_ids,
          subscriptionId: params.subscription_id,
          includeUnchanged: params.include_unchanged,
        });

        const response = await server.callTool("mcp__get_recent_changes", {
          entity_ids: params.entity_ids,
          subscription_id: params.subscription_id,
          include_unchanged: params.include_unchanged,
        });

        return response;
      } catch (error) {
        handleToolError("recent_changes", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting entity changes: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Register callback for real-time notifications
  server.tool(
    "register_callback",
    "Register a callback for real-time entity state change notifications",
    {
      callback_id: z
        .string()
        .describe("Unique identifier for this callback"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing register_callback tool", {
          callbackId: params.callback_id,
        });

        const response = await server.callTool("mcp__register_callback", {
          callback_id: params.callback_id,
        });

        return response;
      } catch (error) {
        handleToolError("register_callback", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error registering callback: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Unregister callback for real-time notifications
  server.tool(
    "unregister_callback",
    "Unregister a callback for real-time notifications",
    {
      callback_id: z
        .string()
        .describe("The ID of the callback to remove"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing unregister_callback tool", {
          callbackId: params.callback_id,
        });

        const response = await server.callTool("mcp__unregister_callback", {
          callback_id: params.callback_id,
        });

        return response;
      } catch (error) {
        handleToolError("unregister_callback", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error unregistering callback: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // List all subscriptions
  server.tool(
    "subscriptions",
    "List all active entity subscriptions",
    {
      random_string: z
        .string()
        .optional()
        .describe("Dummy parameter for no-parameter tools"),
    },
    async () => {
      try {
        apiLogger.info("Executing subscriptions tool");

        const response = await server.callTool("mcp__list_subscriptions", {});

        return response;
      } catch (error) {
        handleToolError("subscriptions", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing subscriptions: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Unsubscribe from entity state changes
  server.tool(
    "unsubscribe_entities",
    "Unsubscribe from entity state changes",
    {
      subscription_id: z
        .string()
        .describe("The ID of the subscription to cancel"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing unsubscribe_entities tool", {
          subscriptionId: params.subscription_id,
        });

        const result = websocket.unsubscribeEntities(params.subscription_id);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: `Successfully unsubscribed from subscription with ID: ${params.subscription_id}`,
                  subscription_id: params.subscription_id,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        handleToolError("unsubscribe_entities", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error unsubscribing from entities: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
