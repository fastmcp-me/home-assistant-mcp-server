import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getEntities, getStates } from "../api.js";
import { apiLogger } from "../logger.js";
import { entityTransformer } from "../transforms.js";
import { getStatesSchema } from "../types.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register entity-related tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerEntityTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get all entities tool
  server.tool(
    "get_entities",
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
        apiLogger.info("Executing get_entities tool", {
          domain: params.domain,
          simplified: params.simplified,
        });
        const entities = await getEntities(hassUrl, hassToken, params.domain);

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
        handleToolError("get_entities", error);
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
  server.tool(
    "get_states",
    "Get the current state of all (or specific) Home Assistant entities",
    getStatesSchema,
    async (params) => {
      try {
        apiLogger.info("Executing get_states tool", {
          entityId: params.entity_id,
          simplified: params.simplified,
        });
        const states = await getStates(hassUrl, hassToken, params.entity_id);

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
        handleToolError("get_states", error);
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
