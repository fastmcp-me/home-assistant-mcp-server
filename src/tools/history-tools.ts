import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getHistory } from "../api.js";
import { apiLogger } from "../logger.js";
import { entityTransformer } from "../transforms.js";
import { getHistorySchema } from "../types.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register history-related tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerHistoryTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get history tool
  server.tool(
    "get_history",
    "Get historical state data for entities",
    getHistorySchema,
    async (params) => {
      try {
        apiLogger.info("Executing get_history tool", {
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

        // Transform history if simplified flag is set
        if (params.simplified && Array.isArray(history) && history.length > 0) {
          const transformedHistory = history.map((entityHistory) => {
            if (Array.isArray(entityHistory)) {
              return entityHistory.map((state) =>
                entityTransformer.transform(state),
              );
            }
            return entityHistory;
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(transformedHistory, null, 2),
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
        handleToolError("get_history", error);
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
