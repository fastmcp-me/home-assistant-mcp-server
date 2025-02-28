import { z } from "zod";
import { highlightSchema } from "./highlight.js";
import { aggregationSchema } from "./aggregation.js";
import { Elasticsearch6SearchSchema } from "./elasticsearch.js";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { ElasticsearchQueryDSL } from "../types/elasticsearch.types.js";
import {
  BoolQuery,
  QueryClause,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SortOrder,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Sort,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  QueryString,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Range,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Term,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Terms,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  Match,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SourceField,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SearchRequest,
} from "../types/query.types.js";

// Basic schemas
export const sortOrderSchema = z.enum(["asc", "desc"]);

export const sortSchema = z.array(
  z
    .object({
      field: z.string(),
      order: sortOrderSchema.optional(),
    })
    .or(z.record(z.string(), sortOrderSchema)),
);

// Query string schema - using Elasticsearch schema
export const queryStringSchema = z
  .object({
    query: z
      .union([z.string(), z.record(z.string(), z.any())])
      .describe("The query text to search for or a structured query object"),
    // Using Elasticsearch schema properties for query_string
    allow_leading_wildcard: z.literal(false).optional(),
    analyze_wildcard: z.boolean().optional(),
    analyzer: z.string().optional(),
    auto_generate_synonyms_phrase_query: z.boolean().optional(),
    default_field: z.string().optional(),
    default_operator: z.enum(["AND", "OR"]).optional(),
    enable_position_increments: z.boolean().optional(),
    fields: z.array(z.string()).optional(),
    fuzziness: z.string().or(z.number()).optional(),
    lenient: z.boolean().optional(),
    minimum_should_match: z.string().or(z.number()).optional(),
    quote_analyzer: z.string().optional(),
    phrase_slop: z.number().optional(),
    quote_field_suffix: z.string().optional(),
    time_zone: z.string().optional(),
    type: z
      .enum([
        "best_fields",
        "most_fields",
        "cross_fields",
        "phrase",
        "phrase_prefix",
      ])
      .optional(),
  })
  .refine(
    (data) =>
      data.allow_leading_wildcard === undefined ||
      data.allow_leading_wildcard === false,
    {
      message:
        "allow_leading_wildcard must be set to false per Logz.io API restrictions",
    },
  );

// Range query schema
export const rangeSchema = z.record(
  z.string(),
  z.object({
    gt: z.any().optional(),
    gte: z.any().optional(),
    lt: z.any().optional(),
    lte: z.any().optional(),
    format: z.string().optional(),
    relation: z.enum(["INTERSECTS", "CONTAINS", "WITHIN"]).optional(),
    time_zone: z.string().optional(),
    boost: z.number().optional(),
  }),
);

// Term query schema
export const termSchema = z.record(
  z.string(),
  z
    .object({
      value: z.any(),
      boost: z.number().optional(),
    })
    .or(z.any()),
);

// Terms query schema
export const termsSchema = z.record(z.string(), z.array(z.any()));

// Match query schema
export const matchSchema = z.record(
  z.string(),
  z
    .object({
      query: z.any(),
      operator: z.enum(["AND", "OR"]).optional(),
      minimum_should_match: z.string().or(z.number()).optional(),
      analyzer: z.string().optional(),
      boost: z.number().optional(),
    })
    .or(z.any()),
);

// Use imported types instead of defining them here

// Bool query schema
export const boolQuerySchema: z.ZodType<BoolQuery> = z.lazy(() =>
  z.object({
    must: z.array(queryClauseSchema).or(queryClauseSchema).optional(),
    must_not: z.array(queryClauseSchema).or(queryClauseSchema).optional(),
    should: z.array(queryClauseSchema).or(queryClauseSchema).optional(),
    filter: z.array(queryClauseSchema).or(queryClauseSchema).optional(),
    minimum_should_match: z.number().or(z.string()).optional(),
    boost: z.number().optional(),
  }),
);

// Combined query clause schema - using Elasticsearch schema
export const queryClauseSchema: z.ZodType<QueryClause> = z.lazy(() => {
  // Use the query property from Elasticsearch6SearchSchema which is based on ElasticsearchQueryDSL
  return Elasticsearch6SearchSchema.shape.query.unwrap();
});

// Source field schema
export const sourceFieldSchema = z.union([
  z.boolean(),
  z.string(),
  z.array(z.string()),
  z.object({
    includes: z.array(z.string()).optional(),
    excludes: z.array(z.string()).optional(),
  }),
]);

// Search request schema - using Elasticsearch schema
export const searchRequestSchema = z.object({
  // Use Elasticsearch6SearchSchema for base properties
  query: queryClauseSchema.optional(),
  dayOffset: z.number().optional(), // Custom property
  from: z.number().optional(),
  size: z
    .number()
    .optional()
    .refine((val) => val === undefined || val <= 10000, {
      message: "Size must be less than or equal to 10000",
    }),
  sort: sortSchema.optional(),
  _source: sourceFieldSchema.optional(),
  post_filter: queryClauseSchema.optional(),
  docvalue_fields: z.array(z.string()).optional(),
  version: z.boolean().optional(),
  stored_fields: z.array(z.string()).optional(),
  highlight: highlightSchema.optional(),
  aggregations: aggregationSchema.optional(),
  aggs: aggregationSchema.optional(),
});

// Export the main query schema
export const querySchema = queryClauseSchema;
