import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
// Use the HassClient instead of direct API calls
import { getHassClient } from "../api/utils.js";
import { apiLogger } from "../logger.js";
import { serviceTransformer } from "../transforms.js";
import { callServiceSchema } from "../types.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
// Import the HassServices type
import type { HassServices } from "../api/utils.js";
import type { HassService } from "../types.js";

/**
 * Adapter function to convert HassServices to the format expected by transformNestedServices
 * @param services The HassServices object from the client
 * @returns A compatible format for the transformer
 */
function adaptServicesForTransformer(services: HassServices): Record<string, Record<string, HassService>> {
  const result: Record<string, Record<string, HassService>> = {};

  // Convert each domain
  Object.entries(services).forEach(([domain, domainServices]) => {
    result[domain] = {};

    // Convert each service in the domain
    Object.entries(domainServices).forEach(([serviceId, serviceDetail]) => {
      result[domain][serviceId] = {
        domain,
        service: serviceId,
        services: [serviceId],
        description: serviceDetail.description,
        fields: serviceDetail.fields,
        target: serviceDetail.target
      };
    });
  });

  return result;
}

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
  // Get the HassClient instance
  const hassClient = getHassClient(hassUrl, hassToken);

  // Get all services tool
  // TODO: Move to src/tools/services.ts
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

        // Use the HassClient's getServices method instead of direct fetch
        const services = await hassClient.getServices(params.domain);

        // Filter by domain if provided - this is now handled by the client method

        // Transform services if simplified flag is set
        if (params.simplified) {
          try {
            // Handle case where services might be in an unexpected format
            let transformedServices;
            if (
              typeof services === "object" &&
              services !== null
            ) {
              // Attempt to transform expected nested services structure
              if (
                Object.keys(services).some(
                  (domain) =>
                    typeof services[domain] === "object" &&
                    services[domain] !== null,
                )
              ) {
                // Use the adapter function to convert the services to the expected format
                const adaptedServices = adaptServicesForTransformer(services);
                // Use the transformNestedServices method which is designed for the nested structure
                transformedServices =
                  serviceTransformer.transformNestedServices(adaptedServices);
              } else {
                // Handle unexpected format gracefully
                transformedServices = services;
              }
            } else {
              // Fallback for any other format
              transformedServices = services;
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
            // Fall back to returning raw services if transformation fails
            apiLogger.error(
              "Error transforming services",
              { error: transformError },
              transformError instanceof Error
                ? transformError
                : new Error(String(transformError)),
            );
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

  // Service call tool
  server.tool(
    "service",
    "Call a Home Assistant service",
    callServiceSchema,
    async (params) => {
      try {
        apiLogger.info("Executing service tool", params);

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
        handleToolError("service", error);
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
