import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getHassClient, convertToHassEntities } from "../api/utils.js";
import { apiLogger } from "../logger.js";
import { entityTransformer } from "../transforms.js";
import { getStatesSchema } from "../types.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register entity tools for MCP
 */
export function registerEntityTools(server: McpServer): void {
  // Get all entities tool
  // TODO: Move to src/tools/entities.ts
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
        apiLogger.info("Getting entities", {
          domain: params.domain,
          simplified: params.simplified,
        });

        const client = getHassClient();
        const states = await client.getAllStates();

        // Filter by domain if specified
        const filteredStates = params.domain
          ? states.filter(state => state.entity_id?.startsWith(`${params.domain}.`))
          : states;

        // Convert to HassEntities for compatibility with existing code
        const entities = convertToHassEntities(filteredStates);

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
        handleToolError("mcp__entities", error);
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

  // Get entity states tool
  // TODO: Move to src/tools/states.ts
  server.tool(
    "states",
    "Get the current state of all (or specific) Home Assistant entities",
    getStatesSchema,
    async (params) => {
      try {
        apiLogger.info("Getting states", {
          entityId: params.entity_id,
          simplified: params.simplified,
        });

        const client = getHassClient();
        let states;

        if (params.entity_id) {
          // Get a specific entity state
          const state = await client.getEntityState(params.entity_id);
          states = convertToHassEntities([state])[0];
        } else {
          // Get all entity states
          const allStates = await client.getAllStates();
          states = convertToHassEntities(allStates);
        }

        // Transform states if simplified flag is set
        if (params.simplified) {
          if (Array.isArray(states)) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    entityTransformer.transformAll(states),
                    null,
                    2,
                  ),
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    entityTransformer.transform(states),
                    null,
                    2,
                  ),
                },
              ],
            };
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(states, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("mcp__states", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting states: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
