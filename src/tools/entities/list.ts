import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiLogger } from "../../logger.js";
import { handleToolError, formatErrorMessage } from "../utils.js";
import type { HassClient } from "../../api/client.js";

/**
 * Register entities list tool with the MCP server
 * @param server The MCP server to register the tools with
 */
export function registerEntitiesListTool(
  server: McpServer,
  hassClient: HassClient,
) {
  // Get all entities tool
  server.tool(
    "tools-entities-list",
    "Get a list of all Home Assistant entities",
    {
      simplified: z
        .boolean()
        .optional()
        .describe("Return simplified entity data structure (recommended)"),
      domain: z
        .string()
        .optional()
        .describe("Filter entities by domain (e.g. 'light', 'sensor')"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing entities list tool", {
          domain: params.domain,
          simplified: params.simplified,
        });

        // Use HassClient to get all states
        const allStates = await hassClient.getAllStates();

        // Filter by domain if provided but don't transform
        const filteredStates = params.domain
          ? allStates.filter(
              (entity) =>
                entity.entity_id &&
                entity.entity_id.startsWith(`${params.domain}.`),
            )
          : allStates;

        // Return raw data without any transformations
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(filteredStates, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("tools-entities-list", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting entities: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
