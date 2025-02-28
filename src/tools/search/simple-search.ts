import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { querySchema } from "../../schemas/query.js";
import { buildTimeRange } from "../../utils/time.js";
import { formatSearchResults } from "../../utils/formatter.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import { extractSearchSummary } from "../../utils/search/extractors.js";
import { SimpleSearchParams } from "../../types/tools/search.types.js";
import {
  Elasticsearch6SearchParams,
  ElasticsearchQueryDSL,
} from "../../types/elasticsearch.types.js";

/**
 * Registers the simple search tool
 */
export function registerSimpleSearchTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "simple-search",
    "Search logs with a simple text query",
    {
      query: z.union([
        z.string().describe("A simple text query"),
        querySchema.describe("A complex Elasticsearch query DSL object"),
      ]),
      fields: z.array(z.string()).optional(),
      timeRange: z.string().optional(),
      from: z.number().optional(),
      size: z.number().optional(),
      sortField: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
    },
    async ({
      query,
      fields,
      timeRange,
      from,
      size,
      sortField,
      sortOrder,
    }: SimpleSearchParams) => {
      try {
        // Create search params with default pagination
        const searchParams: Partial<Elasticsearch6SearchParams> = {
          from: from ?? 0,
          size: size ?? 10,
        };

        // Process query based on its type (string or object)
        if (typeof query === "string") {
          // Convert string query to a query_string query object
          const queryStringQuery: ElasticsearchQueryDSL = {
            query_string: {
              query: query,
              default_operator: "AND",
              allow_leading_wildcard: false,
            },
          };
          searchParams.query = queryStringQuery;

          // Add fields if specified and query is a string
          if (fields && fields.length > 0 && searchParams.query) {
            // Add fields to query_string using type assertion
            (
              (searchParams.query as Record<string, unknown>)
                .query_string as Record<string, unknown>
            ).fields = fields;
          }
        } else {
          // Use the complex query object directly
          searchParams.query = query as ElasticsearchQueryDSL;
        }

        // Add sort if specified
        if (sortField) {
          searchParams.sort = [{ [sortField]: sortOrder ?? "desc" }];
        }

        // Add time range if specified
        if (timeRange) {
          // Replace the query with a bool query that includes the original query and a time filter
          const timeFilteredQuery: ElasticsearchQueryDSL = {
            bool: {
              must: searchParams.query
                ? Array.isArray(searchParams.query)
                  ? searchParams.query
                  : [searchParams.query]
                : [],
              filter: buildTimeRange(timeRange),
            },
          };
          searchParams.query = timeFilteredQuery;
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
        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "simple-search",
          operation: "elasticsearch_search",
          params: {
            query,
            fields,
            timeRange,
            from,
            size,
            sortField,
            sortOrder,
          },
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
