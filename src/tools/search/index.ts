import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { registerElasticsearchSearchTool } from "./elasticsearch-search.js";
import { registerSimpleSearchTool } from "./simple-search.js";
import { registerQuickSearchTool } from "./quick-search.js";

/**
 * Registers all search-related tools
 */
export function registerSearchTools(server: McpServer, client: LogzioClient) {
  registerElasticsearchSearchTool(server, client);
  registerSimpleSearchTool(server, client);
  registerQuickSearchTool(server, client);
}
