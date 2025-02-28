import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Set up constants and environment variables
const HASS_URL = process.env.HASS_URL || "http://localhost:8123";
const HASS_TOKEN = process.env.HASS_TOKEN;

if (!HASS_TOKEN) {
  console.error("No Home Assistant token found. Please set HASS_TOKEN environment variable.");
  process.exit(1);
}

// Initialize the MCP server
const server = new McpServer({
  name: "hass-mcp",
  version: "1.0.0",
});

// Helper function to make requests to Home Assistant API
async function makeHassRequest<T = any>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  data?: any
): Promise<T> {
  const url = `${HASS_URL}/api${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${HASS_TOKEN}`,
      "Content-Type": "application/json",
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`Home Assistant API error: ${response.status} ${response.statusText}`);
    }
    
    // For some endpoints that return text instead of JSON
    if (response.headers.get("content-type")?.includes("text/plain")) {
      return await response.text() as unknown as T;
    }
    
    return await response.json();
  } catch (error) {
    console.error("Error making request to Home Assistant:", error);
    throw error;
  }
}

// Register tools for Home Assistant API endpoints

// 1. Get states
server.tool(
  "get_states",
  "Get the state of all entities or a specific entity",
  {
    entity_id: z.string().optional().describe("Optional entity ID to get a specific entity state, if omitted all states are returned"),
  },
  async ({ entity_id }) => {
    try {
      const endpoint = entity_id ? `/states/${entity_id}` : "/states";
      const data = await makeHassRequest(endpoint);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error getting states:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error getting states: ${error.message}`,
          },
        ],
      };
    }
  }
);

// 2. Call service
server.tool(
  "call_service",
  "Call a Home Assistant service",
  {
    domain: z.string().describe("Service domain (e.g., 'light', 'switch', 'automation')"),
    service: z.string().describe("Service name (e.g., 'turn_on', 'turn_off')"),
    data: z.record(z.any()).optional().describe("Optional service data"),
  },
  async ({ domain, service, data }) => {
    try {
      const endpoint = `/services/${domain}/${service}`;
      const response = await makeHassRequest(endpoint, "POST", data || {});
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error calling service:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error calling service ${domain}.${service}: ${error.message}`,
          },
        ],
      };
    }
  }
);

// 3. Get history
server.tool(
  "get_history",
  "Get historical state data for entities",
  {
    entity_id: z.string().optional().describe("Optional entity ID to filter history"),
    start_time: z.string().optional().describe("Start time in ISO format (e.g., '2023-01-01T00:00:00Z')"),
    end_time: z.string().optional().describe("End time in ISO format"),
  },
  async ({ entity_id, start_time, end_time }) => {
    try {
      let endpoint = "/history/period";
      
      if (start_time) {
        endpoint += `/${start_time}`;
      }
      
      const params = new URLSearchParams();
      if (entity_id) {
        params.append("filter_entity_id", entity_id);
      }
      if (end_time) {
        params.append("end_time", end_time);
      }
      
      const queryString = params.toString();
      if (queryString) {
        endpoint += `?${queryString}`;
      }
      
      const data = await makeHassRequest(endpoint);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error getting history:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error getting history: ${error.message}`,
          },
        ],
      };
    }
  }
);

// 4. List available services
server.tool(
  "list_services",
  "List all available services in Home Assistant",
  {},
  async () => {
    try {
      const data = await makeHassRequest("/services");
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error listing services:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error listing services: ${error.message}`,
          },
        ],
      };
    }
  }
);

// 5. Get configuration
server.tool(
  "get_config",
  "Get Home Assistant configuration",
  {},
  async () => {
    try {
      const data = await makeHassRequest("/config");
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error getting configuration:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error getting configuration: ${error.message}`,
          },
        ],
      };
    }
  }
);

// 6. Get events
server.tool(
  "list_events",
  "List all available event types",
  {},
  async () => {
    try {
      const data = await makeHassRequest("/events");
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error listing events:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error listing events: ${error.message}`,
          },
        ],
      };
    }
  }
);

// 7. Fire event
server.tool(
  "fire_event",
  "Fire an event in Home Assistant",
  {
    event_type: z.string().describe("Event type to fire"),
    event_data: z.record(z.any()).optional().describe("Optional event data"),
  },
  async ({ event_type, event_data }) => {
    try {
      const endpoint = `/events/${event_type}`;
      const response = await makeHassRequest(endpoint, "POST", event_data || {});
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error("Error firing event:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error firing event ${event_type}: ${error.message}`,
          },
        ],
      };
    }
  }
);

// 8. Render template
server.tool(
  "render_template",
  "Render a Home Assistant template",
  {
    template: z.string().describe("Jinja2 template to render"),
  },
  async ({ template }) => {
    try {
      const response = await makeHassRequest("/template", "POST", { template });
      
      return {
        content: [
          {
            type: "text",
            text: response as string,
          },
        ],
      };
    } catch (error) {
      console.error("Error rendering template:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error rendering template: ${error.message}`,
          },
        ],
      };
    }
  }
);

// Support both stdio transport for CLI tools and SSE transport for web clients
if (process.argv.includes("--stdio")) {
  // STDIO mode for local usage
  const stdioTransport = new StdioServerTransport();
  server.connect(stdioTransport).then(() => {
    console.error("Home Assistant MCP Server running (stdio mode)");
  });
} else {
  // Start HTTP server for SSE
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());
  
  // Health check endpoint
  app.get("/health", (_, res) => {
    res.send({ status: "ok" });
  });

  // Configure SSE endpoint
  let sseTransport: SSEServerTransport | null = null;
  
  app.get("/sse", (req, res) => {
    console.error("SSE client connected");
    sseTransport = new SSEServerTransport("/messages", res);
    server.connect(sseTransport);
  });
  
  app.post("/messages", (req, res) => {
    if (sseTransport) {
      sseTransport.handlePostMessage(req, res);
    } else {
      res.status(400).send("No SSE session established");
    }
  });

  app.listen(PORT, () => {
    console.error(`Home Assistant MCP Server listening on port ${PORT}`);
  });
}