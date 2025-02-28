import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import { buildTimeRange } from "../../utils/time.js";
import { Elasticsearch6SearchParams } from "../../types/elasticsearch.types.js";
import {
  FieldValidationParams,
  ValidationRule,
  ValidationResult,
} from "../../types/tools/fields.types.js";

/**
 * Registers the validate-fields tool
 * This tool validates field values against defined rules
 */
export function registerFieldValidationTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "validate-fields",
    "Validate field values against defined rules and constraints",
    {
      field: z
        .string()
        .describe("The field to validate (e.g., 'email', 'status_code')"),

      rules: z
        .array(
          z.object({
            type: z.enum([
              "regex",
              "range",
              "enum",
              "length",
              "format",
              "custom",
            ]),
            pattern: z.string().optional(),
            min: z.number().optional(),
            max: z.number().optional(),
            allowedValues: z
              .array(z.union([z.string(), z.number(), z.boolean()]))
              .optional(),
            minLength: z.number().optional(),
            maxLength: z.number().optional(),
            format: z.string().optional(),
            script: z.string().optional(),
            description: z.string().optional(),
          }),
        )
        .describe("Validation rules to apply to the field"),

      index: z
        .string()
        .optional()
        .describe("Index pattern to validate (e.g., 'logstash-*')"),

      timeRange: z
        .string()
        .optional()
        .default("24h")
        .describe("Time range to validate (e.g., '15m', '24h', '7d')"),

      query: z
        .string()
        .optional()
        .describe("Optional query to filter logs before validation"),

      sampleSize: z
        .number()
        .optional()
        .default(1000)
        .describe("Maximum number of documents to validate"),

      includeExamples: z
        .boolean()
        .optional()
        .default(true)
        .describe("Whether to return examples of invalid values"),

      failOnMissing: z
        .boolean()
        .optional()
        .default(false)
        .describe("Whether to treat missing fields as validation failures"),
    },
    async (params) => {
      try {
        // Build base query
        const baseQuery: Record<string, unknown> = {
          bool: {
            filter: [
              ...(params.timeRange ? [buildTimeRange(params.timeRange)] : []),
            ],
          },
        };

        // Add text query if provided
        if (params.query) {
          const boolQuery = baseQuery.bool as Record<string, unknown>;
          if (!boolQuery.must) {
            boolQuery.must = [];
          }
          (boolQuery.must as Array<Record<string, unknown>>).push({
            query_string: {
              query: params.query,
              allow_leading_wildcard: false,
            },
          });
        }

        // Create validation result object
        const validationResult: ValidationResult = {
          field: params.field,
          total_docs: 0,
          docs_with_field: 0,
          field_coverage: 0,
          valid_docs: 0,
          invalid_docs: 0,
          valid_percentage: 0,
          rule_results: [],
        };

        // First, get field statistics to understand field presence and type
        const statsQuery = {
          ...baseQuery,
          size: 0,
          aggs: {
            field_exists: {
              filter: {
                exists: {
                  field: params.field,
                },
              },
            },
            // Gather statistics to help with validation
            field_stats: {
              filter: {
                exists: {
                  field: params.field,
                },
              },
              aggs: {
                value_stats: {
                  extended_stats: {
                    field: params.field,
                  },
                },
                cardinality: {
                  cardinality: {
                    field: params.field,
                  },
                },
              },
            },
          },
        };

        const statsResponse = await client.search({
          index: params.index,
          ...statsQuery,
        } as unknown as Elasticsearch6SearchParams);

        // Extract basic field statistics
        // Handle different Elasticsearch response formats for total hits
        let total = 0;
        const hitsObj = statsResponse.hits as Record<string, unknown>;
        if (
          hitsObj &&
          typeof hitsObj.total === "object" &&
          hitsObj.total !== null
        ) {
          const totalObj = hitsObj.total as Record<string, unknown>;
          total = typeof totalObj.value === "number" ? totalObj.value : 0;
        } else if (hitsObj && typeof hitsObj.total === "number") {
          total = hitsObj.total;
        }

        validationResult.total_docs = total;

        // Extract aggregation results with proper type checking
        let docsWithField = 0;
        const aggsObj = statsResponse.aggregations as
          | Record<string, unknown>
          | undefined;
        if (
          aggsObj &&
          typeof aggsObj.field_exists === "object" &&
          aggsObj.field_exists !== null
        ) {
          const fieldExistsAgg = aggsObj.field_exists as Record<
            string,
            unknown
          >;
          docsWithField =
            typeof fieldExistsAgg.doc_count === "number"
              ? fieldExistsAgg.doc_count
              : 0;
        }

        validationResult.docs_with_field = docsWithField;

        validationResult.field_coverage =
          validationResult.total_docs > 0
            ? (validationResult.docs_with_field / validationResult.total_docs) *
              100
            : 0;

        // Setup rule results with initial counts
        validationResult.rule_results = params.rules.map((rule) => ({
          rule_type: rule.type,
          description:
            rule.description ||
            getDefaultRuleDescription(rule as ValidationRule),
          valid_count: 0,
          invalid_count: 0,
          valid_percentage: 0,
          invalid_examples: params.includeExamples ? [] : undefined,
        }));

        // If the field doesn't exist in any document, we can return early
        if (validationResult.docs_with_field === 0) {
          const message = `Field '${params.field}' not found in any documents.`;
          return formatValidationResponse(validationResult, message);
        }

        // Create the validation query
        const validationQueries = params.rules.map((rule, index) =>
          createValidationQuery(params.field, rule as ValidationRule, index),
        );

        // Build the search request for validation
        const validationSearchParams = {
          index: params.index,
          size: params.includeExamples
            ? Math.min(params.sampleSize || 1000, 100)
            : 0,
          query: baseQuery,
          aggs: {
            field_exists: {
              filter: {
                exists: {
                  field: params.field,
                },
              },
              aggs: {
                // Add each validation rule as a subaggregation
                ...validationQueries.reduce(
                  (aggs, query, index) => {
                    aggs[`rule_${index}`] = query;
                    return aggs;
                  },
                  {} as Record<string, unknown>,
                ),
              },
            },
          },
          _source: params.includeExamples
            ? [params.field, "@timestamp", "message"]
            : false,
        };

        // Execute the validation search
        const validationResponse = await client.search(
          validationSearchParams as unknown as Elasticsearch6SearchParams,
        );

        // Process validation results
        processValidationResults(
          validationResult,
          validationResponse,
          params.rules as ValidationRule[],
          params.includeExamples,
          params.failOnMissing,
        );

        // Format the output with a summary and detailed results
        const message = formatValidationMessage(validationResult);
        return formatValidationResponse(validationResult, message);
      } catch (error) {
        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "validate-fields",
          operation: "field_validation",
          params: params,
        };

        // Use centralized error handler
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
 * Creates the Elasticsearch query for a validation rule
 */
function createValidationQuery(
  field: string,
  rule: ValidationRule,
  index: number,
): Record<string, unknown> {
  switch (rule.type) {
    case "regex":
      if (!rule.pattern) {
        throw new Error("Pattern is required for regex validation");
      }
      return {
        filter: {
          script: {
            script: {
              source: `doc['${field}'].size() > 0 && doc['${field}'].value.toString().matches(params.pattern)`,
              params: {
                pattern: rule.pattern,
              },
            },
          },
        },
      };

    case "range":
      if (rule.min === undefined && rule.max === undefined) {
        throw new Error("Either min or max is required for range validation");
      }

      const rangeScript = [];
      if (rule.min !== undefined) {
        rangeScript.push(`doc['${field}'].value >= params.min`);
      }
      if (rule.max !== undefined) {
        rangeScript.push(`doc['${field}'].value <= params.max`);
      }

      return {
        filter: {
          script: {
            script: {
              source: `doc['${field}'].size() > 0 && ${rangeScript.join(" && ")}`,
              params: {
                min: rule.min,
                max: rule.max,
              },
            },
          },
        },
      };

    case "enum":
      if (!rule.allowedValues || rule.allowedValues.length === 0) {
        throw new Error("Allowed values are required for enum validation");
      }
      return {
        filter: {
          script: {
            script: {
              source: `doc['${field}'].size() > 0 && params.allowedValues.contains(doc['${field}'].value.toString())`,
              params: {
                allowedValues: rule.allowedValues.map((v) => v.toString()),
              },
            },
          },
        },
      };

    case "length":
      if (rule.minLength === undefined && rule.maxLength === undefined) {
        throw new Error(
          "Either minLength or maxLength is required for length validation",
        );
      }

      const lengthScript = [];
      if (rule.minLength !== undefined) {
        lengthScript.push(
          `doc['${field}'].value.toString().length() >= params.minLength`,
        );
      }
      if (rule.maxLength !== undefined) {
        lengthScript.push(
          `doc['${field}'].value.toString().length() <= params.maxLength`,
        );
      }

      return {
        filter: {
          script: {
            script: {
              source: `doc['${field}'].size() > 0 && ${lengthScript.join(" && ")}`,
              params: {
                minLength: rule.minLength,
                maxLength: rule.maxLength,
              },
            },
          },
        },
      };

    case "format":
      if (!rule.format) {
        throw new Error("Format is required for format validation");
      }

      let formatScript = "";
      switch (rule.format) {
        case "email":
          formatScript = `doc['${field}'].value.toString().matches(params.emailPattern)`;
          return {
            filter: {
              script: {
                script: {
                  source: `doc['${field}'].size() > 0 && ${formatScript}`,
                  params: {
                    emailPattern:
                      "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
                  },
                },
              },
            },
          };
        case "url":
          formatScript = `doc['${field}'].value.toString().matches(params.urlPattern)`;
          return {
            filter: {
              script: {
                script: {
                  source: `doc['${field}'].size() > 0 && ${formatScript}`,
                  params: {
                    urlPattern: "^(https?|ftp)://[^\\s/$.?#].[^\\s]*$",
                  },
                },
              },
            },
          };
        case "ip":
          formatScript = `doc['${field}'].value.toString().matches(params.ipPattern)`;
          return {
            filter: {
              script: {
                script: {
                  source: `doc['${field}'].size() > 0 && ${formatScript}`,
                  params: {
                    ipPattern: "^(?:[0-9]{1,3}\\.){3}[0-9]{1,3}$",
                  },
                },
              },
            },
          };
        case "date":
          // This relies on the field already being a date type in Elasticsearch
          return {
            filter: {
              exists: {
                field: field,
              },
            },
          };
        default:
          throw new Error(`Unsupported format: ${rule.format}`);
      }

    case "custom":
      if (!rule.script) {
        throw new Error("Script is required for custom validation");
      }
      return {
        filter: {
          script: {
            script: {
              source: rule.script,
              params: {},
            },
          },
        },
      };

    default:
      throw new Error(`Unsupported validation rule type: ${rule.type}`);
  }
}

/**
 * Process validation results from Elasticsearch
 */
function processValidationResults(
  result: ValidationResult,
  response: any,
  rules: ValidationRule[],
  includeExamples: boolean = false,
  failOnMissing: boolean = false,
) {
  // Get total documents with the field
  const totalDocsWithField =
    response.aggregations?.field_exists?.doc_count || 0;

  // Process rule results
  rules.forEach((rule, index) => {
    const ruleAggName = `rule_${index}`;
    const validCount =
      response.aggregations?.field_exists?.[ruleAggName]?.doc_count || 0;
    const invalidCount = totalDocsWithField - validCount;

    // Update rule result
    const ruleResult = result.rule_results[index];
    ruleResult.valid_count = validCount;
    ruleResult.invalid_count = invalidCount;
    ruleResult.valid_percentage =
      totalDocsWithField > 0 ? (validCount / totalDocsWithField) * 100 : 0;

    // If examples are requested and we have invalid docs, collect examples
    if (includeExamples && invalidCount > 0 && response.hits?.hits) {
      // We need to filter the hits to find ones that fail this specific rule
      const invalidExamples = [];
      for (const hit of response.hits.hits) {
        const fieldValue = hit._source?.[result.field];
        if (fieldValue !== undefined) {
          // Check if this document fails the current rule
          if (!validateValue(fieldValue, rule)) {
            invalidExamples.push({
              value: fieldValue,
              document_id: hit._id,
            });
          }
        }
      }

      // Only keep a reasonable number of examples
      if (ruleResult.invalid_examples) {
        ruleResult.invalid_examples = invalidExamples.slice(0, 10);
      }
    }
  });

  // Calculate overall validation results
  result.valid_docs = result.rule_results.every((r) => r.invalid_count === 0)
    ? totalDocsWithField
    : 0;
  result.invalid_docs = totalDocsWithField - result.valid_docs;
  result.valid_percentage =
    totalDocsWithField > 0 ? (result.valid_docs / totalDocsWithField) * 100 : 0;

  // If we should fail on missing fields
  if (failOnMissing && result.total_docs > result.docs_with_field) {
    const missingCount = result.total_docs - result.docs_with_field;
    result.invalid_docs += missingCount;
    result.valid_percentage =
      result.total_docs > 0 ? (result.valid_docs / result.total_docs) * 100 : 0;
  }
}

/**
 * Format validation results into a human-readable message
 */
function formatValidationMessage(result: ValidationResult): string {
  let message = `# Field Validation: ${result.field}\n\n`;

  // Field presence information
  message += `## Field Coverage\n\n`;
  message += `- Total documents: ${result.total_docs}\n`;
  message += `- Documents with field: ${result.docs_with_field} (${result.field_coverage.toFixed(2)}%)\n\n`;

  // Overall validation results
  message += `## Validation Summary\n\n`;

  if (result.docs_with_field === 0) {
    message += `Field '${result.field}' not found in any documents. No validation performed.\n\n`;
    return message;
  }

  const validPercentage = result.valid_percentage.toFixed(2);
  message += `- Valid documents: ${result.valid_docs} (${validPercentage}%)\n`;
  message += `- Invalid documents: ${result.invalid_docs} (${(100 - result.valid_percentage).toFixed(2)}%)\n\n`;

  // Validation health indicator
  if (result.valid_percentage >= 95) {
    message += `Overall validation status: ✅ GOOD (>95% valid)\n\n`;
  } else if (result.valid_percentage >= 80) {
    message += `Overall validation status: ⚠️ ACCEPTABLE (80-95% valid)\n\n`;
  } else {
    message += `Overall validation status: ❌ POOR (<80% valid)\n\n`;
  }

  // Detailed rule results
  message += `## Validation Rules\n\n`;

  result.rule_results.forEach((ruleResult, index) => {
    const validPercentage = ruleResult.valid_percentage.toFixed(2);
    message += `### Rule ${index + 1}: ${ruleResult.description}\n\n`;
    message += `- Type: ${ruleResult.rule_type}\n`;
    message += `- Valid: ${ruleResult.valid_count} (${validPercentage}%)\n`;
    message += `- Invalid: ${ruleResult.invalid_count} (${(100 - ruleResult.valid_percentage).toFixed(2)}%)\n`;

    // Include examples of invalid values if available
    if (ruleResult.invalid_examples && ruleResult.invalid_examples.length > 0) {
      message += `\n#### Invalid Examples:\n\n`;
      ruleResult.invalid_examples.forEach((example, i) => {
        message += `${i + 1}. \`${JSON.stringify(example.value)}\`\n`;
      });
    }

    message += `\n`;
  });

  // Add recommendations
  message += `## Recommendations\n\n`;

  if (result.valid_percentage < 80) {
    // Find the most problematic rule
    const worstRule = [...result.rule_results].sort(
      (a, b) => a.valid_percentage - b.valid_percentage,
    )[0];
    message += `- Focus on fixing validation issues with rule: ${worstRule.description}\n`;
    message += `- Consider reviewing data quality processes for this field\n`;
  } else if (result.valid_percentage < 95) {
    message += `- Address remaining validation issues to improve data quality\n`;
    message += `- Set up monitoring to track validation rates over time\n`;
  } else {
    message += `- Maintain current data quality standards\n`;
    message += `- Consider adding more validation rules for deeper quality assurance\n`;
  }

  return message;
}

/**
 * Format the final validation response
 */
function formatValidationResponse(result: ValidationResult, message: string) {
  return {
    // Include raw data for programmatic access
    data: result,

    // Include a structured summary
    summary: {
      field: result.field,
      total_docs: result.total_docs,
      docs_with_field: result.docs_with_field,
      field_coverage_percent: result.field_coverage,
      valid_docs: result.valid_docs,
      invalid_docs: result.invalid_docs,
      valid_percentage: result.valid_percentage,
      rules_count: result.rule_results.length,
      validation_status:
        result.valid_percentage >= 95
          ? "good"
          : result.valid_percentage >= 80
            ? "acceptable"
            : "poor",
    },

    // Provide formatted text output
    content: [{ type: "text", text: message }],

    // Add related tools
    related_tools: {
      field_stats: {
        name: "field-stats",
        description: "Get detailed statistics about this field",
      },
      discover_fields: {
        name: "discover-fields",
        description: "Discover and explore available fields",
      },
    },
  };
}

/**
 * Get a default description for a validation rule
 */
function getDefaultRuleDescription(rule: ValidationRule): string {
  switch (rule.type) {
    case "regex":
      return `Matches regular expression ${rule.pattern}`;
    case "range":
      if (rule.min !== undefined && rule.max !== undefined) {
        return `Value between ${rule.min} and ${rule.max}`;
      } else if (rule.min !== undefined) {
        return `Value greater than or equal to ${rule.min}`;
      } else {
        return `Value less than or equal to ${rule.max}`;
      }
    case "enum":
      return `Value in allowed set: ${rule.allowedValues?.join(", ")}`;
    case "length":
      if (rule.minLength !== undefined && rule.maxLength !== undefined) {
        return `Length between ${rule.minLength} and ${rule.maxLength} characters`;
      } else if (rule.minLength !== undefined) {
        return `Length at least ${rule.minLength} characters`;
      } else {
        return `Length at most ${rule.maxLength} characters`;
      }
    case "format":
      return `Valid ${rule.format} format`;
    case "custom":
      return `Custom validation script`;
    default:
      return `Validation rule: ${rule.type}`;
  }
}

/**
 * Validate a single value against a rule (used for collecting examples)
 */
function validateValue(value: any, rule: ValidationRule): boolean {
  switch (rule.type) {
    case "regex":
      if (!rule.pattern) return false;
      return new RegExp(rule.pattern).test(String(value));

    case "range":
      if (typeof value !== "number") return false;
      if (rule.min !== undefined && value < rule.min) return false;
      if (rule.max !== undefined && value > rule.max) return false;
      return true;

    case "enum":
      if (!rule.allowedValues) return false;
      return rule.allowedValues.includes(value);

    case "length":
      const strValue = String(value);
      if (rule.minLength !== undefined && strValue.length < rule.minLength)
        return false;
      if (rule.maxLength !== undefined && strValue.length > rule.maxLength)
        return false;
      return true;

    case "format":
      if (!rule.format) return false;
      const strVal = String(value);

      switch (rule.format) {
        case "email":
          return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(
            strVal,
          );
        case "url":
          return /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/.test(strVal);
        case "ip":
          return /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(strVal);
        case "date":
          return !isNaN(Date.parse(strVal));
        default:
          return false;
      }

    case "custom":
      // Can't evaluate custom scripts here
      return true;

    default:
      return false;
  }
}
