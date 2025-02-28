import { z } from "zod";

/**
 * Interface representing a bucket in an Elasticsearch aggregation
 */
export interface EsAggregationBucket {
  key: string | number;
  key_as_string?: string;
  doc_count: number;
  examples?: {
    hits: {
      hits: Array<{
        _source: Record<string, unknown>;
      }>;
    };
  };
  pattern_over_time?: {
    buckets: Array<{
      key: number;
      key_as_string?: string;
      doc_count: number;
    }>;
  };
  error_types?: {
    buckets: Array<EsAggregationBucket>;
  };
  context?: {
    hits: {
      hits: Array<{
        _source: Record<string, unknown>;
      }>;
    };
  };
}

/**
 * Interface representing an Elasticsearch response
 */
export interface EsResponse {
  took: number;
  hits: {
    total: { value: number; relation: string };
    hits: Array<{
      _id?: string;
      _score?: number;
      _source?: Record<string, unknown>;
    }>;
  };
  aggregations?: {
    error_types?: {
      buckets: EsAggregationBucket[];
    };
    error_trend?: {
      buckets: Array<{
        key: number;
        key_as_string?: string;
        doc_count: number;
      }>;
    };
    logs_over_time?: {
      buckets: Array<{
        key: number;
        key_as_string?: string;
        doc_count: number;
      }>;
    };
    log_levels?: {
      buckets: EsAggregationBucket[];
    };
    services?: {
      buckets: EsAggregationBucket[];
    };
    error_count?: {
      doc_count: number;
    };
    alternative_levels?: {
      buckets: Record<
        string,
        {
          doc_count: number;
        }
      >;
    };
    distinct_values?: {
      value: number;
    };
    distinct_samples?: {
      buckets: Array<{
        key: string | number;
        doc_count: number;
        sample?: {
          hits: {
            hits: Array<{
              _source: Record<string, unknown>;
            }>;
          };
        };
      }>;
    };
    categories?: {
      buckets: EsAggregationBucket[];
    };
    patterns?: {
      buckets: EsAggregationBucket[];
    };
    level_distribution?: {
      buckets: EsAggregationBucket[];
    };
    service_distribution?: {
      buckets: EsAggregationBucket[];
    };
    error_categories?: {
      buckets: EsAggregationBucket[];
    };
    error_severity?: {
      buckets: EsAggregationBucket[];
    };
    detected_patterns?: {
      buckets: EsAggregationBucket[];
    };
    // Trend detection aggregations
    time_series?: {
      buckets: Array<{
        key: number;
        key_as_string?: string;
        doc_count: number;
        field_values?: {
          buckets: EsAggregationBucket[];
        };
      }>;
    };
    before_period?: {
      doc_count: number;
      field_values?: {
        buckets: EsAggregationBucket[];
      };
    };
    after_period?: {
      doc_count: number;
      field_values?: {
        buckets: EsAggregationBucket[];
      };
    };
    group_analysis?: {
      buckets: Array<{
        key: string | number;
        key_as_string?: string;
        doc_count: number;
        before_period?: {
          doc_count: number;
          field_values?: {
            buckets: EsAggregationBucket[];
          };
        };
        after_period?: {
          doc_count: number;
          field_values?: {
            buckets: EsAggregationBucket[];
          };
        };
      }>;
    };
  };
}

/**
 * Type definitions for tool parameters
 */
export const LogHistogramParams = z
  .object({
    query: z.string().optional(),
    interval: z.string(),
    timeRange: z.string(),
    field: z.string().optional(),
    format: z.enum(["text", "json"]).optional(),
  })
  .passthrough();

export type LogHistogramParamsType = z.infer<typeof LogHistogramParams>;

export const AnalyzeErrorsParams = z
  .object({
    timeRange: z.string().default("24h"),
    errorField: z.string().optional().default("level"),
    errorValue: z.string().optional().default("error"),
    groupBy: z.string().optional().default("message.keyword"),
    maxGroups: z.number().optional().default(20),
    useSimpleAggregation: z.boolean().optional().default(false),
  })
  .passthrough();

export type AnalyzeErrorsParamsType = z.infer<typeof AnalyzeErrorsParams>;

export const LogDashboardParams = z
  .object({
    timeRange: z.string().optional().default("24h"),
    filter: z.string().optional(),
    includeAllLevels: z.boolean().optional().default(false),
    checkAlternativeLevels: z.boolean().optional().default(true),
  })
  .passthrough();

export type LogDashboardParamsType = z.infer<typeof LogDashboardParams>;

export const AnalyzeLogPatternsParams = z
  .object({
    timeRange: z.string().default("24h"),
    messageField: z.string().optional().default("message"),
    patternField: z.string().optional().default("message.keyword"),
    minCount: z.number().optional().default(5),
    maxPatterns: z.number().optional().default(20),
    filter: z.string().optional(),
    includeExamples: z.boolean().optional().default(true),
  })
  .passthrough();

export type AnalyzeLogPatternsParamsType = z.infer<
  typeof AnalyzeLogPatternsParams
>;

export const CategorizeErrorsParams = z
  .object({
    timeRange: z.string().default("24h"),
    errorField: z.string().optional().default("level"),
    errorValue: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .default("error"),
    categorizeBy: z
      .union([z.string(), z.array(z.string())])
      .describe("Field(s) to use for categorizing errors"),
    includeContextFields: z.array(z.string()).optional(),
    minErrorCount: z.number().optional().default(5),
    maxCategories: z.number().optional().default(20),
    includeExamples: z.boolean().optional().default(true),
    detectErrorTypes: z.boolean().optional().default(true),
  })
  .passthrough();

export type CategorizeErrorsParamsType = z.infer<typeof CategorizeErrorsParams>;

export const TrendDetectionParams = z
  .object({
    timeRange: z.string().default("7d"),
    field: z.string(),
    query: z.string().optional(),
    groupBy: z.union([z.string(), z.array(z.string())]).optional(),
    interval: z.string().optional(),
    minTrendSignificance: z.number().optional().default(10),
    maxCategories: z.number().optional().default(20),
    includePercentages: z.boolean().optional().default(true),
    trendVisualization: z
      .enum(["text", "ascii", "none"])
      .optional()
      .default("ascii"),
  })
  .passthrough();

export type TrendDetectionParamsType = z.infer<typeof TrendDetectionParams>;
