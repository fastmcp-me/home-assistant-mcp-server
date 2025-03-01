import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { HassClient } from "../api/client.js";
import { initializeHassClient } from "../api/index.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register the state tool with the MCP server
 * @param server The MCP server to register the tool with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerStateTool(
  server: McpServer,
  hassUrl: string,
  hassToken: string
) {
  // Initialize the HassClient singleton if not already initialized
  initializeHassClient(hassUrl, hassToken);

  // Get the singleton instance
  const hassClient = HassClient.getInstance();

  // Get entity state tool
  server.tool(
    "state",
    "Get the current state of a specific Home Assistant entity",
    {
      entity_id: z
        .string()
        .describe("Entity ID to get the state for (e.g., 'light.living_room')"),
      simplified: z
        .boolean()
        .optional()
        .describe("Return simplified entity data structure"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing state tool", {
          entityId: params.entity_id,
          simplified: params.simplified,
        });

        // Use HassClient to get state
        const state = await hassClient.getEntityState(params.entity_id);

        // Return raw data without any transformations
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(state, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("state", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting state: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
