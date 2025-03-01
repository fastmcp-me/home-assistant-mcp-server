import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
// Use the HassClient instead of direct API calls
import { getHassClient } from "../api/utils.js";
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

        // Call the client instead of direct API
        // HassClient doesn't have getServices(), we need to adapt to this client's API
        // We'll use makeRequest directly

        // Create a direct request for /services
        const response = await fetch(`${hassUrl}/api/services`, {
          headers: {
            Authorization: `Bearer ${hassToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to get services: ${response.status} ${response.statusText}`);
        }

        const services = await response.json();

        // Filter by domain if provided
        const filteredServices = params.domain
          ? { [params.domain]: services[params.domain] }
          : services;

        // Transform services if simplified flag is set
        if (params.simplified) {
          try {
            // Handle case where services might be in an unexpected format
            let transformedServices;
            if (typeof filteredServices === "object" && filteredServices !== null) {
              // Attempt to transform expected nested services structure
              if (
                Object.keys(filteredServices).some(
                  (domain) =>
                    typeof filteredServices[domain] === "object" &&
                    filteredServices[domain] !== null,
                )
              ) {
                transformedServices =
                  serviceTransformer.transformAll(filteredServices);
              } else {
                // Handle unexpected format gracefully
                transformedServices = filteredServices;
              }
            } else {
              // Fallback for any other format
              transformedServices = filteredServices;
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
              transformError instanceof Error ? transformError : new Error(String(transformError)),
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(filteredServices, null, 2),
                },
              ],
            };
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(filteredServices, null, 2),
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
          serviceData
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
    }
  );
}
