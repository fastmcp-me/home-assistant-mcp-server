import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../api/logzio.js";
import { buildTimeRange } from "../utils/time.js";
import { formatSearchResults } from "../utils/formatter.js";

export function registerAdvancedTools(server: McpServer, client: LogzioClient) {
  // Add a tool for searching logs by service and severity level
  server.tool(
    "service-logs",
    "Search logs for a specific service with optional severity filter",
    {
      service: z
        .string()
        .describe("Service name to search for (e.g., 'api-gateway')"),
      level: z
        .string()
        .optional()
        .describe("Log level to filter by (e.g., 'error', 'info')"),
      timeRange: z
        .string()
        .optional()
        .default("24h")
        .describe("Time range to search (e.g., '1h', '7d')"),
      maxResults: z
        .number()
        .optional()
        .default(20)
        .describe("Maximum number of results to return"),
      additionalFilter: z
        .string()
        .optional()
        .describe("Additional query filters (e.g., 'message:*exception*')"),
    },
    async ({
      service,
      level,
      timeRange = "24h",
      maxResults = 20,
      additionalFilter,
    }) => {
      try {
        // Build query based on parameters
        const mustClauses: Record<string, unknown>[] = [
          { term: { "service.keyword": service } },
        ];

        if (level) {
          mustClauses.push({ term: { "level.keyword": level } });
        }

        if (additionalFilter) {
          mustClauses.push({
            query_string: {
              query: additionalFilter,
              allow_leading_wildcard: false,
            },
          });
        }

        const searchParams = {
          query: {
            bool: {
              must: mustClauses,
              filter: buildTimeRange(timeRange),
            },
          },
          size: maxResults,
          sort: [{ "@timestamp": "desc" }],
        };

        const data = await client.search(searchParams);

        // Type assertion for the response
        interface SearchResponse {
          hits?: {
            total?: { value?: number };
            hits?: Array<{
              _source?: Record<string, unknown>;
            }>;
          };
          aggregations?: {
            services?: {
              buckets?: Array<{
                key: string;
                doc_count: number;
              }>;
            };
          };
        }

        const typedData = data as SearchResponse;

        // Format the data for better readability
        const formattedResults = formatSearchResults(data);

        // Extract available fields
        const fieldNames = new Set<string>();
        if (typedData.hits?.hits) {
          typedData.hits.hits.forEach((hit) => {
            if (hit._source) {
              Object.keys(hit._source).forEach((key) => fieldNames.add(key));
            }
          });
        }

        // Determine alternative services if no results
        let alternativeServices: string[] = [];
        const totalHits = typedData.hits?.total?.value || 0;

        // If no results found, try to find available services
        if (totalHits === 0) {
          try {
            // Query for available services
            const servicesQuery = {
              size: 0,
              query: {
                bool: {
                  filter: buildTimeRange(timeRange),
                },
              },
              aggs: {
                services: {
                  terms: {
                    field: "service.keyword",
                    size: 10,
                  },
                },
              },
            };

            const servicesData = (await client.search(
              servicesQuery,
            )) as SearchResponse;

            // Type safe extraction of alternative services
            if (servicesData.aggregations?.services?.buckets) {
              alternativeServices = servicesData.aggregations.services.buckets
                .map((bucket) => bucket.key)
                .filter((s) => s !== service);
            }
          } catch (e) {
            // Silently fail if we can't get alternatives
            console.error("Failed to fetch alternative services", e);
          }
        }

        // Prepare message for no results case
        let noResultsMessage = "";
        if (totalHits === 0) {
          noResultsMessage = `No logs found for service "${service}"`;
          if (level) noResultsMessage += ` with level "${level}"`;
          if (additionalFilter)
            noResultsMessage += ` matching "${additionalFilter}"`;
          noResultsMessage += ` in the last ${timeRange}.\n\n`;

          // Add suggestions
          noResultsMessage += "### Suggestions\n\n";

          // Include alternative services if found
          if (alternativeServices.length > 0) {
            noResultsMessage += "Available services:\n";
            alternativeServices.forEach((s) => {
              noResultsMessage += `- Try searching for: \`service-logs({ service: "${s}" })\`\n`;
            });
            noResultsMessage += "\n";
          }

          noResultsMessage += "Troubleshooting tips:\n";
          noResultsMessage +=
            "- Check that the service name is spelled correctly\n";
          noResultsMessage +=
            "- Try a longer time range (e.g., '7d' instead of '24h')\n";
          noResultsMessage +=
            "- Use the `get-fields` tool to discover available services\n";
          noResultsMessage += "- Try searching without the level filter\n";
        }

        // Prepare response
        return {
          // Include raw data for programmatic access
          data: data,

          // Include a structured summary
          summary: {
            service: service,
            level: level || "any",
            total_logs: totalHits,
            time_range: timeRange,
            available_fields: Array.from(fieldNames),
            alternative_services: alternativeServices,
          },

          // Provide formatted text output
          content: [
            {
              type: "text",
              text: totalHits > 0 ? formattedResults : noResultsMessage,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Create a more helpful error message based on the error type
        let userMessage = `Service log search failed: ${errorMessage}`;

        if (errorMessage.includes("parsing_exception")) {
          userMessage = `Error: Invalid syntax in additionalFilter: "${additionalFilter}". Please check your query format.`;
        } else if (errorMessage.includes("field_expansion_exception")) {
          userMessage = `Error: Too many fields matched your filter. Please use more specific field names.`;
        } else if (errorMessage.includes("404")) {
          userMessage = `Error: Index not found. Please check your index pattern or confirm that data exists for the specified time range.`;
        } else if (errorMessage.includes("401")) {
          userMessage = `Error: Authentication failed. Please check your API credentials.`;
        }

        return {
          isError: true,
          error: errorMessage,
          troubleshooting: {
            suggestions: [
              "Check service name spelling",
              "Try a different time range",
              "Check additionalFilter syntax",
              "Verify API credentials",
            ],
            related_commands: [
              "get-fields() to discover available fields",
              "log-dashboard() to see active services",
            ],
          },
          content: [{ type: "text" as const, text: userMessage }],
        };
      }
    },
  );

  // Add a tool for tracing requests across services
  server.tool(
    "trace-request",
    "Trace a request across multiple services using a request ID or correlation ID",
    {
      requestId: z.string(),
      idField: z.string().optional().default("request_id"),
      timeRange: z.string().optional().default("1h"),
      maxResults: z.number().optional().default(100),
    },
    async ({
      requestId,
      idField = "request_id",
      timeRange = "1h",
      maxResults = 100,
    }) => {
      try {
        // Build query to find logs with this request ID
        const searchParams = {
          query: {
            bool: {
              must: [
                {
                  multi_match: {
                    query: requestId,
                    fields: [
                      idField,
                      "request_id",
                      "correlation_id",
                      "trace_id",
                      "span_id",
                      "requestId",
                      "request.id",
                    ],
                  },
                },
              ],
              filter: buildTimeRange(timeRange),
            },
          },
          size: maxResults,
          sort: [{ "@timestamp": "asc" }],
          _source: true,
        };

        interface EsResponse {
          took: number;
          hits: {
            total: { value: number; relation: string };
            hits: Array<{
              _source: {
                "@timestamp"?: string;
                service?: string;
                level?: string;
                severity?: string;
                message?: string;
                [key: string]: unknown;
              };
            }>;
          };
        }

        const data = (await client.search(
          searchParams,
        )) as unknown as EsResponse;

        if (!data.hits || !data.hits.hits || data.hits.hits.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No logs found with request ID: ${requestId}`,
              },
            ],
          };
        }

        // Format the results as a trace timeline
        let output = `## Request Trace: ${requestId}\n\n`;
        output += `Found ${data.hits.total.value} logs related to this request ID\n\n`;

        const services = new Set<string>();
        data.hits.hits.forEach((hit) => {
          if (hit._source.service) {
            services.add(hit._source.service);
          }
        });

        output += `Services involved: ${Array.from(services).join(", ")}\n\n`;
        output += "### Timeline\n\n";

        data.hits.hits.forEach((hit, index) => {
          const source = hit._source;
          const timestamp = source["@timestamp"] || "Unknown time";
          const service = source.service || "Unknown service";
          const level = source.level || source.severity || "";
          const message = source.message || JSON.stringify(source);

          output += `${index + 1}. **[${timestamp}]** ${service} (${level})\n`;
          output += `   ${message}\n\n`;
        });

        return {
          content: [{ type: "text" as const, text: output }],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Request tracing failed: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );

  // Add a tool to create common query builders
  server.tool(
    "build-query",
    "Generate a query for common log search patterns",
    {
      queryType: z.enum([
        "error-search",
        "service-health",
        "performance-issues",
        "user-activity",
        "security-events",
        "custom",
      ]),
      parameters: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ queryType, parameters = {} }) => {
      try {
        let query: Record<string, unknown>;
        let explanation = "";

        switch (queryType) {
          case "error-search":
            query = {
              bool: {
                should: [
                  { term: { "level.keyword": "error" } },
                  { term: { "severity.keyword": "error" } },
                  { term: { "log_level.keyword": "ERROR" } },
                  { wildcard: { message: "*exception*" } },
                  { wildcard: { message: "*error*" } },
                ],
                minimum_should_match: 1,
              },
            };

            // Add service filter if specified
            if (parameters.service) {
              const boolQuery = query.bool as Record<string, unknown>;
              boolQuery.filter = [
                { term: { "service.keyword": parameters.service } },
              ];
            }

            // Add specific error type if specified
            if (parameters.errorType) {
              const boolQuery = query.bool as Record<string, unknown>;
              boolQuery.must = [{ match: { message: parameters.errorType } }];
            }

            explanation =
              "This query searches for error logs across different error indicators " +
              "(level field, message content) and can be filtered by service and error type.";
            break;

          case "service-health":
            query = {
              bool: {
                filter: [
                  {
                    term: {
                      "service.keyword": parameters.service || "application",
                    },
                  },
                ],
              },
            };

            // Add status code range if monitoring HTTP services
            if (parameters.includeStatusCodes) {
              const boolQuery = query.bool as Record<string, unknown>;
              boolQuery.should = [
                {
                  range: {
                    status_code: {
                      gte: 500,
                    },
                  },
                },
                {
                  range: {
                    "response.status": {
                      gte: 500,
                    },
                  },
                },
              ];
              boolQuery.minimum_should_match = 1;
            }

            explanation =
              "This query monitors service health by tracking logs from a specific service " +
              "and optionally filtering for status codes indicating problems.";
            break;

          case "performance-issues":
            query = {
              bool: {
                should: [
                  {
                    range: {
                      duration: {
                        gte: parameters.thresholdMs || 1000,
                      },
                    },
                  },
                  {
                    range: {
                      response_time: {
                        gte: parameters.thresholdMs || 1000,
                      },
                    },
                  },
                  {
                    match_phrase: {
                      message: "slow",
                    },
                  },
                  {
                    match_phrase: {
                      message: "timeout",
                    },
                  },
                ],
                minimum_should_match: 1,
              },
            };

            explanation =
              "This query identifies performance issues by looking for logs with high duration/response times " +
              "or messages indicating slowness or timeouts.";
            break;

          case "user-activity":
            if (!parameters.userId) {
              return {
                content: [
                  {
                    type: "text",
                    text: "Error: userId parameter is required for user-activity query type",
                  },
                ],
              };
            }

            query = {
              bool: {
                should: [
                  { term: { "user.id": parameters.userId } },
                  { term: { userId: parameters.userId } },
                  { term: { user_id: parameters.userId } },
                  { term: { username: parameters.userId } },
                  { term: { "user.name": parameters.userId } },
                ],
                minimum_should_match: 1,
              },
            };

            explanation =
              "This query tracks activity for a specific user across various user identifier fields.";
            break;

          case "security-events":
            query = {
              bool: {
                should: [
                  { term: { "level.keyword": "alert" } },
                  { term: { "level.keyword": "critical" } },
                  { match_phrase: { message: "authentication failure" } },
                  { match_phrase: { message: "failed login" } },
                  { match_phrase: { message: "unauthorized" } },
                  { match_phrase: { message: "permission denied" } },
                  { match_phrase: { message: "security" } },
                ],
                minimum_should_match: 1,
              },
            };

            // Add IP filter if specified
            if (parameters.ip) {
              const boolQuery = query.bool as Record<string, unknown>;
              boolQuery.filter = [{ term: { ip: parameters.ip } }];
            }

            explanation =
              "This query focuses on security-related events like authentication failures, " +
              "permission issues, and other security alerts.";
            break;

          case "custom":
            if (!parameters.customQuery) {
              return {
                content: [
                  {
                    type: "text",
                    text: "Error: customQuery parameter is required for custom query type",
                  },
                ],
              };
            }

            try {
              const customQueryStr = parameters.customQuery as string;
              query = JSON.parse(customQueryStr);
              explanation = "Custom query provided by user.";
            } catch (e) {
              return {
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `Error parsing custom query: ${e instanceof Error ? e.message : String(e)}`,
                  },
                ],
              };
            }
            break;
        }

        // Build the complete search params
        const searchParams = {
          query: query,
          size: parameters.size || 10,
        };

        // Add time range if specified
        if (parameters.timeRange) {
          const timeRangeStr = parameters.timeRange as string;
          const queryBool = (searchParams.query as Record<string, unknown>)
            .bool as Record<string, unknown>;
          queryBool.filter = queryBool.filter || [];

          if (Array.isArray(queryBool.filter)) {
            queryBool.filter.push(buildTimeRange(timeRangeStr));
          } else {
            queryBool.filter = [queryBool.filter, buildTimeRange(timeRangeStr)];
          }
        }

        // Generate example usage
        const searchExample = `search-logs({
  query: ${JSON.stringify(searchParams.query, null, 2)},
  size: ${searchParams.size}
})`;

        let output = "## Generated Query\n\n";
        output +=
          "```json\n" + JSON.stringify(searchParams, null, 2) + "\n```\n\n";
        output += "### Explanation\n\n" + explanation + "\n\n";
        output += "### Example Usage\n\n";
        output += "To use this query with the search-logs tool:\n\n";
        output += "```\n" + searchExample + "\n```\n\n";
        output += "### Query Customization Tips\n\n";

        // Add query-specific tips
        switch (queryType) {
          case "error-search":
            output +=
              '- Add specific error messages with: `message:"exact error phrase"`\n';
            output += "- Filter by service: `service:your-service-name`\n";
            output += "- Look for patterns: `message:*timeout*`\n";
            break;
          case "service-health":
            output += "- Add response time thresholds: `response_time:>1000`\n";
            output += "- Filter by endpoint: `path:/api/users*`\n";
            output +=
              "- Focus on specific status codes: `status_code:[500 TO 599]`\n";
            break;
          case "performance-issues":
            output +=
              '- Filter by specific operation: `operation:"database query"`\n';
            output += "- Set custom thresholds: `duration:>500`\n";
            output += "- Look for specific components: `component:database`\n";
            break;
          case "user-activity":
            output += "- Filter by action: `action:login`\n";
            output +=
              "- Look for specific outcomes: `outcome:success OR outcome:failure`\n";
            output += "- Focus on IP addresses: `ip:192.168.*`\n";
            break;
          case "security-events":
            output += '- Look for specific threats: `threat:"SQL injection"`\n';
            output += "- Filter by severity: `severity:high`\n";
            output += "- Focus on specific users: `user:admin`\n";
            break;
        }

        return {
          // Include structured data for programmatic access
          data: searchParams,

          // Include sample usage information
          examples: {
            search_logs: searchExample,
            curl_example: `curl -X POST https://api.logz.io/v1/search -H "X-API-TOKEN: <YOUR_API_TOKEN_HERE>" -d '${JSON.stringify(searchParams)}'`,
          },

          query_type: queryType,
          explanation: explanation,

          // Provide formatted text output
          content: [{ type: "text" as const, text: output }],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Create a more helpful error message based on the error type
        let userMessage = `Query builder failed: ${errorMessage}`;

        if (errorMessage.includes("user-activity") && !parameters.userId) {
          userMessage = `Error: The 'userId' parameter is required for user-activity queries. Please provide a user ID.`;
        } else if (errorMessage.includes("custom") && !parameters.customQuery) {
          userMessage = `Error: The 'customQuery' parameter is required for custom queries. Please provide a JSON query.`;
        } else if (errorMessage.includes("JSON")) {
          userMessage = `Error: Invalid JSON format in the customQuery parameter. Please check the syntax.`;
        }

        // Prepare suggestion examples
        const examples = {
          "error-search": `build-query({ queryType: "error-search", parameters: { service: "api" } })`,
          "user-activity": `build-query({ queryType: "user-activity", parameters: { userId: "user123" } })`,
          custom: `build-query({ queryType: "custom", parameters: { customQuery: '{"term":{"field":"value"}}' } })`,
        };

        return {
          isError: true,
          error: errorMessage,
          troubleshooting: {
            suggestions: [
              "Check parameter requirements for the query type",
              "Verify JSON syntax in custom queries",
              "Ensure required parameters are provided",
            ],
            examples: examples,
          },
          content: [{ type: "text" as const, text: userMessage }],
        };
      }
    },
  );
}
