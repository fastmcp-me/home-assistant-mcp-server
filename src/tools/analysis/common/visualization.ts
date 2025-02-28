/**
 * Common visualization utilities for analysis tools.
 */

/**
 * Creates a simple ASCII chart for time-based data.
 *
 * @param timeBuckets - Array of time buckets, each with a timestamp and count
 * @param options - Optional configuration for the chart
 * @returns Formatted ASCII chart as a string
 */
export function createAsciiTimeChart(
  timeBuckets: Array<{
    key_as_string?: string;
    key?: number | string;
    doc_count: number;
  }>,
  options: {
    timeFormat?: "full" | "date" | "time";
    maxBars?: number;
    title?: string;
  } = {},
): string {
  if (timeBuckets.length === 0) {
    return "No data available for visualization.\n";
  }

  const { timeFormat = "full", maxBars = 50, title = "Time Chart" } = options;

  // Find max count for visual scaling
  const maxCount = Math.max(...timeBuckets.map((b) => b.doc_count));
  const scaleFactor = maxCount > maxBars ? Math.ceil(maxCount / maxBars) : 1;

  let output = `## ${title}\n\n`;

  // Select a subset of buckets if there are too many
  const displayBuckets =
    timeBuckets.length > 15
      ? timeBuckets.filter(
          (_, i) => i % Math.ceil(timeBuckets.length / 15) === 0,
        )
      : timeBuckets;

  // Format each time bucket
  displayBuckets.forEach((bucket) => {
    const count = bucket.doc_count;
    const barLength = Math.ceil(count / scaleFactor) || 0;
    const bar = "█".repeat(barLength || 1);

    // Format the timestamp according to the specified format
    let timeLabel = bucket.key_as_string || String(bucket.key);
    if (timeFormat === "date" && timeLabel.includes(" ")) {
      timeLabel = timeLabel.split(" ")[0];
    } else if (timeFormat === "time" && timeLabel.includes(" ")) {
      timeLabel = timeLabel.split(" ")[1];
    }

    output += `${timeLabel} |${bar} ${count}\n`;
  });

  // Add a legend if the data is scaled
  if (scaleFactor > 1) {
    output += `\n(Each █ represents ~${scaleFactor} items)\n`;
  }

  return output;
}

/**
 * Creates a table with trend indicators.
 *
 * @param trends - Array of trend objects
 * @param options - Optional configuration for the table
 * @returns Formatted markdown table as a string
 */
export function createTrendTable(
  trends: Array<{
    value: string | number;
    beforeCount: number;
    afterCount: number;
    percentageChange: number;
    trend?: "increasing" | "decreasing" | "stable";
  }>,
  options: {
    showPercentage?: boolean;
    trendVisualization?: "text" | "ascii" | "none";
    title?: string;
  } = {},
): string {
  if (trends.length === 0) {
    return "No trend data available.\n";
  }

  const {
    showPercentage = true,
    trendVisualization = "ascii",
    title = "Trend Analysis",
  } = options;

  let output = `## ${title}\n\n`;

  // Create table header
  output += `| Value | Before | After | Change | Trend |\n`;
  output += `|-------|--------|-------|--------|-------|\n`;

  // Add each trend row
  trends.forEach((trend) => {
    const changeText = showPercentage
      ? `${
          trend.beforeCount === 0 && trend.afterCount > 0
            ? "New"
            : `${trend.afterCount - trend.beforeCount > 0 ? "+" : ""}${trend.afterCount - trend.beforeCount}`
        } (${trend.percentageChange > 0 ? "+" : ""}${trend.percentageChange.toFixed(1)}%)`
      : `${trend.afterCount - trend.beforeCount > 0 ? "+" : ""}${trend.afterCount - trend.beforeCount}`;

    // Create trend indicator based on visualization type
    let trendIndicator = "";

    if (trendVisualization === "text") {
      trendIndicator =
        trend.trend === "increasing"
          ? "↑"
          : trend.trend === "decreasing"
            ? "↓"
            : "→";
    } else if (trendVisualization === "ascii") {
      const magnitude = Math.min(
        Math.abs(Math.round(trend.percentageChange / 20)),
        10,
      );
      trendIndicator =
        trend.trend === "increasing"
          ? "▁▂▃▄▅▆▇█".substring(8 - magnitude)
          : trend.trend === "decreasing"
            ? "█▇▆▅▄▃▂▁".substring(0, magnitude)
            : "▬";
    }

    output += `| ${trend.value} | ${trend.beforeCount} | ${trend.afterCount} | ${changeText} | ${trendIndicator} |\n`;
  });

  return output;
}
