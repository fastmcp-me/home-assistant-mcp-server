import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { registerSampleLogsTool } from "./sample-logs.js";
import { registerStratifiedSampleTool } from "./stratified-sample.js";

/**
 * Registers all sampling-related tools
 */
export function registerSamplingTools(server: McpServer, client: LogzioClient) {
  // Register the sample logs tools
  registerSampleLogsTool(server, client);
  registerStratifiedSampleTool(server, client);
}
