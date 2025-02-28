import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { querySchema } from "../../schemas/query.js";
import { buildTimeRange } from "../../utils/time.js";
import { formatSearchResults } from "../../utils/formatter.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import { extractSearchSummary } from "../../utils/search/extractors.js";
import { QuickSearchParams } from "../../types/tools/search.types.js";
import {
  Elasticsearch6SearchParams,
  ElasticsearchQueryDSL,
} from "../../types/elasticsearch.types.js";

/**
 * Registers the quick search tool
 */
export function registerQuickSearchTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "quick-search",
    "Perform a simple log search with user-friendly output",
    {
      query: z.union([
        z.string().describe("A simple text query"),
        querySchema.describe("A complex Elasticsearch query DSL object"),
      ]),
      timeRange: z.string().optional().default("24h"),
      maxResults: z.number().optional().default(10),
      fields: z.array(z.string()).optional(),
    },
    async ({
      query,
      timeRange = "24h",
      maxResults = 10,
      fields,
    }: QuickSearchParams) => {
      try {
        // Process query based on its type
        let queryObject: ElasticsearchQueryDSL;

        if (typeof query === "string") {
          queryObject = {
            query_string: {
              query: query,
              default_operator: "AND",
              allow_leading_wildcard: false,
            },
          };
        } else {
          queryObject = query as ElasticsearchQueryDSL;
        }

        // Create the bool query with must and filter clauses
        const boolQuery: ElasticsearchQueryDSL = {
          bool: {
            must: queryObject,
            filter: buildTimeRange(timeRange),
          },
        };

        const searchParams: Partial<Elasticsearch6SearchParams> = {
          query: boolQuery,
          size: maxResults,
          sort: [{ "@timestamp": "desc" }],
        };

        // Add fields if specified
        if (fields && fields.length > 0) {
          searchParams._source = fields;
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
          tool: "quick-search",
          operation: "elasticsearch_search",
          params: { query, fields, timeRange, maxResults },
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
