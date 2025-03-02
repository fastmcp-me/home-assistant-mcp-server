import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HassClient } from "../../api/client.js";
import { apiLogger } from "../../logger.js";
import { renderTemplateSchema } from "../../types/schemas/schema.types.js";
import { handleToolError, formatErrorMessage } from "../utils.js";

/**
 * Register the template render tool with the MCP server
 * @param server The MCP server to register the tool with
 * @param hassClient The Home Assistant client
 */
export function registerTemplateRenderTool(
  server: McpServer,
  hassClient: HassClient,
) {
  server.tool(
    "tools-template-render",
    "Render a Home Assistant template string",
    renderTemplateSchema,
    async (params) => {
      try {
        apiLogger.warn("Executing template render tool", {
          template: params.template,
          simplified: params.simplified,
        });

        // Use HassClient to render the template
        const rendered = await hassClient.renderTemplate(params.template);

        // If simplified format is requested
        if (params.simplified) {
          return {
            content: [
              {
                type: "text",
                text: rendered,
              },
            ],
          };
        }

        // Return detailed format
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                template: params.template,
                rendered: rendered,
              }, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("tools-template-render", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error rendering template: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
