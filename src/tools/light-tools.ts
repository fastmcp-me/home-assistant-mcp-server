import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getEntities, callService } from "../api.js";
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
function validateLightParameters(entity: HassLightEntity, params: any) {
  const supportedFeatures: number = entity.attributes.supported_features || 0;
  const supportedColorModes = entity.attributes.supported_color_modes || [];
  const errors = [];
  const warnings = [];
  let filteredParams = { ...params };

  // Check for brightness support
  if ((params.brightness !== undefined || params.brightness_pct !== undefined) &&
      !(supportedFeatures & SUPPORT_BRIGHTNESS) &&
      !supportedColorModes.includes("brightness")) {
    errors.push(`Light ${entity.entity_id} does not support brightness control`);
    delete filteredParams.brightness;
    delete filteredParams.brightness_pct;
  }

  // Check for color temperature support
  if (params.color_temp !== undefined &&
      !(supportedFeatures & SUPPORT_COLOR_TEMP) &&
      !supportedColorModes.includes("color_temp")) {
    errors.push(`Light ${entity.entity_id} does not support color temperature control`);
    delete filteredParams.color_temp;
  }

  // Check for color support (including various color parameters)
  const colorParams = ['rgb_color', 'hs_color', 'xy_color', 'rgbw_color', 'rgbww_color', 'color_name'];
  const hasColorParams = colorParams.some(param => params[param] !== undefined);

  if (hasColorParams &&
      !(supportedFeatures & SUPPORT_COLOR) &&
      !supportedColorModes.some(mode => ['rgb', 'rgbw', 'rgbww', 'hs', 'xy'].includes(mode))) {
    errors.push(`Light ${entity.entity_id} does not support color control`);
    colorParams.forEach(param => delete filteredParams[param]);
  } else {
    // Check specific color mode compatibility
    if (params.rgb_color !== undefined && !supportedColorModes.some(mode => ['rgb', 'rgbw', 'rgbww'].includes(mode))) {
      warnings.push(`RGB color may not be supported for ${entity.entity_id}`);
    }
    if (params.hs_color !== undefined && !supportedColorModes.includes('hs')) {
      warnings.push(`HS color may not be supported for ${entity.entity_id}`);
    }
    if (params.xy_color !== undefined && !supportedColorModes.includes('xy')) {
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
    if (!effectList.includes(params.effect)) {
      warnings.push(`Effect "${params.effect}" may not be supported for ${entity.entity_id}. Supported effects: ${effectList.join(', ')}`);
    }
  }

  // Check for flash support
  if (params.flash !== undefined && !(supportedFeatures & SUPPORT_FLASH)) {
    errors.push(`Light ${entity.entity_id} does not support flash`);
    delete filteredParams.flash;
  }

  // Check for transition support
  if (params.transition !== undefined && !(supportedFeatures & SUPPORT_TRANSITION)) {
    warnings.push(`Light ${entity.entity_id} may not support transition`);
    // Keep the transition parameter as it's harmless if not supported
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    filteredParams
  };
}

/**
 * Register light-related tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerLightTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Tool to manage lights (turn on/off, change brightness, color, etc.)
  server.tool(
    "manage_light",
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
        .describe("RGBWW color as [r, g, b, c_white, w_white] with values from 0-255"),
      hs_color: z
        .array(z.number())
        .length(2)
        .optional()
        .describe("Hue/Saturation color as [hue (0-360), saturation (0-100)]"),
      xy_color: z
        .array(z.number())
        .length(2)
        .optional()
        .describe("CIE xy color as [x (0-1), y (0-1)]"),
      color_temp: z
        .number()
        .optional()
        .describe("Color temperature in mireds"),
      kelvin: z
        .number()
        .optional()
        .describe("Color temperature in Kelvin"),
      effect: LightEffectsEnum
        .optional()
        .describe("Light effect to apply"),
      transition: z
        .number()
        .optional()
        .describe("Transition time in seconds"),
      flash: z
        .enum(["short", "long"])
        .optional()
        .describe("Flash effect (short or long)"),
      color_mode: ColorModeEnum
        .optional()
        .describe("Color mode to use"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing manage_light tool", {
          entity_id: params.entity_id,
          action: params.action,
          // Log other parameters as needed
        });

        // Get all light entities
        const entities = await getEntities(hassUrl, hassToken, "light");

        // Find the target light
        const targetLight = entities.find(
          (entity) => entity.entity_id === params.entity_id
        ) as HassLightEntity | undefined;

        if (!targetLight) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Light entity "${params.entity_id}" not found. Please check the entity ID and ensure it's a light.`,
              },
            ],
          };
        }

        // Validate parameters against the light's capabilities
        const { isValid, errors, warnings, filteredParams } = validateLightParameters(targetLight, params);

        // If there are validation errors, return them
        if (!isValid) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Cannot perform ${params.action} on ${params.entity_id} with the provided parameters:\n- ${errors.join('\n- ')}`,
              },
            ],
          };
        }

        // Log warnings but continue with filtered parameters
        if (warnings.length > 0) {
          apiLogger.warn("Light parameter warnings", {
            entity_id: params.entity_id,
            warnings,
          });
        }

        // Prepare service data by removing action and entity_id
        const { action, entity_id, ...serviceData } = filteredParams;

        // Call the appropriate service based on the action
        const domain = "light";
        const service = action;
        const target = { entity_id };

        // Log the exact service call being made
        apiLogger.info("Calling light service", {
          domain,
          service,
          target,
          serviceData,
        });

        const result = await callService(
          hassUrl,
          hassToken,
          domain,
          service,
          Object.keys(serviceData).length > 0 ? serviceData : undefined,
          target
        );

        // Get the updated state after the service call
        const updatedEntities = await getEntities(hassUrl, hassToken, "light");
        const updatedLight = updatedEntities.find(
          (entity) => entity.entity_id === params.entity_id
        );

        // Include any warnings in the success response
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                message: `Successfully performed ${action} on ${entity_id}`,
                warnings: warnings.length > 0 ? warnings : undefined,
                result,
                current_state: updatedLight
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        // Enhanced error handling with more context
        apiLogger.error("Error in manage_light tool", {
          entity_id: params.entity_id,
          action: params.action,
          error: error.message,
          stack: error.stack,
        });

        handleToolError("manage_light", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error controlling light ${params.entity_id} with action ${params.action}: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Tool to get light-specific information
  server.tool(
    "get_lights",
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
        apiLogger.info("Executing get_lights tool", {
          entity_id: params.entity_id,
          include_details: params.include_details,
        });

        // Get light entities
        const entities = await getEntities(hassUrl, hassToken, "light") as HassLightEntity[];

        // Filter by entity_id if provided
        const filteredEntities = params.entity_id
          ? entities.filter((entity) => entity.entity_id === params.entity_id)
          : entities;

        if (params.entity_id && filteredEntities.length === 0) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Light entity "${params.entity_id}" not found. Please check the entity ID.`,
              },
            ],
          };
        }

        // Extract useful light information
        const lightInfo = filteredEntities.map((entity) => {
          const baseInfo = {
            entity_id: entity.entity_id,
            friendly_name: entity.attributes.friendly_name || entity.entity_id.split('.')[1],
            state: entity.state,
            brightness: entity.attributes.brightness,
            color_mode: entity.attributes.color_mode,
          };

          if (params.include_details) {
            // Get human-readable supported features
            const supportedFeatures: number = entity.attributes.supported_features || 0;
            const featureNames = [];

            if (supportedFeatures & SUPPORT_BRIGHTNESS) featureNames.push("brightness");
            if (supportedFeatures & SUPPORT_COLOR_TEMP) featureNames.push("color_temperature");
            if (supportedFeatures & SUPPORT_COLOR) featureNames.push("color");
            if (supportedFeatures & SUPPORT_EFFECT) featureNames.push("effects");
            if (supportedFeatures & SUPPORT_FLASH) featureNames.push("flash");
            if (supportedFeatures & SUPPORT_TRANSITION) featureNames.push("transition");

            return {
              ...baseInfo,
              supported_color_modes: entity.attributes.supported_color_modes || [],
              supported_features: {
                raw: entity.attributes.supported_features || 0,
                names: featureNames,
              },
              min_mireds: entity.attributes.min_mireds,
              max_mireds: entity.attributes.max_mireds,
              effect_list: entity.attributes.effect_list || [],
              hs_color: entity.attributes.hs_color,
              rgb_color: entity.attributes.rgb_color,
              xy_color: entity.attributes.xy_color,
              color_temp: entity.attributes.color_temp,
              last_changed: entity.last_changed,
              last_updated: entity.last_updated,
            };
          }

          return baseInfo;
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(lightInfo, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("get_lights", error);
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
}
