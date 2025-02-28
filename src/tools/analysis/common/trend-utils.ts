/**
 * Common utilities for trend analysis across different tools.
 */
import { EsAggregationBucket } from "../../../types/elasticsearch.js";
import { Trend } from "../types/responses.js";

/**
 * Calculates trends between two time periods.
 *
 * @param beforeBuckets - Aggregation buckets from the "before" period
 * @param afterBuckets - Aggregation buckets from the "after" period
 * @param minSignificance - Minimum percentage change to consider significant
 * @returns Array of trends sorted by absolute percentage change
 */
export function calculateTrends(
  beforeBuckets: EsAggregationBucket[],
  afterBuckets: EsAggregationBucket[],
  minSignificance: number,
): Trend[] {
  const trends: Trend[] = [];

  // Create maps for before and after counts
  const beforeCounts = new Map<string, number>();
  const afterCounts = new Map<string, number>();

  // Total documents in each period for calculating percentages
  const beforeTotal = beforeBuckets.reduce(
    (sum, bucket) => sum + bucket.doc_count,
    0,
  );
  const afterTotal = afterBuckets.reduce(
    (sum, bucket) => sum + bucket.doc_count,
    0,
  );

  // Fill maps with counts
  beforeBuckets.forEach((bucket) => {
    beforeCounts.set(bucket.key as string, bucket.doc_count);
  });

  afterBuckets.forEach((bucket) => {
    afterCounts.set(bucket.key as string, bucket.doc_count);
  });

  // Get all unique values
  const allValues = new Set<string>();
  beforeBuckets.forEach((bucket) => allValues.add(bucket.key as string));
  afterBuckets.forEach((bucket) => allValues.add(bucket.key as string));

  // Calculate trends for each value
  allValues.forEach((value) => {
    const beforeCount = beforeCounts.get(value) || 0;
    const afterCount = afterCounts.get(value) || 0;

    // Skip if both counts are 0 or very small
    if (beforeCount <= 2 && afterCount <= 2) {
      return;
    }

    const absoluteChange = afterCount - beforeCount;

    // Calculate normalized percentage change to account for different period sizes
    // Use the average count as the base to avoid division by zero
    const normalizedBeforeCount =
      beforeTotal === 0 ? 0 : beforeCount / beforeTotal;
    const normalizedAfterCount = afterTotal === 0 ? 0 : afterCount / afterTotal;

    let percentageChange = 0;
    if (normalizedBeforeCount > 0) {
      percentageChange =
        ((normalizedAfterCount - normalizedBeforeCount) /
          normalizedBeforeCount) *
        100;
    } else if (normalizedAfterCount > 0) {
      percentageChange = 100; // New appearance (infinite increase)
    }

    // Determine trend direction
    let trend: "increasing" | "decreasing" | "stable" = "stable";
    if (percentageChange >= minSignificance) {
      trend = "increasing";
    } else if (percentageChange <= -minSignificance) {
      trend = "decreasing";
    }

    // Only include significant trends
    if (trend !== "stable" || beforeCount >= 10 || afterCount >= 10) {
      trends.push({
        value,
        beforeCount,
        afterCount,
        absoluteChange,
        percentageChange,
        trend,
      });
    }
  });

  // Sort trends by absolute percentage change (descending)
  return trends.sort(
    (a, b) => Math.abs(b.percentageChange) - Math.abs(a.percentageChange),
  );
}
