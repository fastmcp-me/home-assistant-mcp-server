import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HassClient } from "../api/client.js";
import { apiLogger } from "../logger.js";
import { entityTransformer } from "../transforms.js";
import { getStatesSchema } from "../types.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import type { HassEntity } from "../types.js";

/**
 * Register the states tool with the MCP server
 * @param server The MCP server to register the tool with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerStatesTool(
  server: McpServer,
  hassUrl: string,
  hassToken: string
) {
  // Create a new HassClient instance
  const hassClient = new HassClient(hassUrl, hassToken);

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

          // Convert HassState to HassEntity for transformer
          const hassEntity: HassEntity = {
            entity_id: state.entity_id || "",
            state: state.state || "",
            attributes: state.attributes || {},
            last_changed: state.last_changed || "",
            last_updated: state.last_updated || "",
          };

          // Transform state if simplified flag is set
          if (params.simplified) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    entityTransformer.transform(hassEntity),
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
                text: JSON.stringify(state, null, 2),
              },
            ],
          };
        } else {
          // Get all states
          const states = await hassClient.getAllStates();

          // Convert HassState[] to HassEntity[] for transformer
          const hassEntities: HassEntity[] = states.map(state => ({
            entity_id: state.entity_id || "",
            state: state.state || "",
            attributes: state.attributes || {},
            last_changed: state.last_changed || "",
            last_updated: state.last_updated || "",
          }));

          // Transform states if simplified flag is set
          if (params.simplified) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    entityTransformer.transformAll(hassEntities),
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
                text: JSON.stringify(states, null, 2),
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
