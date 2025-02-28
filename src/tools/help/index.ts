import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LogzioClient } from "../../api/logzio.js";
import { registerHelpCommands } from "./help-commands.js";
import { registerContextualHelp } from "./contextual-help.js";
import { registerQueryHelper } from "./query-helper.js";
import { registerHelpExamples } from "./help-examples.js";

/**
 * Registers all help and documentation tools
 */
export function registerHelpTools(server: McpServer, client: LogzioClient) {
  registerHelpCommands(server, client);
  registerContextualHelp(server, client);
  registerQueryHelper(server, client);
  registerHelpExamples(server, client);
}
