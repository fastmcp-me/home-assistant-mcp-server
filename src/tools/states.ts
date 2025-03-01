import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getHassClient, convertToHassEntities } from "../api/utils.js";
import { apiLogger } from "../logger.js";
import { entityTransformer } from "../transforms.js";
import { getStatesSchema } from "../types.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register the states tool with the MCP server
 * @param server The MCP server to register the tool with
 */
export function registerStatesTool(server: McpServer) {
  // Get the HassClient instance
  const hassClient = getHassClient();

  // Get entity states tool
  server.tool(
    "states",
    "Get the current state of all (or specific) Home Assistant entities",
    getStatesSchema,
    async (params) => {
      try {
        apiLogger.info("Executing states tool", {
          entityId: params.entity_id,
          simplified: params.simplified,
        });

        // Use HassClient to get states
        if (params.entity_id) {
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
        } else {
          // Get all states
          const states = await hassClient.getAllStates();
          const hassStates = convertToHassEntities(states);

          // Transform states if simplified flag is set
          if (params.simplified) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    entityTransformer.transformAll(hassStates),
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
                text: JSON.stringify(hassStates, null, 2),
              },
            ],
          };
        }
      } catch (error) {
        handleToolError("states", error);
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
