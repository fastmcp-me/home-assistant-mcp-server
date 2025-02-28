import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { buildTimeRange } from "../../utils/time.js";
import { formatSearchResults } from "../../utils/formatter.js";
import { handleToolError } from "../../utils/errorHandler.js";
import { ErrorContext } from "../../types/errors.types.js";
import {
  StratifiedSampleParams,
  StratifiedSampleMetadata,
} from "../../types/tools/sampling.types.js";
import {
  ElasticsearchQueryDSL,
  Elasticsearch6SearchParams,
} from "../../types/elasticsearch.types.js";

/**
 * Registers the stratified-sample tool for balanced sampling across categories
 */
export function registerStratifiedSampleTool(
  server: McpServer,
  client: LogzioClient,
) {
  server.tool(
    "stratified-sample",
    "Get a balanced sample of logs across specified dimensions",
    {
      dimension: z
        .string()
        .describe(
          "Field to stratify by (e.g., 'service.keyword', 'level.keyword')",
        ),
      sampleSize: z
        .number()
        .optional()
        .default(20)
        .describe("Total number of log entries to sample"),
      maxPerCategory: z
        .number()
        .optional()
        .describe("Optional maximum samples per category"),
      minPerCategory: z
        .number()
        .optional()
        .describe("Optional minimum samples per category"),
      timeRange: z
        .string()
        .optional()
        .default("24h")
        .describe("Time range to sample from (e.g., '1h', '7d')"),
      query: z
        .string()
        .optional()
        .describe("Optional query string to filter logs"),
      secondaryDimension: z
        .string()
        .optional()
        .describe(
          "Optional secondary dimension field for nested stratification",
        ),
      fields: z
        .array(z.string())
        .optional()
        .describe("Optional specific fields to include in results"),
      format: z
        .enum(["text", "json"])
        .optional()
        .default("text")
        .describe("Response format: text for human-readable, json for data"),
    },
    async (params: StratifiedSampleParams) => {
      try {
        // Extract parameters with defaults
        const {
          dimension,
          sampleSize = 20,
          maxPerCategory,
          minPerCategory,
          timeRange = "24h",
          query,
          secondaryDimension,
          fields,
          format = "text",
        } = params;

        // 1. First get the distribution of values for the dimension field
        const distributionParams: Elasticsearch6SearchParams = {
          size: 0,
          query: buildQueryWithFilters(query, timeRange),
          aggs: {
            dimension_distribution: {
              terms: {
                field: dimension,
                size: 50, // Get up to 50 categories (this is more than enough for most use cases)
              },
            },
          },
        };

        // Add secondary dimension if specified
        if (secondaryDimension) {
          // Add a sub-aggregation for the secondary dimension
          (distributionParams.aggs.dimension_distribution as any).aggs = {
            secondary_dimension: {
              terms: {
                field: secondaryDimension,
                size: 20, // Limit to 20 subcategories per main category
              },
            },
          };
        }

        // Execute the aggregation query to get the distribution
        const distributionResult = await client.search(distributionParams);

        // Process the distribution results
        const buckets = ((distributionResult?.aggregations as any)
          ?.dimension_distribution?.buckets || []) as any[];
        const totalDocs = getHitsTotal(distributionResult);

        // If no buckets found, return a helpful error
        if (buckets.length === 0) {
          return {
            isError: true,
            error: `No values found for dimension field '${dimension}'`,
            content: [
              {
                type: "text",
                text:
                  `No values found for dimension field '${dimension}'. Please verify:\n` +
                  `- The field name is correct (check for typos)\n` +
                  `- The field exists in your data (use get-fields tool)\n` +
                  `- The timeRange contains data with this field\n` +
                  `- If using a text field, add '.keyword' suffix for exact matching`,
              },
            ],
          };
        }

        // 2. Calculate how many samples to take from each category
        const samplingPlan = calculateSamplingPlan(buckets, {
          totalSampleSize: sampleSize,
          maxPerCategory,
          minPerCategory,
        });

        // 3. Collect samples from each category
        const allResults: Record<string, unknown>[] = [];
        const categoryStats: any[] = [];

        // For each category, get the appropriate number of samples
        for (const category of samplingPlan) {
          if (category.sampleCount === 0) continue;

          // Create query for this specific category
          const categoryQuery = buildCategoryQuery(
            query,
            timeRange,
            dimension,
            category.name,
          );

          // Secondary dimension handling
          let secondaryStats = undefined;
          if (secondaryDimension && category.subCategories) {
            secondaryStats = [];

            // For each subcategory, get samples using nested categories
            for (const subCategory of category.subCategories) {
              if (subCategory.sampleCount === 0) continue;

              // Get samples for this subcategory
              const subResults = await getSamplesForCategory(
                client,
                query,
                timeRange,
                dimension,
                category.name,
                secondaryDimension,
                subCategory.name,
                subCategory.sampleCount,
                fields,
              );

              // Add to results and stats
              allResults.push(...subResults);

              // Track the subcategory stats
              secondaryStats.push({
                name: subCategory.name,
                count: subResults.length,
                percentage: subResults.length / category.sampleCount,
              });
            }
          } else {
            // Simple category sampling without subcategories
            const categoryResults = await getSamplesForCategory(
              client,
              query,
              timeRange,
              dimension,
              category.name,
              undefined,
              undefined,
              category.sampleCount,
              fields,
            );

            allResults.push(...categoryResults);
          }

          // Track the category stats
          categoryStats.push({
            name: category.name,
            count: category.sampleCount,
            percentage: category.sampleCount / sampleSize,
            subcategories: secondaryStats,
          });
        }

        // 4. Format the results
        let output = "";
        if (format === "text") {
          if (allResults.length === 0) {
            output =
              `No logs found for the specified criteria.\n\nTry broadening your search by:\n` +
              `- Using a larger time range\n` +
              `- Removing or simplifying the query filter\n`;
          } else {
            output = `## Stratified Sample Results\n\n`;
            output += `Sampled ${allResults.length} logs stratified by "${dimension}"`;
            output += query ? ` matching "${query}"` : "";
            output += ` from the last ${timeRange}`;
            if (secondaryDimension) {
              output += ` with secondary stratification by "${secondaryDimension}"`;
            }
            output += `.\n\n`;

            // Distribution information
            output += `### Distribution\n\n`;
            for (const category of categoryStats) {
              const percentage = (category.percentage * 100).toFixed(1);
              output += `- ${category.name}: ${category.count} logs (${percentage}%)\n`;

              // Add subcategories if present
              if (category.subcategories && category.subcategories.length > 0) {
                for (const sub of category.subcategories) {
                  const subPercentage = (sub.percentage * 100).toFixed(1);
                  output += `  - ${sub.name}: ${sub.count} logs (${subPercentage}%)\n`;
                }
              }
            }
            output += `\n`;

            // Format the actual results
            output += formatSearchResults({
              hits: { hits: allResults, total: { value: totalDocs } },
            });

            // Add usage tips
            output += `\n### Usage Tips\n`;
            output += `- For more control over distribution, adjust maxPerCategory and minPerCategory\n`;
            output += `- Use sample-logs tool for simple random sampling\n`;
            output += `- For detailed log analysis, use the log-dashboard or analyze-errors tools\n`;
          }
        } else {
          // JSON format requested - return raw data
          return {
            data: {
              results: allResults,
              categories: categoryStats,
              total_docs: totalDocs,
            },
            stratified_sample: prepareMetadata(
              allResults.length,
              totalDocs,
              timeRange,
              query || "all logs",
              dimension,
              secondaryDimension,
              categoryStats,
            ),
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { results: allResults, categories: categoryStats },
                  null,
                  2,
                ),
              },
            ],
          };
        }

        // Prepare the metadata
        const metadata = prepareMetadata(
          allResults.length,
          totalDocs,
          timeRange,
          query || "all logs",
          dimension,
          secondaryDimension,
          categoryStats,
        );

        // Return results with helpful metadata
        return {
          data: {
            results: allResults,
            categories: categoryStats,
            total_docs: totalDocs,
          },
          stratified_sample: metadata,
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      } catch (error) {
        // Log the error for server-side debugging
        console.error(`Error in stratified-sample tool:`, error);

        // Create error context for standardized handling
        const context: ErrorContext = {
          tool: "stratified-sample",
          operation: "elasticsearch_stratified_sample",
          params: params,
        };

        // Use centralized error handler
        const errorResponse = handleToolError(error, context);

        // Add specific troubleshooting suggestions for stratified sampling
        errorResponse.troubleshooting.suggestions = [
          `Make sure the dimension field (${params.dimension}) exists and is indexed`,
          `For text fields, try adding .keyword suffix (e.g., ${params.dimension}.keyword)`,
          `Try a different time range or broaden your query`,
          `Check if the field has enough distinct values for stratified sampling`,
          `If using secondary dimension, ensure both fields exist in your documents`,
        ];

        return {
          ...errorResponse,
          [Symbol.iterator]: undefined,
        } as any;
      }
    },
  );
}

/**
 * Builds a query with time range and optional filter
 */
function buildQueryWithFilters(
  query: string | undefined,
  timeRange: string,
): ElasticsearchQueryDSL {
  // Base query with time range
  const timeFilter = buildTimeRange(timeRange);

  // If no query is provided, just return the time range filter
  if (!query) {
    return {
      bool: {
        filter: timeFilter,
      },
    };
  }

  // If a query is provided, combine it with the time range
  return {
    bool: {
      must: {
        query_string: {
          query: query,
          default_operator: "AND",
          allow_leading_wildcard: false,
        },
      },
      filter: timeFilter,
    },
  };
}

/**
 * Builds a query for a specific category
 */
function buildCategoryQuery(
  query: string | undefined,
  timeRange: string,
  dimension: string,
  categoryValue: string,
  secondaryDimension?: string,
  secondaryValue?: string,
): ElasticsearchQueryDSL {
  // Start with the base filters
  const baseQuery = buildQueryWithFilters(query, timeRange);

  // Add the dimension filter
  const dimensionFilter = {
    term: { [dimension]: categoryValue },
  };

  // Add the secondary dimension filter if provided
  let secondaryFilter = undefined;
  if (secondaryDimension && secondaryValue) {
    secondaryFilter = {
      term: { [secondaryDimension]: secondaryValue },
    };
  }

  // Create a new bool query with all our filters
  const filters = [];

  // Include the existing time filter - use type assertion to handle complex ElasticsearchQueryDSL
  const queryWithBool = baseQuery as unknown as {
    bool?: {
      filter?: ElasticsearchQueryDSL | ElasticsearchQueryDSL[];
      must?: ElasticsearchQueryDSL | ElasticsearchQueryDSL[];
    };
  };

  if (queryWithBool.bool && queryWithBool.bool.filter) {
    if (Array.isArray(queryWithBool.bool.filter)) {
      filters.push(...queryWithBool.bool.filter);
    } else {
      filters.push(queryWithBool.bool.filter);
    }
  }

  // Add our dimension filters
  filters.push(dimensionFilter);

  if (secondaryFilter) {
    filters.push(secondaryFilter);
  }

  // Include any existing must clause
  const must = queryWithBool.bool?.must || [];

  // Build the final query
  return {
    bool: {
      must: Array.isArray(must) ? must : [must],
      filter: filters,
    },
  };
}

/**
 * Gets samples for a specific category
 */
async function getSamplesForCategory(
  client: LogzioClient,
  query: string | undefined,
  timeRange: string,
  dimension: string,
  categoryValue: string,
  secondaryDimension?: string,
  secondaryValue?: string,
  sampleCount: number = 10,
  fields?: string[],
): Promise<Record<string, unknown>[]> {
  // Build the category query
  const categoryQuery = buildCategoryQuery(
    query,
    timeRange,
    dimension,
    categoryValue,
    secondaryDimension,
    secondaryValue,
  );

  // Add random scoring to get a diverse sample
  const searchParams: Elasticsearch6SearchParams = {
    size: sampleCount,
    query: {
      function_score: {
        query: categoryQuery,
        functions: [
          {
            random_score: {
              seed: Math.floor(Math.random() * 10000),
            },
          },
        ],
      },
    },
  };

  // Add fields if specified
  if (fields && fields.length > 0) {
    searchParams._source = fields;
  }

  // Execute the search
  const response = await client.search(searchParams);

  // Extract the hits
  const hits = ((response?.hits as any)?.hits || []) as Record<
    string,
    unknown
  >[];

  return hits;
}

/**
 * Calculates how many samples to take from each category
 */
function calculateSamplingPlan(
  buckets: any[],
  options: {
    totalSampleSize: number;
    maxPerCategory?: number;
    minPerCategory?: number;
  },
): Array<{
  name: string;
  docCount: number;
  sampleCount: number;
  subCategories?: Array<{
    name: string;
    docCount: number;
    sampleCount: number;
  }>;
}> {
  const { totalSampleSize, maxPerCategory, minPerCategory } = options;

  // Calculate the total documents across all buckets
  const totalDocs = buckets.reduce((sum, bucket) => sum + bucket.doc_count, 0);

  // Initial allocation - proportional to category size
  let plan = buckets.map((bucket) => {
    const proportion = bucket.doc_count / totalDocs;
    let sampleCount = Math.round(totalSampleSize * proportion);

    // Apply min per category if specified
    if (minPerCategory !== undefined && sampleCount < minPerCategory) {
      sampleCount = Math.min(minPerCategory, bucket.doc_count);
    }

    // Apply max per category if specified
    if (maxPerCategory !== undefined && sampleCount > maxPerCategory) {
      sampleCount = maxPerCategory;
    }

    // Process any subcategories if present
    let subCategories = undefined;
    if (bucket.secondary_dimension && bucket.secondary_dimension.buckets) {
      const subBuckets = bucket.secondary_dimension.buckets;
      const subTotal = subBuckets.reduce(
        (sum: number, sub: any) => sum + sub.doc_count,
        0,
      );

      subCategories = subBuckets.map((subBucket: any) => {
        const subProportion = subBucket.doc_count / subTotal;
        let subSampleCount = Math.round(sampleCount * subProportion);

        // Ensure at least 1 sample if the subcategory has documents
        if (subBucket.doc_count > 0 && subSampleCount === 0) {
          subSampleCount = 1;
        }

        return {
          name: subBucket.key,
          docCount: subBucket.doc_count,
          sampleCount: subSampleCount,
        };
      });
    }

    return {
      name: bucket.key,
      docCount: bucket.doc_count,
      sampleCount,
      subCategories,
    };
  });

  // Calculate total samples allocated
  let totalAllocated = plan.reduce(
    (sum, category) => sum + category.sampleCount,
    0,
  );

  // Adjust if we've allocated too many or too few samples
  if (totalAllocated !== totalSampleSize) {
    // Sort by number of documents (largest first) to prioritize large categories
    plan.sort((a, b) => b.docCount - a.docCount);

    if (totalAllocated > totalSampleSize) {
      // Need to reduce some allocations
      for (
        let i = plan.length - 1;
        i >= 0 && totalAllocated > totalSampleSize;
        i--
      ) {
        const category = plan[i];
        const excess = totalAllocated - totalSampleSize;
        const reduction = Math.min(category.sampleCount, excess);

        category.sampleCount -= reduction;
        totalAllocated -= reduction;
      }
    } else {
      // Need to increase some allocations
      for (
        let i = 0;
        i < plan.length && totalAllocated < totalSampleSize;
        i++
      ) {
        const category = plan[i];
        const shortfall = totalSampleSize - totalAllocated;
        const increase = Math.min(
          category.docCount - category.sampleCount,
          shortfall,
        );

        category.sampleCount += increase;
        totalAllocated += increase;
      }
    }
  }

  return plan;
}

/**
 * Extracts the total hits from a search response
 */
function getHitsTotal(response: Record<string, unknown>): number {
  if (!response.hits) return 0;

  const hits = response.hits as Record<string, unknown>;

  if (typeof hits.total === "number") {
    return hits.total;
  }

  if (
    typeof hits.total === "object" &&
    hits.total &&
    typeof (hits.total as any).value === "number"
  ) {
    return (hits.total as any).value;
  }

  return 0;
}

/**
 * Prepares the metadata for the response
 */
function prepareMetadata(
  sampleSize: number,
  totalDocs: number,
  timeRange: string,
  query: string,
  dimension: string,
  secondaryDimension?: string,
  distribution?: any[],
): StratifiedSampleMetadata {
  return {
    size: sampleSize,
    total_logs: totalDocs,
    time_range: timeRange,
    query: query,
    dimension: dimension,
    secondary_dimension: secondaryDimension,
    distribution: distribution || [],
  };
}
