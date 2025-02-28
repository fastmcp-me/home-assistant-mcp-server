import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LogzioClient } from "../../api/logzio.js";
import { buildTimeRange } from "../../utils/time.js";
import { Elasticsearch6SearchParams } from "../../types/elasticsearch.types.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";

/**
 * Registers schema discovery tools
 */
export function registerSchemaDiscoveryTools(
  server: McpServer,
  client: LogzioClient,
) {
  // Tool to discover available fields in logs with schema information
  server.tool(
    "explore-schema",
    "Discover and explore available fields in logs",
    {
      query: z
        .string()
        .optional()
        .describe("Optional query string to filter logs (e.g., 'level:error')"),
      timeRange: z
        .string()
        .optional()
        .default("24h")
        .describe("Time range to analyze (e.g., '15m', '1h', '24h', '7d')"),
      maxFields: z
        .number()
        .optional()
        .default(50)
        .describe("Maximum number of fields to return"),
      includeStats: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include statistics about field frequency and cardinality"),
      formatType: z
        .enum(["table", "grouped", "detailed"])
        .optional()
        .default("table")
        .describe(
          "How to format the results (table, grouped by type, or detailed)",
        ),
    },
    async ({
      query,
      timeRange = "24h",
      maxFields = 50,
      includeStats = true,
      formatType = "table",
    }) => {
      try {
        // Build base query
        const baseQuery: Record<string, unknown> = {
          bool: {
            filter: buildTimeRange(timeRange),
          },
        };

        // Add filter if provided
        if (query) {
          const boolQuery = baseQuery.bool as Record<string, unknown>;
          boolQuery.must = {
            query_string: {
              query: query,
              allow_leading_wildcard: false,
            },
          };
        }

        // First get a small sample of documents to analyze the fields
        const sampleParams = {
          size: 10,
          query: baseQuery,
          _source: true, // Return the full document source
        };

        // Execute the search to get sample documents
        const sampleData = await client.search(
          sampleParams as unknown as Elasticsearch6SearchParams,
        );

        // Get field stats for relevant fields
        let fieldStats = {};
        if (includeStats) {
          // Create a field stats request for all the discovered fields
          const fieldStatsParams = {
            size: 0,
            query: baseQuery,
            aggs: {
              field_usage: {
                terms: {
                  field: "_field_names", // Special field that contains all field names
                  size: maxFields,
                },
              },
            },
          };

          // Add cardinality aggregations for keyword fields
          const statsData = await client.search(
            fieldStatsParams as unknown as Elasticsearch6SearchParams,
          );

          // Process field usage stats
          const aggregations = statsData.aggregations as Record<string, any>;
          const fieldBuckets = aggregations?.field_usage?.buckets || [];
          fieldStats = fieldBuckets.reduce(
            (acc, bucket) => {
              acc[bucket.key as string] = {
                doc_count: bucket.doc_count,
                frequency:
                  bucket.doc_count /
                  ((statsData.hits as any)?.total?.value || 1),
              };
              return acc;
            },
            {} as Record<string, any>,
          );

          // For each field, get cardinality in separate requests (to avoid too many aggs)
          for (const fieldName of Object.keys(fieldStats).slice(0, 20)) {
            // Limit to 20 fields for performance
            try {
              const cardinalityParams = {
                size: 0,
                query: baseQuery,
                aggs: {
                  field_cardinality: {
                    cardinality: {
                      field: fieldName,
                    },
                  },
                },
              };

              const cardinalityData = await client.search(
                cardinalityParams as unknown as Elasticsearch6SearchParams,
              );

              const cardinalityAggs = cardinalityData.aggregations as Record<
                string,
                any
              >;
              if (cardinalityAggs?.field_cardinality?.value !== undefined) {
                fieldStats[fieldName].cardinality =
                  cardinalityAggs.field_cardinality.value;
              }
            } catch (error) {
              // Skip fields where cardinality can't be calculated
              console.error(
                `Could not get cardinality for field ${fieldName}:`,
                error,
              );
            }
          }
        }

        // Extract field information from the sample documents
        const fieldInfo = new Map<
          string,
          {
            type: string;
            examples: Array<any>;
            description?: string;
            path: string;
            count: number;
          }
        >();

        // Process each document to discover fields
        const hits = sampleData.hits as any;
        if (Array.isArray(hits?.hits)) {
          hits.hits.forEach((hit: any) => {
            // Extract all fields and their types recursively
            extractFields(hit._source, "", fieldInfo);
          });
        }

        // Format output based on the requested format
        let output = "";

        // For grouped format, organize fields by type
        if (formatType === "grouped") {
          const fieldsByType: Record<
            string,
            Array<{ name: string; info: any }>
          > = {};

          fieldInfo.forEach((info, fieldName) => {
            if (!fieldsByType[info.type]) {
              fieldsByType[info.type] = [];
            }
            fieldsByType[info.type].push({
              name: fieldName,
              info: {
                ...info,
                stats: fieldStats[fieldName] || {},
              },
            });
          });

          output = "# Log Fields by Type\n\n";

          for (const [type, fields] of Object.entries(fieldsByType)) {
            output += `## ${type} Fields\n\n`;

            fields.forEach(({ name, info }) => {
              output += `### ${name}\n\n`;
              output += `- **Type:** ${info.type}\n`;

              if (includeStats && fieldStats[name]) {
                output += `- **Frequency:** ${Math.round(fieldStats[name].frequency * 100)}% of documents\n`;
                if (fieldStats[name].cardinality !== undefined) {
                  output += `- **Cardinality:** ${fieldStats[name].cardinality} distinct values\n`;
                }
              }

              if (info.examples.length > 0) {
                output += `- **Example value:** \`${JSON.stringify(info.examples[0])}\`\n`;
              }

              output += "\n";
            });

            output += "\n";
          }
        }
        // For table format, show fields in a concise table
        else if (formatType === "table") {
          output = "# Available Log Fields\n\n";

          // Filter info
          if (query) {
            output += `Filtered by: \`${query}\`\n`;
          }
          output += `Time range: ${timeRange}\n\n`;

          // Add table header
          output += "| Field | Type | Example | Usage |\n";
          output += "|-------|------|---------|-------|\n";

          // Sort fields by usage if stats are available
          const sortedFields = Array.from(fieldInfo.entries())
            .sort((a, b) => {
              const aFreq = fieldStats[a[0]]?.frequency || 0;
              const bFreq = fieldStats[b[0]]?.frequency || 0;
              return bFreq - aFreq; // Sort by descending frequency
            })
            .slice(0, maxFields); // Limit to maxFields

          // Add each field
          sortedFields.forEach(([fieldName, info]) => {
            const example =
              info.examples.length > 0
                ? JSON.stringify(info.examples[0]).substring(0, 30) +
                  (JSON.stringify(info.examples[0]).length > 30 ? "..." : "")
                : "";

            const usage = fieldStats[fieldName]
              ? `${Math.round(fieldStats[fieldName].frequency * 100)}%`
              : "unknown";

            output += `| \`${fieldName}\` | ${info.type} | \`${example}\` | ${usage} |\n`;
          });

          // Add usage tips
          output += "\n## Usage Tips\n\n";
          output +=
            '- For more detailed information about a specific field, use: `field-help({ field: "fieldname" })`\n';
          output +=
            '- To get statistics about a field, use: `field-stats({ field: "fieldname" })`\n';
          output +=
            '- To use these fields in searches, use: `simple-search({ query: "fieldname:value" })`\n';
        }
        // For detailed format, show comprehensive field details
        else {
          output = "# Detailed Field Information\n\n";

          // Filter info
          if (query) {
            output += `Filtered by: \`${query}\`\n`;
          }
          output += `Time range: ${timeRange}\n\n`;

          // Sort fields by usage if stats are available
          const sortedFields = Array.from(fieldInfo.entries())
            .sort((a, b) => {
              const aFreq = fieldStats[a[0]]?.frequency || 0;
              const bFreq = fieldStats[b[0]]?.frequency || 0;
              return bFreq - aFreq; // Sort by descending frequency
            })
            .slice(0, maxFields); // Limit to maxFields

          // Add each field with detailed information
          sortedFields.forEach(([fieldName, info]) => {
            output += `## ${fieldName}\n\n`;
            output += `- **Type:** ${info.type}\n`;
            output += `- **Path:** ${info.path || fieldName}\n`;

            if (includeStats && fieldStats[fieldName]) {
              output += `- **Document frequency:** ${Math.round(fieldStats[fieldName].frequency * 100)}% (${fieldStats[fieldName].doc_count} docs)\n`;
              if (fieldStats[fieldName].cardinality !== undefined) {
                output += `- **Distinct values:** ${fieldStats[fieldName].cardinality}\n`;
              }
            }

            // Show example values
            if (info.examples.length > 0) {
              output += `- **Example values:**\n`;
              info.examples.slice(0, 3).forEach((example) => {
                output += `  - \`${JSON.stringify(example)}\`\n`;
              });
            }

            // Add query syntax examples
            output += "\n**Query syntax:**\n";

            if (
              info.type === "string" ||
              info.type === "text" ||
              info.type === "keyword"
            ) {
              output += "```\n";
              output += `${fieldName}:\"exact value\"\n`;
              output += `${fieldName}:*partial*\n`;
              output += "```\n";
            } else if (
              info.type === "number" ||
              info.type === "integer" ||
              info.type === "long" ||
              info.type === "float" ||
              info.type === "double"
            ) {
              output += "```\n";
              output += `${fieldName}:>100\n`;
              output += `${fieldName}:[50 TO 100]\n`;
              output += "```\n";
            } else if (info.type === "date") {
              output += "```\n";
              output += `${fieldName}:[2023-01-01 TO 2023-01-31]\n`;
              output += `${fieldName}:[now-7d TO now]\n`;
              output += "```\n";
            } else if (info.type === "boolean") {
              output += "```\n";
              output += `${fieldName}:true\n`;
              output += `${fieldName}:false\n`;
              output += "```\n";
            }

            output += "\n";
          });
        }

        // Build a structured summary of the discovered fields
        const summary = {
          total_fields: fieldInfo.size,
          by_type: {} as Record<string, number>,
          common_fields: {} as Record<string, any>,
        };

        // Count fields by type
        fieldInfo.forEach((info) => {
          if (!summary.by_type[info.type]) {
            summary.by_type[info.type] = 0;
          }
          summary.by_type[info.type]++;
        });

        // Extract common fields (high frequency)
        const topFields = Array.from(fieldInfo.entries())
          .sort((a, b) => {
            const aFreq = fieldStats[a[0]]?.frequency || 0;
            const bFreq = fieldStats[b[0]]?.frequency || 0;
            return bFreq - aFreq;
          })
          .slice(0, 10);

        topFields.forEach(([fieldName, info]) => {
          summary.common_fields[fieldName] = {
            type: info.type,
            frequency: fieldStats[fieldName]?.frequency || 0,
            cardinality: fieldStats[fieldName]?.cardinality,
          };
        });

        return {
          // Include raw data for programmatic access
          data: {
            fields: Object.fromEntries(fieldInfo),
            stats: fieldStats,
          },

          // Include a structured summary
          summary,

          // Provide formatted text output
          content: [
            {
              type: "text",
              text: output,
            },
          ],

          // Add related tools
          related_tools: {
            "field-stats": {
              description: "Get detailed statistics about specific fields",
            },
            "field-help": {
              description: "Get help and examples for using specific fields",
            },
            "simple-search": {
              description: "Search logs using the discovered fields",
            },
          },
        };
      } catch (error) {
        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "discover-fields",
          operation: "field_discovery",
          params: {
            query,
            timeRange,
            maxFields,
            includeStats,
            formatType,
          },
        };

        // Use standardized error handler
        const errorResponse = handleToolError(error, context);
        return {
          ...errorResponse,
          // Ensure these properties exist to satisfy the MCP tool response interface
          [Symbol.iterator]: undefined,
        } as any;
      }
    },
  );

  // Tool to provide field recommendations based on a query
  server.tool(
    "recommend-fields",
    "Get field recommendations for your log analysis task",
    {
      task: z
        .string()
        .describe(
          "The analysis task you're working on (e.g., 'error analysis', 'performance monitoring')",
        ),
      query: z
        .string()
        .optional()
        .describe("Optional query string to provide context"),
      timeRange: z
        .string()
        .optional()
        .default("24h")
        .describe("Time range to analyze (e.g., '15m', '1h', '24h', '7d')"),
      maxRecommendations: z
        .number()
        .optional()
        .default(10)
        .describe("Maximum number of field recommendations to return"),
    },
    async ({ task, query, timeRange = "24h", maxRecommendations = 10 }) => {
      try {
        // Normalize task for matching
        const normalizedTask = task.toLowerCase();

        // Identify task type to provide better recommendations
        let taskType = "general";
        if (
          normalizedTask.includes("error") ||
          normalizedTask.includes("exception") ||
          normalizedTask.includes("issue")
        ) {
          taskType = "error";
        } else if (
          normalizedTask.includes("performance") ||
          normalizedTask.includes("slow") ||
          normalizedTask.includes("latency")
        ) {
          taskType = "performance";
        } else if (
          normalizedTask.includes("security") ||
          normalizedTask.includes("auth") ||
          normalizedTask.includes("access")
        ) {
          taskType = "security";
        } else if (
          normalizedTask.includes("user") ||
          normalizedTask.includes("customer") ||
          normalizedTask.includes("client")
        ) {
          taskType = "user";
        }

        // First get the available fields
        // Build base query
        const baseQuery: Record<string, unknown> = {
          bool: {
            filter: buildTimeRange(timeRange),
          },
        };

        // Add filter if provided
        if (query) {
          const boolQuery = baseQuery.bool as Record<string, unknown>;
          boolQuery.must = {
            query_string: {
              query: query,
              allow_leading_wildcard: false,
            },
          };
        }

        // Get field stats to identify common fields
        const fieldStatsParams = {
          size: 0,
          query: baseQuery,
          aggs: {
            field_usage: {
              terms: {
                field: "_field_names",
                size: 100,
              },
            },
          },
        };

        const statsData = await client.search(
          fieldStatsParams as unknown as Elasticsearch6SearchParams,
        );

        // Process field usage stats
        const aggregations = statsData.aggregations as Record<string, any>;
        const fieldBuckets = aggregations?.field_usage?.buckets || [];
        const fieldStats = fieldBuckets.reduce(
          (acc, bucket) => {
            acc[bucket.key as string] = {
              doc_count: bucket.doc_count,
              frequency:
                bucket.doc_count / ((statsData.hits as any)?.total?.value || 1),
            };
            return acc;
          },
          {} as Record<string, any>,
        );

        // Define recommendations based on task type
        const recommendations: Array<{
          field: string;
          relevance: number;
          description: string;
          importance: string;
          example?: string;
        }> = [];

        // Define common fields to recommend for each task type
        const recommendedFields: Record<
          string,
          Array<{
            pattern: string;
            relevance: number;
            description: string;
            importance: string;
            example?: string;
          }>
        > = {
          // Error analysis task recommendations
          error: [
            {
              pattern: "level",
              relevance: 100,
              description: "Log level field to filter for errors",
              importance: "critical",
              example: "level:error",
            },
            {
              pattern: "message",
              relevance: 95,
              description: "Error message content",
              importance: "critical",
              example: 'message:"connection refused"',
            },
            {
              pattern: "error",
              relevance: 90,
              description: "Error details or type",
              importance: "high",
              example: 'error:"NullPointerException"',
            },
            {
              pattern: "stack",
              relevance: 85,
              description: "Stack trace information",
              importance: "high",
              example: "stack:*SQLException*",
            },
            {
              pattern: "service",
              relevance: 80,
              description: "Service or component where error occurred",
              importance: "high",
              example: "service:payment-api",
            },
            {
              pattern: "trace",
              relevance: 75,
              description: "Trace ID for tracking error context",
              importance: "medium",
              example: 'trace:"abc-123"',
            },
            {
              pattern: "exception",
              relevance: 70,
              description: "Exception details",
              importance: "medium",
              example: "exception:*timeout*",
            },
            {
              pattern: "timestamp",
              relevance: 65,
              description: "When the error occurred",
              importance: "medium",
              example: "@timestamp:[now-1h TO now]",
            },
            {
              pattern: "host",
              relevance: 60,
              description: "Host where the error occurred",
              importance: "medium",
              example: "host:web-server-01",
            },
            {
              pattern: "status",
              relevance: 55,
              description: "HTTP status code or operation status",
              importance: "medium",
              example: "status:500",
            },
          ],

          // Performance analysis task recommendations
          performance: [
            {
              pattern: "duration",
              relevance: 100,
              description: "Operation duration/response time",
              importance: "critical",
              example: "duration:>100",
            },
            {
              pattern: "latency",
              relevance: 95,
              description: "Request latency",
              importance: "critical",
              example: "latency:>1000",
            },
            {
              pattern: "response_time",
              relevance: 90,
              description: "Response time metrics",
              importance: "critical",
              example: "response_time:[100 TO 5000]",
            },
            {
              pattern: "endpoint",
              relevance: 85,
              description: "API endpoint or operation",
              importance: "high",
              example: 'endpoint:"/api/v1/users"',
            },
            {
              pattern: "service",
              relevance: 80,
              description: "Service or component name",
              importance: "high",
              example: "service:authentication-service",
            },
            {
              pattern: "method",
              relevance: 75,
              description: "HTTP method or operation type",
              importance: "medium",
              example: "method:POST",
            },
            {
              pattern: "status",
              relevance: 70,
              description: "HTTP status or operation result",
              importance: "medium",
              example: "status:200",
            },
            {
              pattern: "timestamp",
              relevance: 65,
              description: "When the operation occurred",
              importance: "medium",
              example: "@timestamp:[now-1d TO now]",
            },
            {
              pattern: "cpu",
              relevance: 60,
              description: "CPU utilization metrics",
              importance: "medium",
              example: "cpu:>80",
            },
            {
              pattern: "memory",
              relevance: 55,
              description: "Memory utilization metrics",
              importance: "medium",
              example: "memory:>90",
            },
          ],

          // Security analysis task recommendations
          security: [
            {
              pattern: "user",
              relevance: 100,
              description: "User identifier",
              importance: "critical",
              example: "user:john.doe",
            },
            {
              pattern: "source_ip",
              relevance: 95,
              description: "Source IP address",
              importance: "critical",
              example: "source_ip:192.168.1.*",
            },
            {
              pattern: "action",
              relevance: 90,
              description: "Security action (allow, deny, etc.)",
              importance: "critical",
              example: "action:deny",
            },
            {
              pattern: "auth",
              relevance: 85,
              description: "Authentication status or method",
              importance: "high",
              example: "auth:failed",
            },
            {
              pattern: "status",
              relevance: 80,
              description: "Status of security operation",
              importance: "high",
              example: "status:fail",
            },
            {
              pattern: "role",
              relevance: 75,
              description: "User role or permissions",
              importance: "high",
              example: "role:admin",
            },
            {
              pattern: "resource",
              relevance: 70,
              description: "Resource being accessed",
              importance: "medium",
              example: 'resource:"/admin/*"',
            },
            {
              pattern: "timestamp",
              relevance: 65,
              description: "When the security event occurred",
              importance: "medium",
              example: "@timestamp:[now-7d TO now]",
            },
            {
              pattern: "session",
              relevance: 60,
              description: "Session identifier",
              importance: "medium",
              example: 'session:"abc-123"',
            },
            {
              pattern: "user_agent",
              relevance: 55,
              description: "User agent or client details",
              importance: "medium",
              example: "user_agent:*Chrome*",
            },
          ],

          // User activity analysis task recommendations
          user: [
            {
              pattern: "user",
              relevance: 100,
              description: "User identifier",
              importance: "critical",
              example: "user:jane.smith",
            },
            {
              pattern: "action",
              relevance: 95,
              description: "User action or activity",
              importance: "critical",
              example: "action:login",
            },
            {
              pattern: "session",
              relevance: 90,
              description: "Session identifier",
              importance: "high",
              example: 'session:"xyz-789"',
            },
            {
              pattern: "page",
              relevance: 85,
              description: "Page or view accessed",
              importance: "high",
              example: 'page:"/dashboard"',
            },
            {
              pattern: "status",
              relevance: 80,
              description: "Operation status or result",
              importance: "high",
              example: "status:success",
            },
            {
              pattern: "timestamp",
              relevance: 75,
              description: "When the user activity occurred",
              importance: "medium",
              example: "@timestamp:[now-30d TO now]",
            },
            {
              pattern: "device",
              relevance: 70,
              description: "User device information",
              importance: "medium",
              example: "device:mobile",
            },
            {
              pattern: "ip",
              relevance: 65,
              description: "User IP address",
              importance: "medium",
              example: "ip:10.0.0.*",
            },
            {
              pattern: "feature",
              relevance: 60,
              description: "Feature or area being used",
              importance: "medium",
              example: "feature:checkout",
            },
            {
              pattern: "duration",
              relevance: 55,
              description: "Duration of user session or activity",
              importance: "medium",
              example: "duration:>300",
            },
          ],

          // General analysis task recommendations
          general: [
            {
              pattern: "level",
              relevance: 100,
              description: "Log level for filtering",
              importance: "high",
              example: "level:info",
            },
            {
              pattern: "message",
              relevance: 95,
              description: "Log message content",
              importance: "high",
              example: "message:*started*",
            },
            {
              pattern: "timestamp",
              relevance: 90,
              description: "When the event occurred",
              importance: "high",
              example: "@timestamp:[now-24h TO now]",
            },
            {
              pattern: "service",
              relevance: 85,
              description: "Service or component name",
              importance: "high",
              example: "service:api-gateway",
            },
            {
              pattern: "host",
              relevance: 80,
              description: "Host where the event occurred",
              importance: "medium",
              example: "host:app-server-02",
            },
            {
              pattern: "status",
              relevance: 75,
              description: "Operation status",
              importance: "medium",
              example: "status:success",
            },
            {
              pattern: "user",
              relevance: 70,
              description: "User associated with the event",
              importance: "medium",
              example: "user:system",
            },
            {
              pattern: "action",
              relevance: 65,
              description: "Action being performed",
              importance: "medium",
              example: "action:update",
            },
            {
              pattern: "duration",
              relevance: 60,
              description: "Duration of operation",
              importance: "medium",
              example: "duration:<50",
            },
            {
              pattern: "component",
              relevance: 55,
              description: "Component or module name",
              importance: "medium",
              example: "component:database",
            },
          ],
        };

        // Generate recommendations based on available fields and task type
        const taskRecommendations =
          recommendedFields[taskType] || recommendedFields.general;

        // Match field patterns against available fields
        for (const recommendation of taskRecommendations) {
          const pattern = recommendation.pattern.toLowerCase();

          // Find matching fields
          const matchingFields = Object.keys(fieldStats).filter((field) => {
            const normalizedField = field.toLowerCase();
            return (
              normalizedField.includes(pattern) ||
              pattern.includes(normalizedField)
            );
          });

          // Add each matching field as a recommendation
          matchingFields.forEach((field) => {
            recommendations.push({
              field,
              relevance:
                recommendation.relevance * (fieldStats[field].frequency || 0.1), // Adjust relevance by frequency
              description: recommendation.description,
              importance: recommendation.importance,
              example: recommendation.example?.replace(pattern, field), // Update example with actual field name
            });
          });
        }

        // Sort recommendations by relevance and limit to maxRecommendations
        const sortedRecommendations = recommendations
          .sort((a, b) => b.relevance - a.relevance)
          .slice(0, maxRecommendations);

        // Format the output
        let output = `# Field Recommendations for ${task}\n\n`;

        // Task-specific guidance
        switch (taskType) {
          case "error":
            output +=
              "To effectively analyze errors, focus on these key fields:\n\n";
            break;
          case "performance":
            output +=
              "For performance analysis, these fields will be most valuable:\n\n";
            break;
          case "security":
            output +=
              "When investigating security events, prioritize these fields:\n\n";
            break;
          case "user":
            output +=
              "For user activity analysis, these fields provide the most insights:\n\n";
            break;
          default:
            output += "Based on your task, these fields are recommended:\n\n";
        }

        // Add table of recommendations
        output += "| Field | Importance | Description | Example Query |\n";
        output += "|-------|------------|-------------|---------------|\n";

        sortedRecommendations.forEach((rec) => {
          output += `| \`${rec.field}\` | ${rec.importance} | ${rec.description} | \`${rec.example || `${rec.field}:value`}\` |\n`;
        });

        // Add usage tips
        output += "\n## Usage Tips\n\n";

        switch (taskType) {
          case "error":
            output +=
              "- Combine level and component fields to isolate errors in specific services\n";
            output +=
              "- Use message fields with wildcards to find similar error patterns\n";
            output += "- Check stack trace fields for detailed error context\n";
            break;
          case "performance":
            output +=
              "- Sort duration fields in descending order to identify slowest operations\n";
            output +=
              "- Compare latency across different services and endpoints\n";
            output +=
              "- Look for correlations between high resource usage and slow response times\n";
            break;
          case "security":
            output +=
              "- Combine user and action fields to track specific user behaviors\n";
            output +=
              "- Look for patterns in source IP addresses across failed authentication attempts\n";
            output +=
              "- Check unusual resource access patterns by time of day\n";
            break;
          case "user":
            output +=
              "- Group user actions by session to understand user journeys\n";
            output +=
              "- Compare activity patterns across different user segments\n";
            output +=
              "- Look for correlations between user actions and error events\n";
            break;
          default:
            output += "- Combine multiple fields to narrow down your search\n";
            output +=
              "- Use time-based filtering to focus on specific periods\n";
            output +=
              "- Consider exporting field values for further analysis\n";
        }

        // Add next steps
        output += "\n## Next Steps\n\n";
        output += `1. Explore available fields with \`discover-fields({ timeRange: "${timeRange}" })\`\n`;
        output += `2. Get field statistics with \`field-stats({ field: "field_name", timeRange: "${timeRange}" })\`\n`;
        output += `3. Search using these fields with \`simple-search({ query: "field:value", timeRange: "${timeRange}" })\`\n`;

        return {
          // Include structured recommendation data
          data: sortedRecommendations,

          // Include a structured summary
          summary: {
            task_type: taskType,
            total_recommendations: sortedRecommendations.length,
            top_fields: sortedRecommendations
              .slice(0, 3)
              .map((rec) => rec.field),
          },

          // Provide formatted text output
          content: [
            {
              type: "text",
              text: output,
            },
          ],

          // Add related tools
          related_tools: {
            "discover-fields": {
              description: "Discover all available fields in your logs",
            },
            "field-stats": {
              description: "Get detailed statistics about specific fields",
            },
            "simple-search": {
              description: "Search logs using the recommended fields",
            },
          },
        };
      } catch (error) {
        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "recommend-fields",
          operation: "field_recommendation",
          params: {
            task,
            query,
            timeRange,
            maxRecommendations,
          },
        };

        // Use standardized error handler
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

/**
 * Recursively extracts field information from a document
 */
function extractFields(
  data: any,
  path: string,
  fieldInfo: Map<
    string,
    { type: string; examples: Array<any>; path: string; count: number }
  >,
  maxDepth: number = 5,
  currentDepth: number = 0,
) {
  // Prevent excessive recursion
  if (currentDepth >= maxDepth) {
    return;
  }

  // Handle null/undefined
  if (data === null || data === undefined) {
    return;
  }

  // Process based on data type
  if (Array.isArray(data)) {
    // For arrays, process each element
    data.forEach((item, index) => {
      if (index < 3) {
        // Limit array processing to avoid excessive recursion
        extractFields(item, path, fieldInfo, maxDepth, currentDepth + 1);
      }
    });
  } else if (typeof data === "object") {
    // For objects, process each property
    Object.entries(data).forEach(([key, value]) => {
      const fieldPath = path ? `${path}.${key}` : key;

      if (value === null || value === undefined) {
        // Skip null/undefined values
        return;
      } else if (typeof value === "object" && !Array.isArray(value)) {
        // Recursively process nested objects
        extractFields(value, fieldPath, fieldInfo, maxDepth, currentDepth + 1);
      } else {
        // Add leaf field information
        const fieldName = fieldPath;
        const type = getFieldType(value);

        if (fieldInfo.has(fieldName)) {
          // Update existing field info
          const info = fieldInfo.get(fieldName)!;
          // Add example if it's different from existing examples and we have fewer than 3
          if (
            info.examples.length < 3 &&
            !info.examples.some(
              (ex) => JSON.stringify(ex) === JSON.stringify(value),
            )
          ) {
            info.examples.push(value);
          }
          info.count++;
        } else {
          // Add new field info
          fieldInfo.set(fieldName, {
            type,
            examples: [value],
            path: fieldPath,
            count: 1,
          });
        }
      }
    });
  } else {
    // For primitive values at the root (unlikely), use the path as the field name
    if (path) {
      const type = getFieldType(data);
      fieldInfo.set(path, {
        type,
        examples: [data],
        path,
        count: 1,
      });
    }
  }
}

/**
 * Determines the type of a field value
 */
function getFieldType(value: any): string {
  if (value === null || value === undefined) {
    return "null";
  }

  const type = typeof value;

  // Handle special types
  if (type === "object") {
    if (Array.isArray(value)) {
      return "array";
    }

    // Check if it looks like a date string
    if (value instanceof Date) {
      return "date";
    }
  }

  if (type === "string") {
    // Check if it looks like a date string
    if (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value) ||
      /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
      return "date";
    }

    // Check if it's a UUID
    if (
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      return "uuid";
    }

    // Check if it's an email
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "email";
    }

    // Check if it's an IP address
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(value)) {
      return "ip";
    }

    // If it's a "long" string, it's likely text instead of keyword
    if (value.length > 50) {
      return "text";
    }

    return "keyword";
  }

  if (type === "number") {
    // Check if it's an integer
    if (Number.isInteger(value)) {
      return "integer";
    }

    return "float";
  }

  return type;
}
