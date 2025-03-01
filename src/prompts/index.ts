import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLightControlPrompt } from "./light-control.js";
import { registerTempSetPrompt } from "./temperature-set.js";
import { registerPromptsList } from "./list.js";
import { registerPromptsGet } from "./get.js";
import { registerEntityHistoryPrompt } from "./entity-history.js";
import { registerMediaControlPrompt } from "./media-control.js";
import { registerEntitiesListPrompt } from "./entities-list.js";
import { registerServiceCallPrompt } from "./service-call.js";
import { HassClient } from "../api/client.js";
import { serverLogger } from "../logger.js";

/**
 * Export all prompts for use elsewhere
 */
export {
  registerLightControlPrompt,
  registerTempSetPrompt,
  registerPromptsList,
  registerPromptsGet,
  registerEntityHistoryPrompt,
  registerMediaControlPrompt,
  registerEntitiesListPrompt,
  registerServiceCallPrompt,
};

/**
 * Register all Home Assistant prompts with the MCP server
 * @param server The MCP server to register the prompts with
 */
export function registerHassPrompts(server: McpServer) {
  // Get environment variables for Home Assistant connection
  const hassUrl = process.env.HASS_URL ?? "<NOT SET>";
  const hassToken = process.env.HASS_TOKEN ?? "<NOT SET>";
  const hassClient = new HassClient(hassUrl, hassToken);

  // Register all prompts
  registerLightControlPrompt(server, hassClient);
  registerTempSetPrompt(server, hassClient);
  registerPromptsList(server, hassClient);
  registerPromptsGet(server, hassClient);
  registerEntityHistoryPrompt(server, hassClient);
  registerMediaControlPrompt(server, hassClient);
  registerEntitiesListPrompt(server, hassClient);
  registerServiceCallPrompt(server, hassClient);

  serverLogger.info("📝 Registered all Home Assistant prompts");
}
