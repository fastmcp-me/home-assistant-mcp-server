import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { registerLogResources } from "./log-resources.js";

/**
 * Register all resource implementations
 */
export function registerAllResources(server: McpServer, client: LogzioClient) {
  // Register log resources (service, error, timeframe, etc.)
  registerLogResources(server, client);
}
