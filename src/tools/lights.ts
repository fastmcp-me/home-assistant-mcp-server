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
        includeDetails: params.include_details
      });

      // Get states for all lights or specific light
      const filterEntityId = params.entity_id || "light.";
      const lights = await getStates(
        hassUrl,
        hassToken,
        filterEntityId
      );

      let result = Array.isArray(lights) ? lights : [lights];

      // Filter to only include lights
      result = result.filter(entity =>
        entity.entity_id.startsWith("light.")
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
      const enhancedLights = result.map(light => {
        // Get supported_features number
        const supportedFeatures = Number(light.attributes.supported_features) || 0;

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
        const supportedColorModes = light.attributes.supported_color_modes || [];

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
  }
);
