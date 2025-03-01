import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HassClient } from "../../api/client.js";

export function registerServicesListPrompt(server: McpServer, _client: HassClient) {
  server.prompt(
    "services-list",
    "List available services in Home Assistant",
    {
      domain: z.string().optional().describe("Optional domain to filter services by"),
    },
    async (request) => {
      const domainFilter = request.domain ? ` for the ${request.domain} domain` : "";

      // Return a prompt message sequence
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `What services are available${domainFilter}?`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll check the available services for you.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: "Please use the services list tool to get the information.",
            },
          },
        ],
      };
    },
  );
}
