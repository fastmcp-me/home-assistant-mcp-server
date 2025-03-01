import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getServices, callService } from "../api.js";
import { apiLogger } from "../logger.js";
import { serviceTransformer } from "../transforms.js";
import { callServiceSchema } from "../types.js";
import { handleToolError, formatErrorMessage } from "./utils.js";

/**
 * Register service tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerServiceTool(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get all services tool
  server.tool(
    "services",
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
        apiLogger.info("Executing services tool", {
          domain: params.domain,
          simplified: params.simplified,
        });
        const services = await getServices(hassUrl, hassToken, params.domain);

        // Transform services if simplified flag is set
        if (params.simplified) {
          try {
            // Handle case where services might be in an unexpected format
            let transformedServices;
            if (typeof services === 'object' && services !== null) {
              // Attempt to transform expected nested services structure
              if (Object.keys(services).some(key => typeof services[key] === 'object')) {
                transformedServices = serviceTransformer.transformNestedServices(services);
              } else {
                // Create a fallback simplified representation
                transformedServices = Object.entries(services).map(([domain], index) => {
                  return {
                    id: `${index}.domain`,
                    name: domain,
                    requiredParams: [],
                    optionalParams: []
                  };
                });
              }
            } else {
              // If we can't parse the structure at all, return a simple error structure
              transformedServices = [{
                id: "error",
                name: "Error parsing services",
                description: "Unexpected service structure returned"
              }];
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(transformedServices, null, 2),
                },
              ],
            };
          } catch (transformError) {
            apiLogger.warn("Error transforming services", { error: transformError });
            // Return raw services as fallback
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(services, null, 2),
                },
              ],
            };
          }
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
        handleToolError("services", error);
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

  // Service tool
  server.tool(
    "service",
    "Call a Home Assistant service",
    callServiceSchema,
    async (params) => {
      try {
        apiLogger.info("Executing service tool", {
          domain: params.domain,
          service: params.service,
          hasTarget: !!params.target,
          hasServiceData: !!params.service_data,
        });

        // Create a proper target structure
        let target = params.target;
        if (!target && params.service_data && params.service_data.entity_id) {
          // If entity_id is in service_data, move it to target
          target = { entity_id: params.service_data.entity_id };
          // Destructure and omit entity_id from service_data
          const { entity_id: _, ...restServiceData } = params.service_data;
          params.service_data = restServiceData;
        }

        const result = await callService(
          hassUrl,
          hassToken,
          params.domain,
          params.service,
          params.service_data,
          target,
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
        handleToolError("service", error, {
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
