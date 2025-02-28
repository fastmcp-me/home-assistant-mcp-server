import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import {
  FieldStatsParams,
  FieldStats,
} from "../../types/tools/fields.types.js";
import {
  createFieldStatsQuery,
  processFieldStatsResponse,
  formatFieldStats,
} from "../../utils/fields/statistics.js";

/**
 * Registers the field-stats tool
 * This tool calculates statistics and analyzes the distribution of a specified field
 */
export function registerFieldStatsTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "field-stats",
    "Analyze statistics and distribution for a specified field",
    {
      field: z
        .string()
        .describe(
          "The field to analyze (e.g., 'level', 'status', '@timestamp')",
        ),
      index: z
        .string()
        .optional()
        .describe(
          "Index pattern to analyze (e.g., 'logstash-*', 'filebeat-*')",
        ),
      timeRange: z
        .string()
        .optional()
        .describe("Time range to analyze (e.g., '15m', '24h', '7d')"),
      maxValues: z
        .number()
        .optional()
        .describe("Maximum number of top values to return"),
      query: z
        .string()
        .optional()
        .describe("Optional query to filter logs before analyzing"),
    },
    async (params: FieldStatsParams) => {
      try {
        // Create the query for field statistics
        const { query, aggs } = createFieldStatsQuery(
          params.field,
          params.timeRange,
          params.query,
        );

        // Execute the query with aggregations
        const searchParams = {
          index: params.index,
          size: 0, // We don't need actual documents, just the aggregations
          query,
          aggs,
        };

        const response = await client.search(searchParams);

        // Process the response to extract field statistics
        const stats = processFieldStatsResponse(response, params.field);

        // Format the results for display
        const formattedStats = formatFieldStats(stats);

        return {
          // Include the raw statistics for programmatic access
          data: stats,

          // Include a structured summary with the key information
          summary: {
            field: stats.field,
            type: stats.type,
            doc_count: stats.doc_count,
            coverage: stats.coverage,
            unique_values: stats.unique_values,
          },

          // Provide formatted text for human-readable output
          content: [
            {
              type: "text",
              text: formattedStats,
            },
          ],
        };
      } catch (error) {
        // Log the error for server-side debugging
        console.error(`Error in field-stats tool:`, error);

        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "field-stats",
          operation: "elasticsearch_field_stats",
          params: params,
        };

        // Use centralized error handler for standardized error response
        const errorResponse = handleToolError(error, context);
        return {
          ...errorResponse,
          [Symbol.iterator]: undefined,
        } as any;
      }
    },
  );
}
