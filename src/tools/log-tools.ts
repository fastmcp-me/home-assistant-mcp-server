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

        // Check if we received valid content - just verify it's a string
        // Home Assistant logs are plain text, not JSON
        if (typeof logContent !== 'string') {
          throw new Error('Received invalid log content format');
        }

        // Truncate if log is extremely long (> 100KB)
        const maxSize = 100 * 1024; // 100KB
        const truncatedContent = logContent.length > maxSize
          ? logContent.substring(0, maxSize) + '\n\n[Log truncated due to size...]'
          : logContent;

        apiLogger.debug(`Retrieved log content (${truncatedContent.length} bytes)`);

        // Return the log content as plain text
        return {
          content: [
            {
              type: "text",
              text: truncatedContent,
            },
          ],
        };
      } catch (error) {
        apiLogger.error(`Error retrieving error log: ${error}`);
        handleToolError("get_error_log", error);

        // Return a more helpful error message
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error retrieving error log: ${formatErrorMessage(error)}`,
            },
            {
              type: "text",
              text: "Unable to retrieve Home Assistant logs. This could be due to connectivity issues, authentication problems, or incorrect API endpoint configuration.",
            }
          ],
        };
      }
    },
  );
}
