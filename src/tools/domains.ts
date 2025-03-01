import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getHassClient } from "../api/utils.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import { z } from "zod";

/**
 * Register domains tool for MCP
 */
export function registerDomainsTools(server: McpServer): void {
  // Get all domains
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
        apiLogger.info("Getting Home Assistant domains");

        const client = getHassClient();
        const states = await client.getAllStates();

        // Extract unique domains from entity IDs
        const domains = [
          ...new Set(
            states
              .map((state) => state.entity_id?.split(".")[0])
              .filter(Boolean),
          ),
        ].sort();

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
}
