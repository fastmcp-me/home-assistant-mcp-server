import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEntitiesTools } from "./entities.js";
import { registerHistoryTool } from "./history.js";
import { registerConfigTools } from "./config.js";
import { registerServiceTool } from "./service.js";
import { registerLightTools } from "./light.js";
import { registerLogTool } from "./log.js";
import { registerStatesTool } from "./states.js";
import { registerStateTool } from "./state.js";
import { registerDeviceTools } from "./device.js";
// Don't import the websocket tools here, they're registered separately

/**
 * Export all tools for use in API controller
 */
export {
  registerEntitiesTools,
  registerHistoryTool,
  registerServiceTool,
  registerLightTools,
  registerLogTool,
  registerConfigTools,
  registerStatesTool,
  registerStateTool,
  registerDeviceTools,
};

/**
 * Register all Home Assistant tools with the MCP server
 * @param server The MCP server to register the tools with
 */
export function registerHassTools(server: McpServer) {
  // Get environment variables for Home Assistant connection
  const hassUrl = process.env.HASS_URL || "";
  const hassToken = process.env.HASS_TOKEN || "";

  // Register entity tools
  registerEntitiesTools(server);

  // Register service tools
  registerServiceTool(server, hassUrl, hassToken);

  // Register configuration tools
  registerConfigTools(server);

  // Register history tools
  registerHistoryTool(server, hassUrl, hassToken);

  // Register light tools
  registerLightTools(server, hassUrl, hassToken);

  // Register log tools
  registerLogTool(server);

  // Register states tools
  registerStatesTool(server);

  // Register state tool
  registerStateTool(server);

  // Register device tools
  registerDeviceTools(server);

  console.error("🔨 Registered all Home Assistant tools");
}
