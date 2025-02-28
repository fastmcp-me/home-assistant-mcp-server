import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getConfig, getAllDomains, getServices, getDevices } from "../api.js";
import { apiLogger } from "../logger.js";
import { handleToolError, formatErrorMessage } from "./utils.js";
import { z } from "zod";

/**
 * Register configuration-related tools with the MCP server
 * @param server The MCP server instance
 * @param hassUrl The Home Assistant URL
 * @param hassToken The Home Assistant access token
 */
export function registerConfigTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string,
) {
  // Get Home Assistant configuration tool
  server.tool(
    "config",
    "Get Home Assistant configuration",
    {
      random_string: z
        .string()
        .optional()
        .describe("Dummy parameter for no-parameter tools"),
    },
    async () => {
      try {
        apiLogger.info("Executing config tool");
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
        handleToolError("config", error);
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
    "domains",
    "Get a list of all domains in Home Assistant",
    {
      random_string: z
        .string()
        .optional()
        .describe("Dummy parameter for no-parameter tools"),
    },
    async () => {
      try {
        apiLogger.info("Executing domains tool");
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
        handleToolError("domains", error);
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
          const simplified: Record<
            string,
            Record<string, { description: string; fields: Record<string, unknown> }>
          > = {};

          for (const [domain, domainServices] of Object.entries(services)) {
            simplified[domain] = {};
            for (const [service, serviceData] of Object.entries(
              domainServices,
            )) {
              simplified[domain][service] = {
                description: serviceData.description || "",
                fields: serviceData.fields || {},
              };
            }
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(simplified, null, 2),
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

  // Get all devices tool
  server.tool(
    "devices",
    "Get all devices in Home Assistant",
    {
      random_string: z
        .string()
        .optional()
        .describe("Dummy parameter for no-parameter tools"),
    },
    async () => {
      try {
        apiLogger.info("Executing devices tool");
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
        handleToolError("devices", error);
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
}
