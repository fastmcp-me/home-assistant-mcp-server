import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { HassClient } from "../api/client.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import type { IntegrationLight } from "../types/integration-light.js";

/**
 * Register lights tools for MCP
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerLightsTools(server: McpServer, hassClient: HassClient) {
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
          ? lightStates.filter((state) => state.entity_id === params.entity_id)
          : lightStates;

        // Process lights to match IntegrationLight structure if include_details is true
        const processedLights = params.include_details
          ? enhanceLightsWithIntegrationDetails(filteredLights)
          : filteredLights;

        // Return raw data without any transformations
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(processedLights, null, 2),
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

/**
 * Enhance light entities with additional details based on IntegrationLight structure
 * @param lights Array of light entities
 * @returns Enhanced light entities with IntegrationLight compatible structure
 */
function enhanceLightsWithIntegrationDetails(lights: any[]): any[] {
  return lights.map((light) => {
    // Get supported_features number
    const supportedFeatures =
      Number(light.attributes?.["supported_features"]) || 0;

    // Determine supported features using bitwise operations
    const features = {
      brightness: (supportedFeatures & 1) !== 0,
      color_temp: (supportedFeatures & 2) !== 0,
      effect: (supportedFeatures & 4) !== 0,
      flash: (supportedFeatures & 8) !== 0,
      color: (supportedFeatures & 16) !== 0,
      transition: (supportedFeatures & 32) !== 0,
    };

    // Get supported color modes
    const supportedColorModes =
      light.attributes?.["supported_color_modes"] || [];

    // Extract platform information if available
    const platform = light.attributes?.["platform"] || "unknown";

    // Create a structure that aligns with IntegrationLight type
    return {
      ...light,
      features,
      supported_color_modes: supportedColorModes,
      integration_details: {
        platform,
        // Add other IntegrationLight specific properties as needed
      }
    };
  });
}
