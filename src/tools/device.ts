import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getHassClient } from "../api/utils.js";
import { apiLogger } from "../logger.js";
import { handleToolError } from "./utils.js";

/**
 * Register device tools for MCP
 */
export function registerDeviceTools(server: McpServer): void {
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
        apiLogger.info("Getting devices");

        const client = getHassClient();
        // Get devices using the client API
        const response = await client.getDeviceRegistry();

        apiLogger.info(`Found ${response.length} devices`);
        return response;
      } catch (error) {
        return handleToolError("devices", error);
      }
    },
  );
}
