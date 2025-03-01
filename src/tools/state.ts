import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { HassClient } from "../api/client.js";
import { apiLogger } from "../logger.js";
import { entityTransformer } from "../transforms.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import type { HassState } from "../types/types.js";
import type { HassEntity } from "../types.js";

/**
 * Register the state tool with the MCP server
 * @param server The MCP server to register the tool with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerStateTool(
  server: McpServer,
  hassUrl: string,
  hassToken: string
) {
  // Create a new HassClient instance
  const hassClient = new HassClient(hassUrl, hassToken);

  // Get entity state tool
  server.tool(
    "state",
    "Get the current state of a specific Home Assistant entity",
    {
      entity_id: z
        .string()
        .describe("Entity ID to get the state for (e.g., 'light.living_room')"),
      simplified: z
        .boolean()
        .optional()
        .describe("Return simplified entity data structure"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing state tool", {
          entityId: params.entity_id,
          simplified: params.simplified,
        });

        // Use HassClient to get state
        const state = await hassClient.getEntityState(params.entity_id);

        // Convert HassState to HassEntity for transformer
        const hassEntity: HassEntity = {
          entity_id: state.entity_id || "",
          state: state.state || "",
          attributes: state.attributes || {},
          last_changed: state.last_changed || "",
          last_updated: state.last_updated || "",
        };

        // Transform state if simplified flag is set
        if (params.simplified) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  entityTransformer.transform(hassEntity),
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
              text: JSON.stringify(state, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("state", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting state: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
