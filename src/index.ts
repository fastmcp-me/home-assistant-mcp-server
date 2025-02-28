import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { z } from "zod";
import dotenv from "dotenv";
import { HassWebSocket } from "./websocket.js";

// Load environment variables from .env file
dotenv.config();

// Set up constants and environment variables
const HASS_URL = process.env.HASS_URL || "http://localhost:8123";
const HASS_TOKEN = process.env.HASS_TOKEN;
const USE_WEBSOCKET = process.env.HASS_WEBSOCKET === "true" || false;

if (!HASS_TOKEN) {
  console.error(
    "No Home Assistant token found. Please set HASS_TOKEN environment variable.",
  );
  process.exit(1);
}

// Initialize the MCP server
const server = new McpServer({
  name: "hass-mcp",
  version: "1.0.0",
});

// Track Home Assistant availability
let homeAssistantAvailable = false;
let useMockData = false;

// Initialize WebSocket connection if enabled
let wsClient: HassWebSocket | null = null;

// Helper function to make requests to Home Assistant API
async function makeHassRequest<T = unknown>(
  endpoint: string,
  method: "GET" | "POST" = "GET",
  data?: Record<string, unknown>,
): Promise<T> {
  // If we've determined that Home Assistant is not available and mock data is enabled
  if (!homeAssistantAvailable && useMockData) {
    return getMockData<T>(endpoint, method, data);
  }

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
    console.error(`Making request to Home Assistant: ${method} ${url}`);

    // Add a timeout to avoid hanging indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    options.signal = controller.signal;

    const response = await fetch(url, options);
    clearTimeout(timeoutId);

    // If we get a successful response, update availability flag
    homeAssistantAvailable = true;

    if (!response.ok) {
      throw new Error(
        `Home Assistant API error: ${response.status} ${response.statusText}`,
      );
    }

    // For some endpoints that return text instead of JSON
    if (response.headers.get("content-type")?.includes("text/plain")) {
      return (await response.text()) as unknown as T;
    }

    return await response.json();
  } catch (error: unknown) {
    const err = error as Error & { name?: string; cause?: { code?: string } };
    if (err.name === "AbortError") {
      console.error(`Request to Home Assistant timed out: ${method} ${url}`);
      homeAssistantAvailable = false;

      if (useMockData) {
        return getMockData<T>(endpoint, method, data);
      }

      throw new Error(
        `Home Assistant request timed out. Please check if Home Assistant is running at ${HASS_URL}`,
      );
    } else if (err.cause && err.cause.code === "ECONNREFUSED") {
      console.error(
        `Connection refused to Home Assistant at ${HASS_URL}. Please check if Home Assistant is running.`,
      );
      homeAssistantAvailable = false;

      if (useMockData) {
        return getMockData<T>(endpoint, method, data);
      }

      throw new Error(
        `Cannot connect to Home Assistant at ${HASS_URL}. Please check if it's running.`,
      );
    } else {
      console.error("Error making request to Home Assistant:", error);

      if (useMockData) {
        return getMockData<T>(endpoint, method, data);
      }

      throw error;
    }
  }
}

// Mock data for demonstration purposes
function getMockData<T>(
  endpoint: string,
  method: string,
  data?: Record<string, unknown>,
): T {
  console.error(`Using mock data for ${method} ${endpoint}`);

  // Mock for states endpoint
  if (endpoint === "/states") {
    return [
      {
        entity_id: "light.living_room",
        state: "off",
        attributes: {
          friendly_name: "Living Room Light",
          supported_features: 1,
        },
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      },
      {
        entity_id: "switch.kitchen",
        state: "on",
        attributes: {
          friendly_name: "Kitchen Switch",
        },
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      },
      {
        entity_id: "sensor.temperature",
        state: "22.5",
        attributes: {
          friendly_name: "Temperature",
          unit_of_measurement: "°C",
        },
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      },
    ] as unknown as T;
  }

  // Mock for specific entity state
  if (endpoint.startsWith("/states/")) {
    const entityId = endpoint.split("/states/")[1];
    return {
      entity_id: entityId,
      state: entityId.includes("light")
        ? "off"
        : entityId.includes("switch")
          ? "on"
          : "unknown",
      attributes: {
        friendly_name: entityId
          .split(".")[1]
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
      },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    } as unknown as T;
  }

  // Mock for services
  if (endpoint === "/services") {
    return [
      {
        domain: "light",
        services: ["turn_on", "turn_off", "toggle"],
      },
      {
        domain: "switch",
        services: ["turn_on", "turn_off", "toggle"],
      },
    ] as unknown as T;
  }

  // Mock for config
  if (endpoint === "/config") {
    return {
      location_name: "Mock Home",
      latitude: 37.7749,
      longitude: -122.4194,
      elevation: 100,
      unit_system: {
        length: "m",
        mass: "kg",
        temperature: "°C",
        volume: "L",
      },
      version: "2023.12.0",
      components: [
        "homeassistant",
        "frontend",
        "http",
        "light",
        "switch",
        "sensor",
      ],
    } as unknown as T;
  }

  // Mock for events
  if (endpoint === "/events") {
    return [
      {
        event: "state_changed",
        listener_count: 1,
      },
      {
        event: "service_executed",
        listener_count: 1,
      },
    ] as unknown as T;
  }

  // Mock for service call
  if (endpoint.startsWith("/services/")) {
    return {} as unknown as T;
  }

  // Mock for template rendering
  if (endpoint === "/template" && method === "POST") {
    const template = data?.template as string | undefined;
    if (template) {
      // Very basic template parsing for demonstration
      if (template.includes("states(")) {
        const entityId = template.match(/states\(['"]([^'"]+)['"]\)/)?.[1];
        if (entityId) {
          return `${entityId.includes("light") ? "off" : "on"}` as unknown as T;
        }
      }
      return "Template result" as unknown as T;
    }
  }

  // Default mock response
  return {} as unknown as T;
}

// Register tools for Home Assistant API endpoints

// 1. Get states
server.tool(
  "get_states",
  "Get the state of all entities or a specific entity",
  {
    entity_id: z
      .string()
      .optional()
      .describe(
        "Optional entity ID to get a specific entity state, if omitted all states are returned",
      ),
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
  },
);

// 2. Call service
server.tool(
  "call_service",
  "Call a Home Assistant service",
  {
    domain: z
      .string()
      .describe("Service domain (e.g., 'light', 'switch', 'automation')"),
    service: z.string().describe("Service name (e.g., 'turn_on', 'turn_off')"),
    service_data: z
      .record(z.any())
      .optional()
      .describe("Optional service data to pass to the service"),
  },
  async ({ domain, service, service_data }) => {
    try {
      const endpoint = `/services/${domain}/${service}`;
      const response = await makeHassRequest(
        endpoint,
        "POST",
        service_data || {},
      );

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
  },
);

// 3. Get history
server.tool(
  "get_history",
  "Get historical state data for entities",
  {
    entity_id: z
      .string()
      .optional()
      .describe("Optional entity ID to filter history"),
    start_time: z
      .string()
      .optional()
      .describe("Start time in ISO format (e.g., '2023-01-01T00:00:00Z')"),
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
  },
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
  },
);

// 5. Get configuration
server.tool("get_config", "Get Home Assistant configuration", {}, async () => {
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
});

// 6. Get events
server.tool("list_events", "List all available event types", {}, async () => {
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
});

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
      const response = await makeHassRequest(
        endpoint,
        "POST",
        event_data || {},
      );

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
  },
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
  },
);

// Function to check Home Assistant connectivity
async function checkHomeAssistantConnection(): Promise<boolean> {
  try {
    console.error(`Checking connectivity to Home Assistant at ${HASS_URL}`);
    await makeHassRequest("/config");
    console.error("✅ Successfully connected to Home Assistant!");
    homeAssistantAvailable = true;
    return true;
  } catch (error) {
    console.error("❌ Could not connect to Home Assistant:");
    console.error(`   ${error.message}`);
    console.error(
      `   Please check that Home Assistant is running at ${HASS_URL}`,
    );
    console.error(`   and that your token is valid.`);

    // Enable mock mode for demonstration purposes
    homeAssistantAvailable = false;

    // Check if we should use mock data by looking for command line arg
    if (process.argv.includes("--mock") || process.env.HASS_MOCK === "true") {
      console.error("🔄 Enabling mock data mode for demonstration");
      useMockData = true;
    } else {
      console.error(
        "⚠️ To enable mock data for demonstration, run with --mock flag",
      );
      console.error("   or set HASS_MOCK=true in your .env file");
    }

    // We'll still continue, connection might become available later or mock data will be used
    return useMockData;
  }
}

// Support both stdio transport for CLI tools and SSE transport for web clients
if (process.argv.includes("--stdio")) {
  // STDIO mode for local usage
  const stdioTransport = new StdioServerTransport();

  // Check Home Assistant connection before starting
  checkHomeAssistantConnection().then(() => {
    // Initialize WebSocket client if enabled
    if (USE_WEBSOCKET && !useMockData) {
      wsClient = new HassWebSocket(server, HASS_URL, HASS_TOKEN, useMockData);
      // Connect will be called automatically when subscribing
      console.error("WebSocket client initialized for real-time updates");
    }

    server.connect(stdioTransport).then(() => {
      console.error("Home Assistant MCP Server running (stdio mode)");
    });
  });
} else {
  // Start HTTP server for SSE
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Home Assistant connection status endpoint
  app.get("/ha-status", async (_, res) => {
    try {
      await makeHassRequest("/config");
      res.send({
        status: "connected",
        message: "Successfully connected to Home Assistant",
      });
    } catch (error) {
      res.status(503).send({
        status: "disconnected",
        message: `Cannot connect to Home Assistant: ${error.message}`,
        url: HASS_URL,
      });
    }
  });

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

  const httpServer = app.listen(PORT, () => {
    console.error(`Home Assistant MCP Server listening on port ${PORT}`);

    // Check Home Assistant connection after server starts
    checkHomeAssistantConnection().then(() => {
      // Initialize WebSocket client if enabled
      if (USE_WEBSOCKET && !useMockData) {
        wsClient = new HassWebSocket(server, HASS_URL, HASS_TOKEN, useMockData);
        // Connect will be called automatically when subscribing
        console.error("WebSocket client initialized for real-time updates");
      }
    });
  });

  // Setup process signal handling for cleanup
  process.on("SIGTERM", async () => {
    console.error("Received SIGTERM, shutting down...");
    if (wsClient) {
      await wsClient
        .close()
        .catch((e) => console.error("Error closing WebSocket:", e));
    }
    httpServer.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.error("Received SIGINT, shutting down...");
    if (wsClient) {
      await wsClient
        .close()
        .catch((e) => console.error("Error closing WebSocket:", e));
    }
    httpServer.close();
    process.exit(0);
  });
}
