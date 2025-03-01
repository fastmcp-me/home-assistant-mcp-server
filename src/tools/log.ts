import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getErrorLog } from "../api.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register log-related tools with the MCP server
 * @param server The MCP server instance
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerLogTool(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get error log tool
  server.tool(
    "error_log",
    "Get Home Assistant error log",
    {
      random_string: z
        .string()
        .optional()
        .describe("Dummy parameter for no-parameter tools"),
      limit: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Maximum number of log lines to return"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing error_log tool", {
          limit: params.limit,
        });
        const logData = await getErrorLog(hassUrl, hassToken, params.limit);
        return {
          content: [
            {
              type: "text",
              text: logData,
            },
          ],
        };
      } catch (error) {
        handleToolError("error_log", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting error log: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
