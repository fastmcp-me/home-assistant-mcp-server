import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getServices, callService, getDevices } from "../api.js";
import { apiLogger } from "../logger.js";
import { serviceTransformer } from "../transforms.js";
import { callServiceSchema } from "../types.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register service-related tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerServiceTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get all services tool
  server.tool(
    "get_services",
    "Get all available services in Home Assistant",
    {
      domain: z
        .string()
        .optional()
        .describe("Optional domain to filter services by"),
      simplified: z
        .boolean()
        .optional()
        .describe("Return simplified service data structure (recommended)"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing get_services tool", {
          domain: params.domain,
          simplified: params.simplified,
        });
        const services = await getServices(hassUrl, hassToken, params.domain);

        // Transform services if simplified flag is set
        if (params.simplified) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  serviceTransformer.transformNestedServices(services),
                  null,
                  2,
                ),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(services, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("get_services", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting services: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Get all devices tool
  server.tool(
    "get_devices",
    "Get all devices in Home Assistant",
    {},
    async () => {
      try {
        apiLogger.info("Executing get_devices tool");
        const devices = await getDevices(hassUrl, hassToken);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(devices, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("get_devices", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting devices: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Call service tool
  server.tool(
    "call_service",
    "Call a Home Assistant service",
    callServiceSchema,
    async (params) => {
      try {
        apiLogger.info("Executing call_service tool", {
          domain: params.domain,
          service: params.service,
          hasTarget: !!params.target,
          hasServiceData: !!params.service_data,
        });

        const result = await callService(
          hassUrl,
          hassToken,
          params.domain,
          params.service,
          params.service_data,
          params.target,
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("call_service", error, {
          domain: params.domain,
          service: params.service,
        });
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error calling service ${params.domain}.${params.service}: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );
}
