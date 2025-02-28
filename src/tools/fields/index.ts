import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { registerGetFieldsTool } from "./get-fields.js";
import { registerFieldStatsTool } from "./field-stats.js";
import { registerDiscoverFieldsTool } from "./discover-fields.js";
import { registerFieldRelationsTool } from "./field-relations.js";
import { registerFieldValidationTool } from "./validate-fields.js";
import { registerSchemaDiscoveryTools } from "./schema-discovery.js";

/**
 * Registers all field-related tools
 */
export function registerFieldTools(server: McpServer, client: LogzioClient) {
  registerGetFieldsTool(server, client);
  registerFieldStatsTool(server, client);
  registerDiscoverFieldsTool(server, client);
  registerFieldRelationsTool(server, client);
  registerFieldValidationTool(server, client);
  registerSchemaDiscoveryTools(server, client);
}
