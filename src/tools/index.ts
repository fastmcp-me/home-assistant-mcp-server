import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEntitiesTools } from "./entities.js";
import { registerHistoryTool } from "./history.js";
import { registerConfigTools } from "./config.js";
import { registerServiceTool } from "./service.js";
import { registerServicesTool } from "./services.js";
import { registerLightTools } from "./light.js";
import { registerLightsTools } from "./lights.js";
import { registerLogsTools } from "./logs.js";
import { registerStatesTool } from "./states.js";
import { registerStateTool } from "./state.js";
import { registerDeviceTools } from "./device.js";
import { registerDomainsTools } from "./domains.js";
import { HassClient } from "../api/client.js";
import { initializeHassClient } from "../api/index.js";
// Don't import the websocket tools here, they're registered separately

/**
 * Export all tools for use in API controller
 */
export {
  registerEntitiesTools,
  registerHistoryTool,
  registerServiceTool,
  registerServicesTool,
  registerLightTools,
  registerLightsTools,
  registerLogsTools,
  registerConfigTools,
  registerStatesTool,
  registerStateTool,
  registerDeviceTools,
  registerDomainsTools,
};

/**
 * Register all Home Assistant tools with the MCP server
 * @param server The MCP server to register the tools with
 */
export function registerHassTools(server: McpServer) {
  // Get environment variables for Home Assistant connection
  // TODO: Handle errors better when undefined
  const hassUrl = process.env.HASS_URL ?? "<NOT SET>";
  const hassToken = process.env.HASS_TOKEN ?? "<NOT SET>";

  // Initialize the HassClient singleton
  initializeHassClient(hassUrl, hassToken);

  // Get the singleton instance
  const hassClient = HassClient.getInstance();

  // Register entity tools
  registerEntitiesTools(server, hassUrl, hassToken);

  // Register service tools
  registerServiceTool(server, hassUrl, hassToken);

  // Register services tool
  registerServicesTool(server, hassUrl, hassToken);

  // Register configuration tools
  registerConfigTools(server, hassClient);

  // Register domains tools
  registerDomainsTools(server);

  // Register history tools
  registerHistoryTool(server, hassUrl, hassToken);

  // Register light tools
  registerLightTools(server, hassUrl, hassToken);

  // Register lights tools
  registerLightsTools(server, hassUrl, hassToken);

  // Register logs tools
  registerLogsTools(server);

  // Register states tools
  registerStatesTool(server, hassUrl, hassToken);

  // Register state tool
  registerStateTool(server, hassUrl, hassToken);

  // Register device tools
  registerDeviceTools(server);

  console.error("🔨 Registered all Home Assistant tools");
}
