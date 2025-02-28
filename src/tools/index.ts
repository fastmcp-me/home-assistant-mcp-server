import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEntitiesTools } from "./entities.js";
import { registerHistoryTool } from "./history.js";
import { registerConfigTools } from "./config.js";
import { registerServiceTool } from "./service.js";
import { registerLightTools } from "./light.js";
import { registerLogTool } from "./log.js";
// Don't import the websocket tools here, they're registered separately

export {
  registerEntitiesTools,
  registerHistoryTool,
  registerConfigTools,
  registerServiceTool,
  registerLightTools,
  registerLogTool
};

/**
 * Register all Home Assistant tools with the MCP server
 * @param server The MCP server instance
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerHassTools(server: McpServer, hassUrl: string, hassToken: string) {
  // Register entity-related tools
  registerEntitiesTools(server, hassUrl, hassToken);

  // Register service-related tools
  registerServiceTool(server, hassUrl, hassToken);

  // Register history tools
  registerHistoryTool(server, hassUrl, hassToken);

  // Register configuration tools
  registerConfigTools(server, hassUrl, hassToken);

  // Register light tools
  registerLightTools(server, hassUrl, hassToken);

  // Register log tools
  registerLogTool(server, hassUrl, hassToken);

  console.log("🔨 Registered all Home Assistant tools");
}
