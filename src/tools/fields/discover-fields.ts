import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import {
  DiscoverFieldsParams,
  FieldInfo,
} from "../../types/tools/fields.types.js";

/**
 * Registers the discover-fields tool
 * This tool analyzes log samples to discover available fields, their types, and basic statistics
 */
export function registerDiscoverFieldsTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "discover-fields",
    "Discover and analyze available fields in your logs with detailed metadata",
    {
      index: z
        .string()
        .optional()
        .describe(
          "Index pattern to analyze (e.g., 'logstash-*', 'filebeat-*')",
        ),
      timeRange: z
        .string()
        .optional()
        .describe("Time range to analyze (e.g., '15m', '24h', '7d')"),
      query: z
        .string()
        .optional()
        .describe("Optional query to filter logs before analyzing"),
      sampleSize: z
        .number()
        .optional()
        .default(100)
        .describe("Number of sample documents to analyze"),
      includeExamples: z
        .boolean()
        .optional()
        .default(false)
        .describe("Include example values for each field"),
    },
    async (params: DiscoverFieldsParams) => {
      try {
        // Build the search parameters for sampling logs
        const searchParams: Record<string, unknown> = {
          index: params.index,
          size: params.sampleSize || 100,
          query: params.query
            ? {
                query_string: {
                  query: params.query,
                  default_operator: "AND",
                },
              }
            : { match_all: {} },
        };

        // Add time range if specified
        if (params.timeRange) {
          // Create a proper bool query with time range
          searchParams.query = {
            bool: {
              must: [searchParams.query],
              filter: [
                {
                  range: {
                    "@timestamp": {
                      gte: `now-${params.timeRange}`,
                      lte: "now",
                    },
                  },
                },
              ],
            },
          };
        }

        // Execute the search to get sample documents
        const response = await client.search(searchParams);

        // Process the documents to extract field information
        interface ElasticsearchResponse {
          hits?: {
            hits?: Array<Record<string, unknown>>;
          };
        }
        const responseObj = response as ElasticsearchResponse;
        const hits = responseObj.hits?.hits || [];
        const fieldInfo = extractFieldsFromSamples(
          hits,
          params.includeExamples || false,
        );

        // Format the results for display
        const formattedResult = formatFieldDiscoveryResults(fieldInfo);

        return {
          // Include the raw field information for programmatic access
          data: { fields: fieldInfo },

          // Provide formatted text for human-readable output
          content: [
            {
              type: "text",
              text: formattedResult,
            },
          ],
        };
      } catch (error) {
        // Log the error for server-side debugging
        console.error(`Error in discover-fields tool:`, error);

        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "discover-fields",
          operation: "elasticsearch_discover_fields",
          params: params,
        };

        // Use centralized error handler for standardized error response
        const errorResponse = handleToolError(error, context);
        return {
          ...errorResponse,
          [Symbol.iterator]: undefined,
        };
      }
    },
  );
}

/**
 * Extract field information from sample documents
 */
function extractFieldsFromSamples(
  samples: Array<Record<string, unknown>>,
  includeExamples: boolean,
): FieldInfo[] {
  if (!samples || samples.length === 0) {
    return [];
  }

  const fieldMap = new Map<
    string,
    {
      types: Set<string>;
      count: number;
      examples: Set<string | number | boolean>;
      paths: Set<string>;
    }
  >();

  // Process each sample document to extract fields
  samples.forEach((sample) => {
    // Cast to appropriate type for accessing _source
    const sampleObj = sample as Record<string, unknown>;
    const source = sampleObj._source
      ? (sampleObj._source as Record<string, unknown>)
      : sampleObj;
    if (!source) return;

    // Recursively process fields to handle nested structures
    function processObject(obj: Record<string, unknown>, path: string = "") {
      Object.entries(obj).forEach(([key, value]) => {
        const fieldPath = path ? `${path}.${key}` : key;

        // Skip _id and other metadata fields
        if (key.startsWith("_")) return;

        // Determine field type
        let type: string = typeof value;
        if (Array.isArray(value)) {
          type = "array"; // We'll handle this custom type in our code
          if (value.length > 0) {
            if (typeof value[0] === "object" && value[0] !== null) {
              // Handle array of objects as nested fields
              value.forEach((item, index) => {
                if (typeof item === "object" && item !== null) {
                  processObject(item, `${fieldPath}[${index}]`);
                }
              });
            }
          }
        } else if (type === "object" && value !== null) {
          // Process nested objects recursively
          processObject(value as Record<string, unknown>, fieldPath);
          type = "object";
        }

        // Store field information
        if (!fieldMap.has(fieldPath)) {
          fieldMap.set(fieldPath, {
            types: new Set<string>(),
            count: 0,
            examples: new Set<string | number | boolean>(),
            paths: new Set<string>(),
          });
        }

        const fieldInfo = fieldMap.get(fieldPath)!;
        fieldInfo.types.add(type);
        fieldInfo.count++;

        // Add example value if requested
        if (
          includeExamples &&
          type !== "object" &&
          type !== "array" &&
          fieldInfo.examples.size < 3 &&
          // Only add examples of supported types
          (typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean")
        ) {
          fieldInfo.examples.add(value as string | number | boolean);
        }

        // Store path information for nested fields
        if (path) {
          fieldInfo.paths.add(path);
        }
      });
    }

    processObject(source);
  });

  // Convert the map to an array of FieldInfo objects
  const totalDocs = samples.length;
  const result: FieldInfo[] = [];

  fieldMap.forEach((info, fieldName) => {
    // Determine the most common type
    let primaryType = Array.from(info.types)[0] || "unknown";
    if (info.types.size > 1) {
      // Multiple types detected, find the most common one
      const typeCounts = new Map<string, number>();
      info.types.forEach((type) => {
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      });

      let maxCount = 0;
      info.types.forEach((type) => {
        const count = typeCounts.get(type) || 0;
        if (count > maxCount) {
          maxCount = count;
          primaryType = type;
        }
      });
    }

    // Calculate coverage
    const coverage = info.count / totalDocs;

    // Create field info object
    const fieldInfo: FieldInfo = {
      name: fieldName,
      type: primaryType,
      coverage: coverage,
    };

    // Add path information for nested fields
    if (info.paths.size > 0) {
      fieldInfo.path = Array.from(info.paths)[0];
    }

    // Add examples if requested
    if (includeExamples && info.examples.size > 0) {
      fieldInfo.examples = Array.from(info.examples) as Array<
        string | number | boolean
      >;
    }

    // Special handling for text fields
    if (primaryType === "string") {
      // Check if it might be a keyword or analyzed text
      if (fieldName.endsWith(".keyword")) {
        fieldInfo.isKeyword = true;
        fieldInfo.analyzed = false;
      } else {
        // Most string fields in Elasticsearch are analyzed by default
        fieldInfo.analyzed = true;
        fieldInfo.isKeyword = false;
      }
    }

    result.push(fieldInfo);
  });

  // Sort by coverage (descending)
  return result.sort((a, b) => b.coverage - a.coverage);
}

/**
 * Format field discovery results into a readable string
 */
function formatFieldDiscoveryResults(fields: FieldInfo[]): string {
  if (!fields || fields.length === 0) {
    return "No fields discovered. Try adjusting your search parameters or sample size.";
  }

  // Group fields by top-level type
  const fieldsByType: Record<string, FieldInfo[]> = {};

  fields.forEach((field) => {
    const type = field.type;
    if (!fieldsByType[type]) {
      fieldsByType[type] = [];
    }
    fieldsByType[type].push(field);
  });

  // Create formatted output
  let output = `# Discovered Fields\n\n`;
  output += `Total: ${fields.length} fields\n\n`;

  // Add section for each field type
  for (const [type, typeFields] of Object.entries(fieldsByType)) {
    output += `## ${type.toUpperCase()} FIELDS (${typeFields.length})\n\n`;

    // Sort by name within each type
    typeFields.sort((a, b) => a.name.localeCompare(b.name));

    typeFields.forEach((field) => {
      output += `### ${field.name}\n`;
      output += `- Coverage: ${(field.coverage * 100).toFixed(1)}%\n`;

      // Add path for nested fields
      if (field.path) {
        output += `- Path: ${field.path}\n`;
      }

      // Add analyzed/keyword info for text fields
      if (field.type === "string") {
        output += `- Analyzed: ${field.analyzed ? "Yes" : "No"}\n`;
        output += `- Keyword: ${field.isKeyword ? "Yes" : "No"}\n`;
      }

      // Add examples if available
      if (field.examples && field.examples.length > 0) {
        output += `- Examples: ${field.examples.map((ex) => JSON.stringify(ex)).join(", ")}\n`;
      }

      output += `\n`;
    });
  }

  // Add usage tips
  output += `## Usage Tips\n\n`;
  output += `- Use the \`field-stats\` tool to get detailed statistics for specific fields\n`;
  output += `- Fields with high coverage are good candidates for filtering and aggregation\n`;
  output += `- Text fields may have both analyzed and keyword versions (fieldname.keyword)\n`;

  return output;
}
