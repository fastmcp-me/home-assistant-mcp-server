import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import dotenv from "dotenv";
import { HassWebSocket } from "./websocket.js";
import {
  checkHomeAssistantConnection as checkHass,
  useMockData,
  setMockData
} from "./utils.js";
import { registerHassTools } from "./tools.js";

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

// Initialize WebSocket connection if enabled
let wsClient: HassWebSocket | null = null;

// Register all tools with the server
registerHassTools(server, HASS_URL, HASS_TOKEN);

// Support both stdio transport for CLI tools and SSE transport for web clients
if (process.argv.includes("--stdio")) {
  // STDIO mode for local usage
  const stdioTransport = new StdioServerTransport();

  // Check if mock mode is enabled
  const useMock = process.argv.includes("--mock") || process.env.HASS_MOCK === "true";

  // Check Home Assistant connection before starting
  checkHass(
    HASS_URL,
    HASS_TOKEN,
    useMock
  ).then(() => {
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
      await checkHass(HASS_URL, HASS_TOKEN);
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

    // Check if mock mode is enabled
    const useMock = process.argv.includes("--mock") || process.env.HASS_MOCK === "true";

    // Check Home Assistant connection after server starts
    checkHass(
      HASS_URL,
      HASS_TOKEN,
      useMock
    ).then(() => {
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
