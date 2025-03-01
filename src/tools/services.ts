import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import type { HassClient } from "../api/client.js";

/**
 * Register services tool with the MCP server
 * @param server The MCP server to register the tools with
 */
export function registerServicesTool(
  server: McpServer,
  hassClient: HassClient,
) {
  server.tool(
    "services",
    "Get all available services in Home Assistant",
    {
      domain: z
        .string()
        .optional()
        .describe("Optional domain to filter services by"),
      simplified: z
        .boolean()
        .optional()
        .describe("Return simplified service data structure (recommended)"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing services tool", {
          domain: params.domain,
          simplified: params.simplified,
        });

        // Use the HassClient's getServices method instead of direct fetch
        const services = await hassClient.getServices(params.domain);

        // Return raw data without any transformations
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(services, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("services", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting services: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
