import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { HassClient } from "../../api/client.js";
import { apiLogger } from "../../logger.js";
import { handleToolError, formatErrorMessage } from "../utils.js";

/**
 * Register the entity state tool with the MCP server
 * @param server The MCP server to register the tool with
 * @param client The Home Assistant client
 */
export function registerEntityStateTool(server: McpServer, client: HassClient) {
  server.tool(
    "tools-entities-state",
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
        apiLogger.info("Executing entity state tool", {
          entityId: params.entity_id,
          simplified: params.simplified,
        });

        // Use HassClient to get state
        const state = await client.getEntityState(params.entity_id);

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
        handleToolError("tools-entities-state", error);
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
