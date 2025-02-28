import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import { buildTimeRange } from "../../utils/time.js";
import { Elasticsearch6SearchParams } from "../../types/elasticsearch.types.js";

// Interface for field relationships response
interface FieldRelationship {
  fieldA: string;
  fieldB: string;
  cooccurrenceCount: number;
  correlationScore: number;
  sampleValues?: Array<{
    valueA: string | number | boolean;
    valueB: string | number | boolean;
    count: number;
  }>;
}

/**
 * Registers the field-relations tool
 * This tool analyzes relationships between different log fields
 */
export function registerFieldRelationsTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "field-relations",
    "Analyze relationships between different log fields to identify correlations and patterns",
    {
      fields: z
        .array(z.string())
        .min(2)
        .max(5)
        .describe("Array of fields to analyze for relationships (2-5 fields)"),
      index: z
        .string()
        .optional()
        .describe(
          "Index pattern to analyze (e.g., 'logstash-*', 'filebeat-*')",
        ),
      timeRange: z
        .string()
        .optional()
        .default("24h")
        .describe("Time range to analyze (e.g., '15m', '24h', '7d')"),
      query: z
        .string()
        .optional()
        .describe("Optional query to filter logs before analyzing"),
      sampleSize: z
        .number()
        .optional()
        .default(1000)
        .describe("Maximum number of documents to analyze"),
      includeExamples: z
        .boolean()
        .optional()
        .default(true)
        .describe("Include example value pairs in the results"),
      minCorrelation: z
        .number()
        .optional()
        .default(0.1)
        .describe("Minimum correlation score to include in results (0-1)"),
    },
    async ({
      fields,
      index,
      timeRange = "24h",
      query,
      sampleSize = 1000,
      includeExamples = true,
      minCorrelation = 0.1,
    }) => {
      try {
        // Validate we have at least 2 fields
        if (fields.length < 2) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "At least 2 fields are required to analyze relationships",
              },
            ],
          };
        }

        // For better elasticsearch compatibility, add .keyword to text fields if not already present
        const processedFields = fields.map((field) =>
          field.endsWith(".keyword") ? field : `${field}.keyword`,
        );

        // Build the query for field relationship analysis
        // Start with time range and any user-provided filters
        const baseQuery: Record<string, unknown> = {
          bool: {
            filter: buildTimeRange(timeRange),
          },
        };

        // Add user query if provided
        if (query) {
          const boolQuery = baseQuery.bool as Record<string, unknown>;
          boolQuery.must = {
            query_string: {
              query,
              default_operator: "AND",
            },
          };
        }

        // Create a query that finds documents where all specified fields exist
        const existsFilters = processedFields.map((field) => ({
          exists: { field },
        }));

        // Add exists filters to the query
        const boolQuery = baseQuery.bool as Record<string, unknown>;
        if (!boolQuery.filter) {
          boolQuery.filter = [];
        }
        const filterArray = Array.isArray(boolQuery.filter)
          ? boolQuery.filter
          : [boolQuery.filter];
        boolQuery.filter = [...filterArray, ...existsFilters];

        // Create aggregations to analyze field co-occurrence
        const aggregations: Record<string, unknown> = {};

        // For each pair of fields, create an aggregation to analyze their relationship
        for (let i = 0; i < processedFields.length; i++) {
          for (let j = i + 1; j < processedFields.length; j++) {
            const fieldA = processedFields[i];
            const fieldB = processedFields[j];
            const aggName = `${fieldA.replace(/\./g, "_")}_${fieldB.replace(
              /\./g,
              "_",
            )}`;

            // Create a composite aggregation that groups by both fields
            aggregations[aggName] = {
              composite: {
                size: 100, // Limit number of combinations
                sources: [
                  {
                    [fieldA]: {
                      terms: {
                        field: fieldA,
                      },
                    },
                  },
                  {
                    [fieldB]: {
                      terms: {
                        field: fieldB,
                      },
                    },
                  },
                ],
              },
            };
          }
        }

        // Also get individual field cardinality for correlation calculation
        processedFields.forEach((field) => {
          const fieldName = field.replace(/\./g, "_");
          aggregations[`${fieldName}_values`] = {
            terms: {
              field: field,
              size: 100,
            },
          };
          aggregations[`${fieldName}_cardinality`] = {
            cardinality: {
              field: field,
            },
          };
        });

        // Create the search parameters
        const searchParams = {
          index,
          size: 0, // We only need aggregations
          query: baseQuery,
          aggs: aggregations,
        };

        // Execute the search
        const response = await client.search(
          searchParams as unknown as Elasticsearch6SearchParams,
        );

        // Process the results to calculate relationships
        const relationships: FieldRelationship[] = [];
        const fieldStats: Record<
          string,
          { topValues: any[]; cardinality: number }
        > = {};

        // Extract field stats
        processedFields.forEach((field) => {
          const fieldName = field.replace(/\./g, "_");
          const topValues =
            response.aggregations?.[`${fieldName}_values`]?.buckets || [];
          const cardinality =
            response.aggregations?.[`${fieldName}_cardinality`]?.value || 0;

          fieldStats[field] = {
            topValues,
            cardinality,
          };
        });

        // Calculate field relationships
        for (let i = 0; i < processedFields.length; i++) {
          for (let j = i + 1; j < processedFields.length; j++) {
            const fieldA = processedFields[i];
            const fieldB = processedFields[j];
            const aggName = `${fieldA.replace(/\./g, "_")}_${fieldB.replace(
              /\./g,
              "_",
            )}`;

            const buckets = response.aggregations?.[aggName]?.buckets || [];

            // Calculate co-occurrence statistics
            const totalPairs = buckets.reduce(
              (sum: number, bucket: any) => sum + bucket.doc_count,
              0,
            );

            // Skip if no co-occurrences
            if (totalPairs === 0) continue;

            // Calculate correlation score - simplified version of mutual information
            // Higher score means stronger relationship between fields
            const cardinalityA = fieldStats[fieldA].cardinality;
            const cardinalityB = fieldStats[fieldB].cardinality;

            // Skip if either field has no values
            if (cardinalityA === 0 || cardinalityB === 0) continue;

            // Calculate a simple correlation score based on co-occurrence patterns
            // This is a simplified approximation - more sophisticated metrics could be used
            const combinationRatio =
              buckets.length / (cardinalityA * cardinalityB);
            const correlationScore = Math.min(
              1,
              Math.sqrt(combinationRatio * Math.log(totalPairs + 1)),
            );

            // Skip relationships below the minimum correlation threshold
            if (correlationScore < minCorrelation) continue;

            // Create the relationship object
            const relationship: FieldRelationship = {
              fieldA,
              fieldB,
              cooccurrenceCount: totalPairs,
              correlationScore,
            };

            // Add sample values if requested
            if (includeExamples) {
              relationship.sampleValues = buckets
                .slice(0, 5)
                .map((bucket: any) => ({
                  valueA: bucket.key[fieldA],
                  valueB: bucket.key[fieldB],
                  count: bucket.doc_count,
                }));
            }

            relationships.push(relationship);
          }
        }

        // Sort relationships by correlation score (descending)
        relationships.sort((a, b) => b.correlationScore - a.correlationScore);

        // Format the results for display
        let output = "# Field Relationship Analysis\n\n";
        output += `Analyzed fields: ${fields.join(", ")}\n`;
        output += `Time range: ${timeRange}\n`;
        if (query) {
          output += `Filter: ${query}\n`;
        }
        output += "\n";

        if (relationships.length === 0) {
          output += "## No Significant Relationships Found\n\n";
          output +=
            "No field relationships meeting the minimum correlation threshold were found.\n";
          output += "You can try:\n";
          output += "- Lowering the minimum correlation threshold\n";
          output += "- Extending the time range to include more data\n";
          output += "- Checking that the fields exist in your logs\n";
          output += "- Using '.keyword' suffix for text fields\n";
        } else {
          output += "## Field Relationships\n\n";
          output +=
            "| Field A | Field B | Co-occurrences | Correlation Score | Relationship Strength |\n";
          output +=
            "|---------|---------|----------------|-------------------|----------------------|\n";

          relationships.forEach((rel) => {
            // Format field names for display (remove .keyword suffix)
            const fieldADisplay = rel.fieldA.replace(/\.keyword$/, "");
            const fieldBDisplay = rel.fieldB.replace(/\.keyword$/, "");

            // Create a visual indicator of relationship strength
            const strengthIndicator = getStrengthIndicator(
              rel.correlationScore,
            );

            output += `| ${fieldADisplay} | ${fieldBDisplay} | ${rel.cooccurrenceCount} | ${rel.correlationScore.toFixed(3)} | ${strengthIndicator} |\n`;
          });

          // Add detailed examples for each relationship
          output += "\n## Relationship Details\n\n";
          relationships.forEach((rel, index) => {
            const fieldADisplay = rel.fieldA.replace(/\.keyword$/, "");
            const fieldBDisplay = rel.fieldB.replace(/\.keyword$/, "");

            output += `### ${index + 1}. ${fieldADisplay} ↔ ${fieldBDisplay}\n\n`;
            output += `Correlation score: ${rel.correlationScore.toFixed(3)} (${getCorrelationDescription(rel.correlationScore)})\n`;
            output += `Co-occurrences: ${rel.cooccurrenceCount} documents\n\n`;

            if (rel.sampleValues && rel.sampleValues.length > 0) {
              output += "**Common combinations:**\n\n";
              output +=
                "| Value of " +
                fieldADisplay +
                " | Value of " +
                fieldBDisplay +
                " | Count |\n";
              output +=
                "|--------------------------|--------------------------|-------|\n";

              rel.sampleValues.forEach((sample) => {
                const valueA = formatValue(sample.valueA);
                const valueB = formatValue(sample.valueB);
                output += `| ${valueA} | ${valueB} | ${sample.count} |\n`;
              });
              output += "\n";
            }

            // Add analysis insights
            output += "**Insights:**\n\n";
            if (rel.correlationScore > 0.7) {
              output +=
                "- These fields show a very strong relationship and likely represent related concepts\n";
              output +=
                "- Consider using them together in searches and dashboards\n";
            } else if (rel.correlationScore > 0.4) {
              output += "- These fields show a moderate relationship\n";
              output +=
                "- They likely represent related but distinct aspects of your logs\n";
            } else {
              output += "- These fields show a weak relationship\n";
              output +=
                "- They may occasionally coincide but likely represent different aspects of your logs\n";
            }
            output += "\n";
          });

          // Add usage recommendations
          output += "## Usage Recommendations\n\n";
          output +=
            "- **For searching**: Use related fields together in search queries for more precise results\n";
          output +=
            "- **For filtering**: When filtering on one field, consider how related fields may be affected\n";
          output +=
            "- **For dashboards**: Visualize related fields together to reveal patterns\n";
          output +=
            "- **For anomaly detection**: Watch for changes in these relationships to spot unusual behavior\n\n";

          // Add example queries
          if (relationships.length > 0) {
            const topRel = relationships[0];
            const fieldA = topRel.fieldA.replace(/\.keyword$/, "");
            const fieldB = topRel.fieldB.replace(/\.keyword$/, "");

            if (topRel.sampleValues && topRel.sampleValues.length > 0) {
              const sampleValueA = formatValue(topRel.sampleValues[0].valueA);
              const sampleValueB = formatValue(topRel.sampleValues[0].valueB);

              output += "**Example query using related fields:**\n\n";
              output += "```\n";
              output += `${fieldA}:"${sampleValueA}" AND ${fieldB}:"${sampleValueB}"\n`;
              output += "```\n\n";
            }
          }
        }

        // Return the formatted results
        return {
          // Include raw data for programmatic access
          data: relationships,

          // Include a structured summary
          summary: {
            field_count: fields.length,
            relationship_count: relationships.length,
            top_relationships: relationships.slice(0, 3).map((rel) => ({
              fields: [rel.fieldA, rel.fieldB],
              correlation: rel.correlationScore,
            })),
          },

          // Provide formatted text output
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      } catch (error) {
        // Log the error for server-side debugging
        console.error(`Error in field-relations tool:`, error);

        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "field-relations",
          operation: "analyze_field_relationships",
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

/**
 * Helper function to format a value for display in the markdown table
 */
function formatValue(value: string | number | boolean): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    // Escape any pipe characters that would break the markdown table
    let sanitized = value.replace(/\|/g, "\\|");
    // Truncate long values
    return sanitized.length > 30
      ? sanitized.substring(0, 27) + "..."
      : sanitized;
  }
  return String(value);
}

/**
 * Helper function to get a visual indicator of relationship strength
 */
function getStrengthIndicator(score: number): string {
  if (score >= 0.8) return "█████"; // Very strong
  if (score >= 0.6) return "████"; // Strong
  if (score >= 0.4) return "███"; // Moderate
  if (score >= 0.2) return "██"; // Weak
  return "█"; // Very weak
}

/**
 * Helper function to get a text description of correlation strength
 */
function getCorrelationDescription(score: number): string {
  if (score >= 0.8) return "Very strong relationship";
  if (score >= 0.6) return "Strong relationship";
  if (score >= 0.4) return "Moderate relationship";
  if (score >= 0.2) return "Weak relationship";
  return "Very weak relationship";
}
