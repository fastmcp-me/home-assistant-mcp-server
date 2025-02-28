/**
 * Log histogram tool for visualizing log volume over time.
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { buildTimeRange } from "../../utils/time.js";
import { Elasticsearch6SearchParams } from "../../types/elasticsearch.types.js";
import { EsResponse } from "../../types/elasticsearch.js";
import { createAsciiTimeChart } from "./common/visualization.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import { ErrorResponse, SuccessResponse } from "./types/responses.js";

/**
 * Registers a tool for getting log counts over time intervals.
 */
export function registerLogHistogramTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "log-histogram",
    "Get log counts over time intervals for trend analysis",
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
            // Use the common visualization utility to create the chart
            formattedData += createAsciiTimeChart(histogramBuckets, {
              title: "Log Volume Over Time",
              timeFormat: "full",
            });

            // Add summary statistics
            const totalLogs = histogramBuckets.reduce(
              (sum: number, bucket: { doc_count?: number }) =>
                sum + (bucket.doc_count || 0),
              0,
            );
            const avgLogs = Math.round(totalLogs / histogramBuckets.length);

            formattedData += `\n### Summary\n`;
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
        } as SuccessResponse;
      } catch (error) {
        const context: ErrorContext = {
          tool: "log-histogram",
          operation: "histogram_analysis",
          params: { query, interval, timeRange, field },
        };

        return handleToolError(error, context) as ErrorResponse;
      }
    },
  );
}
