import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HassClient } from "../../api/client.js";
import { apiLogger } from "../../logger.js";
import { getStatesSchema } from "../../types.js";
import { handleToolError, formatErrorMessage } from "../utils.js";

/**
 * Register the entities states tool with the MCP server
 * @param server The MCP server to register the tool with
 * @param hassClient The Home Assistant client
 */
export function registerEntitiesStatesTool(server: McpServer, hassClient: HassClient) {
  server.tool(
    "tools-entities-states",
    "Get the current state of all (or specific) Home Assistant entities",
    getStatesSchema,
    async (params) => {
      try {
        apiLogger.info("Executing entities states tool", {
          entityId: params.entity_id,
          simplified: params.simplified,
        });

        // Use HassClient to get states
        if (params.entity_id) {
          const state = await hassClient.getEntityState(params.entity_id);
          // Transform state if simplified flag is set
          if (params.simplified) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(state, null, 2),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(state, null, 2),
              },
            ],
          };
        } else {
          // Get all states
          const states = await hassClient.getAllStates();
          // Transform states if simplified flag is set
          if (params.simplified) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(states, null, 2),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(states, null, 2),
              },
            ],
          };
        }
      } catch (error) {
        handleToolError("tools-entities-states", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting states: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
