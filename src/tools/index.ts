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
 */
export function registerHassTools(server: McpServer) {
  // Register entity tools
  registerEntitiesTools(server);

  // Register service tools
  registerServiceTool(server);

  // Register configuration tools
  registerConfigTools(server);

  // Register history tools
  registerHistoryTool(server);

  // Register light tools
  registerLightTools(server);

  // Register log tools
  registerLogTool(server);

  // Will uncomment when device.js is compiled
  // Register device tools
  // registerDeviceTools(server);

  console.error("🔨 Registered all Home Assistant tools");
}
