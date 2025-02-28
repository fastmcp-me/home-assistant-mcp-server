import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTemplates } from "../src/templates/index.js";
import { Resource } from "@modelcontextprotocol/sdk/types.js";

describe("Template Registration Tests", () => {
  let server: McpServer;

  beforeEach(() => {
    // Create a fresh server for each test
    server = new McpServer({
      name: "test-server",
      version: "1.0.0",
    });

    // Mock the server methods to track registrations
    server.resource = jest.fn();
    server.prompt = jest.fn();
  });

  it("should register URI templates", () => {
    // When
    registerTemplates(server);

    // Then
    // Verify resource was called at least 4 times (once for each URI template)
    expect(server.resource).toHaveBeenCalledTimes(4);

    // Verify logs resource for timeframe was registered
    expect(server.resource).toHaveBeenCalledWith(
      "timeframe-logs",
      "logs://timeframe",
      expect.any(Function),
    );

    // Verify logs resource for filtering was registered
    expect(server.resource).toHaveBeenCalledWith(
      "filtered-logs",
      "logs://filtered",
      expect.any(Function),
    );
  });

  it("should register dynamic prompt templates", () => {
    // When
    registerTemplates(server);

    // Then
    // Verify specific prompt templates were registered
    expect(server.prompt).toHaveBeenCalledWith(
      "analyze-log-pattern",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );

    expect(server.prompt).toHaveBeenCalledWith(
      "investigate-error",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );

    expect(server.prompt).toHaveBeenCalledWith(
      "service-health",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("should register workflow prompt templates", () => {
    // When
    registerTemplates(server);

    // Then
    // Verify workflow prompts were registered
    expect(server.prompt).toHaveBeenCalledWith(
      "incident-workflow",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );

    expect(server.prompt).toHaveBeenCalledWith(
      "debug-workflow",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );

    expect(server.prompt).toHaveBeenCalledWith(
      "security-incident-workflow",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );
  });
});
