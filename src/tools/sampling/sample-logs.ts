import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { buildTimeRange } from "../../utils/time.js";
import { formatSearchResults } from "../../utils/formatter.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import {
  SampleLogsParams,
  SampleLogsMetadata,
} from "../../types/tools/sampling.types.js";
import {
  ElasticsearchQueryDSL,
  Elasticsearch6SearchParams,
} from "../../types/elasticsearch.types.js";

/**
 * Registers the sample-logs tool for extracting random samples from logs
 */
export function registerSampleLogsTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "sample-logs",
    "Get a random sample of logs with optional filtering",
    {
      query: z
        .string()
        .optional()
        .describe("Optional query string to filter logs (e.g., 'level:error')"),
      timeRange: z
        .string()
        .optional()
        .default("24h")
        .describe("Time range to sample from (e.g., '1h', '7d')"),
      sampleSize: z
        .number()
        .optional()
        .default(10)
        .describe("Number of log entries to sample"),
      seedValue: z
        .number()
        .optional()
        .describe("Optional seed value for reproducible random sampling"),
      fields: z
        .array(z.string())
        .optional()
        .describe("Optional specific fields to include in results"),
      distinctField: z
        .string()
        .optional()
        .describe(
          "Optional field to ensure distinct values (e.g., 'host.keyword')",
        ),
      format: z
        .enum(["text", "json"])
        .optional()
        .default("text")
        .describe("Response format: text for human-readable, json for data"),
    },
    async (params: SampleLogsParams) => {
      try {
        // Extract parameters with defaults
        const {
          query,
          timeRange = "24h",
          sampleSize = 10,
          seedValue,
          fields,
          distinctField,
          format = "text",
        } = params;

        // Create base search parameters
        let searchParams: Record<string, unknown> = {
          size: sampleSize,
        };

        // Build the query
        const boolQuery: ElasticsearchQueryDSL = {
          bool: {
            filter: buildTimeRange(timeRange),
          },
        };

        // Add text query if provided
        if (query) {
          if (boolQuery.bool) {
            (boolQuery.bool as Record<string, unknown>).must = {
              query_string: {
                query: query,
                allow_leading_wildcard: false,
              },
            };
          }
        }

        searchParams.query = boolQuery;

        // Add random sampling using a function score query
        // We'll wrap our existing query in a function_score query for random sampling
        const randomSeed =
          seedValue !== undefined
            ? seedValue
            : Math.floor(Math.random() * 10000);
        searchParams.query = {
          function_score: {
            query: searchParams.query,
            functions: [
              {
                random_score: {
                  seed: randomSeed,
                },
              },
            ],
          },
        };

        // Add fields if specified
        if (fields && fields.length > 0) {
          searchParams._source = fields;
        }

        // Handle distinct field sampling if requested
        if (distinctField) {
          // First get the total number of distinct values
          const countParams = {
            size: 0,
            query: boolQuery,
            aggs: {
              distinct_values: {
                cardinality: {
                  field: distinctField,
                },
              },
            },
          };

          // Get count of distinct values
          const countResult = await client.search(countParams);
          // Use type assertion to handle the aggregation property
          const aggregations =
            (countResult?.aggregations as Record<string, unknown>) || {};
          const distinctCount =
            ((aggregations?.distinct_values as Record<string, unknown>)
              ?.value as number) || 0;

          // If we have distinct values, use terms aggregation to get one sample per value
          if (distinctCount > 0) {
            // Calculate actual sample size based on available distinct values
            const effectiveSampleSize = Math.min(distinctCount, sampleSize);

            // Use terms aggregation with top_hits to get distinct values
            searchParams = {
              size: 0,
              query: boolQuery,
              aggs: {
                distinct_samples: {
                  terms: {
                    field: distinctField,
                    size: effectiveSampleSize,
                    order: {
                      _key: "asc", // Deterministic ordering by key
                    },
                  },
                  aggs: {
                    sample: {
                      top_hits: {
                        size: 1,
                        _source: fields && fields.length > 0 ? fields : true,
                        sort: [
                          {
                            _score: {
                              order: "desc",
                            },
                          },
                        ],
                      },
                    },
                  },
                },
              },
            };
          }
        }

        // Execute the search
        const data = await client.search(
          searchParams as Elasticsearch6SearchParams,
        );

        // Process the results
        let processedResults: Record<string, unknown>[] = [];
        let totalHits = 0;

        // Use type assertions for the complex objects
        const aggregations =
          (data.aggregations as Record<string, unknown>) || {};
        const hits = (data.hits as Record<string, unknown>) || {};

        if (
          distinctField &&
          (aggregations?.distinct_samples as Record<string, unknown>)?.buckets
        ) {
          // Extract results from distinct sampling aggregation
          const buckets = (
            aggregations.distinct_samples as Record<string, unknown>
          ).buckets as unknown[];
          totalHits =
            ((hits.total as Record<string, unknown>)?.value as number) ||
            buckets.length;

          processedResults = buckets
            .map((bucket: Record<string, unknown>) => {
              if (
                bucket.sample &&
                (bucket.sample as Record<string, unknown>).hits &&
                (
                  (bucket.sample as Record<string, unknown>).hits as Record<
                    string,
                    unknown
                  >
                ).hits &&
                (
                  (
                    (bucket.sample as Record<string, unknown>).hits as Record<
                      string,
                      unknown
                    >
                  ).hits as unknown[]
                ).length > 0
              ) {
                return (
                  (
                    (bucket.sample as Record<string, unknown>).hits as Record<
                      string,
                      unknown
                    >
                  ).hits as unknown[]
                )[0] as Record<string, unknown>;
              }
              return null;
            })
            .filter(Boolean) as Record<string, unknown>[];
        } else {
          // Process regular search results
          if (hits && (hits.hits as unknown[])) {
            totalHits =
              ((hits.total as Record<string, unknown>)?.value as number) ||
              (hits.hits as unknown[]).length;
            processedResults = hits.hits as Record<string, unknown>[];
          }
        }

        // Format the output
        let output = "";
        if (format === "text") {
          if (processedResults.length === 0) {
            output = `No logs found for the specified criteria.\n\nTry broadening your search by:\n- Using a larger time range\n- Removing or simplifying the query filter\n- Reducing the sample size\n`;
          } else {
            output = `## Log Sample Results\n\n`;
            output += `Randomly sampled ${processedResults.length} of ${totalHits} logs`;
            output += query ? ` matching "${query}"` : "";
            output += ` from the last ${timeRange}`;
            output += distinctField
              ? ` with distinct values for "${distinctField}"`
              : "";
            output += `.\n\n`;

            if (seedValue !== undefined) {
              output += `Seed value: ${seedValue} (use this to reproduce the same sample)\n\n`;
            }

            // For distinct sampling, include distribution info
            if (
              distinctField &&
              (aggregations?.distinct_samples as Record<string, unknown>)
                ?.buckets
            ) {
              const buckets = (
                aggregations.distinct_samples as Record<string, unknown>
              ).buckets as unknown[];
              output += `### Distribution by ${distinctField}:\n\n`;
              buckets.forEach((bucket: Record<string, unknown>) => {
                output += `- ${bucket.key}: ${bucket.doc_count} logs\n`;
              });
              output += `\n`;
            }

            output += formatSearchResults({
              hits: { hits: processedResults, total: { value: totalHits } },
            });

            // Add usage tips
            output += `\n### Usage Tips\n`;
            output += `- For different random samples, run again without specifying a seed value\n`;
            output += `- To get the same sample again, use seedValue: ${randomSeed}\n`;
            output += `- For detailed log analysis, use the log-dashboard or analyze-errors tools\n`;
          }
        } else {
          // JSON format requested - return raw data
          return {
            data: data,
            sample: {
              size: processedResults.length,
              total_logs: totalHits,
              time_range: timeRange,
              query: query || "all logs",
              seed: randomSeed,
              distinct_field: distinctField,
            },
            content: [
              {
                type: "text",
                text: JSON.stringify(data, null, 2),
              },
            ],
          };
        }

        // Prepare the metadata
        const metadata: SampleLogsMetadata = {
          size: processedResults.length,
          total_logs: totalHits,
          time_range: timeRange,
          query: query || "all logs",
          seed: randomSeed,
          distinct_field: distinctField,
        };

        // Return results with helpful metadata
        return {
          data: data,
          sample: metadata,
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      } catch (error) {
        // Log the error for server-side debugging
        console.error(`Error in sample-logs tool:`, error);

        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "sample-logs",
          operation: "elasticsearch_sample",
          params: params,
        };

        // Create a more helpful error message based on the error type
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        let userMessage = `Error sampling logs: ${errorMessage}`;

        if (errorMessage.includes("parsing_exception")) {
          userMessage = `Error: Invalid query syntax in "${params.query}". Please check your query format.`;
        } else if (
          errorMessage.includes("field_not_found") ||
          (errorMessage.includes("field [") &&
            errorMessage.includes("] not found"))
        ) {
          userMessage = `Error: Field "${params.distinctField || params.fields?.join(", ")}" not found. Make sure this field exists in your logs.`;
        }

        // Use centralized error handler
        const errorResponse = handleToolError(error, context);

        // Add more specific troubleshooting suggestions
        errorResponse.troubleshooting.suggestions = [
          "Verify field names are correct",
          "Check query syntax",
          "Try a different time range",
          "Ensure API credentials are valid",
          "Consider using a smaller sample size",
        ];

        return {
          ...errorResponse,
          [Symbol.iterator]: undefined,
        } as any;
      }
    },
  );
}
