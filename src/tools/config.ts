import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConfig, getAllDomains } from "../api.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import { z } from "zod";

/**
 * Register configuration-related tools with the MCP server
 * @param server The MCP server instance
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerConfigTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get Home Assistant configuration tool
  server.tool(
    "config",
    "Get Home Assistant configuration",
    {
      random_string: z
        .string()
        .optional()
        .describe("Dummy parameter for no-parameter tools"),
    },
    async () => {
      try {
        apiLogger.info("Executing config tool");
        const config = await getConfig(hassUrl, hassToken);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(config, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("config", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting configuration: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Get all domains tool
  server.tool(
    "domains",
    "Get a list of all domains in Home Assistant",
    {
      random_string: z
        .string()
        .optional()
        .describe("Dummy parameter for no-parameter tools"),
    },
    async () => {
      try {
        apiLogger.info("Executing domains tool");
        const domains = await getAllDomains(hassUrl, hassToken);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(domains, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("domains", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting domains: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Note: The "devices" tool has been removed from here as it's already defined in service.ts
}
