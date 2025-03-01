import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { HassClient } from "../api/client.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register lights tools for MCP
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerLightsTools(
  server: McpServer,
  hassClient: HassClient,
) {

  server.tool(
    "lights",
    "Get information about Home Assistant lights",
    {
      entity_id: z
        .string()
        .optional()
        .describe("Optional light entity ID to filter results"),
      include_details: z
        .boolean()
        .default(true)
        .describe("Include detailed information about supported features"),
    },
    async (params) => {
      try {
        apiLogger.info("Getting lights information", {
          entityId: params.entity_id,
          includeDetails: params.include_details,
        });

        // Get all states
        const states = await hassClient.getAllStates();

        // Filter for light entities
        const lightStates = states.filter((state) =>
          state.entity_id?.startsWith("light."),
        );

        // Further filter by entity_id if provided
        const filteredLights = params.entity_id
          ? lightStates.filter(
              (state) => state.entity_id === params.entity_id,
            )
          : lightStates;

        // Return raw data without any transformations
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(filteredLights, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("lights", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting lights information: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
