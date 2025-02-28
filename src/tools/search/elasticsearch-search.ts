import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { Elasticsearch6SearchSchema } from "../../schemas/elasticsearch.js";
import { formatSearchResults } from "../../utils/formatter.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import { extractSearchSummary } from "../../utils/search/extractors.js";
import { ExtendedSearchParams } from "../../types/tools/search.types.js";
import {
  Elasticsearch6SearchParams,
  ElasticsearchQueryDSL,
} from "../../types/elasticsearch.types.js";

/**
 * Registers the main Elasticsearch search tool
 */
export function registerElasticsearchSearchTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "search-logs",
    "Search logs using Elasticsearch DSL",
    {
      ...Elasticsearch6SearchSchema.shape,
      dayOffset: z.number().optional(),
    },
    async (params) => {
      try {
        // Clone the params to modify them before sending to Logz.io
        const searchParams: Partial<Elasticsearch6SearchParams> = { ...params };
        const dayOffset = (params as ExtendedSearchParams).dayOffset;
        delete (searchParams as Record<string, unknown>).dayOffset;

        // Remove our custom dayOffset parameter if it exists and convert to a time range
        if (dayOffset !== undefined) {
          const now = new Date();
          const pastDate = new Date(
            now.getTime() - dayOffset * 24 * 60 * 60 * 1000,
          );

          // Add timestamp range query if not already defined
          if (!searchParams.query) {
            // Create a simple range query for timestamp
            const rangeQuery: ElasticsearchQueryDSL = {
              range: {
                "@timestamp": {
                  gte: pastDate.toISOString(),
                  lte: now.toISOString(),
                },
              },
            };
            searchParams.query = rangeQuery;
          } else {
            // If query exists, wrap it in a bool query with the timestamp range
            const timestampFilter = {
              range: {
                "@timestamp": {
                  gte: pastDate.toISOString(),
                  lte: now.toISOString(),
                },
              },
            };

            const boolQuery: ElasticsearchQueryDSL = {
              bool: {
                must: Array.isArray(searchParams.query)
                  ? searchParams.query
                  : [searchParams.query],
                filter: timestampFilter,
              },
            };

            searchParams.query = boolQuery;
          }
        }

        const data = await client.search(searchParams);

        // Get formatted results for better readability
        const formattedResults = formatSearchResults(data);

        // Extract search summary information safely
        const summary = extractSearchSummary(data);

        return {
          // Include the raw data for programmatic access
          data: data,

          // Include a structured summary for easier access to key information
          summary,

          // Provide formatted text for human-readable output
          content: [
            {
              type: "text",
              text: formattedResults,
            },
          ],
        };
      } catch (error) {
        // Log the error for server-side debugging
        console.error(`Error in search-logs tool:`, error);

        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "search-logs",
          operation: "elasticsearch_search",
          params: params,
        };

        // Use centralized error handler for standardized error response
        // Convert the error response to match expected MCP tool response format
        const errorResponse = handleToolError(error, context);
        return {
          ...errorResponse,
          // Ensure these properties exist to satisfy the MCP tool response interface
          [Symbol.iterator]: undefined,
        } as any;
      }
    },
  );
}
