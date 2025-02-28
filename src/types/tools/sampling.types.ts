/**
 * Parameters for the sample-logs tool
 */
export interface SampleLogsParams {
  /** Optional query string to filter logs */
  query?: string;

  /** Time range to sample from (e.g., '1h', '7d') */
  timeRange?: string;

  /** Number of log entries to sample */
  sampleSize?: number;

  /** Optional seed value for reproducible random sampling */
  seedValue?: number;

  /** Optional specific fields to include in results */
  fields?: string[];

  /** Optional field to ensure distinct values (e.g., 'host.keyword') */
  distinctField?: string;

  /** Response format: text for human-readable, json for data */
  format?: "text" | "json";
}

/**
 * Sample logs result metadata
 */
export interface SampleLogsMetadata {
  /** Number of logs in the sample */
  size: number;

  /** Total number of logs matching the criteria */
  total_logs: number;

  /** Time range used for sampling */
  time_range: string;

  /** Query used for filtering */
  query: string;

  /** Seed value used for random sampling */
  seed: number;

  /** Field used for distinct sampling, if any */
  distinct_field?: string;
}

/**
 * Parameters for the stratified-sample tool
 */
export interface StratifiedSampleParams {
  /** Field to stratify by (e.g., 'service.keyword', 'level.keyword') */
  dimension: string;

  /** Total number of log entries to sample */
  sampleSize?: number;

  /** Optional maximum samples per category */
  maxPerCategory?: number;

  /** Optional minimum samples per category */
  minPerCategory?: number;

  /** Time range to sample from (e.g., '1h', '7d') */
  timeRange?: string;

  /** Optional query string to filter logs */
  query?: string;

  /** Optional secondary dimension field for nested stratification */
  secondaryDimension?: string;

  /** Optional specific fields to include in results */
  fields?: string[];

  /** Response format: text for human-readable, json for data */
  format?: "text" | "json";
}

/**
 * Stratified sample result metadata
 */
export interface StratifiedSampleMetadata {
  /** Number of logs in the sample */
  size: number;

  /** Total number of logs matching the criteria */
  total_logs: number;

  /** Time range used for sampling */
  time_range: string;

  /** Query used for filtering */
  query: string;

  /** Primary dimension used for stratification */
  dimension: string;

  /** Secondary dimension used for stratification, if any */
  secondary_dimension?: string;

  /** Distribution of samples across categories */
  distribution: {
    /** Category name */
    name: string;

    /** Number of logs in this category */
    count: number;

    /** Percentage of total logs in the sample */
    percentage: number;

    /** Secondary categories if nested stratification was used */
    subcategories?: Array<{
      name: string;
      count: number;
      percentage: number;
    }>;
  }[];
}
