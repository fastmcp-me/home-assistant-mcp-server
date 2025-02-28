// A simple test to verify Jest is working
import { LogzioClient } from "../src/api/logzio.js";
import { jest } from "@jest/globals";
import { registerFieldTools } from "../src/tools/fields/index.js";
import { registerSearchTools } from "../src/tools/search/index.js";
import { registerAnalysisTools } from "../src/tools/analysis.js";
import { registerAdvancedTools } from "../src/tools/advanced.js";

// Mock the McpServer class
const mockTool = jest.fn().mockReturnThis();
jest.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: mockTool,
  })),
}));

describe("Basic Test", () => {
  test("should pass a simple test", () => {
    expect(1 + 1).toBe(2);
  });

  describe("LogzioClient", () => {
    test("should create an instance with the provided API key", () => {
      const apiKey = "test-api-key";
      const client = new LogzioClient(apiKey);
      expect(client).toBeInstanceOf(LogzioClient);
    });

    test("should have the expected methods", () => {
      const apiKey = "test-api-key";
      const client = new LogzioClient(apiKey);
      expect(typeof client.search).toBe("function");
      expect(typeof client.getFields).toBe("function");
    });
  });

  describe("Fields Tool", () => {
    test("should export registerFieldTools function", () => {
      expect(typeof registerFieldTools).toBe("function");
    });

    test("should register the fields tools with the server", () => {
      // Reset mock before test
      mockTool.mockClear();

      // Create mock server and client
      const server = { tool: mockTool };
      const client = { getFields: jest.fn(), search: jest.fn() };

      // Register the fields tool
      registerFieldTools(server as any, client as any);

      // Verify the tools were registered with the correct names
      expect(mockTool).toHaveBeenCalledWith(
        "get-fields",
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      );

      expect(mockTool).toHaveBeenCalledWith(
        "field-stats",
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      );

      expect(mockTool).toHaveBeenCalledWith(
        "discover-fields",
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      );

      expect(mockTool).toHaveBeenCalledWith(
        "field-relations",
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      );

      // Check that the field tools were registered with the expected count
      // This includes: get-fields, field-stats, discover-fields, field-relations, validate-fields
      // Plus the schema discovery tools: explore-schema, recommend-fields
      expect(mockTool).toHaveBeenCalledTimes(7);
    });
  });

  describe("Search Tools", () => {
    beforeEach(() => {
      // Reset mock before each test
      mockTool.mockClear();
    });

    test("should export registerSearchTools function", () => {
      expect(typeof registerSearchTools).toBe("function");
    });

    test("should register all search tools with the server", () => {
      // Create mock server and client
      const server = { tool: mockTool };
      const client = { search: jest.fn() };

      // Register the search tools
      registerSearchTools(server as any, client as any);

      // Verify all three search tools were registered
      expect(mockTool).toHaveBeenCalledWith(
        "search-logs",
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      );

      expect(mockTool).toHaveBeenCalledWith(
        "simple-search",
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      );

      expect(mockTool).toHaveBeenCalledWith(
        "quick-search",
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      );

      // Verify the tool was called exactly 3 times
      expect(mockTool).toHaveBeenCalledTimes(3);
    });
  });

  describe("Analysis Tools", () => {
    beforeEach(() => {
      mockTool.mockClear();
    });

    test("should export registerAnalysisTools function", () => {
      expect(typeof registerAnalysisTools).toBe("function");
    });

    test("should register analysis tools with the server", () => {
      // Create mock server and client
      const server = { tool: mockTool };
      const client = { search: jest.fn() };

      // Register the analysis tools
      registerAnalysisTools(server as any, client as any);

      // Verify tools were registered
      expect(mockTool).toHaveBeenCalled();

      // Verify detect-trends tool was registered
      expect(mockTool).toHaveBeenCalledWith(
        "detect-trends",
        expect.any(String),
        expect.any(Object),
        expect.any(Function),
      );
    });
  });

  describe("Advanced Tools", () => {
    beforeEach(() => {
      mockTool.mockClear();
    });

    test("should export registerAdvancedTools function", () => {
      expect(typeof registerAdvancedTools).toBe("function");
    });

    test("should register advanced tools with the server", () => {
      // Create mock server and client
      const server = { tool: mockTool };
      const client = { search: jest.fn() };

      // Register the advanced tools
      registerAdvancedTools(server as any, client as any);

      // Verify tools were registered
      expect(mockTool).toHaveBeenCalled();
    });
  });
});
