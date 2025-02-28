import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getEntities,
  getStates,
  getHistory,
  getConfig,
  getAllDomains,
  getServices,
  getDevices,
  callService
} from "./api.js";
import { HassError, HassErrorType } from "./utils.js";
import { apiLogger } from "./logger.js";
import { entityTransformer, serviceTransformer } from "./transforms.js";

// Import schemas from types.js
import {
  getStatesSchema,
  getHistorySchema,
  callServiceSchema,
} from "./types.js";

/**
 * Registers all Home Assistant related tools with the MCP server
 * @param server The MCP server to register the tools with
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerHassTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Register tools with proper error handling and logging

  // Get all entities tool
  server.tool(
    "get_entities",
    "Get a list of all Home Assistant entities",
    {
      simplified: z.boolean().optional().describe("Return simplified entity data structure (recommended)"),
      domain: z.string().optional().describe("Filter entities by domain (e.g. 'light', 'sensor')"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing get_entities tool", { domain: params.domain, simplified: params.simplified });
        const entities = await getEntities(hassUrl, hassToken, params.domain);

        // Transform entities if simplified flag is set
        if (params.simplified) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(entityTransformer.transformAll(entities), null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(entities, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("get_entities", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting entities: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Get entity states tool
  server.tool(
    "get_states",
    "Get the current state of all (or specific) Home Assistant entities",
    getStatesSchema,
    async (params) => {
      try {
        apiLogger.info("Executing get_states tool", { entityId: params.entity_id, simplified: params.simplified });
        const states = await getStates(hassUrl, hassToken, params.entity_id);

        // Transform states if simplified flag is set
        if (params.simplified) {
          if (Array.isArray(states)) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(entityTransformer.transformAll(states), null, 2),
                },
              ],
            };
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(entityTransformer.transform(states), null, 2),
                },
              ],
            };
          }
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(states, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("get_states", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting states: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Get history tool
  server.tool(
    "get_history",
    "Get historical state data for entities",
    getHistorySchema,
    async (params) => {
      try {
        apiLogger.info("Executing get_history tool", {
          entityId: params.entity_id,
          startTime: params.start_time,
          endTime: params.end_time,
          simplified: params.simplified
        });

        const history = await getHistory(
          hassUrl,
          hassToken,
          params.entity_id,
          params.start_time,
          params.end_time,
          params.minimal_response,
          params.significant_changes_only,
        );

        // Transform history if simplified flag is set
        if (params.simplified && Array.isArray(history) && history.length > 0) {
          const transformedHistory = history.map(entityHistory => {
            if (Array.isArray(entityHistory)) {
              return entityHistory.map(state => entityTransformer.transform(state));
            }
            return entityHistory;
          });

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(transformedHistory, null, 2),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(history, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("get_history", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting history: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Get configuration tool
  server.tool(
    "get_config",
    "Get Home Assistant configuration",
    {},
    async () => {
      try {
        apiLogger.info("Executing get_config tool");
        const config = await getConfig(hassUrl, hassToken);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(config, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("get_config", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting configuration: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Get all domains tool
  server.tool(
    "get_domains",
    "Get a list of all domains in Home Assistant",
    {},
    async () => {
      try {
        apiLogger.info("Executing get_domains tool");
        const domains = await getAllDomains(hassUrl, hassToken);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(domains, null, 2),
            },
          ],
        };
      } catch (error) {
        handleToolError("get_domains", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting domains: ${formatErrorMessage(error)}`,
            },
          ],
        };
      }
    },
  );

  // Get all services tool
  server.tool(
    "get_services",
    "Get all available services in Home Assistant",
    {
      domain: z.string().optional().describe("Optional domain to filter services by"),
      simplified: z.boolean().optional().describe("Return simplified service data structure (recommended)"),
    },
    async (params) => {
      try {
        apiLogger.info("Executing get_services tool", { domain: params.domain, simplified: params.simplified });
        const services = await getServices(hassUrl, hassToken, params.domain);

        // Transform services if simplified flag is set
        if (params.simplified) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(serviceTransformer.transformNestedServices(services), null, 2),
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
          hasServiceData: !!params.service_data
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
          service: params.service
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

/**
 * Handle errors from tool execution with proper logging
 */
function handleToolError(toolName: string, error: unknown, context: Record<string, any> = {}) {
  if (error instanceof HassError) {
    apiLogger.error(`Error executing ${toolName}`, {
      ...context,
      errorType: error.type,
      endpoint: error.endpoint,
      statusCode: error.statusCode,
      retryable: error.retryable
    }, error);
  } else {
    apiLogger.error(`Unexpected error executing ${toolName}`, context, error as Error);
  }
}

/**
 * Format error message for tool output
 */
function formatErrorMessage(error: unknown): string {
  if (error instanceof HassError) {
    return `${error.message} (${error.type}${error.statusCode ? `, status: ${error.statusCode}` : ''})`;
  } else if (error instanceof Error) {
    return error.message;
  } else {
    return "Unknown error occurred";
  }
}
