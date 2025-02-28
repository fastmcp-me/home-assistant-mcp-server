import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import { buildTimeRange } from "../../utils/time.js";
import { Elasticsearch6SearchParams } from "../../types/elasticsearch.types.js";

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

// Common log issue patterns with their regex patterns and descriptions
const COMMON_ISSUE_PATTERNS = [
  {
    id: "null_pointer",
    name: "Null Pointer Exception",
    patterns: [
      "NullPointerException",
      "null pointer",
      "Cannot read property .* of (null|undefined)",
      "TypeError: .* is (null|undefined)",
    ],
    description: "Accessing properties or methods of null/undefined objects",
    severity: "high",
    category: "application_error",
  },
  {
    id: "connection_timeout",
    name: "Connection Timeout",
    patterns: [
      "Connection timed? ?out",
      "ConnectTimeoutException",
      "ReadTimeoutException",
      "timeout waiting for connection",
      "Request timed? ?out",
      "SocketTimeoutException",
    ],
    description: "Connection to a service or database taking too long",
    severity: "high",
    category: "infrastructure",
  },
  {
    id: "authentication_failure",
    name: "Authentication Failure",
    patterns: [
      "Authentication failed",
      "Invalid credentials",
      "Login failed",
      "Unauthorized access",
      "401 Unauthorized",
      "Access denied",
      "Bad credentials",
    ],
    description: "Failed login attempts or invalid authentication tokens",
    severity: "medium",
    category: "security",
  },
  {
    id: "rate_limit",
    name: "Rate Limit Exceeded",
    patterns: [
      "Rate limit exceeded",
      "Too many requests",
      "429 Too Many Requests",
      "ThrottlingException",
      "Request rate exceeds",
    ],
    description: "API or service rate limits reached",
    severity: "medium",
    category: "infrastructure",
  },
  {
    id: "out_of_memory",
    name: "Out of Memory",
    patterns: [
      "OutOfMemoryError",
      "Out of memory",
      "Not enough memory",
      "MemoryError",
      "Memory quota exceeded",
      "Allocation failed",
    ],
    description: "Application or service running out of memory",
    severity: "high",
    category: "resource",
  },
  {
    id: "database_connection",
    name: "Database Connection Failure",
    patterns: [
      "Cannot connect to database",
      "Database connection failed",
      "Connection refused",
      "Unable to open connection",
      "Could not open JDBC connection",
      "MongoDB connection error",
      "SQL connection error",
    ],
    description: "Unable to establish or maintain database connections",
    severity: "high",
    category: "infrastructure",
  },
  {
    id: "deadlock",
    name: "Deadlock Detected",
    patterns: [
      "Deadlock found",
      "Deadlock detected",
      "DeadlockException",
      "Circular wait condition",
    ],
    description: "Thread or process deadlocks preventing execution",
    severity: "high",
    category: "application_error",
  },
  {
    id: "disk_space",
    name: "Disk Space Issues",
    patterns: [
      "No space left on device",
      "Disk quota exceeded",
      "Insufficient disk space",
      "Cannot write file",
      "FileSystemException: No space",
    ],
    description: "Running out of disk space",
    severity: "high",
    category: "resource",
  },
  {
    id: "permission_denied",
    name: "Permission Denied",
    patterns: [
      "Permission denied",
      "AccessDeniedException",
      "Forbidden",
      "403 Forbidden",
      "Insufficient privileges",
    ],
    description: "Lack of permissions to access a resource",
    severity: "medium",
    category: "security",
  },
  {
    id: "certificate_error",
    name: "Certificate Error",
    patterns: [
      "Certificate verification failed",
      "SSL certificate error",
      "Untrusted certificate",
      "Certificate has expired",
      "Self[-\\s]signed certificate",
      "PKIX path building failed",
      "CertificateException",
    ],
    description: "SSL/TLS certificate validation issues",
    severity: "medium",
    category: "security",
  },
  {
    id: "index_out_of_bounds",
    name: "Index Out of Bounds",
    patterns: [
      "IndexOutOfBoundsException",
      "ArrayIndexOutOfBounds",
      "Index out of range",
      "Index exceeds array bounds",
    ],
    description: "Accessing array or list elements beyond valid indices",
    severity: "medium",
    category: "application_error",
  },
  {
    id: "data_format",
    name: "Data Format Error",
    patterns: [
      "ParseException",
      "Malformed JSON",
      "Invalid format",
      "NumberFormatException",
      "DateTimeParseException",
      "Syntax error",
      "Unexpected token",
      "Cannot deserialize",
    ],
    description: "Issues parsing or processing data formats",
    severity: "medium",
    category: "application_error",
  },
  {
    id: "circuit_breaker",
    name: "Circuit Breaker Open",
    patterns: [
      "Circuit breaker open",
      "Circuit breaker tripped",
      "Service unavailable",
      "Fallback method called",
    ],
    description: "Circuit breaker pattern preventing cascading failures",
    severity: "high",
    category: "infrastructure",
  },
  {
    id: "missing_resource",
    name: "Resource Not Found",
    patterns: [
      "Resource not found",
      "FileNotFoundException",
      "404 Not Found",
      "NoSuchElementException",
      "No such file or directory",
    ],
    description: "Files, API resources, or database records not found",
    severity: "medium",
    category: "application_error",
  },
  {
    id: "query_timeout",
    name: "Query Timeout",
    patterns: [
      "Query timed? ?out",
      "Statement cancelled due to timeout",
      "Query execution time exceeded",
      "PG::QueryCanceled",
      "SQLTimeoutException",
    ],
    description: "Database queries taking too long to complete",
    severity: "medium",
    category: "performance",
  },
];

/**
 * Registers the recognize-issues tool
 * This tool analyzes logs to identify common issue patterns and problems
 */
export function registerPatternRecognitionTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "recognize-issues",
    "Identify common issue patterns in logs such as errors, timeouts, and resource problems",
    {
      timeRange: z
        .string()
        .optional()
        .default("24h")
        .describe("Time range to analyze (e.g., '15m', '1h', '7d')"),
      messageField: z
        .string()
        .optional()
        .default("message")
        .describe("Field containing log messages to analyze"),
      levelField: z
        .string()
        .optional()
        .default("level")
        .describe("Field containing log level information"),
      query: z
        .string()
        .optional()
        .describe("Optional query to filter logs before analysis"),
      maxSamples: z
        .number()
        .optional()
        .default(10000)
        .describe("Maximum number of log samples to analyze"),
      includeExamples: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include example log messages for each pattern"),
      minOccurrences: z
        .number()
        .optional()
        .default(5)
        .describe("Minimum occurrences required to report an issue"),
      customPatterns: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            patterns: z.array(z.string()),
            description: z.string().optional(),
            severity: z.enum(["low", "medium", "high"]).optional(),
            category: z.string().optional(),
          }),
        )
        .optional()
        .describe(
          "Custom issue patterns to search for in addition to built-in patterns",
        ),
    },
    async ({
      timeRange = "24h",
      messageField = "message",
      levelField = "level",
      query,
      maxSamples = 10000,
      includeExamples = true,
      minOccurrences = 5,
      customPatterns = [],
    }) => {
      try {
        // Combine built-in patterns with any custom patterns
        const allPatterns = [...COMMON_ISSUE_PATTERNS, ...customPatterns];

        // Build base query to filter logs by time range
        const baseQuery: Record<string, unknown> = {
          bool: {
            filter: buildTimeRange(timeRange),
          },
        };

        // Add additional query filter if provided
        if (query) {
          const boolQuery = baseQuery.bool as Record<string, unknown>;
          boolQuery.must = {
            query_string: {
              query,
              default_operator: "AND",
            },
          };
        }

        // Decide how to distribute the search across patterns
        const patternBatchSize = 5; // Search for 5 patterns at a time to avoid query complexity issues
        const patternBatches: Array<typeof allPatterns> = [];

        for (let i = 0; i < allPatterns.length; i += patternBatchSize) {
          patternBatches.push(allPatterns.slice(i, i + patternBatchSize));
        }

        // Initialize results storage
        const recognizedIssues: Record<
          string,
          {
            id: string;
            name: string;
            description: string;
            severity: string;
            category: string;
            count: number;
            examples: Array<{
              message: string;
              timestamp?: string;
              level?: string;
              [key: string]: unknown;
            }>;
          }
        > = {};

        // Process each batch of patterns
        for (const patternBatch of patternBatches) {
          // Create a query with terms for each pattern in this batch
          const batchQuery = {
            ...baseQuery,
            bool: {
              ...(baseQuery.bool as Record<string, unknown>),
              should: patternBatch.flatMap((pattern) =>
                pattern.patterns.map((regex) => ({
                  regexp: {
                    [messageField]: {
                      value: regex,
                      flags: "ALL",
                      case_insensitive: true,
                    },
                  },
                })),
              ),
              minimum_should_match: 1,
            },
          };

          // Define search parameters with aggregations for pattern analysis
          const searchParams = {
            size: includeExamples ? 100 : 0, // Get examples if requested
            query: batchQuery,
            _source: includeExamples
              ? [messageField, "@timestamp", levelField, "service", "host"]
              : false,
            // Track total hits for accurate counts
            track_total_hits: true,
            // Use aggregations to count matches for each pattern
            aggs: {
              pattern_matches: {
                filters: {
                  filters: Object.fromEntries(
                    patternBatch.map((pattern) => [
                      pattern.id,
                      {
                        bool: {
                          should: pattern.patterns.map((regex) => ({
                            regexp: {
                              [messageField]: {
                                value: regex,
                                flags: "ALL",
                                case_insensitive: true,
                              },
                            },
                          })),
                          minimum_should_match: 1,
                        },
                      },
                    ]),
                  ),
                },
              },
            },
          };

          // Execute the search
          const response = await client.search(
            searchParams as unknown as Elasticsearch6SearchParams,
          );
          const data = response as Record<string, unknown>;

          // Extract aggregation results
          const aggregations = data.aggregations as
            | Record<string, unknown>
            | undefined;
          const patternMatches = aggregations?.pattern_matches as
            | Record<string, unknown>
            | undefined;
          const patternAggs = patternMatches?.buckets as
            | Record<string, unknown>
            | Record<string, never>;

          // Process each pattern's results
          for (const pattern of patternBatch) {
            const patternBucket = patternAggs[pattern.id] as
              | Record<string, unknown>
              | undefined;
            const patternCount = (patternBucket?.doc_count as number) || 0;

            // Skip patterns with fewer occurrences than the minimum
            if (patternCount < minOccurrences) {
              continue;
            }

            // Extract examples for this pattern if requested
            const examples: Array<{
              message: string;
              timestamp?: string;
              level?: string;
              [key: string]: unknown;
            }> = [];

            if (includeExamples) {
              // Get hits data safely with type assertions
              const hits = data.hits as Record<string, unknown> | undefined;
              const hitsArray = hits?.hits as
                | Array<Record<string, unknown>>
                | undefined;

              if (hitsArray && hitsArray.length > 0) {
                // Filter hits to only include ones matching this pattern's regex
                const regexPatterns = pattern.patterns.map(
                  (p) => new RegExp(p, "i"),
                );

                for (const hit of hitsArray) {
                  const source = hit._source as
                    | Record<string, unknown>
                    | undefined;
                  if (source) {
                    const message = source[messageField] as string;
                    if (
                      message &&
                      regexPatterns.some((regex) => regex.test(message))
                    ) {
                      examples.push({
                        message,
                        timestamp: source["@timestamp"] as string | undefined,
                        level: source[levelField] as string | undefined,
                        service: source.service as string | undefined,
                        host: source.host as string | undefined,
                      });

                      // Limit examples per pattern
                      if (examples.length >= 3) {
                        break;
                      }
                    }
                  }
                }
              }
            }

            // Store the results
            recognizedIssues[pattern.id] = {
              id: pattern.id,
              name: pattern.name,
              description: pattern.description || "",
              severity: pattern.severity || "medium",
              category: pattern.category || "unknown",
              count: patternCount,
              examples,
            };
          }
        }

        // Convert results to array and sort by count
        const issueArray = Object.values(recognizedIssues).sort(
          (a, b) => b.count - a.count,
        );

        // Format the output
        let output = "# Log Issue Pattern Recognition Report\n\n";
        output += `Time Range: ${timeRange}\n`;
        if (query) {
          output += `Filter: ${query}\n`;
        }
        output += `\n`;

        // Add summary section
        if (issueArray.length === 0) {
          output += "## Summary\n\n";
          output +=
            "No common issue patterns were detected in the logs based on current criteria.\n\n";
          output += "### Suggestions\n\n";
          output += "- Try increasing the time range\n";
          output +=
            "- Reduce the minimum occurrences threshold (currently " +
            minOccurrences +
            ")\n";
          output +=
            "- Check if the message field name is correct (currently '" +
            messageField +
            "')\n";
          output +=
            "- Consider adding custom patterns specific to your application\n";
        } else {
          output += "## Summary\n\n";
          output += `Detected ${issueArray.length} issue patterns in your logs.\n\n`;

          // Add overview table
          output += "| Issue Pattern | Category | Severity | Count |\n";
          output += "|---------------|----------|----------|-------|\n";

          issueArray.forEach((issue) => {
            let severityIcon = "";
            switch (issue.severity) {
              case "high":
                severityIcon = "🔴";
                break;
              case "medium":
                severityIcon = "🟠";
                break;
              case "low":
                severityIcon = "🟡";
                break;
            }

            output += `| ${issue.name} | ${issue.category} | ${severityIcon} ${issue.severity} | ${issue.count} |\n`;
          });

          output += "\n";

          // Group issues by category
          const issuesByCategory: Record<string, typeof issueArray> = {};

          issueArray.forEach((issue) => {
            if (!issuesByCategory[issue.category]) {
              issuesByCategory[issue.category] = [];
            }
            issuesByCategory[issue.category].push(issue);
          });

          // Add detailed section for each category
          output += "## Detailed Analysis\n\n";

          Object.entries(issuesByCategory).forEach(([category, issues]) => {
            output += `### ${category.charAt(0).toUpperCase() + category.slice(1)} Issues\n\n`;

            issues.forEach((issue) => {
              output += `#### ${issue.name} (${issue.count} occurrences)\n\n`;
              output += `**Severity**: ${issue.severity}\n\n`;
              output += `**Description**: ${issue.description}\n\n`;

              if (includeExamples && issue.examples.length > 0) {
                output += "**Examples**:\n\n";

                issue.examples.forEach((example, idx) => {
                  const timestamp = example.timestamp
                    ? new Date(example.timestamp).toISOString()
                    : "unknown time";

                  output += `Example ${idx + 1} (${timestamp}):\n`;
                  if (example.level) output += `Level: ${example.level}\n`;
                  if (example.service)
                    output += `Service: ${example.service}\n`;
                  if (example.host) output += `Host: ${example.host}\n`;

                  output += "```\n" + example.message + "\n```\n\n";
                });
              }
            });

            output += "\n";
          });

          // Add recommendations based on issues found
          output += "## Recommendations\n\n";

          const highSeverityIssues = issueArray.filter(
            (i) => i.severity === "high",
          );
          if (highSeverityIssues.length > 0) {
            output += "### High Priority Issues\n\n";
            output +=
              "The following high-severity issues should be addressed first:\n\n";

            highSeverityIssues.forEach((issue) => {
              output += `- **${issue.name}** (${issue.count} occurrences): ${issue.description}\n`;
            });

            output += "\n";
          }

          // Add category-specific recommendations
          if (issuesByCategory.infrastructure) {
            output += "### Infrastructure Recommendations\n\n";
            output +=
              "- Review connection timeouts and consider adjusting timeout settings\n";
            output +=
              "- Check for resource constraints in your infrastructure\n";
            output += "- Verify network connectivity between services\n\n";
          }

          if (issuesByCategory.application_error) {
            output += "### Application Recommendations\n\n";
            output +=
              "- Implement proper null checking for NullPointerExceptions\n";
            output +=
              "- Add validation for input data to prevent format errors\n";
            output +=
              "- Review resource management practices in your application\n\n";
          }

          if (issuesByCategory.security) {
            output += "### Security Recommendations\n\n";
            output +=
              "- Review authentication mechanisms for potential improvements\n";
            output +=
              "- Check SSL certificate configurations and expiration dates\n";
            output +=
              "- Ensure proper permission management across services\n\n";
          }
        }

        // Add next steps section
        output += "## Next Steps\n\n";
        output +=
          "- Use `analyze-errors` for deeper analysis of error patterns\n";
        output +=
          "- Use `simple-search` to find specific occurrences of these issues\n";
        output += "- Use `log-dashboard` to monitor these issues over time\n";

        // Prepare the results for the response
        const result = {
          // Include a structured summary of detected issues
          summary: {
            total_issues_found: issueArray.length,
            time_range: timeRange,
            query: query || "none",
            issues: issueArray.map((issue) => ({
              id: issue.id,
              name: issue.name,
              category: issue.category,
              severity: issue.severity,
              count: issue.count,
            })),
          },

          // Include detailed issue data
          issues: issueArray,

          // Provide formatted text output
          content: [{ type: "text" as const, text: output }],

          // Add related tools
          related_tools: {
            analyze: {
              name: "analyze-errors",
              description: "Analyze error patterns in logs",
            },
            search: {
              name: "simple-search",
              description: "Search logs for specific error patterns",
            },
            dashboard: {
              name: "log-dashboard",
              description: "Monitor logs and errors over time",
            },
          },
        };

        return result;
      } catch (error) {
        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "recognize-issues",
          operation: "pattern_recognition",
          params: {
            timeRange,
            messageField,
            levelField,
            query,
            maxSamples,
            includeExamples,
            minOccurrences,
          },
        };

        // Use standardized error handler
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
