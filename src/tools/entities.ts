import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getHassClient, convertToHassEntities } from "../api/utils.js";
import { apiLogger } from "../logger.js";
import { entityTransformer } from "../transforms.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import type { HassEntity } from "../types.js";

/**
 * Register entity-related tools with the MCP server
 * @param server The MCP server to register the tools with
 */
export function registerEntitiesTools(server: McpServer) {
  // Get the HassClient instance
  const hassClient = getHassClient();

  // Get all entities tool
  server.tool(
    "entities",
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
        apiLogger.info("Executing entities tool", {
          domain: params.domain,
          simplified: params.simplified,
        });

        // Use HassClient to get all states
        const allStates = await hassClient.getAllStates();

        // Filter by domain if provided and convert to HassEntity
        const entities: HassEntity[] = params.domain
          ? convertToHassEntities(
              allStates.filter(
                (entity) =>
                  entity.entity_id &&
                  entity.entity_id.startsWith(`${params.domain}.`),
              ),
            )
          : convertToHassEntities(allStates);

        // Transform entities if simplified flag is set
        if (params.simplified) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  entityTransformer.transformAll(entities),
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(entities, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("entities", error);
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
