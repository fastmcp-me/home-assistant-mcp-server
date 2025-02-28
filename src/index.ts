import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import express from "express";
import dotenv from "dotenv";
import { HassWebSocket } from "./websocket.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  HassError,
  HassErrorType,
  checkHomeAssistantConnection as checkHass,
  getCacheStats,
  clearCache,
} from "./utils.js";
import {
  registerHassTools,
} from "./tools/index.js";
import { serverLogger, apiLogger, websocketLogger } from "./logger.js";
import type { Response, Request } from "express";

// Define minimalist Express types to avoid external dependency
type ExpressRequest = {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  body?: Record<string, unknown>;
};

type ExpressResponse = {
  status: (code: number) => ExpressResponse;
  send: (body: Record<string, unknown> | string) => void;
};

// Load environment variables from .env file
dotenv.config();

// Set up constants and environment variables
const HASS_URL = process.env['HASS_URL'] || "http://homeassistant.local:8123";
const HASS_TOKEN = process.env['HASS_TOKEN'];
const USE_WEBSOCKET = process.env['HASS_WEBSOCKET'] === "true" || false;

if (!HASS_TOKEN) {
  console.error(
    "Error: HASS_TOKEN environment variable is required. Please set it in .env file.",
  );
  process.exit(1);
}

// Server instance
const server = new McpServer({
  name: "hass-mcp",
  version: "1.0.0",
});

// WebSocket client
let wsClient: HassWebSocket | null = null;

// Register Home Assistant tools with the server
registerHassTools(server, HASS_URL, HASS_TOKEN);

// Support both stdio transport for CLI tools and SSE transport for web clients
if (process.argv.includes("--stdio")) {
  // STDIO mode for local usage
  const stdioTransport = new StdioServerTransport();

  serverLogger.info("Starting in stdio mode");

  // Check Home Assistant connection before starting
  checkHass(HASS_URL, HASS_TOKEN)
    .then(() => {
      // Initialize WebSocket client if enabled
      if (USE_WEBSOCKET) {
        wsClient = new HassWebSocket(server, HASS_URL, HASS_TOKEN);
        // Connect will be called automatically when subscribing
        websocketLogger.info(
          "WebSocket client initialized for real-time updates",
        );
      }

      server.connect(stdioTransport).then(() => {
        serverLogger.info("Home Assistant MCP Server running (stdio mode)");
      });
    })
    .catch((error: unknown) => {
      if (error instanceof HassError) {
        serverLogger.error(
          "Failed to connect to Home Assistant",
          {
            errorType: error.type,
            endpoint: error.endpoint,
            retryable: error.retryable,
          },
          error,
        );
      } else {
        serverLogger.error(
          "Unexpected error during startup",
          {},
          error instanceof Error ? error : new Error(String(error))
        );
      }
    });
} else {
  // Start HTTP server for SSE
  const app = express();
  const PORT = process.env['PORT'] || 3000;

  app.use(express.json());

  // Home Assistant connection status endpoint
  app.get("/ha-status", async (_: ExpressRequest, res: ExpressResponse) => {
    try {
      await checkHass(HASS_URL, HASS_TOKEN, false);
      apiLogger.info("Connection check successful");
      res.send({
        status: "connected",
        message: "Successfully connected to Home Assistant",
      });
    } catch (error) {
      // Enhanced error handling
      let status = 503;
      let message = "Cannot connect to Home Assistant";
      let errorType = "unknown";

      if (error instanceof HassError) {
        message = `Cannot connect to Home Assistant: ${error.message}`;
        errorType = error.type;

        if (error.type === HassErrorType.AUTHENTICATION_FAILED) {
          status = 401;
        } else if (error.type === HassErrorType.RESOURCE_NOT_FOUND) {
          status = 404;
        }

        apiLogger.error(
          "Connection check failed",
          {
            errorType: error.type,
            statusCode: error.statusCode,
            endpoint: error.endpoint,
          },
          error,
        );
      } else {
        apiLogger.error(
          "Connection check failed with unexpected error",
          {},
          error as Error,
        );
      }

      res.status(status).send({
        status: "disconnected",
        message,
        errorType,
        url: HASS_URL,
      });
    }
  });

  // Health check endpoint
  app.get("/health", (_: ExpressRequest, res: ExpressResponse) => {
    res.send({ status: "ok" });
  });

  // Cache statistics endpoint
  app.get("/cache-stats", (_: ExpressRequest, res: ExpressResponse) => {
    const stats = getCacheStats();
    res.send({
      cacheStats: stats,
      hitRatio: stats.hits / (stats.hits + stats.misses) * 100,
    });
  });

  // Cache clear endpoint
  app.post("/clear-cache", (_: ExpressRequest, res: ExpressResponse) => {
    clearCache();
    apiLogger.info("Cache cleared via API request");
    res.send({ status: "ok", message: "Cache cleared" });
  });

  // Configure SSE endpoint and store active connections
  app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    await server.connect(transport);
  });

  app.listen(PORT);

  process.on("SIGINT", () => {
    serverLogger.info("SIGINT received, shutting down...");
    if (wsClient) {
      wsClient
        .close()
        .catch((e: Error) => serverLogger.error("Error closing WebSocket", {}, e));
    }
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    serverLogger.info("SIGTERM received, shutting down...");
    if (wsClient) {
      wsClient
        .close()
        .catch((e: Error) => serverLogger.error("Error closing WebSocket", {}, e));
    }
    process.exit(0);
  });
}
