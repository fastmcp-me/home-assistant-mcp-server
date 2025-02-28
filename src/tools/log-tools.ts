import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getErrorLog } from "../api.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register log-related tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerLogTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get error log tool
  server.tool(
    "get_error_log",
    "Get Home Assistant error log",
    {},
    async () => {
      try {
        apiLogger.info("Executing get_error_log tool");
        const logContent = await getErrorLog(hassUrl, hassToken);

        // Return the log content as plain text
        return {
          content: [
            {
              type: "text",
              text: logContent,
            },
          ],
        };
      } catch (error) {
        handleToolError("get_error_log", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error retrieving error log: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
