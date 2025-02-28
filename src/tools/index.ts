import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerEntityTools } from "./entity-tools.js";
import { registerHistoryTools } from "./history-tools.js";
import { registerConfigTools } from "./config-tools.js";
import { registerServiceTools } from "./service-tools.js";
import { registerLightTools } from "./light-tools.js";
import { registerLogTools } from "./log-tools.js";

/**
 * Registers all Home Assistant related tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerHassTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Register all tool categories
  registerEntityTools(server, hassUrl, hassToken);
  registerHistoryTools(server, hassUrl, hassToken);
  registerConfigTools(server, hassUrl, hassToken);
  registerServiceTools(server, hassUrl, hassToken);
  registerLightTools(server, hassUrl, hassToken);
  registerLogTools(server, hassUrl, hassToken);
}

// Re-export individual tool registration functions for more granular usage
export { registerEntityTools } from "./entity-tools.js";
export { registerHistoryTools } from "./history-tools.js";
export { registerConfigTools } from "./config-tools.js";
export { registerServiceTools } from "./service-tools.js";
export { registerLightTools } from "./light-tools.js";
export { registerLogTools } from "./log-tools.js";
