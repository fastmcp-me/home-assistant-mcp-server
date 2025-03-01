import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getHassClient, convertToHassEntities } from "../api/utils.js";
import { apiLogger } from "../logger.js";
import { entityTransformer } from "../transforms.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register the state tool with the MCP server
 * @param server The MCP server to register the tool with
 */
export function registerStateTool(server: McpServer) {
  // Get the HassClient instance
  const hassClient = getHassClient();

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
        const hassState = convertToHassEntities([state])[0];

        // Transform state if simplified flag is set
        if (params.simplified) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  entityTransformer.transform(hassState),
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(hassState, null, 2),
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
