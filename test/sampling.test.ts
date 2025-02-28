import { registerSamplingTools } from "../src/tools/sampling/index.js";
import { jest } from "@jest/globals";

// Mock the McpServer class
const mockTool = jest.fn().mockReturnThis();
jest.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: mockTool,
  })),
}));

describe("Sampling Tools", () => {
  beforeEach(() => {
    // Reset mock before each test
    mockTool.mockClear();
  });

  test("should export registerSamplingTools function", () => {
    expect(typeof registerSamplingTools).toBe("function");
  });

  test("should register sampling tools with the server", () => {
    // Create mock server and client
    const server = { tool: mockTool };
    const client = { search: jest.fn() };

    // Register the sampling tools
    registerSamplingTools(server as any, client as any);

    // Verify that the tool registration function was called
    // Tool count may change during refactoring, so we'll just check
    // that the specific tools we care about were registered
    expect(mockTool).toHaveBeenCalled();

    // Check that sample-logs was registered
    expect(mockTool).toHaveBeenCalledWith(
      "sample-logs",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );

    // Check that stratified-sample was registered
    expect(mockTool).toHaveBeenCalledWith(
      "stratified-sample",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );
  });

  // Additional tests could be added here to test the actual functionality
  // of the sampling tools, but would require more complex mocking of the
  // Elasticsearch response data
});
