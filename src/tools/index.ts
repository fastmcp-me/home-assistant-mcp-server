import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEntitiesTools } from "./entities.js";
import { registerHistoryTool } from "./history.js";
import { registerConfigTools } from "./config.js";
import { registerServiceTool } from "./service.js";
import { registerLightTools } from "./light.js";
import { registerLogTool } from "./log.js";
// Will uncomment when device.js is compiled
// import { registerDeviceTools } from "./device.js";
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
  // Will uncomment when device.js is compiled
  // registerDeviceTools,
};

/**
 * Register all Home Assistant tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerHassTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Register entity tools
  registerEntitiesTools(server, hassUrl, hassToken);

  // Register service tools
  registerServiceTool(server, hassUrl, hassToken);

  // Register configuration tools
  registerConfigTools(server, hassUrl, hassToken);

  // Register history tools
  registerHistoryTool(server, hassUrl, hassToken);

  // Register light tools
  registerLightTools(server, hassUrl, hassToken);

  // Register log tools
  registerLogTool(server, hassUrl, hassToken);

  // Will uncomment when device.js is compiled
  // Register device tools
  // registerDeviceTools(server, hassUrl, hassToken);

  console.error("🔨 Registered all Home Assistant tools");
}
