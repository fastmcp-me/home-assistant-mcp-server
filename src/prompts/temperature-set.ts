import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiLogger } from "../logger.js";
import type { HassClient } from "../api/client.js";

/**
 * Register temperature setting prompt with the MCP server
 * @param server The MCP server to register the prompt with
 * @param hassClient The Home Assistant client
 */
export function registerTempSetPrompt(
  server: McpServer,
  hassClient: HassClient,
) {
  server.prompt(
    "temperature-set",
    "Set the temperature for a climate device",
    [
      {
        name: "area",
        description: "The area where the climate device is located (e.g., living room, bedroom)",
        required: true,
      },
      {
        name: "temperature",
        description: "The temperature to set (in degrees)",
        required: true,
      },
      {
        name: "mode",
        description: "The optional climate mode to set (cool, heat, auto, off)",
        required: false,
      },
    ],
    async (request) => {
      apiLogger.info("Processing temperature set prompt", {
        args: request.arguments,
      });

      // Get the arguments from the request with typesafe access
      const area = typeof request.arguments?.area === 'string' ? request.arguments.area : '';
      const temperature = typeof request.arguments?.temperature === 'string' ?
        parseFloat(request.arguments.temperature) : 0;
      const mode = typeof request.arguments?.mode === 'string' ? request.arguments.mode : undefined;

      // Form the user message
      let userMessage = `I want to set the temperature to ${temperature} degrees`;
      if (area) {
        userMessage += ` in the ${area}`;
      }
      if (mode) {
        userMessage += ` and set the mode to ${mode}`;
      }

      // Return a prompt message sequence
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: userMessage,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll help you set the temperature. Let me check what climate devices are available.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: "Please use the service-call tool with the climate domain to set the temperature how I want it.",
            },
          },
        ],
      };
    },
  );
}
