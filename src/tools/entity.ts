import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getHassClient } from "../api/utils.js";
import { apiLogger } from "../logger.js";
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
          ? states.filter((state) =>
              state.entity_id?.startsWith(`${params.domain}.`),
            )
          : states;

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
          states = await client.getEntityState(params.entity_id);
        } else {
          // Get all entity states
          states = await client.getAllStates();
        }

        // Return raw data without any transformations
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
