/**
 * Common utilities for building Elasticsearch queries in analysis tools.
 */
import { divideTimeRange } from "./time-utils.js";

/**
 * Builds a time range filter for an Elasticsearch query
 *
 * @param timeRange - Time range string (e.g. "24h", "7d")
 * @param field - The timestamp field name (default: "@timestamp")
 * @returns Elasticsearch range filter object
 */
export function buildTimeRangeFilter(
  timeRange: string,
  field: string = "@timestamp",
): Record<string, unknown> {
  return {
    range: {
      [field]: {
        gte: `now-${timeRange}`,
        lte: "now",
      },
    },
  };
}

/**
 * Builds a before/after time range comparison query
 *
 * @param timeRange - Time range string (e.g. "7d")
 * @param field - The timestamp field name (default: "@timestamp")
 * @returns Object with before and after period filters
 */
export function buildComparisonRangeFilters(
  timeRange: string,
  field: string = "@timestamp",
): {
  beforeFilter: Record<string, unknown>;
  afterFilter: Record<string, unknown>;
} {
  const { startPoint, midPoint, endPoint } = divideTimeRange(timeRange);

  return {
    beforeFilter: {
      range: {
        [field]: {
          gte: startPoint,
          lt: midPoint,
        },
      },
    },
    afterFilter: {
      range: {
        [field]: {
          gte: midPoint,
          lte: endPoint,
        },
      },
    },
  };
}

/**
 * Builds a base query with optional text query
 *
 * @param timeRange - Time range string (e.g. "24h", "7d")
 * @param query - Optional text query
 * @param field - The timestamp field name (default: "@timestamp")
 * @returns Elasticsearch query object
 */
export function buildBaseQuery(
  timeRange: string,
  query?: string,
  field: string = "@timestamp",
): Record<string, unknown> {
  const baseQuery: Record<string, unknown> = {
    bool: {
      filter: buildTimeRangeFilter(timeRange, field),
    },
  };

  // Add text query if provided
  if (query) {
    const boolQuery = baseQuery.bool as Record<string, unknown>;
    boolQuery.must = {
      query_string: {
        query: query,
        allow_leading_wildcard: false,
      },
    };
  }

  return baseQuery;
}

/**
 * Builds a multi-value term query that tries multiple case variations
 *
 * @param field - Field name to search
 * @param value - Value or values to search for
 * @returns Elasticsearch bool query with multiple term options
 */
export function buildMultiCaseTermsQuery(
  field: string,
  value: string | string[],
): Record<string, unknown> {
  const values = Array.isArray(value) ? value : [value];

  return {
    bool: {
      should: values.flatMap((val) => [
        // Try exact match
        { term: { [field]: val } },
        // Try lowercase
        { term: { [field]: val.toLowerCase() } },
        // Try uppercase
        { term: { [field]: val.toUpperCase() } },

        // If field doesn't have .keyword suffix, try with it
        ...(field.endsWith(".keyword")
          ? []
          : [
              { term: { [`${field}.keyword`]: val } },
              { term: { [`${field}.keyword`]: val.toLowerCase() } },
              { term: { [`${field}.keyword`]: val.toUpperCase() } },
            ]),
      ]),
      minimum_should_match: 1,
    },
  };
}
