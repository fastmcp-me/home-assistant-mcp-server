import { z } from "zod";
import {
  MetricAggregation,
  BucketsAggregation,
  DateHistogramAggregation,
  HistogramAggregation,
  AggregationSchema,
} from "../types/aggregation.types.js";

// Metric aggregation schema
export const metricAggregationSchema: z.ZodType<MetricAggregation> = z
  .object({
    field: z.string().optional(),
    script: z
      .union([
        z.string(),
        z
          .object({ source: z.string() })
          .transform((obj) => ({ source: obj.source })),
      ])
      .optional(),
    missing: z.any().optional(),
  })
  .passthrough();

// Buckets aggregation schema
export const bucketsAggregationSchema: z.ZodType<BucketsAggregation> = z
  .object({
    field: z.string().optional(),
    size: z
      .number()
      .optional()
      .refine((val) => val === undefined || val <= 1000, {
        message: "Size must be less than or equal to 1000",
      }),
    missing: z.any().optional(),
    order: z
      .object({
        _count: z.enum(["asc", "desc"]).optional(),
        _key: z.enum(["asc", "desc"]).optional(),
      })
      .or(z.array(z.record(z.string(), z.enum(["asc", "desc"]))))
      .optional(),
  })
  .passthrough();

// Date histogram aggregation schema
export const dateHistogramAggregationSchema: z.ZodType<DateHistogramAggregation> =
  z.object({
    field: z.string(),
    calendar_interval: z.string().optional(),
    fixed_interval: z.string().optional(),
    interval: z.string().optional(),
    format: z.string().optional(),
    time_zone: z.string().optional(),
    min_doc_count: z.number().optional(),
    extended_bounds: z
      .object({
        min: z.union([z.string(), z.number()]),
        max: z.union([z.string(), z.number()]),
      })
      .optional(),
  });

// Histogram aggregation schema
export const histogramAggregationSchema: z.ZodType<HistogramAggregation> =
  z.object({
    field: z.string(),
    interval: z.number(),
    min_doc_count: z.number().optional(),
    extended_bounds: z
      .object({
        min: z.number(),
        max: z.number(),
      })
      .optional(),
  });

// Aggregation schema
export const aggregationSchema: z.ZodType<AggregationSchema> = z.lazy(() =>
  z.record(
    z.string(),
    z
      .object({
        terms: bucketsAggregationSchema.optional(),
        date_histogram: dateHistogramAggregationSchema.optional(),
        histogram: histogramAggregationSchema.optional(),
        avg: metricAggregationSchema.optional(),
        sum: metricAggregationSchema.optional(),
        min: metricAggregationSchema.optional(),
        max: metricAggregationSchema.optional(),
        cardinality: metricAggregationSchema.optional(),
        percentiles: metricAggregationSchema.optional(),
        stats: metricAggregationSchema.optional(),
        aggs: z.lazy(() => aggregationSchema).optional(),
        aggregations: z.lazy(() => aggregationSchema).optional(),
      })
      .passthrough(),
  ),
);
