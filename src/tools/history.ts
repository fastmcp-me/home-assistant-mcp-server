import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getHistory } from "../api.js";
import { apiLogger } from "../logger.js";
import { getHistorySchema } from "../types.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import { HassError, HassErrorType } from "../utils.js";

/**
 * Register history-related tools with the MCP server
 * @param server The MCP server instance
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant authentication token
 */
export function registerHistoryTool(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  server.tool(
    "history",
    "Get historical state data for entities",
    getHistorySchema,
    async (params) => {
      try {
        apiLogger.info("Executing history tool", {
          entityId: params.entity_id,
          startTime: params.start_time,
          endTime: params.end_time,
          simplified: params.simplified,
        });

        try {
          const history = await getHistory(
            hassUrl,
            hassToken,
            params.entity_id || "",
            params.start_time,
            params.end_time,
            params.minimal_response,
            params.significant_changes_only,
          );

          // If history is empty or undefined, provide a user-friendly message
          if (!history || (Array.isArray(history) && history.length === 0)) {
            apiLogger.info("No history data found for entity", {
              entityId: params.entity_id,
            });

            const emptyResponse = {
              note: `No history data found for entity: ${params.entity_id || 'all entities'}`,
              entity_id: params.entity_id,
              states: []
            };

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(emptyResponse, null, 2),
                },
              ],
            };
          }

          // Transform if simplified flag is set
          if (params.simplified) {
            // Simplified format:
            // For each entity, return an array of {
            //   time: ISO string,
            //   state: state value,
            //   attributes: optional simplified attributes
            // }
            const simplified = history.map((entityHistory) => {
              if (!entityHistory || entityHistory.length === 0) return [];

              const entityId = entityHistory[0].entity_id;
              return {
                entity_id: entityId,
                states: entityHistory.map((state) => {
                  return {
                    time: state.last_updated,
                    state: state.state,
                    attributes: {
                      // Include only relevant attributes
                      friendly_name: state.attributes["friendly_name"],
                      icon: state.attributes["icon"],
                      unit_of_measurement:
                        state.attributes["unit_of_measurement"],
                    },
                  };
                }),
              };
            });

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(simplified, null, 2),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(history, null, 2),
              },
            ],
          };
        } catch (fetchError) {
          // If it's a resource not found error, provide fallback behavior
          if (
            fetchError instanceof HassError &&
            fetchError.type === HassErrorType.RESOURCE_NOT_FOUND
          ) {
            apiLogger.warn("History endpoint not available, providing empty results", {
              message: fetchError.message,
              entityId: params.entity_id,
            });

            // Return an empty history dataset with explanation
            const fallbackResponse = {
              note: "The history API endpoint is not available in this Home Assistant instance",
              reason: "The history component may not be enabled or is using a different endpoint structure",
              entity_id: params.entity_id,
              states: []
            };

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(fallbackResponse, null, 2),
                },
              ],
            };
          } else if (fetchError instanceof HassError) {
            // Handle other specific Hass errors with appropriate messages
            apiLogger.warn(`Home Assistant error when fetching history: ${fetchError.type}`, {
              message: fetchError.message,
              entityId: params.entity_id,
            });

            const errorResponse = {
              note: "Unable to retrieve history data",
              reason: fetchError.message,
              error_type: fetchError.type,
              entity_id: params.entity_id,
              states: []
            };

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(errorResponse, null, 2),
                },
              ],
            };
          }

          // For other errors, rethrow to be caught by the outer handler
          throw fetchError;
        }
      } catch (error) {
        handleToolError("history", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting history: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
