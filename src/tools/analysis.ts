import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../api/logzio.js";
import { buildTimeRange } from "../utils/time.js";
import { calculateInterval } from "../utils/time.js";
import { handleToolError } from "../utils/errorHandler.js";
import { ErrorContext } from "../types/errors.types.js";
import {
  EsResponse,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  EsAggregationBucket,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  LogHistogramParams,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  AnalyzeErrorsParams,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  LogDashboardParams,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  AnalyzeLogPatternsParams,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  CategorizeErrorsParams,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  TrendDetectionParamsType,
} from "../types/elasticsearch.js";
import { Elasticsearch6SearchParams } from "../types/elasticsearch.types.js";

// Define interface for MCP Tool Response
interface McpToolResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: {
      text?: string;
      mimeType?: string;
      uri?: string;
    };
    [key: string]: unknown;
  }>;
  [Symbol.iterator]?: unknown;
  [key: string]: unknown;
}

// Define the trend type for trend analysis
type Trend = {
  value: string;
  beforeCount: number;
  afterCount: number;
  absoluteChange: number;
  percentageChange: number;
  trend: "increasing" | "decreasing" | "stable";
};

// Use the type imported from elasticsearch.ts
// This empty interface ensures we're using the type correctly
type TrendDetectionParams = TrendDetectionParamsType;

import { registerAnalysisTools as registerModularAnalysisTools } from "./analysis/index.js";
import { registerLogHistogramTool } from "./analysis/log-histogram.js";
import { registerDetectTrendsTool } from "./analysis/detect-trends.js";

export function registerAnalysisTools(server: McpServer, client: LogzioClient) {
  // Register tools from the modular analysis directory
  registerModularAnalysisTools(server, client);

  // Register additional analysis tools
  registerLogHistogramTool(server, client);
  registerDetectTrendsTool(server, client);

  // Register legacy tools
  server.tool(
    "log-histogram-legacy",
    "Legacy version - use log-histogram instead",
    {
      query: z
        .string()
        .optional()
        .describe("Optional query string to filter logs (e.g., 'level:error')"),
      interval: z
        .string()
        .describe("Time interval for histogram buckets (e.g., '1h', '1d')"),
      timeRange: z
        .string()
        .describe("Time range to analyze (e.g., '24h', '7d')"),
      field: z
        .string()
        .optional()
        .default("@timestamp")
        .describe("Timestamp field to use for the histogram"),
      format: z
        .enum(["text", "json"])
        .optional()
        .default("text")
        .describe("Response format: text for human-readable, json for data"),
    },
    async ({
      query,
      interval,
      timeRange,
      field = "@timestamp",
      format = "text",
    }) => {
      try {
        // Construct query
        const searchParams = {
          size: 0, // No documents, just aggregations
          query: {
            bool: {
              filter: buildTimeRange(timeRange, field),
            },
          },
          aggs: {
            logs_over_time: {
              date_histogram: {
                field: field,
                fixed_interval: interval,
                format: "yyyy-MM-dd HH:mm:ss",
              },
            },
          },
        };

        // Add text query if provided
        if (query) {
          const boolQuery = (searchParams.query as Record<string, unknown>)
            .bool as Record<string, unknown>;
          boolQuery.must = {
            query_string: {
              query: query,
              allow_leading_wildcard: false,
            },
          };
        }

        const data = (await client.search(
          searchParams as unknown as Elasticsearch6SearchParams,
        )) as unknown as EsResponse;

        // Extract histogram buckets
        const histogramBuckets =
          data.aggregations?.logs_over_time?.buckets || [];

        // Format the data for better readability
        let formattedData = "";
        const queryText = query ? ` matching "${query}"` : "";

        if (format === "text") {
          formattedData = `## Log Volume Histogram\n\n`;
          formattedData += `Log counts${queryText} over time (interval: ${interval}, range: ${timeRange})\n\n`;

          if (histogramBuckets.length === 0) {
            formattedData += `No data found for the specified time range and query.\n\n`;
            formattedData += `### Suggestions\n`;
            formattedData += `- Try a longer time range\n`;
            formattedData += `- Check if your query syntax is correct\n`;
            formattedData += `- Verify that the timestamp field "${field}" exists\n`;
          } else {
            // Find max count for visual scaling
            const maxCount = Math.max(
              ...histogramBuckets.map(
                (b: { doc_count?: number }) => b.doc_count || 0,
              ),
            );
            const scaleFactor = maxCount > 50 ? Math.ceil(maxCount / 50) : 1;

            // Add a simple header
            formattedData += `| Time | Count | Trend |\n`;
            formattedData += `|------|-------|-------|\n`;

            // Add each time bucket
            histogramBuckets.forEach(
              (bucket: { key_as_string?: string; doc_count?: number }) => {
                const count = bucket.doc_count || 0;
                const bars = "█".repeat(Math.ceil(count / scaleFactor) || 1);
                formattedData += `| ${bucket.key_as_string || ""} | ${count} | ${bars} |\n`;
              },
            );

            formattedData += `\n`;

            // Add summary statistics
            const totalLogs = histogramBuckets.reduce(
              (sum: number, bucket: { doc_count?: number }) =>
                sum + (bucket.doc_count || 0),
              0,
            );
            const avgLogs = Math.round(totalLogs / histogramBuckets.length);

            formattedData += `### Summary\n`;
            formattedData += `- Total logs: ${totalLogs}\n`;
            formattedData += `- Time periods: ${histogramBuckets.length}\n`;
            formattedData += `- Average per period: ${avgLogs}\n`;

            // Add usage tips
            formattedData += `\n### Usage Tips\n`;
            formattedData += `- For detailed logs, use the \`simple-search\` tool with this query\n`;
            formattedData += `- For error analysis, try the \`analyze-errors\` tool\n`;
            formattedData += `- To compare with metrics, use \`log-dashboard\`\n`;
          }
        } else {
          // If json format was requested, return the raw data
          formattedData = JSON.stringify(data, null, 2);
        }

        return {
          // Include raw data for programmatic access
          data: data,

          // Include a structured summary
          summary: {
            total_buckets: histogramBuckets.length,
            total_logs: histogramBuckets.reduce(
              (sum: number, bucket: { doc_count?: number }) =>
                sum + (bucket.doc_count || 0),
              0,
            ),
            time_range: timeRange,
            interval: interval,
            query: query || "all logs",
            buckets: histogramBuckets.map(
              (bucket: {
                key: number;
                key_as_string?: string;
                doc_count?: number;
              }) => ({
                time: bucket.key_as_string || "",
                count: bucket.doc_count || 0,
                timestamp: bucket.key,
              }),
            ),
          },

          // Provide formatted text output
          content: [
            {
              type: "text",
              text: formattedData,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Create a more helpful error message based on the error type
        let userMessage = `Error generating histogram: ${errorMessage}`;

        if (errorMessage.includes("parsing_exception")) {
          userMessage = `Error: Invalid query syntax in "${query}". Please check your query format.`;
        } else if (
          errorMessage.includes("field_not_found") ||
          (errorMessage.includes("field [") &&
            errorMessage.includes("] not found"))
        ) {
          userMessage = `Error: Field "${field}" not found. Make sure this field exists in your logs.`;
        } else if (errorMessage.includes("404")) {
          userMessage = `Error: Index not found. Please check your index pattern or confirm that data exists for the specified time range.`;
        } else if (errorMessage.includes("401")) {
          userMessage = `Error: Authentication failed. Please check your API credentials.`;
        } else if (errorMessage.includes("No date histogram could be built")) {
          userMessage = `Error: Cannot build histogram. The field "${field}" might not be a date field. Use a timestamp field.`;
        }

        return {
          isError: true,
          error: errorMessage,
          troubleshooting: {
            suggestions: [
              "Verify field name is correct",
              "Check query syntax",
              "Try a different time range",
              "Ensure timestamp field is a date type",
              "Check API credentials",
            ],
          },
          content: [
            {
              type: "text",
              text: userMessage,
            },
          ],
        };
      }
    },
  );

  // Add a tool for error analysis
  server.tool(
    "analyze-errors",
    "Analyze error patterns in logs",
    {
      timeRange: z
        .string()
        .default("24h")
        .describe("Time range to analyze (e.g., '15m', '1h', '7d')"),
      errorField: z
        .string()
        .optional()
        .default("level")
        .describe("Field name that contains error level information"),
      errorValue: z
        .string()
        .optional()
        .default("error")
        .describe("Value in errorField that indicates an error"),
      groupBy: z
        .string()
        .optional()
        .default("message.keyword")
        .describe("Field to group errors by"),
      maxGroups: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of error groups to return"),
      useSimpleAggregation: z
        .boolean()
        .optional()
        .default(false)
        .describe("Use simplified aggregation to avoid nested bucket errors"),
    },
    async (
      {
        timeRange = "24h",
        errorField = "level",
        errorValue = "error",
        groupBy = "message.keyword",
        maxGroups = 20,
        useSimpleAggregation = false,
      },
      _extra,
    ) => {
      try {
        // Build the base query to identify errors with improved matching
        // Support for both uppercase and lowercase error values for better matching
        const baseQuery = {
          bool: {
            must: {
              bool: {
                should: [
                  // Try both the exact value and case insensitive variations
                  { term: { [errorField]: errorValue } },
                  { term: { [errorField]: errorValue.toLowerCase() } },
                  { term: { [errorField]: errorValue.toUpperCase() } },
                  // Also try with .keyword suffix if not already present
                  ...(errorField.endsWith(".keyword")
                    ? []
                    : [
                        { term: { [`${errorField}.keyword`]: errorValue } },
                        {
                          term: {
                            [`${errorField}.keyword`]: errorValue.toLowerCase(),
                          },
                        },
                        {
                          term: {
                            [`${errorField}.keyword`]: errorValue.toUpperCase(),
                          },
                        },
                      ]),
                ],
                minimum_should_match: 1,
              },
            },
            filter: buildTimeRange(timeRange),
          },
        };

        // First do a cardinality check to determine if the field has too many values
        // This helps decide whether to use simple aggregation automatically
        const cardinalityParams = {
          size: 0,
          query: baseQuery,
          aggs: {
            field_cardinality: {
              cardinality: {
                field: groupBy,
              },
            },
            total_errors: {
              value_count: {
                field: "_index", // Just to count the total number of matching documents
              },
            },
          },
        };

        // Check cardinality first to auto-determine if we need simple aggregation
        const cardinalityResult = (await client.search(
          cardinalityParams as unknown as Elasticsearch6SearchParams,
        )) as unknown as EsResponse;

        // Safely access aggregation fields with optional chaining and type assertions
        const fieldCardinality =
          (
            cardinalityResult?.aggregations as Record<
              string,
              { value?: number }
            >
          )?.field_cardinality?.value || 0;
        const totalErrorCount =
          (
            cardinalityResult?.aggregations as Record<
              string,
              { value?: number }
            >
          )?.total_errors?.value || 0;

        // Auto-determine if we should use simple aggregation
        const shouldUseSimpleAggregation =
          useSimpleAggregation ||
          fieldCardinality > 1000 ||
          totalErrorCount > 10000 ||
          (totalErrorCount > 0 && fieldCardinality / totalErrorCount > 0.1);

        console.log(
          `Analyzing errors with ${fieldCardinality} distinct values across ${totalErrorCount} documents. Using simple aggregation: ${shouldUseSimpleAggregation}`,
        );

        // Define the search parameters with different aggregation strategies
        // based on whether simplified aggregation is requested or auto-determined
        const searchParams = {
          size: 0,
          query: baseQuery,
          aggs: shouldUseSimpleAggregation
            ? // Simple aggregation approach - avoids nested buckets error
              {
                error_types: {
                  terms: {
                    field: groupBy,
                    size: maxGroups,
                    order: { _count: "desc" },
                  },
                },
                error_trend: {
                  date_histogram: {
                    field: "@timestamp",
                    fixed_interval: calculateInterval(timeRange),
                    format: "yyyy-MM-dd HH:mm:ss",
                  },
                },
                // Add a simple sample of errors for context, even in simple mode
                error_samples: {
                  top_hits: {
                    size: 3,
                    _source: ["message", "@timestamp", errorField],
                    sort: [{ "@timestamp": "desc" }],
                  },
                },
              }
            : // Advanced aggregation with nested buckets (may cause errors with some configurations)
              {
                error_types: {
                  terms: {
                    field: groupBy,
                    size: maxGroups,
                    order: { _count: "desc" },
                  },
                  aggs: {
                    over_time: {
                      date_histogram: {
                        field: "@timestamp",
                        fixed_interval: calculateInterval(timeRange),
                        format: "yyyy-MM-dd HH:mm:ss",
                      },
                    },
                    examples: {
                      top_hits: {
                        size: 1,
                        sort: [{ "@timestamp": "desc" }],
                      },
                    },
                  },
                },
                error_trend: {
                  date_histogram: {
                    field: "@timestamp",
                    fixed_interval: calculateInterval(timeRange),
                    format: "yyyy-MM-dd HH:mm:ss",
                  },
                },
              },
        };

        const data = (await client.search(
          searchParams as unknown as Elasticsearch6SearchParams,
        )) as unknown as EsResponse;

        // Extract the error types and counts from the response
        const errorTypes = data.aggregations?.error_types?.buckets || [];
        const totalErrors = data.hits.total.value || 0;

        // Get the error trend data and use it in the output
        const errorTrendData = data.aggregations?.error_trend?.buckets || [];

        // Safely access samples with optional chaining if needed in the future
        // const errorSamples =
        //   (data.aggregations as Record<string, unknown>)?.error_samples?.hits?.hits || [];

        // Format the results for better readability
        let output = "## Error Analysis Report\n\n";

        if (errorTypes.length > 0) {
          output += `Total errors in the last ${timeRange}: ${totalErrors}\n\n`;

          // Use the error trend data if available
          if (errorTrendData.length > 0) {
            output += "### Error Trend\n\n";
            output += "Time period | Error count\n";
            output += "------------|------------\n";
            errorTrendData.forEach((bucket) => {
              const date = new Date(bucket.key).toISOString().split("T")[0];
              output += `${date} | ${bucket.doc_count}\n`;
            });
            output += "\n";
          }

          output += "### Top Error Types\n\n";

          errorTypes.forEach((bucket, index) => {
            output += `${index + 1}. **${bucket.key}** (${bucket.doc_count} occurrences)\n`;

            // Add an example if available and not using simple aggregation
            if (
              !useSimpleAggregation &&
              bucket.examples &&
              bucket.examples.hits.hits.length > 0
            ) {
              const example = bucket.examples.hits.hits[0]._source;
              output += `   - Example: ${JSON.stringify(example.message || example)}\n`;
              if (example["@timestamp"]) {
                output += `   - Last seen: ${example["@timestamp"]}\n`;
              }
            }

            output += "\n";
          });

          // Add usage tips
          output += "\n### Usage Tips\n";
          output +=
            "- To see more detailed information about a specific error type, use the `simple-search` tool\n";
          output +=
            '- If you\'re experiencing the "nested buckets" error, try setting `useSimpleAggregation: true`\n';
          output +=
            "- For a daily summary of errors, use the `log-dashboard` tool\n";
        } else {
          output += "No error patterns found in the specified time range.\n\n";
          output += "### Suggestions\n";
          output += "- Try a longer time range (e.g., '7d' instead of '24h')\n";
          output +=
            "- Check if the error field name is correct (commonly 'level', 'severity', or 'log_level')\n";
          output +=
            "- Try a different error value (e.g., 'ERROR' instead of 'error', or 'critical')\n";
        }

        // Construct examples for related tools
        const searchExample = `simple-search({\n  query: "${errorField}:${errorValue}",\n  timeRange: "${timeRange}"\n})`;
        const dashboardExample = `log-dashboard({\n  timeRange: "${timeRange}",\n  filter: "${errorField}:${errorValue}"\n})`;

        return {
          // Include raw data for programmatic access
          data: data,

          // Include a structured summary
          summary: {
            total_errors: totalErrors,
            error_types_count: errorTypes.length,
            top_errors: errorTypes.slice(0, 3).map((bucket) => ({
              message: bucket.key,
              count: bucket.doc_count,
            })),
            time_range: timeRange,
          },

          // Include helpful related tools
          related_tools: {
            search: {
              name: "simple-search",
              example: searchExample,
            },
            dashboard: {
              name: "log-dashboard",
              example: dashboardExample,
            },
          },

          // Provide formatted text output
          content: [{ type: "text" as const, text: output }],
        };
      } catch (error) {
        const context: ErrorContext = {
          tool: "analyze-errors",
          operation: "analyze-errors",
        };

        // Convert the error response to match expected MCP tool response format
        const errorResponse = handleToolError(error, context);
        return {
          ...errorResponse,
          // Ensure these properties exist to satisfy the MCP tool response interface
          [Symbol.iterator]: undefined,
        } as McpToolResponse;
      }
    },
  );

  // Add a tool for dashboard-like analytics
  server.tool(
    "log-dashboard",
    "Get a comprehensive dashboard view of log activity with key metrics",
    {
      timeRange: z
        .string()
        .optional()
        .default("24h")
        .describe("Time range to analyze (e.g., '15m', '1h', '7d')"),
      filter: z
        .string()
        .optional()
        .describe(
          "Optional filter query to limit results (e.g., 'service:api-gateway')",
        ),
      includeAllLevels: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include all log levels even if they have 0 count"),
      checkAlternativeLevels: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "Check alternative level field names if standard one has no data",
        ),
    },
    async (
      {
        timeRange = "24h",
        filter,
        includeAllLevels = false,
        checkAlternativeLevels = true,
      },
      _extra,
    ) => {
      try {
        // Define possible level fields to check
        const levelFields = [
          "level.keyword",
          "severity.keyword",
          "log_level.keyword",
        ];
        let primaryLevelField = levelFields[0]; // Default level field

        // Build base query
        const baseQuery: Record<string, unknown> = {
          bool: {
            filter: buildTimeRange(timeRange),
          },
        };

        // Add filter to base query if provided
        if (filter) {
          const boolQuery = baseQuery.bool as Record<string, unknown>;
          boolQuery.must = {
            query_string: {
              query: filter,
              allow_leading_wildcard: false,
            },
          };
        }

        // Define all possible log levels to include even if count is 0
        const allLogLevels = [
          "error",
          "warn",
          "warning",
          "info",
          "debug",
          "trace",
          "critical",
          "fatal",
          "notice",
        ];

        const searchParams = {
          size: 0,
          query: baseQuery,
          aggs: {
            // Volume over time
            logs_over_time: {
              date_histogram: {
                field: "@timestamp",
                fixed_interval: calculateInterval(timeRange),
                format: "yyyy-MM-dd HH:mm:ss",
              },
            },
            // Top log levels - we'll try multiple possible field names
            log_levels: {
              terms: {
                field: primaryLevelField,
                size: 10,
                // Include 0 counts for visualization completeness if requested
                ...(includeAllLevels
                  ? { include: allLogLevels.map((l) => l.toLowerCase()) }
                  : {}),
              },
            },
            // Alternative level fields to check if primary has no data
            alternative_levels: {
              filters: {
                filters: levelFields.reduce(
                  (
                    acc: Record<string, Record<string, unknown>>,
                    field: string,
                  ) => {
                    acc[field] = { exists: { field } };
                    return acc;
                  },
                  {} as Record<string, Record<string, unknown>>,
                ),
              },
            },
            // Top services
            services: {
              terms: {
                field: "service.keyword",
                size: 10,
                missing: "unknown", // Handle missing service names
              },
            },
            // Error count - will check multiple level fields
            error_count: {
              filter: {
                bool: {
                  should: [
                    { term: { "level.keyword": "error" } },
                    { term: { "severity.keyword": "error" } },
                    { term: { "level.keyword": "critical" } },
                    { term: { "severity.keyword": "critical" } },
                    { term: { "log_level.keyword": "ERROR" } },
                  ],
                  minimum_should_match: 1,
                },
              },
            },
            // Top error types if errors exist
            error_types: {
              terms: {
                field: "message.keyword",
                size: 5,
              },
            },
          },
        };

        const data = (await client.search(
          searchParams as unknown as Elasticsearch6SearchParams,
        )) as unknown as EsResponse;

        // Calculate total logs - safely handle undefined
        const totalLogs = data?.hits?.total?.value || 0;

        // Check if we need to find an alternative level field (if primary has no data)
        let logLevelBuckets = data?.aggregations?.log_levels?.buckets || [];

        // Look at alternative level fields if primary field returned no data and checking is enabled
        // Use the alternative_levels if needed
        const alternativeLevelsBuckets = data?.aggregations?.alternative_levels
          ?.buckets as Record<string, { doc_count: number }> | undefined;

        if (
          checkAlternativeLevels &&
          logLevelBuckets.length === 0 &&
          alternativeLevelsBuckets
        ) {
          // Find the first alternative field that has documents
          for (const [field, bucket] of Object.entries(
            alternativeLevelsBuckets,
          )) {
            if (field !== primaryLevelField && bucket && bucket.doc_count > 0) {
              // We found a better field, let's use it for a second query
              primaryLevelField = field;

              // Update the aggregation to use the discovered field by using type assertions
              const logLevels = searchParams.aggs.log_levels as Record<
                string,
                unknown
              >;
              if ((logLevels as Record<string, unknown>).terms) {
                (logLevels.terms as Record<string, unknown>).field =
                  primaryLevelField;
              }

              // Re-run the query with the new level field
              const newData = (await client.search(
                searchParams as unknown as Elasticsearch6SearchParams,
              )) as unknown as EsResponse;

              // Update log levels with the new results
              logLevelBuckets =
                newData?.aggregations?.log_levels?.buckets || [];
              break;
            }
          }
        }

        // Error count - safely handle undefined
        const errorCount = data?.aggregations?.error_count?.doc_count || 0;
        const errorRate =
          totalLogs > 0 ? ((errorCount / totalLogs) * 100).toFixed(2) : "0.00";

        // Service buckets - safely handle undefined
        const serviceBuckets = data?.aggregations?.services?.buckets || [];

        // Error type buckets - safely handle undefined
        const errorTypeBuckets = data?.aggregations?.error_types?.buckets || [];

        // Volume over time - safely handle undefined
        const volumeBuckets = data?.aggregations?.logs_over_time?.buckets || [];

        // Format results as a dashboard
        let output = "# Log Analytics Dashboard\n\n";

        output += `## Summary (Last ${timeRange})\n\n`;
        output += `- Total logs: ${totalLogs.toLocaleString()}\n`;
        output += `- Error count: ${errorCount.toLocaleString()} (${errorRate}%)\n`;
        output += `- Log level field: ${primaryLevelField}\n`;

        // Add time trend visualization if data exists
        if (volumeBuckets.length > 0) {
          output += "\n## Log Volume Trend\n\n";

          // Find max count for scaling
          const maxCount = Math.max(
            ...volumeBuckets.map((b) => b.doc_count || 0),
          );
          const scaleFactor = maxCount > 20 ? Math.ceil(maxCount / 20) : 1;

          // Select a subset of buckets if there are too many
          const displayBuckets =
            volumeBuckets.length > 10
              ? volumeBuckets.filter(
                  (_, i) => i % Math.ceil(volumeBuckets.length / 10) === 0,
                )
              : volumeBuckets;

          // Create a simple ASCII chart
          displayBuckets.forEach((bucket) => {
            const barLength = Math.ceil((bucket.doc_count || 0) / scaleFactor);
            const bar = "█".repeat(barLength || 1);
            const time = bucket.key_as_string?.split(" ")[1] || "unknown"; // Just show the time part
            output += `${time} |${bar} ${bucket.doc_count || 0}\n`;
          });

          output += "\n";
        }

        // Add log level breakdown
        if (logLevelBuckets.length > 0) {
          output += "\n## Log Levels\n\n";
          logLevelBuckets.forEach((bucket) => {
            const count = bucket.doc_count || 0;
            const percentage =
              totalLogs > 0 ? ((count / totalLogs) * 100).toFixed(1) : "0.0";
            output += `- ${bucket.key}: ${count.toLocaleString()} (${percentage}%)\n`;
          });
        } else {
          output +=
            "\n## Log Levels\n\nNo log level information found. Available fields may include:\n";
          output +=
            "- level.keyword\n- severity.keyword\n- log_level.keyword\n";
        }

        // Add service breakdown
        if (serviceBuckets.length > 0) {
          output += "\n## Top Services\n\n";
          serviceBuckets.forEach((bucket) => {
            const count = bucket.doc_count || 0;
            const percentage =
              totalLogs > 0 ? ((count / totalLogs) * 100).toFixed(1) : "0.0";
            output += `- ${bucket.key}: ${count.toLocaleString()} (${percentage}%)\n`;
          });
        } else {
          output +=
            "\n## Services\n\nNo service information found. The service field may not exist in your logs.\n";
        }

        // Add top error types if there are errors
        if (errorTypeBuckets.length > 0) {
          output += "\n## Top Error Messages\n\n";
          errorTypeBuckets.forEach((bucket, index) => {
            const message =
              typeof bucket.key === "string"
                ? bucket.key
                : JSON.stringify(bucket.key);
            const truncatedMessage =
              message.length > 80 ? message.substring(0, 80) + "..." : message;
            output += `${index + 1}. **${truncatedMessage}** (${bucket.doc_count || 0} occurrences)\n`;
          });
        } else if (errorCount > 0) {
          output +=
            "\n## Error Messages\n\nError count is non-zero, but no error message patterns were found.\n";
        }

        // Add usage suggestions
        output += "\n## Next Steps\n\n";
        output +=
          '- For detailed error analysis: `analyze-errors({ timeRange: "' +
          timeRange +
          '" })`\n';
        output +=
          '- To see log volume over time: `log-histogram({ timeRange: "' +
          timeRange +
          '", interval: "1h" })`\n';
        output +=
          '- To search specific logs: `simple-search({ query: "level:error" })`\n';

        // Create a structured summary of the dashboard data
        const dashboardSummary = {
          total_logs: totalLogs,
          error_count: errorCount,
          error_percentage: parseFloat(errorRate),
          level_field: primaryLevelField,
          top_levels: logLevelBuckets.slice(0, 5).map((bucket) => ({
            level: bucket.key,
            count: bucket.doc_count || 0,
          })),
          top_services: serviceBuckets.slice(0, 5).map((bucket) => ({
            service: bucket.key,
            count: bucket.doc_count || 0,
          })),
          top_errors: errorTypeBuckets.slice(0, 3).map((bucket) => ({
            message: bucket.key,
            count: bucket.doc_count || 0,
          })),
        };

        return {
          // Include raw data for programmatic access
          data: data,

          // Include a structured summary
          summary: dashboardSummary,

          // Provide formatted text output
          content: [{ type: "text" as const, text: output }],
        };
      } catch (error) {
        const context: ErrorContext = {
          tool: "log-dashboard",
          operation: "log-dashboard",
        };

        // Convert the error response to match expected MCP tool response format
        const errorResponse = handleToolError(error, context);
        return {
          ...errorResponse,
          // Ensure these properties exist to satisfy the MCP tool response interface
          [Symbol.iterator]: undefined,
        } as McpToolResponse;
      }
    },
  );

  // Add a tool for analyzing log patterns
  server.tool(
    "analyze-patterns",
    "Analyze recurring patterns in logs to identify common events and behaviors",
    {
      timeRange: z
        .string()
        .default("24h")
        .describe("Time range to analyze (e.g., '15m', '1h', '7d')"),
      messageField: z
        .string()
        .optional()
        .default("message")
        .describe("Field containing the log message text"),
      patternField: z
        .string()
        .optional()
        .default("message.keyword")
        .describe(
          "Field to use for pattern grouping (typically keyword field)",
        ),
      minCount: z
        .number()
        .optional()
        .default(5)
        .describe("Minimum occurrence count to include in results"),
      maxPatterns: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of patterns to return"),
      filter: z
        .string()
        .optional()
        .describe("Optional query filter to limit logs analyzed"),
      includeExamples: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include example log messages for each pattern"),
    },
    async (
      {
        timeRange = "24h",
        messageField = "message",
        patternField = "message.keyword",
        minCount = 5,
        maxPatterns = 20,
        filter,
        includeExamples = true,
      },
      _extra,
    ) => {
      try {
        // Build base query
        const baseQuery: Record<string, unknown> = {
          bool: {
            filter: buildTimeRange(timeRange),
          },
        };

        // Add filter to base query if provided
        if (filter) {
          const boolQuery = baseQuery.bool as Record<string, unknown>;
          boolQuery.must = {
            query_string: {
              query: filter,
              allow_leading_wildcard: false,
            },
          };
        }

        // Create search parameters for pattern analysis
        const searchParams = {
          size: 0, // We only need aggregations
          query: baseQuery,
          aggs: {
            patterns: {
              terms: {
                field: patternField,
                size: maxPatterns,
                min_doc_count: minCount,
                order: { _count: "desc" },
              },
              ...(includeExamples
                ? {
                    aggs: {
                      examples: {
                        top_hits: {
                          size: 2, // Get a couple of examples per pattern
                          _source: {
                            includes: [
                              messageField,
                              "@timestamp",
                              "level",
                              "service",
                            ],
                          },
                          sort: [{ "@timestamp": "desc" }],
                        },
                      },
                      // Add a time-based aggregation to see when this pattern occurs
                      pattern_over_time: {
                        date_histogram: {
                          field: "@timestamp",
                          fixed_interval: calculateInterval(timeRange),
                          format: "yyyy-MM-dd HH:mm:ss",
                        },
                      },
                    },
                  }
                : {}),
            },
            // Add additional aggregations to help understand pattern distribution
            level_distribution: {
              terms: {
                field: "level.keyword",
                size: 10,
              },
            },
            service_distribution: {
              terms: {
                field: "service.keyword",
                size: 10,
                missing: "unknown", // Handle missing service names
              },
            },
          },
        };

        const data = (await client.search(
          searchParams as unknown as Elasticsearch6SearchParams,
        )) as unknown as EsResponse;

        // Extract pattern buckets
        const patternBuckets = data.aggregations?.patterns?.buckets || [];

        // Extract level distribution
        const levelBuckets =
          data.aggregations?.level_distribution?.buckets || [];

        // Extract service distribution
        const serviceBuckets =
          data.aggregations?.service_distribution?.buckets || [];

        // Format the results for better readability
        let output = "# Log Pattern Analysis Report\n\n";

        if (filter) {
          output += `Analyzing logs matching: "${filter}"\n`;
        }
        output += `Time range: ${timeRange}\n`;
        output += `Minimum pattern occurrences: ${minCount}\n\n`;

        if (patternBuckets.length === 0) {
          output += "## No Significant Patterns Found\n\n";
          output +=
            "No patterns meeting the minimum occurrence threshold were found. You can try:\n";
          output += "- Extending the time range to capture more data\n";
          output += "- Lowering the minimum count threshold\n";
          output += "- Checking if the message field name is correct\n";
          output += `- Using a different field for pattern analysis (current: ${patternField})\n`;
        } else {
          output += `## ${patternBuckets.length} Common Log Patterns\n\n`;

          // Create a table for the patterns
          output += "| # | Pattern | Count | % of Total |\n";
          output += "|---|---------|-------|------------|\n";

          // Calculate total docs for percentage
          const totalDocs = patternBuckets.reduce(
            (sum, bucket) => sum + bucket.doc_count,
            0,
          );

          // Add each pattern
          patternBuckets.forEach((bucket, index) => {
            const pattern =
              typeof bucket.key === "string"
                ? bucket.key
                : JSON.stringify(bucket.key);

            // Truncate long patterns for display
            const displayPattern =
              pattern.length > 80 ? pattern.substring(0, 80) + "..." : pattern;

            const percentage = ((bucket.doc_count / totalDocs) * 100).toFixed(
              1,
            );

            output += `| ${index + 1} | \`${displayPattern}\` | ${bucket.doc_count} | ${percentage}% |\n`;
          });

          // Add examples and deeper analysis for top patterns
          output += "\n## Detailed Pattern Analysis\n\n";

          // Process top N patterns (limited to keep the output manageable)
          const topPatternsToDetail = Math.min(5, patternBuckets.length);

          for (let i = 0; i < topPatternsToDetail; i++) {
            const bucket = patternBuckets[i];
            const pattern =
              typeof bucket.key === "string"
                ? bucket.key
                : JSON.stringify(bucket.key);

            output += `### Pattern ${i + 1}: ${bucket.doc_count} occurrences\n\n`;
            output += "```\n" + pattern + "\n```\n\n";

            // Add examples if available
            if (
              includeExamples &&
              bucket.examples &&
              bucket.examples.hits.hits.length > 0
            ) {
              output += "**Example logs:**\n\n";

              bucket.examples.hits.hits.forEach((hit, idx) => {
                const source = hit._source;
                const timestamp = source["@timestamp"]
                  ? new Date(
                      source["@timestamp"] as string | number,
                    ).toISOString()
                  : "unknown time";
                const level = source["level"] || "unknown";
                const service = source["service"] || "unknown";

                output += `Example ${idx + 1} (${timestamp}):\n`;
                output += `- Level: ${level}\n`;
                output += `- Service: ${service}\n`;
                output +=
                  "```\n" +
                  (source[messageField] || "No message") +
                  "\n```\n\n";
              });
            }

            // Add time distribution if available
            if (bucket.pattern_over_time && bucket.pattern_over_time.buckets) {
              const timeBuckets = bucket.pattern_over_time.buckets.filter(
                (b) => b.doc_count > 0,
              );
              if (timeBuckets.length > 0) {
                output += "**Time distribution:**\n\n";
                const maxCount = Math.max(
                  ...timeBuckets.map((b) => b.doc_count),
                );
                const scaleFactor =
                  maxCount > 10 ? Math.ceil(maxCount / 10) : 1;

                timeBuckets.forEach((timeBucket) => {
                  const barLength = Math.ceil(
                    timeBucket.doc_count / scaleFactor,
                  );
                  const bar = "█".repeat(barLength || 1);
                  const time = timeBucket.key_as_string || "";
                  output += `${time.split(" ")[1] || time}: ${bar} (${timeBucket.doc_count})\n`;
                });
                output += "\n";
              }
            }
          }

          // Add distribution of logs by level
          if (levelBuckets.length > 0) {
            output += "## Log Level Distribution\n\n";
            levelBuckets.forEach((bucket) => {
              const percentage = ((bucket.doc_count / totalDocs) * 100).toFixed(
                1,
              );
              output += `- ${bucket.key}: ${bucket.doc_count} (${percentage}%)\n`;
            });
            output += "\n";
          }

          // Add distribution of logs by service if available
          if (serviceBuckets.length > 0) {
            output += "## Service Distribution\n\n";
            serviceBuckets.forEach((bucket) => {
              const percentage = ((bucket.doc_count / totalDocs) * 100).toFixed(
                1,
              );
              output += `- ${bucket.key}: ${bucket.doc_count} (${percentage}%)\n`;
            });
            output += "\n";
          }
        }

        // Add usage suggestions
        output += "## Next Steps\n\n";
        output +=
          "- To examine specific patterns in more detail, use the following search:\n";
        output += `  \`simple-search({ query: "${patternField}:\\"PATTERN\\"", timeRange: "${timeRange}" })\`\n`;
        output += "- To see how patterns change over time, use:\n";
        output += `  \`log-histogram({ timeRange: "${timeRange}", interval: "${calculateInterval(timeRange)}" })\`\n`;
        output += "- For error pattern analysis specifically, use:\n";
        output += `  \`analyze-errors({ timeRange: "${timeRange}" })\`\n`;

        // Create a structured summary of patterns
        const patternSummary = patternBuckets.map((bucket) => {
          const examples =
            includeExamples &&
            bucket.examples &&
            bucket.examples.hits.hits.length > 0
              ? bucket.examples.hits.hits.map((hit) => ({
                  message: hit._source[messageField],
                  timestamp: hit._source["@timestamp"],
                  level: hit._source["level"],
                  service: hit._source["service"],
                }))
              : [];

          return {
            pattern: bucket.key,
            count: bucket.doc_count,
            examples: examples,
          };
        });

        return {
          // Include raw data for programmatic access
          data: data,

          // Include a structured summary
          summary: {
            total_patterns: patternBuckets.length,
            time_range: timeRange,
            filter: filter || "none",
            min_count: minCount,
            top_patterns: patternSummary.slice(0, 5),
          },

          // Provide formatted text output
          content: [{ type: "text" as const, text: output }],

          // Add related tools for further analysis
          related_tools: {
            search: {
              name: "simple-search",
              description: "Search for specific log patterns",
            },
            errors: {
              name: "analyze-errors",
              description: "Analyze error patterns specifically",
            },
            histogram: {
              name: "log-histogram",
              description: "View log volume over time",
            },
          },
        };
      } catch (error) {
        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "analyze-patterns",
          operation: "pattern_analysis",
          params: {
            timeRange,
            messageField,
            patternField,
            minCount,
            maxPatterns,
            filter,
          },
        };

        // Convert the error response to match expected MCP tool response format
        const errorResponse = handleToolError(error, context);
        return {
          ...errorResponse,
          // Ensure these properties exist to satisfy the MCP tool response interface
          [Symbol.iterator]: undefined,
        } as McpToolResponse;
      }
    },
  );

  // Add a tool for categorizing and analyzing errors by type
  server.tool(
    "categorize-errors",
    "Analyze and categorize errors by type, source, and patterns for deeper error diagnosis",
    {
      timeRange: z
        .string()
        .default("24h")
        .describe("Time range to analyze (e.g., '15m', '1h', '7d')"),
      errorField: z
        .string()
        .optional()
        .default("level")
        .describe("Field name that contains error level information"),
      errorValue: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .default("error")
        .describe(
          "Value(s) in errorField that indicate errors (e.g., 'error', ['error', 'critical'])",
        ),
      categorizeBy: z
        .union([z.string(), z.array(z.string())])
        .describe(
          "Field(s) to use for categorizing errors (e.g., 'component', 'source', 'class')",
        ),
      includeContextFields: z
        .array(z.string())
        .optional()
        .describe("Additional fields to include in error context"),
      minErrorCount: z
        .number()
        .optional()
        .default(5)
        .describe("Minimum error count to include a category"),
      maxCategories: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of error categories to return"),
      includeExamples: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include example error messages for each category"),
      detectErrorTypes: z
        .boolean()
        .optional()
        .default(true)
        .describe(
          "Automatically detect common error types (e.g., NullPointer, Timeout)",
        ),
    },
    async ({
      timeRange = "24h",
      errorField = "level",
      errorValue = "error",
      categorizeBy,
      includeContextFields = [],
      minErrorCount = 5,
      maxCategories = 20,
      includeExamples = true,
      detectErrorTypes = true,
    }) => {
      try {
        // Handle multiple error values if provided as an array
        const errorValues = Array.isArray(errorValue)
          ? errorValue
          : [errorValue];

        // Handle multiple categorization fields
        const categoryFields = Array.isArray(categorizeBy)
          ? categorizeBy
          : [categorizeBy];

        // Build the query to identify errors
        const baseQuery = {
          bool: {
            must: {
              bool: {
                should: errorValues.flatMap((value) => [
                  // Try both exact value and keyword variations
                  { term: { [errorField]: value } },
                  { term: { [errorField]: value.toLowerCase() } },
                  { term: { [errorField]: value.toUpperCase() } },

                  // Try with .keyword suffix if not already present
                  ...(errorField.endsWith(".keyword")
                    ? []
                    : [
                        { term: { [`${errorField}.keyword`]: value } },
                        {
                          term: {
                            [`${errorField}.keyword`]: value.toLowerCase(),
                          },
                        },
                        {
                          term: {
                            [`${errorField}.keyword`]: value.toUpperCase(),
                          },
                        },
                      ]),
                ]),
                minimum_should_match: 1,
              },
            },
            filter: buildTimeRange(timeRange),
          },
        };

        // Prepare aggregations for each category field
        const aggregations: Record<string, unknown> = {};

        // Create primary category aggregation
        const primaryCategoryField = categoryFields[0].endsWith(".keyword")
          ? categoryFields[0]
          : `${categoryFields[0]}.keyword`;

        aggregations.error_categories = {
          terms: {
            field: primaryCategoryField,
            size: maxCategories,
            min_doc_count: minErrorCount,
            order: { _count: "desc" },
          },
          aggs: {},
        };

        // Add nested aggregations for subcategories (if multiple category fields)
        if (categoryFields.length > 1) {
          const subcategoryField = categoryFields[1].endsWith(".keyword")
            ? categoryFields[1]
            : `${categoryFields[1]}.keyword`;

          // Add subcategory aggregation
          (aggregations.error_categories as Record<string, unknown>).aggs = {
            subcategories: {
              terms: {
                field: subcategoryField,
                size: 10,
                min_doc_count: 2,
              },
            },
          };
        }

        // Add example errors if requested
        if (includeExamples) {
          const aggObj = (
            aggregations.error_categories as Record<string, unknown>
          ).aggs as Record<string, unknown>;

          // Add examples and context for errors
          const sourceFields = [
            "message",
            "@timestamp",
            errorField,
            ...includeContextFields,
          ];

          aggObj.context = {
            top_hits: {
              size: 3, // Get 3 examples per category
              _source: {
                includes: sourceFields,
              },
              sort: [{ "@timestamp": "desc" }],
            },
          };

          // Add time trend for categories
          aggObj.trend = {
            date_histogram: {
              field: "@timestamp",
              fixed_interval: calculateInterval(timeRange),
              format: "yyyy-MM-dd HH:mm:ss",
            },
          };
        }

        // Add error severity distribution
        aggregations.error_severity = {
          terms: {
            field: "level.keyword", // Use level for severity
            size: 10,
            order: { _count: "desc" },
          },
        };

        // Add error pattern detection if requested
        if (detectErrorTypes) {
          // Define patterns to match different error types (Java-style exceptions, HTTP errors, etc.)
          aggregations.detected_patterns = {
            terms: {
              field: "message.keyword",
              size: 20,
              min_doc_count: 3,
            },
          };
        }

        // Define search parameters
        const searchParams = {
          size: 0, // Only need aggregations
          query: baseQuery,
          aggs: aggregations,
        };

        // Execute the Elasticsearch query
        const data = (await client.search(
          searchParams as unknown as Elasticsearch6SearchParams,
        )) as unknown as EsResponse;

        // Process results
        // Extract the error categories
        const categoryBuckets =
          data.aggregations?.error_categories?.buckets || [];
        const totalErrors = categoryBuckets.reduce(
          (sum, bucket) => sum + bucket.doc_count,
          0,
        );

        // Extract severity information
        const severityBuckets =
          data.aggregations?.error_severity?.buckets || [];

        // Extract detected patterns if available
        const patternBuckets =
          data.aggregations?.detected_patterns?.buckets || [];

        // Format the results for better readability
        let output = "# Error Categorization Analysis\n\n";
        output += `Time range: ${timeRange}\n`;
        output += `Error criteria: ${errorField} = ${Array.isArray(errorValue) ? errorValue.join(", ") : errorValue}\n`;
        output += `Categorized by: ${Array.isArray(categorizeBy) ? categorizeBy.join(", ") : categorizeBy}\n\n`;

        // Add summary stats
        output += `## Summary\n\n`;
        output += `- Total errors: ${totalErrors}\n`;
        output += `- Error categories: ${categoryBuckets.length}\n`;

        // Add severity breakdown if available
        if (severityBuckets.length > 0) {
          output += `\n## Error Severity Distribution\n\n`;
          severityBuckets.forEach((bucket) => {
            const percentage =
              totalErrors > 0
                ? ((bucket.doc_count / totalErrors) * 100).toFixed(1)
                : "0";
            output += `- ${bucket.key}: ${bucket.doc_count} (${percentage}%)\n`;
          });
        }

        // Add main categorization results
        if (categoryBuckets.length > 0) {
          output += `\n## Error Categories\n\n`;
          output += `| Category | Count | % of Total | Trend |\n`;
          output += `|----------|-------|------------|-------|\n`;

          // Process each category
          categoryBuckets.forEach((bucket) => {
            const categoryName =
              typeof bucket.key === "string"
                ? bucket.key
                : bucket.key.toString();
            const percentage =
              totalErrors > 0
                ? ((bucket.doc_count / totalErrors) * 100).toFixed(1)
                : "0";

            // Create a simple trend indicator based on the last few time buckets (if available)
            const trendIndicator = "—";
            // Note: This part relies on the 'trend' field we added in the aggregation

            output += `| ${categoryName} | ${bucket.doc_count} | ${percentage}% | ${trendIndicator} |\n`;
          });
        } else {
          output += `\n## No Error Categories Found\n\n`;
          output += `No error categories meeting the minimum count threshold (${minErrorCount}) were found.\n`;
          output += `Try modifying your search criteria:\n`;
          output += `- Extend the time range\n`;
          output += `- Lower the minimum error count\n`;
          output += `- Check different error field or values\n`;
          output += `- Try different categorization fields\n`;
        }

        // Add detailed analysis for top categories
        if (categoryBuckets.length > 0 && includeExamples) {
          output += `\n## Detailed Category Analysis\n\n`;

          // Limit to top 5 categories for detail
          const detailCategories = Math.min(5, categoryBuckets.length);

          for (let i = 0; i < detailCategories; i++) {
            const bucket = categoryBuckets[i];
            const categoryName =
              typeof bucket.key === "string"
                ? bucket.key
                : bucket.key.toString();

            output += `### ${i + 1}. ${categoryName} (${bucket.doc_count} errors)\n\n`;

            // Add subcategories if available (requires aggregation setup above)

            // Add example errors if available
            if (bucket.context && bucket.context.hits.hits.length > 0) {
              output += `**Example errors:**\n\n`;

              bucket.context.hits.hits.forEach((hit, idx) => {
                const source = hit._source;
                const timestamp = source["@timestamp"]
                  ? new Date(
                      source["@timestamp"] as string | number,
                    ).toISOString()
                  : "unknown time";
                const level = source[errorField] || errorValue;

                output += `Example ${idx + 1} (${timestamp}):\n`;
                output += `- Level: ${level}\n`;

                // Add any additional context fields
                includeContextFields.forEach((field) => {
                  if (source[field]) {
                    output += `- ${field}: ${source[field]}\n`;
                  }
                });

                // Add the full message
                output +=
                  "```\n" + (source.message || "No message") + "\n```\n\n";
              });
            }
          }
        }

        // Add detected error patterns if available
        if (detectErrorTypes && patternBuckets.length > 0) {
          output += `\n## Common Error Patterns\n\n`;

          // Common error types are not used in this simplified implementation
          // Will be used in a future enhancement for automatic error categorization

          // Group patterns by error type (simplified for space)
          patternBuckets.slice(0, 10).forEach((bucket) => {
            const pattern =
              typeof bucket.key === "string"
                ? bucket.key
                : bucket.key.toString();
            const truncated =
              pattern.length > 120
                ? pattern.substring(0, 120) + "..."
                : pattern;
            output += `- \`${truncated}\` (${bucket.doc_count} occurrences)\n`;
          });
        }

        // Add recommendations section
        output += `\n## Recommendations\n\n`;
        output += `- Review the most frequent error categories and consider creating targeted fixes.\n`;
        output += `- Set up monitoring for these error categories to track improvements.\n`;

        // Add usage tips
        output += `\n## Next Steps\n\n`;
        output += `- For detailed search of specific error categories:\n`;
        output += `  \`simple-search({ query: "${primaryCategoryField}:\\"CATEGORY\\" AND ${errorField}:${errorValue}", timeRange: "${timeRange}" })\`\n`;
        output += `- For trend analysis over time:\n`;
        output += `  \`log-histogram({ query: "${errorField}:${errorValue}", timeRange: "${timeRange}", interval: "${calculateInterval(timeRange)}" })\`\n`;
        output += `- For pattern-based error analysis:\n`;
        output += `  \`analyze-errors({ timeRange: "${timeRange}", errorField: "${errorField}", errorValue: "${errorValue}" })\`\n`;

        // Create a structured summary of error categories
        const categorySummary = categoryBuckets.map((bucket) => {
          return {
            category: bucket.key,
            count: bucket.doc_count,
            percentage:
              totalErrors > 0 ? (bucket.doc_count / totalErrors) * 100 : 0,
          };
        });

        return {
          // Include raw data for programmatic access
          data: data,

          // Include a structured summary
          summary: {
            total_errors: totalErrors,
            time_range: timeRange,
            error_criteria: {
              field: errorField,
              values: Array.isArray(errorValue) ? errorValue : [errorValue],
            },
            top_categories: categorySummary.slice(0, 5),
          },

          // Provide formatted text output
          content: [{ type: "text" as const, text: output }],

          // Add related tools for further analysis
          related_tools: {
            search: {
              name: "simple-search",
              description: "Search for specific error categories",
            },
            patterns: {
              name: "analyze-errors",
              description: "Analyze error patterns in more detail",
            },
            histogram: {
              name: "log-histogram",
              description: "View error trends over time",
            },
          },
        };
      } catch (error) {
        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "categorize-errors",
          operation: "error_categorization",
          params: {
            timeRange,
            errorField,
            errorValue,
            categorizeBy,
            includeContextFields,
            minErrorCount,
            maxCategories,
            includeExamples,
            detectErrorTypes,
          },
        };

        // Use standardized error handler
        const errorResponse = handleToolError(error, context);
        return {
          ...errorResponse,
          // Ensure these properties exist to satisfy the MCP tool response interface
          [Symbol.iterator]: undefined,
        };
      }
    },
  );

  // Add a tool for trend detection
  server.tool(
    "detect-trends",
    "Identify and analyze trends in log data over time, detecting significant patterns and changes",
    {
      timeRange: z
        .string()
        .default("7d")
        .describe("Time range to analyze (e.g., '24h', '7d', '30d')"),
      field: z
        .string()
        .describe(
          "Field to analyze for trends (e.g., 'level', 'service', 'http.status_code')",
        ),
      query: z
        .string()
        .optional()
        .describe("Optional query string to filter logs (e.g., 'level:error')"),
      groupBy: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .describe("Field(s) to group trends by (e.g., 'service', 'host')"),
      interval: z
        .string()
        .optional()
        .describe(
          "Time interval for trend analysis (e.g., '1h', '1d'). If not provided, an appropriate interval will be calculated",
        ),
      minTrendSignificance: z
        .number()
        .optional()
        .default(10)
        .describe("Minimum percentage change to consider a trend significant"),
      maxCategories: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of categories to analyze"),
      includePercentages: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include percentage changes in the results"),
      trendVisualization: z
        .enum(["text", "ascii", "none"])
        .optional()
        .default("ascii")
        .describe("How to visualize trends: text (↑/↓), ascii charts, or none"),
    },
    async ({
      timeRange = "7d",
      field,
      query,
      groupBy,
      interval,
      minTrendSignificance = 10,
      maxCategories = 20,
      includePercentages = true,
      trendVisualization = "ascii",
    }: TrendDetectionParams) => {
      try {
        // Determine appropriate interval if not provided
        const timeInterval = interval || calculateInterval(timeRange);

        // Build base query
        const baseQuery: Record<string, unknown> = {
          bool: {
            filter: buildTimeRange(timeRange),
          },
        };

        // Add text query if provided
        if (query) {
          const boolQuery = baseQuery.bool as Record<string, unknown>;
          boolQuery.must = {
            query_string: {
              query: query,
              allow_leading_wildcard: false,
            },
          };
        }

        // Prepare aggregations for trend analysis
        const mainField = field.endsWith(".keyword")
          ? field
          : `${field}.keyword`;

        // Calculate midpoint of time range to divide into "before" and "after" periods
        const now = new Date();
        const timeValue = parseInt(timeRange.replace(/\D/g, ""));
        const timeUnit = timeRange.replace(/\d/g, "");

        let totalMs;
        switch (timeUnit) {
          case "d":
            totalMs = timeValue * 24 * 60 * 60 * 1000;
            break;
          case "h":
            totalMs = timeValue * 60 * 60 * 1000;
            break;
          case "m":
            totalMs = timeValue * 60 * 1000;
            break;
          default:
            totalMs = 24 * 60 * 60 * 1000; // Default to 24h
        }

        const midPoint = new Date(now.getTime() - totalMs / 2);
        const startPoint = new Date(now.getTime() - totalMs);

        // Define search parameters with aggregations for trend analysis
        const searchParams = {
          size: 0,
          query: baseQuery,
          aggs: {
            // Overall time series for the entire period
            time_series: {
              date_histogram: {
                field: "@timestamp",
                fixed_interval: timeInterval,
                format: "yyyy-MM-dd HH:mm:ss",
              },
              aggs: {
                // Aggregate by the field we want to analyze
                field_values: {
                  terms: {
                    field: mainField,
                    size: maxCategories,
                    order: { _count: "desc" },
                  },
                },
              },
            },
            // Compare first half vs second half of time range
            before_period: {
              filter: {
                range: {
                  "@timestamp": {
                    gte: startPoint.toISOString(),
                    lt: midPoint.toISOString(),
                  },
                },
              },
              aggs: {
                field_values: {
                  terms: {
                    field: mainField,
                    size: maxCategories,
                    order: { _count: "desc" },
                  },
                },
              },
            },
            after_period: {
              filter: {
                range: {
                  "@timestamp": {
                    gte: midPoint.toISOString(),
                    lte: now.toISOString(),
                  },
                },
              },
              aggs: {
                field_values: {
                  terms: {
                    field: mainField,
                    size: maxCategories,
                    order: { _count: "desc" },
                  },
                },
              },
            },
            // Add grouped analysis if groupBy is specified
            ...(groupBy
              ? {
                  group_analysis: {
                    terms: {
                      field: Array.isArray(groupBy) ? groupBy[0] : groupBy,
                      size: maxCategories,
                    },
                    aggs: {
                      before_period: {
                        filter: {
                          range: {
                            "@timestamp": {
                              gte: startPoint.toISOString(),
                              lt: midPoint.toISOString(),
                            },
                          },
                        },
                        aggs: {
                          field_values: {
                            terms: {
                              field: mainField,
                              size: 10,
                            },
                          },
                        },
                      },
                      after_period: {
                        filter: {
                          range: {
                            "@timestamp": {
                              gte: midPoint.toISOString(),
                              lte: now.toISOString(),
                            },
                          },
                        },
                        aggs: {
                          field_values: {
                            terms: {
                              field: mainField,
                              size: 10,
                            },
                          },
                        },
                      },
                    },
                  },
                }
              : {}),
          },
        };

        // Execute the search
        const data = (await client.search(
          searchParams as unknown as Elasticsearch6SearchParams,
        )) as unknown as EsResponse;

        // Process the results
        // Extract time series data
        const timeSeriesBuckets = data.aggregations?.time_series?.buckets || [];

        // Extract before and after period data
        const beforeBuckets =
          data.aggregations?.before_period?.field_values?.buckets || [];
        const afterBuckets =
          data.aggregations?.after_period?.field_values?.buckets || [];

        // Calculate trends
        const trends = calculateTrends(
          beforeBuckets,
          afterBuckets,
          minTrendSignificance,
        );

        // Process group analysis if available
        const groupTrends: Array<{
          group: string | number;
          count: number;
          trends: Trend[];
        }> = [];
        if (groupBy && data.aggregations?.group_analysis?.buckets) {
          data.aggregations.group_analysis.buckets.forEach(
            (groupBucket: {
              key: string | number;
              key_as_string?: string;
              doc_count: number;
              before_period?: {
                doc_count: number;
                field_values?: {
                  buckets: EsAggregationBucket[];
                };
              };
              after_period?: {
                doc_count: number;
                field_values?: {
                  buckets: EsAggregationBucket[];
                };
              };
            }) => {
              const groupBeforeBuckets =
                groupBucket.before_period?.field_values?.buckets || [];
              const groupAfterBuckets =
                groupBucket.after_period?.field_values?.buckets || [];

              const groupTrendData = calculateTrends(
                groupBeforeBuckets,
                groupAfterBuckets,
                minTrendSignificance,
              );

              if (groupTrendData.length > 0) {
                groupTrends.push({
                  group: groupBucket.key,
                  count: groupBucket.doc_count,
                  trends: groupTrendData,
                });
              }
            },
          );
        }

        // Format the results
        let output = `# Trend Analysis for Field: ${field}\n\n`;
        output += `Time range: ${timeRange} (${startPoint.toISOString()} to ${now.toISOString()})\n`;
        if (query) {
          output += `Filter: ${query}\n`;
        }
        output += `Analysis interval: ${timeInterval}\n\n`;

        // Overall summary section
        output += `## Overall Trends\n\n`;

        if (trends.length === 0) {
          output += `No significant trends detected for field '${field}' with the current settings.\n\n`;
          output += `Try adjusting the minimum significance threshold (currently ${minTrendSignificance}%) or analyzing a different field.\n\n`;
        } else {
          output += `Found ${trends.length} significant trends in field '${field}'.\n\n`;

          // Create a trend table
          output += `| Value | Before | After | Change | Trend |\n`;
          output += `|-------|--------|-------|--------|-------|\n`;

          trends.forEach((trend) => {
            const changeText = includePercentages
              ? `${trend.absoluteChange > 0 ? "+" : ""}${trend.absoluteChange} (${trend.percentageChange > 0 ? "+" : ""}${trend.percentageChange.toFixed(1)}%)`
              : `${trend.absoluteChange > 0 ? "+" : ""}${trend.absoluteChange}`;

            let trendIndicator = "";
            if (trendVisualization === "text") {
              trendIndicator =
                trend.trend === "increasing"
                  ? "↑"
                  : trend.trend === "decreasing"
                    ? "↓"
                    : "→";
            } else if (trendVisualization === "ascii") {
              const magnitude = Math.min(
                Math.abs(Math.round(trend.percentageChange / 20)),
                10,
              );
              trendIndicator =
                trend.trend === "increasing"
                  ? "▁▂▃▄▅▆▇█".substring(8 - magnitude)
                  : trend.trend === "decreasing"
                    ? "█▇▆▅▄▃▂▁".substring(0, magnitude)
                    : "▬";
            }

            output += `| ${trend.value} | ${trend.beforeCount} | ${trend.afterCount} | ${changeText} | ${trendIndicator} |\n`;
          });
        }

        // Add time series visualization
        if (timeSeriesBuckets.length > 0) {
          output += `\n## Time Series Analysis\n\n`;

          // Get top 5 values for time series visualization
          const topValues = new Set<string>();
          beforeBuckets
            .slice(0, 5)
            .forEach((bucket) => topValues.add(bucket.key as string));
          afterBuckets
            .slice(0, 5)
            .forEach((bucket) => topValues.add(bucket.key as string));

          // Track counts for each value over time
          const timeData: Record<string, Record<string, number>> = {};

          timeSeriesBuckets.forEach((timeBucket) => {
            const timeKey =
              timeBucket.key_as_string || timeBucket.key.toString();
            timeData[timeKey] = {};

            // Initialize with zeros for all top values
            topValues.forEach((value) => {
              timeData[timeKey][value] = 0;
            });

            // Fill in actual counts
            const fieldValueBuckets = timeBucket.field_values?.buckets || [];
            fieldValueBuckets.forEach((valueBucket) => {
              const value = valueBucket.key as string;
              if (topValues.has(value)) {
                timeData[timeKey][value] = valueBucket.doc_count;
              }
            });
          });

          // Create a simple visualization
          const timeKeys = Object.keys(timeData);
          output += `Time series for top ${topValues.size} values:\n\n`;

          if (trendVisualization === "ascii" && timeKeys.length > 0) {
            // For each top value, create a time series visualization
            topValues.forEach((value) => {
              output += `${value}:\n`;

              // Get counts for this value over time
              const counts = timeKeys.map(
                (timeKey) => timeData[timeKey][value] || 0,
              );
              const maxCount = Math.max(...counts);
              const scaleFactor = maxCount > 20 ? Math.ceil(maxCount / 20) : 1;

              // Create the ASCII chart
              timeKeys.forEach((timeKey, index) => {
                const count = counts[index];
                const barLength = Math.ceil(count / scaleFactor) || 0;
                const bar = "█".repeat(barLength);

                // Format timeKey to just show date or time part depending on interval
                const formattedTime = timeKey.includes(" ")
                  ? timeInterval.includes("d")
                    ? timeKey.split(" ")[0]
                    : timeKey.split(" ")[1]
                  : timeKey;

                output += `${formattedTime} |${bar} ${count}\n`;
              });

              output += "\n";
            });
          }
        }

        // Add group analysis if available
        if (groupTrends.length > 0) {
          output += `\n## Trends by ${Array.isArray(groupBy) ? groupBy[0] : groupBy}\n\n`;

          groupTrends.forEach((groupData) => {
            output += `### ${groupData.group} (${groupData.count} logs)\n\n`;

            if (groupData.trends.length === 0) {
              output += `No significant trends for this group.\n\n`;
            } else {
              // Create a trend table for this group
              output += `| Value | Before | After | Change | Trend |\n`;
              output += `|-------|--------|-------|--------|-------|\n`;

              groupData.trends.slice(0, 5).forEach((trend: Trend) => {
                const changeText = includePercentages
                  ? `${trend.absoluteChange > 0 ? "+" : ""}${trend.absoluteChange} (${trend.percentageChange > 0 ? "+" : ""}${trend.percentageChange.toFixed(1)}%)`
                  : `${trend.absoluteChange > 0 ? "+" : ""}${trend.absoluteChange}`;

                let trendIndicator = "";
                if (trendVisualization === "text") {
                  trendIndicator =
                    trend.trend === "increasing"
                      ? "↑"
                      : trend.trend === "decreasing"
                        ? "↓"
                        : "→";
                } else if (trendVisualization === "ascii") {
                  const magnitude = Math.min(
                    Math.abs(Math.round(trend.percentageChange / 20)),
                    10,
                  );
                  trendIndicator =
                    trend.trend === "increasing"
                      ? "▁▂▃▄▅▆▇█".substring(8 - magnitude)
                      : trend.trend === "decreasing"
                        ? "█▇▆▅▄▃▂▁".substring(0, magnitude)
                        : "▬";
                }

                output += `| ${trend.value} | ${trend.beforeCount} | ${trend.afterCount} | ${changeText} | ${trendIndicator} |\n`;
              });

              output += "\n";
            }
          });
        }

        // Add usage tips and recommendations
        output += `\n## Recommendations\n\n`;

        if (trends.length > 0) {
          const increasingTrends = trends.filter(
            (t) => t.trend === "increasing",
          );
          const decreasingTrends = trends.filter(
            (t) => t.trend === "decreasing",
          );

          if (increasingTrends.length > 0) {
            output += `### Increasing Trends\n\n`;
            output += `The following values show significant increases:\n`;
            increasingTrends.slice(0, 3).forEach((trend) => {
              output += `- **${trend.value}**: Increased by ${trend.percentageChange.toFixed(1)}% (${trend.beforeCount} → ${trend.afterCount})\n`;
            });
            output += `\nConsider investigating why these values are becoming more frequent.\n\n`;
          }

          if (decreasingTrends.length > 0) {
            output += `### Decreasing Trends\n\n`;
            output += `The following values show significant decreases:\n`;
            decreasingTrends.slice(0, 3).forEach((trend) => {
              output += `- **${trend.value}**: Decreased by ${Math.abs(trend.percentageChange).toFixed(1)}% (${trend.beforeCount} → ${trend.afterCount})\n`;
            });
            output += `\nConsider investigating why these values are becoming less frequent.\n\n`;
          }
        }

        // Add next steps
        output += `## Next Steps\n\n`;
        output += `- For deeper analysis of specific trends, use: \`simple-search({ query: "${field}:\\"VALUE\\""  })\`\n`;
        output += `- For more detailed time-based analysis: \`log-histogram({ interval: "${timeInterval}", timeRange: "${timeRange}" })\`\n`;
        output += `- To analyze patterns in these trends: \`analyze-patterns({ timeRange: "${timeRange}" })\`\n`;

        // Prepare structured data for API consumption
        const trendSummary = {
          field: field,
          time_range: timeRange,
          interval: timeInterval,
          filter: query || "none",
          trends: trends.map((trend) => ({
            value: trend.value,
            before: trend.beforeCount,
            after: trend.afterCount,
            absolute_change: trend.absoluteChange,
            percentage_change: trend.percentageChange,
            trend: trend.trend,
          })),
          group_trends: groupTrends.map((groupData) => ({
            group: groupData.group,
            count: groupData.count,
            trends: groupData.trends.map((trend: Trend) => ({
              value: trend.value,
              before: trend.beforeCount,
              after: trend.afterCount,
              absolute_change: trend.absoluteChange,
              percentage_change: trend.percentageChange,
              trend: trend.trend,
            })),
          })),
        };

        return {
          // Include raw data for programmatic access
          data: data,

          // Include a structured summary
          summary: trendSummary,

          // Provide formatted text output
          content: [{ type: "text" as const, text: output }],

          // Add related tools
          related_tools: {
            search: {
              name: "simple-search",
              description: "Search logs containing specific field values",
            },
            patterns: {
              name: "analyze-patterns",
              description: "Find patterns in logs related to trending values",
            },
            histogram: {
              name: "log-histogram",
              description: "See detailed time-based distributions",
            },
          },
        };
      } catch (error) {
        const context: ErrorContext = {
          tool: "detect-trends",
          operation: "trend_analysis",
        };

        // Convert the error response to match expected MCP tool response format
        const errorResponse = handleToolError(error, context);
        return {
          ...errorResponse,
          // Ensure these properties exist to satisfy the MCP tool response interface
          [Symbol.iterator]: undefined,
        } as McpToolResponse;
      }
    },
  );
}

// Helper function to calculate trends between two periods
function calculateTrends(
  beforeBuckets: EsAggregationBucket[],
  afterBuckets: EsAggregationBucket[],
  minSignificance: number,
): Trend[] {
  const trends: Trend[] = [];

  // Create maps for before and after counts
  const beforeCounts = new Map<string, number>();
  const afterCounts = new Map<string, number>();

  // Total documents in each period for calculating percentages
  const beforeTotal = beforeBuckets.reduce(
    (sum, bucket) => sum + bucket.doc_count,
    0,
  );
  const afterTotal = afterBuckets.reduce(
    (sum, bucket) => sum + bucket.doc_count,
    0,
  );

  // Fill maps with counts
  beforeBuckets.forEach((bucket) => {
    beforeCounts.set(bucket.key as string, bucket.doc_count);
  });

  afterBuckets.forEach((bucket) => {
    afterCounts.set(bucket.key as string, bucket.doc_count);
  });

  // Get all unique values
  const allValues = new Set<string>();
  beforeBuckets.forEach((bucket) => allValues.add(bucket.key as string));
  afterBuckets.forEach((bucket) => allValues.add(bucket.key as string));

  // Calculate trends for each value
  allValues.forEach((value) => {
    const beforeCount = beforeCounts.get(value) || 0;
    const afterCount = afterCounts.get(value) || 0;

    // Skip if both counts are 0 or very small
    if (beforeCount <= 2 && afterCount <= 2) {
      return;
    }

    const absoluteChange = afterCount - beforeCount;

    // Calculate normalized percentage change to account for different period sizes
    // Use the average count as the base to avoid division by zero
    const normalizedBeforeCount =
      beforeTotal === 0 ? 0 : beforeCount / beforeTotal;
    const normalizedAfterCount = afterTotal === 0 ? 0 : afterCount / afterTotal;

    let percentageChange = 0;
    if (normalizedBeforeCount > 0) {
      percentageChange =
        ((normalizedAfterCount - normalizedBeforeCount) /
          normalizedBeforeCount) *
        100;
    } else if (normalizedAfterCount > 0) {
      percentageChange = 100; // New appearance (infinite increase)
    }

    // Determine trend direction
    let trend: "increasing" | "decreasing" | "stable" = "stable";
    if (percentageChange >= minSignificance) {
      trend = "increasing";
    } else if (percentageChange <= -minSignificance) {
      trend = "decreasing";
    }

    // Only include significant trends
    if (trend !== "stable" || beforeCount >= 10 || afterCount >= 10) {
      trends.push({
        value,
        beforeCount,
        afterCount,
        absoluteChange,
        percentageChange,
        trend,
      });
    }
  });

  // Sort trends by absolute percentage change (descending)
  return trends.sort(
    (a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange),
  );
}
