import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { callService, getStates, getEntities } from "../api.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import { HassEntity } from "../types.js";

// Define a Light entity interface with properly typed attributes
interface HassLightEntity extends HassEntity {
  attributes: {
    friendly_name?: string;
    supported_features?: number;
    supported_color_modes?: string[];
    brightness?: number;
    color_mode?: string;
    min_mireds?: number;
    max_mireds?: number;
    effect_list?: string[];
    effect?: string;
    hs_color?: [number, number];
    rgb_color?: [number, number, number];
    xy_color?: [number, number];
    color_temp?: number;
    [key: string]: unknown;
  };
}

// Light effect enum based on common effect types
// Used for type safety in the tool schema
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const LightEffectsEnum = z.enum([
  "none",
  "colorloop",
  "random",
  "bounce",
  "candle",
  "fireworks",
  "custom",
]);

// Light color modes based on common types
// Used for type safety in the tool schema
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ColorModeEnum = z.enum([
  "color_temp",
  "hs",
  "rgb",
  "rgbw",
  "rgbww",
  "xy",
  "brightness",
  "onoff",
]);

// Bit flags for light features support
const SUPPORT_BRIGHTNESS = 1;
const SUPPORT_COLOR_TEMP = 2;
const SUPPORT_EFFECT = 4;
const SUPPORT_FLASH = 8;
const SUPPORT_COLOR = 16;
const SUPPORT_TRANSITION = 32;

/**
 * Check if parameters are compatible with a light's supported features and color modes
 * @param entity The light entity
 * @param params The parameters being sent
 * @returns Object with validation results
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function validateLightParameters(entity: HassLightEntity, params: Record<string, unknown>) {
  const supportedFeatures: number = entity.attributes.supported_features || 0;
  const supportedColorModes = entity.attributes.supported_color_modes || [];
  const errors = [];
  const warnings = [];
  const filteredParams = { ...params };

  // Check for brightness support
  if (
    (params.brightness !== undefined || params.brightness_pct !== undefined) &&
    !(supportedFeatures & SUPPORT_BRIGHTNESS) &&
    !supportedColorModes.includes("brightness")
  ) {
    errors.push(
      `Light ${entity.entity_id} does not support brightness control`,
    );
    delete filteredParams.brightness;
    delete filteredParams.brightness_pct;
  }

  // Check for color temperature support
  if (
    params.color_temp !== undefined &&
    !(supportedFeatures & SUPPORT_COLOR_TEMP) &&
    !supportedColorModes.includes("color_temp")
  ) {
    errors.push(
      `Light ${entity.entity_id} does not support color temperature control`,
    );
    delete filteredParams.color_temp;
  }

  // Check for color support (including various color parameters)
  const colorParams = [
    "rgb_color",
    "hs_color",
    "xy_color",
    "rgbw_color",
    "rgbww_color",
    "color_name",
  ];
  const hasColorParams = colorParams.some(
    (param) => params[param] !== undefined,
  );

  if (
    hasColorParams &&
    !(supportedFeatures & SUPPORT_COLOR) &&
    !supportedColorModes.some((mode) =>
      ["rgb", "rgbw", "rgbww", "hs", "xy"].includes(mode),
    )
  ) {
    errors.push(`Light ${entity.entity_id} does not support color control`);
    colorParams.forEach((param) => delete filteredParams[param]);
  } else {
    // Check specific color mode compatibility
    if (
      params.rgb_color !== undefined &&
      !supportedColorModes.some((mode) =>
        ["rgb", "rgbw", "rgbww"].includes(mode),
      )
    ) {
      warnings.push(`RGB color may not be supported for ${entity.entity_id}`);
    }
    if (params.hs_color !== undefined && !supportedColorModes.includes("hs")) {
      warnings.push(`HS color may not be supported for ${entity.entity_id}`);
    }
    if (params.xy_color !== undefined && !supportedColorModes.includes("xy")) {
      warnings.push(`XY color may not be supported for ${entity.entity_id}`);
    }
  }

  // Check for effect support
  if (params.effect !== undefined && !(supportedFeatures & SUPPORT_EFFECT)) {
    errors.push(`Light ${entity.entity_id} does not support effects`);
    delete filteredParams.effect;
  } else if (params.effect !== undefined) {
    // Verify the effect is in the list of supported effects
    const effectList = entity.attributes.effect_list || [];
    const effect = params.effect as string;
    if (!effectList.includes(effect)) {
      warnings.push(
        `Effect "${effect}" may not be supported for ${entity.entity_id}. Supported effects: ${effectList.join(", ")}`,
      );
    }
  }

  // Check for flash support
  if (params.flash !== undefined && !(supportedFeatures & SUPPORT_FLASH)) {
    errors.push(`Light ${entity.entity_id} does not support flash`);
    delete filteredParams.flash;
  }

  // Check for transition support
  if (
    params.transition !== undefined &&
    !(supportedFeatures & SUPPORT_TRANSITION)
  ) {
    warnings.push(`Light ${entity.entity_id} may not support transition`);
    // Keep the transition parameter as it's harmless if not supported
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    filteredParams,
  };
}

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
            Number(light.attributes.supported_features) || 0;

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
            light.attributes.supported_color_modes || [];

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

        // Prepare target
        const target = {
          entity_id,
        };

        await callService(
          hassUrl,
          hassToken,
          domain,
          service,
          serviceData,
          target,
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
