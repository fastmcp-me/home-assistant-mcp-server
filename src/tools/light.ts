import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { callService, getStates } from "../api.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register light-related tools with the MCP server
 * @param server The MCP server instance
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerLightTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get information about lights
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
        .optional()
        .default(true)
        .describe("Include detailed information about supported features"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing lights tool", {
          entityId: params.entity_id,
          includeDetails: params.include_details,
        });

        // Get states for all lights or specific light
        const filterEntityId = params.entity_id || "light.";
        const lights = await getStates(hassUrl, hassToken, filterEntityId);

        let result = Array.isArray(lights) ? lights : [lights];

        // Filter to only include lights
        result = result.filter((entity) =>
          entity.entity_id.startsWith("light."),
        );

        // If include_details is false, return simple list
        if (params.include_details === false) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        // Otherwise, enhance with feature information
        const enhancedLights = result.map((light) => {
          // Get supported_features number
          const supportedFeatures =
            Number(light.attributes["supported_features"]) || 0;

          // Determine supported features using boolean checks
          const features = {
            brightness: supportedFeatures >= 1,
            color_temp: supportedFeatures >= 2,
            effect: supportedFeatures >= 4,
            flash: supportedFeatures >= 8,
            color: supportedFeatures >= 16,
            transition: supportedFeatures >= 32,
          };

          // Get supported color modes
          const supportedColorModes =
            light.attributes["supported_color_modes"] || [];

          return {
            ...light,
            features,
            supported_color_modes: supportedColorModes,
          };
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(enhancedLights, null, 2),
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
              text: `Error getting lights: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Control lights
  server.tool(
    "light",
    "Control Home Assistant lights including turning on/off, brightness, color, effects, etc.",
    {
      entity_id: z
        .string()
        .describe("Light entity ID to control (e.g., 'light.living_room')"),
      action: z
        .enum(["turn_on", "turn_off", "toggle"])
        .describe("Action to perform on the light"),
      brightness: z
        .number()
        .min(0)
        .max(255)
        .optional()
        .describe("Brightness level (0-255, where 255 is maximum brightness)"),
      brightness_pct: z
        .number()
        .min(0)
        .max(100)
        .optional()
        .describe("Brightness percentage (0-100%)"),
      color_name: z
        .string()
        .optional()
        .describe("Named color (e.g., 'red', 'green', 'blue')"),
      rgb_color: z
        .array(z.number().min(0).max(255))
        .length(3)
        .optional()
        .describe("RGB color as [r, g, b] with values from 0-255"),
      rgbw_color: z
        .array(z.number().min(0).max(255))
        .length(4)
        .optional()
        .describe("RGBW color as [r, g, b, w] with values from 0-255"),
      rgbww_color: z
        .array(z.number().min(0).max(255))
        .length(5)
        .optional()
        .describe(
          "RGBWW color as [r, g, b, c_white, w_white] with values from 0-255",
        ),
      xy_color: z
        .array(z.number())
        .length(2)
        .optional()
        .describe("CIE xy color as [x (0-1), y (0-1)]"),
      hs_color: z
        .array(z.number())
        .length(2)
        .optional()
        .describe("Hue/Saturation color as [hue (0-360), saturation (0-100)]"),
      color_temp: z.number().optional().describe("Color temperature in mireds"),
      kelvin: z.number().optional().describe("Color temperature in Kelvin"),
      effect: z
        .enum([
          "none",
          "colorloop",
          "random",
          "bounce",
          "candle",
          "fireworks",
          "custom",
        ])
        .optional()
        .describe("Light effect to apply"),
      transition: z.number().optional().describe("Transition time in seconds"),
      flash: z
        .enum(["short", "long"])
        .optional()
        .describe("Flash effect (short or long)"),
      color_mode: z
        .enum([
          "color_temp",
          "hs",
          "rgb",
          "rgbw",
          "rgbww",
          "xy",
          "brightness",
          "onoff",
        ])
        .optional()
        .describe("Color mode to use"),
    },
    async (params) => {
      try {
        const { entity_id, action, ...serviceData } = params;
        apiLogger.info(`Executing light tool: ${action}`, {
          entityId: entity_id,
          serviceData,
        });

        // Determine service domain and service
        const domain = "light";
        const service = action;

        // Include entity_id in the service data instead of using target
        const enhancedServiceData = {
          ...serviceData,
          entity_id,
        };

        await callService(
          hassUrl,
          hassToken,
          domain,
          service,
          enhancedServiceData
        );

        // Get updated state after operation
        const updatedState = await getStates(hassUrl, hassToken, entity_id);

        return {
          content: [
            {
              type: "text",
              text: `Successfully executed ${action} on ${entity_id}. Updated state: ${JSON.stringify(updatedState, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        handleToolError("light", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error controlling light: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
