// Type definitions extracted from aggregation schema
export type MetricAggregation = {
  field?: string;
  script?: string | { source?: string };
  missing?: unknown;
  [key: string]: unknown; // For passthrough
};

export type BucketsAggregation = {
  field?: string;
  size?: number;
  missing?: unknown;
  order?:
    | {
        _count?: "asc" | "desc";
        _key?: "asc" | "desc";
      }
    | Array<Record<string, "asc" | "desc">>;
  [key: string]: unknown; // For passthrough
};

export type DateHistogramAggregation = {
  field?: string;
  calendar_interval?: string;
  fixed_interval?: string;
  interval?: string;
  format?: string;
  time_zone?: string;
  min_doc_count?: number;
  extended_bounds?: {
    min?: string | number;
    max?: string | number;
  };
};

export type HistogramAggregation = {
  field?: string;
  interval?: number;
  min_doc_count?: number;
  extended_bounds?: {
    min?: number;
    max?: number;
  };
};

export type AggregationSchema = Record<
  string,
  {
    terms?: BucketsAggregation;
    date_histogram?: DateHistogramAggregation;
    histogram?: HistogramAggregation;
    avg?: MetricAggregation;
    sum?: MetricAggregation;
    min?: MetricAggregation;
    max?: MetricAggregation;
    cardinality?: MetricAggregation;
    percentiles?: MetricAggregation;
    stats?: MetricAggregation;
    aggs?: AggregationSchema;
    aggregations?: AggregationSchema;
    [key: string]: unknown; // For passthrough
  }
>;
