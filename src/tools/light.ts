import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { callService, getStates } from "../api.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import { HassError, HassErrorType } from "../utils.js";

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

        try {
          // Get all states and filter for light entities
          const allStates = await getStates(hassUrl, hassToken);

          // Ensure we have an array of states
          const statesArray = Array.isArray(allStates) ? allStates : [allStates];

          // Filter to only include light entities
          let lightEntities = statesArray.filter(entity =>
            entity.entity_id.startsWith("light.")
          );

          // Further filter by specific entity ID if provided
          if (params.entity_id) {
            lightEntities = lightEntities.filter(
              entity => entity.entity_id === params.entity_id
            );
          }

          // If no lights found or requested light doesn't exist
          if (lightEntities.length === 0) {
            if (params.entity_id) {
              // Get all available light entities for the error message
              const availableLights = statesArray
                .filter(entity => entity.entity_id.startsWith("light."))
                .map(entity => entity.entity_id);

              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      message: `Light entity '${params.entity_id}' not found.`,
                      available_lights: availableLights
                    }, null, 2),
                  },
                ],
              };
            } else {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      message: "No light entities found in your Home Assistant instance."
                    }, null, 2),
                  },
                ],
              };
            }
          }

          // If include_details is false, return simple list
          if (params.include_details === false) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(lightEntities, null, 2),
                },
              ],
            };
          }

          // Otherwise, enhance with feature information
          const enhancedLights = lightEntities.map((light) => {
            // Get supported_features number
            const supportedFeatures =
              Number(light.attributes["supported_features"]) || 0;

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
        } catch (fetchError) {
          // If it's a resource not found error, provide fallback behavior
          if (
            fetchError instanceof HassError &&
            fetchError.type === HassErrorType.RESOURCE_NOT_FOUND
          ) {
            apiLogger.warn("Lights endpoint not available, attempting to use entity_states", {
              message: fetchError.message,
              entityId: params.entity_id,
            });

            // Try to get specific light entity if requested
            if (params.entity_id) {
              try {
                const lightEntity = await getStates(hassUrl, hassToken, params.entity_id);

                if (lightEntity && typeof lightEntity === 'object' && 'entity_id' in lightEntity) {
                  // We got a valid entity, return it with enhanced features
                  const supportedFeatures =
                    Number(lightEntity.attributes["supported_features"]) || 0;

                  const features = {
                    brightness: (supportedFeatures & 1) !== 0,
                    color_temp: (supportedFeatures & 2) !== 0,
                    effect: (supportedFeatures & 4) !== 0,
                    flash: (supportedFeatures & 8) !== 0,
                    color: (supportedFeatures & 16) !== 0,
                    transition: (supportedFeatures & 32) !== 0,
                  };

                  const supportedColorModes =
                    lightEntity.attributes["supported_color_modes"] || [];

                  const enhancedLight = {
                    ...lightEntity,
                    features,
                    supported_color_modes: supportedColorModes,
                  };

                  return {
                    content: [
                      {
                        type: "text",
                        text: JSON.stringify([enhancedLight], null, 2),
                      },
                    ],
                  };
                }
              } catch (specificError) {
                // If we can't get the specific entity, continue to fallback
                apiLogger.warn("Failed to get specific light entity", {
                  entityId: params.entity_id,
                  error: specificError,
                });
              }
            }

            // Return a fallback response
            const fallbackResponse = {
              note: "Unable to retrieve light entities using the standard API",
              reason: "The lights API endpoint may not be available in this Home Assistant instance",
              suggestion: "Try using the 'entities' tool to list all entities and filter for lights manually",
              entity_id: params.entity_id,
            };

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(fallbackResponse, null, 2),
                },
              ],
            };
          }

          // For other errors, rethrow to be caught by the outer handler
          throw fetchError;
        }
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
