import { LogzioClient } from "../src/api/logzio.js";
import { jest, describe, expect, test, beforeEach } from "@jest/globals";
import { registerAnalysisTools } from "../src/tools/analysis.js";
import { Elasticsearch6SearchParams } from "../src/types/elasticsearch.types.js";

// Mock the McpServer class with executeTool functionality
const mockTool = jest.fn().mockReturnThis();
const mockExecuteTool = jest.fn();

jest.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    tool: mockTool,
    executeTool: mockExecuteTool,
    toolIsRegistered: (name: string) => name === "detect-trends",
  })),
}));

// Simple type for our test to avoid type errors
interface ToolFunction {
  (params: Record<string, any>, options?: any): Promise<any>;
}

describe("Trend Analysis Tool", () => {
  const mockSearchFn = jest.fn();
  let client: LogzioClient;
  let server: any;

  beforeEach(() => {
    mockTool.mockClear();
    mockExecuteTool.mockClear();
    mockSearchFn.mockClear();

    // Mock client response for trend detection
    mockSearchFn.mockImplementation((params: Elasticsearch6SearchParams) => {
      if (params.aggs && "time_series" in params.aggs) {
        // Mock response for trend detection query
        return Promise.resolve({
          took: 10,
          hits: {
            total: { value: 100, relation: "eq" },
            hits: [],
          },
          aggregations: {
            time_series: {
              buckets: [
                {
                  key: 1644506400000,
                  key_as_string: "2022-02-10 12:00:00",
                  doc_count: 50,
                  field_values: {
                    buckets: [
                      { key: "error", doc_count: 20 },
                      { key: "info", doc_count: 30 },
                    ],
                  },
                },
                {
                  key: 1644510000000,
                  key_as_string: "2022-02-10 13:00:00",
                  doc_count: 60,
                  field_values: {
                    buckets: [
                      { key: "error", doc_count: 25 },
                      { key: "info", doc_count: 35 },
                    ],
                  },
                },
              ],
            },
            before_period: {
              doc_count: 500,
              field_values: {
                buckets: [
                  { key: "error", doc_count: 200 },
                  { key: "info", doc_count: 150 },
                  { key: "debug", doc_count: 150 },
                ],
              },
            },
            after_period: {
              doc_count: 600,
              field_values: {
                buckets: [
                  { key: "error", doc_count: 300 },
                  { key: "info", doc_count: 200 },
                  { key: "debug", doc_count: 100 },
                ],
              },
            },
          },
        });
      }

      // Default response for other queries
      return Promise.resolve({
        took: 10,
        hits: {
          total: { value: 100, relation: "eq" },
          hits: [],
        },
      });
    });

    // Create client and server mocks
    client = { search: mockSearchFn } as unknown as LogzioClient;
    server = { tool: mockTool, executeTool: mockExecuteTool };

    // Register the tools
    registerAnalysisTools(server, client);
  });

  test("should register detect-trends tool with server", () => {
    // Verify that the detect-trends tool was registered
    expect(mockTool).toHaveBeenCalledWith(
      "detect-trends",
      expect.any(String),
      expect.any(Object),
      expect.any(Function),
    );
  });

  test("should call Elasticsearch with correct parameters", async () => {
    // Find the detect-trends tool call
    const detectTrendsCall = mockTool.mock.calls.find(
      (call) => call[0] === "detect-trends",
    );

    expect(detectTrendsCall).toBeDefined();
    if (!detectTrendsCall) return;

    // Extract the callback function
    const detectTrendsCallback = detectTrendsCall[3] as ToolFunction;

    // Call the callback directly
    await detectTrendsCallback({
      timeRange: "7d",
      field: "level",
      minTrendSignificance: 5,
    });

    // Verify that client.search was called
    expect(mockSearchFn).toHaveBeenCalled();

    // Get the first call to search
    const searchCall = mockSearchFn.mock.calls[0];
    expect(searchCall).toBeDefined();
    if (!searchCall) return;

    // Check the params structure
    const searchParams = searchCall[0] as Elasticsearch6SearchParams;
    expect(searchParams.aggs).toBeDefined();

    // Check aggs structure
    if (searchParams.aggs) {
      expect("time_series" in searchParams.aggs).toBe(true);
      expect("before_period" in searchParams.aggs).toBe(true);
      expect("after_period" in searchParams.aggs).toBe(true);

      // Check field parameter - deep optional chaining
      const timeSeriesAgg = searchParams.aggs.time_series as Record<
        string,
        any
      >;
      const timeSeriesAggsField =
        timeSeriesAgg.aggs?.field_values?.terms?.field;
      expect(timeSeriesAggsField).toBe("level.keyword");
    }
  });

  test("should identify and analyze trends correctly", async () => {
    // Find the detect-trends tool call
    const detectTrendsCall = mockTool.mock.calls.find(
      (call) => call[0] === "detect-trends",
    );

    expect(detectTrendsCall).toBeDefined();
    if (!detectTrendsCall) return;

    // Extract the callback function
    const detectTrendsCallback = detectTrendsCall[3] as ToolFunction;

    // Call the callback directly
    const result = await detectTrendsCallback({
      timeRange: "7d",
      field: "level",
      minTrendSignificance: 5,
    });

    // Check the basic structure of the result
    expect(result).toBeDefined();
    expect(result.content[0].text).toContain("Trend Analysis for Field: level");

    // Check that trends were correctly identified
    expect(result.summary).toHaveProperty("trends");
    expect(result.summary.trends.length).toBeGreaterThan(0);

    // Check that trends contain the expected data
    const errorTrend = result.summary.trends.find(
      (t: any) => t.value === "error",
    );
    expect(errorTrend).toBeDefined();
    expect(errorTrend).toHaveProperty("before");
    expect(errorTrend).toHaveProperty("after");
    expect(errorTrend).toHaveProperty("percentage_change");
    expect(errorTrend).toHaveProperty("trend");

    // Check that the trend direction is correct
    // Error count went from 200 to 300, which is an increase
    expect(errorTrend.trend).toBe("increasing");

    // Check for debug trend which decreased
    const debugTrend = result.summary.trends.find(
      (t: any) => t.value === "debug",
    );
    expect(debugTrend).toBeDefined();
    expect(debugTrend.trend).toBe("decreasing");
  });
});
