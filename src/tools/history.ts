import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getHistory } from "../api.js";
import { apiLogger } from "../logger.js";
import { getHistorySchema } from "../types.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

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

        const history = await getHistory(
          hassUrl,
          hassToken,
          params.entity_id,
          params.start_time,
          params.end_time,
          params.minimal_response,
          params.significant_changes_only,
        );

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
                    friendly_name: state.attributes.friendly_name,
                    icon: state.attributes.icon,
                    unit_of_measurement: state.attributes.unit_of_measurement,
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
