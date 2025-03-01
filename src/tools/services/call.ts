import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// Use the HassClient instead of direct API calls
import { apiLogger } from "../../logger.js";
import { callServiceSchema } from "../../types/services/service.types.js";
import { handleToolError, formatErrorMessage } from "../utils.js";
import type { HassClient } from "../../api/client.js";

/**
 * Register service call tool with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassClient The HassClient instance
 */
export function registerServiceCallTool(server: McpServer, hassClient: HassClient) {
  // Service call tool
  server.tool(
    "tools-services-call",
    "Call a Home Assistant service",
    callServiceSchema,
    async (params) => {
      try {
        apiLogger.info("Executing service call tool", params);

        // Prepare target if provided
        const serviceData = { ...params.service_data };
        if (params.target) {
          // Add target to service data
          serviceData.target = params.target;
        }

        // Call the service using the client
        const result = await hassClient.callService(
          params.domain,
          params.service,
          serviceData,
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  result: result,
                  message: `Service ${params.domain}.${params.service} called successfully`,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        handleToolError("tools-services-call", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error calling service: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
