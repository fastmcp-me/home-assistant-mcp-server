import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HassClient } from "../api/client.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import LightSchema from '../schemas/light.js';

/**
 * Register light-related tools with the MCP server
 * @param server The MCP server instance
 * @param client The Home Assistant client
 */
export function registerLightTools(server: McpServer, client: HassClient) {
  // Define the Zod schema for light control
  // Light control tool
  server.tool(
    "light",
    "Control Home Assistant lights including turning on/off, brightness, color, effects, etc.",
    LightSchema.shape,
    async (params) => {
        try {
          const response = await client.light(params, "turn_on");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response, null, 2),
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
