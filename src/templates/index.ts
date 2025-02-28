import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerUriTemplates } from "./uriTemplates.js";
import { registerDynamicPrompts } from "./dynamicPrompts.js";
import { registerWorkflowPrompts } from "./workflowPrompts.js";

/**
 * Register all templates with the MCP server
 *
 * @param server The MCP server instance
 */
export function registerTemplates(server: McpServer) {
  // Register URI templates for accessing Logz.io resources
  registerUriTemplates(server);

  // Register dynamic prompt templates with embedded resource context
  registerDynamicPrompts(server);

  // Register multi-step workflow prompts for complex log analysis
  registerWorkflowPrompts(server);
}
