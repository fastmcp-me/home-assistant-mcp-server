import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiLogger } from "../logger.js";
import type { HassClient } from "../api/client.js";

/**
 * Register light control prompt with the MCP server
 * @param server The MCP server to register the prompt with
 * @param hassClient The Home Assistant client
 */
export function registerLightControlPrompt(
  server: McpServer,
  hassClient: HassClient,
) {
  server.prompt(
    "light-control",
    "Control lights with natural language",
    [
      {
        name: "area",
        description: "The area or room where the light is located (e.g., living room, kitchen)",
        required: true,
      },
      {
        name: "action",
        description: "The action to perform (on, off, dim, brighten)",
        required: true,
      },
      {
        name: "brightness",
        description: "The brightness level (1-100) if setting brightness",
        required: false,
      },
    ],
    async (request) => {
      apiLogger.info("Processing light control prompt", {
        args: request.arguments,
      });

      // Get the arguments from the request with typesafe access
      const area = typeof request.arguments?.area === 'string' ? request.arguments.area : '';
      const action = typeof request.arguments?.action === 'string' ? request.arguments.action : '';
      const brightness = typeof request.arguments?.brightness === 'string' ?
        parseInt(request.arguments.brightness, 10) : undefined;

      // Form the user message based on arguments
      let userMessage = `I want to turn ${action} the lights`;
      if (area) {
        userMessage += ` in the ${area}`;
      }
      if (brightness && (action === "dim" || action === "brighten")) {
        userMessage += ` to ${brightness}% brightness`;
      }

      // Return a prompt message sequence that will help the model
      // know how to use the tools to control lights
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
              text: "I'll help you control your lights. Let me check what lights are available in that area.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: "Please use the tools-light-control tool to set the lights how I want them.",
            },
          },
        ],
      };
    },
  );
}
