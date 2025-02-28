import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConfig, getAllDomains } from "../api.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register configuration-related tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerConfigTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get configuration tool
  server.tool(
    "get_config",
    "Get Home Assistant configuration",
    {},
    async () => {
      try {
        apiLogger.info("Executing get_config tool");
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
        handleToolError("get_config", error);
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
    "get_domains",
    "Get a list of all domains in Home Assistant",
    {},
    async () => {
      try {
        apiLogger.info("Executing get_domains tool");
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
        handleToolError("get_domains", error);
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
}
