import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDevices } from "../api.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register device-related tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerDeviceTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get all devices tool
  server.tool(
    "devices",
    "Get all devices in Home Assistant",
    {
      random_string: z
        .string()
        .optional()
        .describe("Dummy parameter for no-parameter tools"),
    },
    async () => {
      try {
        apiLogger.info("Executing devices tool");

        // Get all devices from Home Assistant
        const devices = await getDevices(hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(devices, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("devices", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting devices: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
