/**
 * Trend detection tool for identifying patterns and changes in log data.
 */
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { buildTimeRange } from "../../utils/time.js";
import { calculateInterval } from "../../utils/time.js";
import { Elasticsearch6SearchParams } from "../../types/elasticsearch.types.js";
import {
  EsResponse,
  TrendDetectionParamsType,
} from "../../types/elasticsearch.js";
import { calculateTrends } from "./common/trend-utils.js";
import { createTrendTable } from "./common/visualization.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import { ErrorResponse, SuccessResponse } from "./types/responses.js";

/**
 * Registers a tool for trend detection in log data.
 */
export function registerDetectTrendsTool(
  server: McpServer,
  client: LogzioClient,
) {
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
    }: TrendDetectionParamsType) => {
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

        // Calculate trends using the shared utility function
        const trends = calculateTrends(
          beforeBuckets,
          afterBuckets,
          minTrendSignificance,
        );

        // Process group analysis if available
        const groupTrends: Array<{
          group: string | number;
          count: number;
          trends: Array<{
            value: string;
            beforeCount: number;
            afterCount: number;
            absoluteChange: number;
            percentageChange: number;
            trend: "increasing" | "decreasing" | "stable";
          }>;
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
                  buckets: Array<{
                    key: string | number;
                    doc_count: number;
                  }>;
                };
              };
              after_period?: {
                doc_count: number;
                field_values?: {
                  buckets: Array<{
                    key: string | number;
                    doc_count: number;
                  }>;
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

          // Use the common visualization utility to create the trend table
          output += createTrendTable(trends, {
            showPercentage: includePercentages,
            trendVisualization: trendVisualization,
            title: "Trend Analysis",
          });
        }

        // Add group analysis if available
        if (groupTrends.length > 0) {
          output += `\n## Trends by ${Array.isArray(groupBy) ? groupBy[0] : groupBy}\n\n`;

          groupTrends.forEach((groupData) => {
            output += `### ${groupData.group} (${groupData.count} logs)\n\n`;

            if (groupData.trends.length === 0) {
              output += `No significant trends for this group.\n\n`;
            } else {
              // Use the common visualization utility to create the trend table for this group
              output += createTrendTable(groupData.trends, {
                showPercentage: includePercentages,
                trendVisualization: trendVisualization,
                title: `Trends for ${groupData.group}`,
              });
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
            trends: groupData.trends.map((trend) => ({
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
        } as SuccessResponse;
      } catch (error) {
        const context: ErrorContext = {
          tool: "detect-trends",
          operation: "trend_analysis",
          params: {
            timeRange,
            field,
            query,
            groupBy,
            interval,
            minTrendSignificance,
          },
        };

        return handleToolError(error, context) as ErrorResponse;
      }
    },
  );
}
