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
  const hassClient = new HassClient(hassUrl, hassToken);

  // Register entity tools - expects HassClient
  registerEntitiesTools(server, hassClient);

  // Register service tools - expects HassClient
  registerServiceTool(server, hassClient);

  // Register services tool - expects HassClient
  registerServicesTool(server, hassClient);

  // Register configuration tools - expects HassClient
  registerConfigTools(server, hassClient);

  // Register domains tools - expects just server
  registerDomainsTools(server, hassClient);

  // Register history tools - expects HassClient
  registerHistoryTool(server, hassClient);

  // Register light tools - expects HassClient
  registerLightTools(server, hassClient);

  // Register lights tools - expects HassClient
  registerLightsTools(server, hassClient);

  // Register logs tools - expects HassClient
  registerLogsTools(server, hassClient);

  // Register states tools - expects HassClient
  registerStatesTool(server, hassClient);

  // Register state tool - expects HassClient
  registerStateTool(server, hassClient);

  // Register device tools - expects just server
  registerDeviceTools(server, hassClient);

  console.error("🔨 Registered all Home Assistant tools");
}
