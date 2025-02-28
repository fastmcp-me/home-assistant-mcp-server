import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import { buildTimeRange, calculateInterval } from "../../utils/time.js";
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

/**
 * Common error pattern categories with their corresponding regex patterns
 */
const ERROR_PATTERN_CATEGORIES = [
  {
    id: "exception_errors",
    name: "Exception Errors",
    patterns: [
      "Exception",
      "Error",
      "Throwable",
      "Failure",
      "Failed",
      "NullPointerException",
      "IllegalArgumentException",
      "RuntimeException",
    ],
    description: "Application exception or error messages",
  },
  {
    id: "timeout_errors",
    name: "Timeout Errors",
    patterns: [
      "Timeout",
      "Timed out",
      "Connection timed out",
      "Read timed out",
      "Deadline exceeded",
      "Request timeout",
    ],
    description: "Timeout-related errors and issues",
  },
  {
    id: "connection_errors",
    name: "Connection Errors",
    patterns: [
      "Connection refused",
      "Connection reset",
      "Connection failed",
      "Unable to connect",
      "Cannot connect",
      "Connection error",
      "Connection closed",
    ],
    description: "Network and connection failures",
  },
  {
    id: "authentication_errors",
    name: "Authentication Errors",
    patterns: [
      "Authentication failed",
      "Not authorized",
      "Unauthorized",
      "Invalid credentials",
      "Access denied",
      "Authentication error",
      "401",
      "403",
    ],
    description: "Authentication and authorization failures",
  },
  {
    id: "database_errors",
    name: "Database Errors",
    patterns: [
      "SQL error",
      "Database error",
      "Query failed",
      "Database connection",
      "Duplicate entry",
      "Deadlock",
      "Lock wait timeout",
      "Foreign key constraint",
    ],
    description: "Database-related errors and failures",
  },
  {
    id: "resource_errors",
    name: "Resource Errors",
    patterns: [
      "Out of memory",
      "OutOfMemoryError",
      "No space left",
      "Disk full",
      "Resource exhausted",
      "Insufficient resources",
      "Too many open files",
      "MemoryError",
    ],
    description: "Resource depletion and availability issues",
  },
];

/**
 * Registers the error-trend-detection tool
 * This tool analyzes error patterns over time to detect trends and recurring issues
 */
export function registerErrorTrendDetectionTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "detect-error-trends",
    "Identify and analyze error trends, patterns, and recurring issues over time",
    {
      timeRange: z
        .string()
        .default("7d")
        .describe("Time range to analyze (e.g., '24h', '7d', '30d')"),
      errorField: z
        .string()
        .default("level")
        .describe("Field containing log level/severity information"),
      errorValues: z
        .union([z.string(), z.array(z.string())])
        .default(["error", "ERROR", "fatal", "FATAL", "critical", "CRITICAL"])
        .describe("Values in errorField that indicate errors"),
      messageField: z
        .string()
        .default("message")
        .describe("Field containing the log message to analyze"),
      interval: z
        .string()
        .optional()
        .describe(
          "Time interval for trend analysis (e.g., '1h', '1d'). If not provided, an appropriate interval will be calculated",
        ),
      categorizeBy: z
        .union([z.string(), z.array(z.string())])
        .optional()
        .default(["service"])
        .describe("Field(s) to group errors by (e.g., 'service', 'component')"),
      customPatterns: z
        .array(
          z.object({
            id: z.string(),
            name: z.string(),
            patterns: z.array(z.string()),
            description: z.string().optional(),
          }),
        )
        .optional()
        .describe(
          "Custom error pattern categories to analyze in addition to built-in patterns",
        ),
      minOccurrences: z
        .number()
        .optional()
        .default(5)
        .describe(
          "Minimum occurrences required to include a pattern in results",
        ),
    },
    async ({
      timeRange = "7d",
      errorField = "level",
      errorValues = [
        "error",
        "ERROR",
        "fatal",
        "FATAL",
        "critical",
        "CRITICAL",
      ],
      messageField = "message",
      interval,
      categorizeBy = ["service"],
      customPatterns = [],
      minOccurrences = 5,
    }) => {
      try {
        // Convert errorValues to array if it's a string
        const errorValuesArray = Array.isArray(errorValues)
          ? errorValues
          : [errorValues];

        // Calculate the appropriate interval if not provided
        const timeInterval = interval || calculateInterval(timeRange);

        // Build base query to find errors
        const baseQuery: Record<string, unknown> = {
          bool: {
            must: {
              bool: {
                should: errorValuesArray.flatMap((value) => [
                  // Try both the exact value and keyword variations to improve matching
                  { term: { [errorField]: value } },
                  ...(errorField.endsWith(".keyword")
                    ? []
                    : [{ term: { [`${errorField}.keyword`]: value } }]),
                ]),
                minimum_should_match: 1,
              },
            },
            filter: buildTimeRange(timeRange),
          },
        };

        // Combine built-in patterns with any custom patterns
        const allPatterns = [...ERROR_PATTERN_CATEGORIES, ...customPatterns];

        // Prepare categorizeBy fields (ensure they have .keyword suffix if needed)
        const categoryFields = (
          Array.isArray(categorizeBy) ? categorizeBy : [categorizeBy]
        ).map((field) =>
          field.endsWith(".keyword") ? field : `${field}.keyword`,
        );

        // Create primary category field for aggregation
        const primaryCategoryField = categoryFields[0];

        // Calculate time divisions for trend analysis
        // Get the appropriate interval for time histogram
        const timeHistogramInterval = timeInterval;

        // Define search parameters with our aggregations
        const searchParams = {
          size: 0, // We only need aggregations
          query: baseQuery,
          aggs: {
            // First, get overall error count by time interval
            errors_over_time: {
              date_histogram: {
                field: "@timestamp",
                fixed_interval: timeHistogramInterval,
                format: "yyyy-MM-dd HH:mm:ss",
              },
            },

            // Then categorize errors by the primary field
            error_categories: {
              terms: {
                field: primaryCategoryField,
                size: 20, // Get top 20 categories
                order: { _count: "desc" },
                min_doc_count: minOccurrences,
              },
              aggs: {
                // For each category, track errors over time
                over_time: {
                  date_histogram: {
                    field: "@timestamp",
                    fixed_interval: timeHistogramInterval,
                    format: "yyyy-MM-dd HH:mm:ss",
                  },
                },
                // And include a sample of the latest errors
                samples: {
                  top_hits: {
                    size: 2,
                    sort: [{ "@timestamp": "desc" }],
                    _source: {
                      includes: [
                        messageField,
                        "@timestamp",
                        errorField,
                        ...categoryFields,
                      ],
                    },
                  },
                },
              },
            },

            // Analyze patterns in error messages
            error_patterns: {
              filters: {
                filters: Object.fromEntries(
                  allPatterns.map((pattern) => [
                    pattern.id,
                    {
                      bool: {
                        must: [
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
                        ],
                      },
                    },
                  ]),
                ),
              },
              aggs: {
                // Track each pattern over time
                over_time: {
                  date_histogram: {
                    field: "@timestamp",
                    fixed_interval: timeHistogramInterval,
                    format: "yyyy-MM-dd HH:mm:ss",
                  },
                },
                // Add samples for each pattern
                samples: {
                  top_hits: {
                    size: 2,
                    sort: [{ "@timestamp": "desc" }],
                    _source: {
                      includes: [
                        messageField,
                        "@timestamp",
                        errorField,
                        ...categoryFields,
                      ],
                    },
                  },
                },
              },
            },
          },
        };

        // Execute the search
        const response = await client.search(
          searchParams as unknown as Elasticsearch6SearchParams,
        );

        // Process the response with safe type assertions
        const data = response as Record<string, unknown>;
        const aggregations =
          (data.aggregations as Record<string, unknown>) || {};

        // Extract time-based data with safe type assertions
        const errorsOverTime =
          (aggregations.errors_over_time as Record<string, unknown>) || {};
        const timeData =
          (errorsOverTime.buckets as Array<{
            key_as_string?: string;
            key: number;
            doc_count: number;
          }>) || [];

        // Extract category data with safe type assertions
        const errorCategories =
          (aggregations.error_categories as Record<string, unknown>) || {};
        const categoryData =
          (errorCategories.buckets as Array<{
            key: string;
            doc_count: number;
            over_time?: {
              buckets: Array<{
                key_as_string?: string;
                key: number;
                doc_count: number;
              }>;
            };
            samples?: {
              hits: {
                hits: Array<{
                  _source: Record<string, unknown>;
                }>;
              };
            };
          }>) || [];

        // Extract pattern data with safe type assertions
        const errorPatterns =
          (aggregations.error_patterns as Record<string, unknown>) || {};
        const patternBuckets =
          (errorPatterns.buckets as Record<
            string,
            {
              doc_count: number;
              over_time?: {
                buckets: Array<{
                  key_as_string?: string;
                  key: number;
                  doc_count: number;
                }>;
              };
              samples?: {
                hits: {
                  hits: Array<{
                    _source: Record<string, unknown>;
                  }>;
                };
              };
            }
          >) || {};

        // Calculate total error count
        const totalErrors = timeData.reduce(
          (sum, bucket) => sum + bucket.doc_count,
          0,
        );

        // Process pattern data and filter out patterns with low counts
        const patternData = Object.entries(patternBuckets)
          .map(([id, data]) => {
            // Find the pattern definition
            const patternDef = allPatterns.find((p) => p.id === id) || {
              id,
              name: id,
              description: "Custom pattern",
              patterns: [],
            };

            return {
              id,
              name: patternDef.name,
              description: patternDef.description || "",
              count: data.doc_count,
              percentage:
                totalErrors > 0 ? (data.doc_count / totalErrors) * 100 : 0,
              timeData: data.over_time?.buckets || [],
              samples: data.samples?.hits.hits.map((hit) => hit._source) || [],
            };
          })
          .filter((pattern) => pattern.count >= minOccurrences)
          .sort((a, b) => b.count - a.count);

        // Calculate trends
        // Compare first half vs second half of the time range
        const midIndex = Math.floor(timeData.length / 2);
        const firstHalfData = timeData.slice(0, midIndex);
        const secondHalfData = timeData.slice(midIndex);

        const firstHalfCount = firstHalfData.reduce(
          (sum, bucket) => sum + bucket.doc_count,
          0,
        );
        const secondHalfCount = secondHalfData.reduce(
          (sum, bucket) => sum + bucket.doc_count,
          0,
        );

        // Calculate overall trend
        const overallTrend = {
          firstHalf: firstHalfCount,
          secondHalf: secondHalfCount,
          change: secondHalfCount - firstHalfCount,
          changePercentage:
            firstHalfCount > 0
              ? ((secondHalfCount - firstHalfCount) / firstHalfCount) * 100
              : 0,
          trend:
            secondHalfCount > firstHalfCount
              ? "increasing"
              : secondHalfCount < firstHalfCount
                ? "decreasing"
                : "stable",
        };

        // Calculate pattern trends
        const patternTrends = patternData.map((pattern) => {
          const timeData = pattern.timeData;
          const midIndex = Math.floor(timeData.length / 2);
          const firstHalfData = timeData.slice(0, midIndex);
          const secondHalfData = timeData.slice(midIndex);

          const firstHalfCount = firstHalfData.reduce(
            (sum, bucket) => sum + bucket.doc_count,
            0,
          );
          const secondHalfCount = secondHalfData.reduce(
            (sum, bucket) => sum + bucket.doc_count,
            0,
          );

          return {
            ...pattern,
            trend: {
              firstHalf: firstHalfCount,
              secondHalf: secondHalfCount,
              change: secondHalfCount - firstHalfCount,
              changePercentage:
                firstHalfCount > 0
                  ? ((secondHalfCount - firstHalfCount) / firstHalfCount) * 100
                  : 0,
              direction:
                secondHalfCount > firstHalfCount
                  ? "increasing"
                  : secondHalfCount < firstHalfCount
                    ? "decreasing"
                    : "stable",
            },
          };
        });

        // Calculate category trends
        const categoryTrends = categoryData.map((category) => {
          const timeData = category.over_time?.buckets || [];
          const midIndex = Math.floor(timeData.length / 2);
          const firstHalfData = timeData.slice(0, midIndex);
          const secondHalfData = timeData.slice(midIndex);

          const firstHalfCount = firstHalfData.reduce(
            (sum, bucket) => sum + bucket.doc_count,
            0,
          );
          const secondHalfCount = secondHalfData.reduce(
            (sum, bucket) => sum + bucket.doc_count,
            0,
          );

          return {
            name: category.key,
            count: category.doc_count,
            percentage:
              totalErrors > 0 ? (category.doc_count / totalErrors) * 100 : 0,
            samples:
              category.samples?.hits.hits.map((hit) => hit._source) || [],
            trend: {
              firstHalf: firstHalfCount,
              secondHalf: secondHalfCount,
              change: secondHalfCount - firstHalfCount,
              changePercentage:
                firstHalfCount > 0
                  ? ((secondHalfCount - firstHalfCount) / firstHalfCount) * 100
                  : 0,
              direction:
                secondHalfCount > firstHalfCount
                  ? "increasing"
                  : secondHalfCount < firstHalfCount
                    ? "decreasing"
                    : "stable",
            },
          };
        });

        // Find significant trends - patterns with notable changes
        const significantPatternTrends = patternTrends
          .filter((pattern) => Math.abs(pattern.trend.changePercentage) > 20) // Show patterns with >20% change
          .sort(
            (a, b) =>
              Math.abs(b.trend.changePercentage) -
              Math.abs(a.trend.changePercentage),
          );

        // Find significant category trends
        const significantCategoryTrends = categoryTrends
          .filter((category) => Math.abs(category.trend.changePercentage) > 20) // Show categories with >20% change
          .sort(
            (a, b) =>
              Math.abs(b.trend.changePercentage) -
              Math.abs(a.trend.changePercentage),
          );

        // Create a comprehensive output
        let output = "# Error Trend Analysis Report\n\n";
        output += `Time Range: ${timeRange}\n`;
        output += `Analysis Interval: ${timeInterval}\n`;
        output += `Total Errors: ${totalErrors}\n\n`;

        // Add overall trend summary
        output += "## Overall Error Trend\n\n";

        let trendSymbol = "→";
        if (overallTrend.trend === "increasing") trendSymbol = "↑";
        if (overallTrend.trend === "decreasing") trendSymbol = "↓";

        output += `Overall error trend: ${trendSymbol} ${overallTrend.trend.toUpperCase()}\n`;
        output += `First half of period: ${overallTrend.firstHalf} errors\n`;
        output += `Second half of period: ${overallTrend.secondHalf} errors\n`;
        output += `Change: ${overallTrend.change > 0 ? "+" : ""}${overallTrend.change} (${overallTrend.changePercentage.toFixed(1)}%)\n\n`;

        // Add time-based visualization
        if (timeData.length > 0) {
          output += "### Error Volume Over Time\n\n";

          // Find max count for scaling
          const maxCount = Math.max(...timeData.map((b) => b.doc_count));
          const scaleFactor = maxCount > 20 ? Math.ceil(maxCount / 20) : 1;

          // Create a simple ASCII chart
          timeData.forEach((bucket) => {
            const barLength = Math.ceil(bucket.doc_count / scaleFactor);
            const bar = "█".repeat(barLength || 1);
            const time =
              bucket.key_as_string || new Date(bucket.key).toISOString();
            output += `${time} |${bar} ${bucket.doc_count}\n`;
          });

          output += "\n";
        }

        // Add significant pattern trends
        if (significantPatternTrends.length > 0) {
          output += "## Significant Error Pattern Trends\n\n";
          output +=
            "The following error patterns show significant changes:\n\n";

          output += "| Pattern | Change | Trend | Count |\n";
          output += "|---------|--------|-------|-------|\n";

          significantPatternTrends.forEach((pattern) => {
            let trendSymbol = "→";
            if (pattern.trend.direction === "increasing") trendSymbol = "↑";
            if (pattern.trend.direction === "decreasing") trendSymbol = "↓";

            const changeText = `${pattern.trend.change > 0 ? "+" : ""}${pattern.trend.change} (${pattern.trend.changePercentage > 0 ? "+" : ""}${pattern.trend.changePercentage.toFixed(1)}%)`;

            output += `| ${pattern.name} | ${changeText} | ${trendSymbol} | ${pattern.count} |\n`;
          });

          output += "\n";
        }

        // Add significant category trends
        if (significantCategoryTrends.length > 0) {
          output += `## Significant ${primaryCategoryField.replace(/\.keyword$/, "")} Trends\n\n`;
          output += `The following ${primaryCategoryField.replace(/\.keyword$/, "")} categories show significant changes:\n\n`;

          output += "| Category | Change | Trend | Count |\n";
          output += "|----------|--------|-------|-------|\n";

          significantCategoryTrends.forEach((category) => {
            let trendSymbol = "→";
            if (category.trend.direction === "increasing") trendSymbol = "↑";
            if (category.trend.direction === "decreasing") trendSymbol = "↓";

            const changeText = `${category.trend.change > 0 ? "+" : ""}${category.trend.change} (${category.trend.changePercentage > 0 ? "+" : ""}${category.trend.changePercentage.toFixed(1)}%)`;

            output += `| ${category.name} | ${changeText} | ${trendSymbol} | ${category.count} |\n`;
          });

          output += "\n";
        }

        // Add detailed pattern analysis
        if (patternTrends.length > 0) {
          output += "## Error Pattern Analysis\n\n";

          // Add a summary table
          output += "| Pattern | Count | % of Total |\n";
          output += "|---------|-------|------------|\n";

          patternTrends.slice(0, 10).forEach((pattern) => {
            output += `| ${pattern.name} | ${pattern.count} | ${pattern.percentage.toFixed(1)}% |\n`;
          });

          output += "\n";

          // Add detailed sections for top patterns
          output += "### Top Error Pattern Details\n\n";

          patternTrends.slice(0, 5).forEach((pattern) => {
            output += `#### ${pattern.name}\n\n`;
            output += `${pattern.description}\n\n`;
            output += `**Count:** ${pattern.count} (${pattern.percentage.toFixed(1)}% of all errors)\n`;

            // Add trend information
            let trendSymbol = "→";
            if (pattern.trend.direction === "increasing") trendSymbol = "↑";
            if (pattern.trend.direction === "decreasing") trendSymbol = "↓";

            const changeText = `${pattern.trend.change > 0 ? "+" : ""}${pattern.trend.change} (${pattern.trend.changePercentage > 0 ? "+" : ""}${pattern.trend.changePercentage.toFixed(1)}%)`;

            output += `**Trend:** ${trendSymbol} ${pattern.trend.direction.toUpperCase()} ${changeText}\n\n`;

            // Add examples
            if (pattern.samples.length > 0) {
              output += "**Examples:**\n\n";

              pattern.samples.forEach((sample, idx) => {
                const timestamp = sample["@timestamp"]
                  ? new Date(
                      sample["@timestamp"] as string | number,
                    ).toISOString()
                  : "unknown time";
                const level = sample[errorField] || "unknown";

                output += `Example ${idx + 1} (${timestamp}):\n`;
                output += `- Level: ${level}\n`;

                // Add category information
                categoryFields.forEach((field) => {
                  const fieldName = field.replace(/\.keyword$/, "");
                  if (sample[fieldName]) {
                    output += `- ${fieldName}: ${sample[fieldName]}\n`;
                  }
                });

                // Add message
                output +=
                  "```\n" +
                  (sample[messageField] || "No message") +
                  "\n```\n\n";
              });
            }
          });
        }

        // Add detailed category analysis
        if (categoryTrends.length > 0) {
          output += `## ${primaryCategoryField.replace(/\.keyword$/, "")} Analysis\n\n`;

          // Add a summary table
          output += "| Category | Count | % of Total |\n";
          output += "|----------|-------|------------|\n";

          categoryTrends.slice(0, 10).forEach((category) => {
            output += `| ${category.name} | ${category.count} | ${category.percentage.toFixed(1)}% |\n`;
          });

          output += "\n";
        }

        // Add insights and recommendations
        output += "## Insights and Recommendations\n\n";

        if (
          overallTrend.trend === "increasing" &&
          overallTrend.changePercentage > 20
        ) {
          output += "### Overall Error Volume is Significantly Increasing\n\n";
          output +=
            "The overall error volume has increased by " +
            overallTrend.changePercentage.toFixed(1) +
            "% from the first half to the second half of the period.\n\n";

          output += "**Recommendations:**\n";
          output += "- Investigate error patterns with the largest increases\n";
          output +=
            "- Look for recent deployments or changes that might have introduced issues\n";
          output +=
            "- Check system resources and scaling as volume increases may indicate capacity issues\n\n";
        } else if (
          overallTrend.trend === "decreasing" &&
          overallTrend.changePercentage < -20
        ) {
          output += "### Overall Error Volume is Significantly Decreasing\n\n";
          output +=
            "The overall error volume has decreased by " +
            Math.abs(overallTrend.changePercentage).toFixed(1) +
            "% from the first half to the second half of the period.\n\n";

          output += "**Recommendations:**\n";
          output +=
            "- Identify successful fixes or improvements that contributed to the decrease\n";
          output +=
            "- Verify that error reporting mechanisms are still working correctly\n";
          output +=
            "- Document effective error reduction strategies for future reference\n\n";
        }

        // Add pattern-specific insights
        if (significantPatternTrends.length > 0) {
          const increasingPatterns = significantPatternTrends.filter(
            (p) => p.trend.direction === "increasing",
          );
          const decreasingPatterns = significantPatternTrends.filter(
            (p) => p.trend.direction === "decreasing",
          );

          if (increasingPatterns.length > 0) {
            output += "### Increasing Error Patterns\n\n";
            output +=
              "The following error patterns show significant increases and should be prioritized:\n\n";

            increasingPatterns.slice(0, 3).forEach((pattern) => {
              output += `- **${pattern.name}**: +${pattern.trend.changePercentage.toFixed(1)}% (${pattern.trend.firstHalf} → ${pattern.trend.secondHalf})\n`;
            });

            output += "\n**Recommendations:**\n";
            output += "- Investigate root causes for these error patterns\n";
            output +=
              "- Look for correlations with recent changes or deployments\n";
            output +=
              "- Consider temporarily rolling back recent changes if errors are critical\n\n";
          }

          if (decreasingPatterns.length > 0) {
            output += "### Decreasing Error Patterns\n\n";
            output +=
              "The following error patterns show significant decreases:\n\n";

            decreasingPatterns.slice(0, 3).forEach((pattern) => {
              output += `- **${pattern.name}**: ${pattern.trend.changePercentage.toFixed(1)}% (${pattern.trend.firstHalf} → ${pattern.trend.secondHalf})\n`;
            });

            output += "\n**Recommendations:**\n";
            output +=
              "- Determine which fixes or improvements led to these decreases\n";
            output += "- Apply similar strategies to other error patterns\n";
            output += "- Document successful error reduction approaches\n\n";
          }
        }

        // Add next steps
        output += "## Next Steps\n\n";
        output +=
          '- For deeper analysis of specific error types: `analyze-errors({ timeRange: "' +
          timeRange +
          '" })`\n';
        output +=
          '- To see log volume over time: `log-histogram({ timeRange: "' +
          timeRange +
          '", interval: "' +
          timeInterval +
          '" })`\n';
        output +=
          '- To analyze specific error patterns: `recognize-issues({ timeRange: "' +
          timeRange +
          '" })`\n';

        // Create a structured summary for the response
        const summary = {
          total_errors: totalErrors,
          time_range: timeRange,
          interval: timeInterval,
          overall_trend: overallTrend,
          significant_pattern_trends: significantPatternTrends
            .slice(0, 5)
            .map((pattern) => ({
              name: pattern.name,
              count: pattern.count,
              change_percentage: pattern.trend.changePercentage,
              direction: pattern.trend.direction,
            })),
          significant_category_trends: significantCategoryTrends
            .slice(0, 5)
            .map((category) => ({
              name: category.name,
              count: category.count,
              change_percentage: category.trend.changePercentage,
              direction: category.trend.direction,
            })),
        };

        return {
          // Include raw data for programmatic access
          data: {
            timeData,
            patternTrends,
            categoryTrends,
            overallTrend,
          },

          // Include a structured summary
          summary,

          // Provide formatted text output
          content: [{ type: "text" as const, text: output }],

          // Add related tools
          related_tools: {
            analyze: {
              name: "analyze-errors",
              description: "Analyze error patterns in logs",
            },
            histogram: {
              name: "log-histogram",
              description: "View log volume over time",
            },
            patterns: {
              name: "recognize-issues",
              description: "Identify common issue patterns in logs",
            },
          },
        };
      } catch (error) {
        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "detect-error-trends",
          operation: "error_trend_detection",
          params: {
            timeRange,
            errorField,
            errorValues,
            messageField,
            interval,
            categorizeBy,
            customPatterns,
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
