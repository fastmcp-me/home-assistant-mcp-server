import { z } from "zod";
import {
  ElasticsearchQueryDSL,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Elasticsearch6SearchParams,
} from "../types/elasticsearch.types.js";

// Recursive schema for Elasticsearch Query DSL
const ElasticsearchQueryDSL: z.ZodType<ElasticsearchQueryDSL> = z
  .lazy(() =>
    z.union([
      // Match Query: full-text search query
      z
        .object({
          match: z
            .record(
              z.union([
                z.string().describe("Simple match query string."),
                z
                  .object({
                    query: z.string().describe("The query text to match."),
                    operator: z
                      .enum(["AND", "OR"])
                      .optional()
                      .describe("The operator to combine multiple terms."),
                  })
                  .describe("Detailed match query options."),
              ]),
            )
            .describe("Mapping of fields to match queries."),
        })
        .describe("A match query for full-text search."),
      // Term Query: exact value matching
      z
        .object({
          term: z
            .record(
              z.union([
                z.string().describe("Simple term query value."),
                z
                  .object({
                    value: z
                      .union([z.string(), z.number(), z.boolean()])
                      .describe("The exact value to match."),
                  })
                  .describe("Detailed term query options."),
              ]),
            )
            .describe("Mapping of fields to term queries."),
        })
        .describe("A term query for exact matching."),
      // Bool Query: combine multiple queries
      z
        .object({
          bool: z
            .object({
              must: z
                .union([
                  ElasticsearchQueryDSL,
                  z
                    .array(ElasticsearchQueryDSL)
                    .describe(
                      "Array of queries to be matched in the must clause.",
                    ),
                ])
                .optional()
                .describe("Queries that must match."),
              filter: z
                .union([
                  ElasticsearchQueryDSL,
                  z
                    .array(ElasticsearchQueryDSL)
                    .describe("Array of queries for filtering results."),
                ])
                .optional()
                .describe("Queries used for filtering results."),
              should: z
                .union([
                  ElasticsearchQueryDSL,
                  z
                    .array(ElasticsearchQueryDSL)
                    .describe("Array of queries to be optionally matched."),
                ])
                .optional()
                .describe("Queries that should match."),
              must_not: z
                .union([
                  ElasticsearchQueryDSL,
                  z
                    .array(ElasticsearchQueryDSL)
                    .describe("Array of queries that must not match."),
                ])
                .optional()
                .describe("Queries that must not match."),
            })
            .describe("Boolean query combining multiple query clauses."),
        })
        .describe("A boolean query combining multiple queries."),
      // Fallback: any valid query DSL object
      z.any().describe("Any valid Elasticsearch Query DSL object."),
    ]),
  )
  .describe("Elasticsearch Query DSL schema for defining search queries.");

// Helper to convert string inputs to numbers when needed
const toInt = (val: unknown) => {
  if (typeof val === "string") {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? val : parsed;
  }
  return val;
};

export const Elasticsearch6SearchSchema = z
  .object({
    // Query DSL and request body sections
    query: ElasticsearchQueryDSL.optional().describe(
      "The search query DSL to filter matching documents, defined by a dedicated schema.",
    ),
    aggs: z
      .any()
      .optional()
      .describe(
        "Aggregations to perform on the search results. Alias for aggregations.",
      ),
    aggregations: z
      .any()
      .optional()
      .describe(
        "Aggregations to perform on the search results. Alias for aggs.",
      ),
    post_filter: z
      .any()
      .optional()
      .describe(
        "Query DSL used to filter search results post query execution, often used for faceted search.",
      ),
    highlight: z
      .any()
      .optional()
      .describe(
        "Defines how the search results should highlight matched query text.",
      ),
    rescore: z
      .any()
      .optional()
      .describe("Rescoring mechanism to fine-tune the search result ranking."),
    suggest: z
      .any()
      .optional()
      .describe(
        "Suggesters for search-as-you-type and query suggestions. Accepts any valid suggestion structure.",
      ),
    script_fields: z
      .any()
      .optional()
      .describe(
        "Allows custom scripts to compute additional fields for each document in the search results.",
      ),
    collapse: z
      .any()
      .optional()
      .describe(
        "Field collapsing to group search results based on a specific field value.",
      ),

    // Pagination & sorting
    from: z
      .preprocess((a) => toInt(a), z.number().int().min(0))
      .optional()
      .describe(
        "Pagination parameter. The starting offset for search results. Must be a non-negative integer.",
      ),
    size: z
      .preprocess((a) => toInt(a), z.number().int().min(0))
      .optional()
      .describe(
        "Pagination parameter. The number of search results to return. Must be a non-negative integer.",
      ),
    sort: z
      .union([
        z.string().describe("A simple sort field as a string."),
        z
          .array(
            z.union([
              z.string().describe("Sort field as a string within an array."),
              z
                .record(z.any())
                .describe("Detailed sort instruction as an object."),
            ]),
          )
          .describe("Array of sort instructions."),
      ])
      .optional()
      .describe("Defines sorting criteria for search results."),
    search_after: z
      .array(z.any())
      .optional()
      .describe(
        "Deep pagination parameter. An array of sort values used to retrieve results after a specific point.",
      ),
    timeout: z
      .string()
      .optional()
      .describe(
        "Specifies a timeout period (e.g., '1s' or '1m') for how long to wait for search results before returning.",
      ),
    terminate_after: z
      .preprocess((a) => toInt(a), z.number().int().min(1))
      .optional()
      .describe(
        "Limits the number of documents collected per shard. Must be a positive integer.",
      ),

    // Request preferences & routing
    routing: z
      .string()
      .optional()
      .describe(
        "Specifies a custom routing value for the search request to target specific shards.",
      ),
    preference: z
      .string()
      .optional()
      .describe(
        "Determines how the search is routed to ensure consistent ordering across requests.",
      ),
    allow_no_indices: z
      .boolean()
      .optional()
      .describe(
        "If true, allows the search to proceed even if wildcard expressions match no indices.",
      ),
    ignore_unavailable: z
      .boolean()
      .optional()
      .describe(
        "If true, ignores unavailable indices (missing or closed) rather than throwing an error.",
      ),
    ignore_throttled: z
      .boolean()
      .optional()
      .describe(
        "If true, ignores indices that are currently throttled for the search.",
      ),
    expand_wildcards: z
      .enum(["open", "closed", "none", "all"])
      .optional()
      .describe(
        "Controls how wildcard expressions are expanded. Acceptable values: 'open', 'closed', 'none', or 'all'.",
      ),

    // Misc search type and caching
    search_type: z
      .enum(["query_then_fetch", "dfs_query_then_fetch"])
      .optional()
      .describe(
        "Specifies the search type. Must be either 'query_then_fetch' or 'dfs_query_then_fetch'.",
      ),
    request_cache: z
      .boolean()
      .optional()
      .describe(
        "Indicates if the request should use the request cache if available.",
      ),
    allow_partial_search_results: z
      .boolean()
      .optional()
      .describe("If true, allows partial results when some shards fail."),
    batched_reduce_size: z
      .preprocess((a) => toInt(a), z.number().int())
      .optional()
      .describe("The number of shard results to reduce per batch."),
    ccs_minimize_roundtrips: z
      .boolean()
      .optional()
      .describe("If true, minimizes roundtrips in cross-cluster search."),
    max_concurrent_shard_requests: z
      .preprocess((a) => toInt(a), z.number().int())
      .optional()
      .describe(
        "Limits the maximum number of concurrent shard requests to execute.",
      ),
    scroll: z
      .string()
      .optional()
      .describe(
        "Specifies a scroll duration to keep the search context open for retrieving large result sets.",
      ),

    // Query string search (simple query via `q` param)
    q: z
      .string()
      .optional()
      .describe("Simple query string parameter for quick search queries."),
    df: z
      .string()
      .optional()
      .describe("Default field to use for query string searches."),
    default_operator: z
      .enum(["AND", "OR"])
      .optional()
      .describe(
        "The default operator for query string queries. Must be either 'AND' or 'OR'.",
      ),
    analyzer: z
      .string()
      .optional()
      .describe("Specifies the analyzer to use for the query string."),
    analyze_wildcard: z
      .boolean()
      .optional()
      .describe("If true, wildcards in the query string are analyzed."),
    lenient: z
      .boolean()
      .optional()
      .describe(
        "If true, ignores format-based query failures such as number format exceptions.",
      ),

    // Response filtering and control
    _source: z
      .union([
        z
          .boolean()
          .describe("A boolean to enable or disable source filtering."),
        z
          .string()
          .describe(
            "A comma-separated string of fields to include in the source.",
          ),
        z
          .array(z.string())
          .describe("An array of field names to include in the source."),
        z
          .object({
            includes: z
              .array(z.string())
              .optional()
              .describe("List of fields to include in the source filtering."),
            excludes: z
              .array(z.string())
              .optional()
              .describe("List of fields to exclude from the source filtering."),
          })
          .describe(
            "An object specifying fields to include or exclude in the returned source.",
          ),
      ])
      .optional()
      .describe("Controls source filtering for the returned documents."),
    _source_includes: z
      .union([
        z.string().describe("A single field name to include in the source."),
        z
          .array(z.string())
          .describe("An array of field names to include in the source."),
      ])
      .optional()
      .describe("Specifies which fields to include in the returned source."),
    _source_excludes: z
      .union([
        z.string().describe("A single field name to exclude from the source."),
        z
          .array(z.string())
          .describe("An array of field names to exclude from the source."),
      ])
      .optional()
      .describe("Specifies which fields to exclude from the returned source."),
    stored_fields: z
      .union([
        z.string().describe("A single stored field name to return."),
        z
          .array(z.string())
          .describe("An array of stored field names to return."),
      ])
      .optional()
      .describe(
        "Specifies which stored fields should be returned for each document.",
      ),
    docvalue_fields: z
      .union([
        z.string().describe("A single docvalue field to return."),
        z.array(z.string()).describe("An array of docvalue fields to return."),
      ])
      .optional()
      .describe("Specifies which docvalue fields to include in the response."),
    fielddata_fields: z
      .union([
        z.string().describe("A single fielddata field to return."),
        z.array(z.string()).describe("An array of fielddata fields to return."),
      ])
      .optional()
      .describe("Specifies which fielddata fields to return."),
    indices_boost: z
      .array(z.record(z.number()))
      .optional()
      .describe(
        "Allows boosting specific indices. Array mapping index names to boost values.",
      ),
    min_score: z
      .number()
      .optional()
      .describe(
        "Minimum score threshold; documents scoring below this value are excluded.",
      ),
    track_scores: z
      .boolean()
      .optional()
      .describe(
        "If true, retains document scores even when sorting by other criteria.",
      ),
    track_total_hits: z
      .union([
        z.boolean().describe("Boolean flag to track total hits accurately."),
        z
          .preprocess((a) => toInt(a), z.number().int().nonnegative())
          .describe("A threshold number for tracking total hits."),
      ])
      .optional()
      .describe("Specifies whether to track the total hit count accurately."),
    explain: z
      .boolean()
      .optional()
      .describe(
        "If true, returns a detailed explanation of how each document's score was computed.",
      ),
    version: z
      .boolean()
      .optional()
      .describe(
        "If true, includes the version number of each document in the response.",
      ),
    profile: z
      .boolean()
      .optional()
      .describe(
        "If true, includes detailed profiling information about the query execution.",
      ),
    stats: z
      .union([
        z.string().describe("A single statistical group identifier."),
        z
          .array(z.string())
          .describe("An array of statistical group identifiers."),
      ])
      .optional()
      .describe(
        "Specifies statistical aggregations to perform on the search results.",
      ),

    // Suggesters (using URL-based suggestion parameters)
    suggest_field: z
      .string()
      .optional()
      .describe("Specifies the field to use for suggestion queries."),
    suggest_text: z
      .string()
      .optional()
      .describe("The text provided for generating suggestions."),
    suggest_mode: z
      .enum(["missing", "popular", "always"])
      .optional()
      .describe(
        "Specifies the suggestion mode; must be 'missing', 'popular', or 'always'.",
      ),
    suggest_size: z
      .preprocess((a) => toInt(a), z.number().int())
      .optional()
      .describe("Defines the number of suggestions to return."),
  })
  .strict()
  .describe(
    "Elasticsearch 6.8 search query parameters schema as defined by the official Elasticsearch documentation.",
  );

// Type is now imported from types file
