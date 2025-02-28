/**
 * Common utilities for time-based operations in analysis tools.
 */

/**
 * Calculates the appropriate time interval for a given time range
 *
 * @param timeRange - Time range string (e.g. "24h", "7d", "30d")
 * @returns An appropriate interval string (e.g. "1h", "1d")
 */
export function calculateOptimalInterval(timeRange: string): string {
  // Extract the numeric part and the time unit
  const timeValue = parseInt(timeRange.replace(/\D/g, ""), 10);
  const timeUnit = timeRange.replace(/\d/g, "");

  // Calculate optimal interval based on the time range
  switch (timeUnit) {
    case "m": // minutes
      return timeValue <= 60 ? "1m" : "5m";
    case "h": // hours
      return timeValue <= 6 ? "5m" : timeValue <= 24 ? "15m" : "1h";
    case "d": // days
      return timeValue <= 2
        ? "1h"
        : timeValue <= 7
          ? "4h"
          : timeValue <= 30
            ? "1d"
            : "7d";
    case "w": // weeks
      return timeValue <= 4 ? "1d" : "7d";
    case "M": // months
      return timeValue <= 2 ? "1d" : "7d";
    default:
      return "1h"; // Default interval
  }
}

/**
 * Parses a duration string into milliseconds
 *
 * @param duration - Duration string (e.g. "30m", "24h", "7d")
 * @returns The duration in milliseconds
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([mhdwMy])$/);
  if (!match) {
    throw new Error(
      `Invalid duration format: ${duration}. Expected format: number + unit (e.g., "30m", "24h", "7d").`,
    );
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "m":
      return value * 60 * 1000; // minutes
    case "h":
      return value * 60 * 60 * 1000; // hours
    case "d":
      return value * 24 * 60 * 60 * 1000; // days
    case "w":
      return value * 7 * 24 * 60 * 60 * 1000; // weeks
    case "M":
      return value * 30 * 24 * 60 * 60 * 1000; // months (approximation)
    case "y":
      return value * 365 * 24 * 60 * 60 * 1000; // years (approximation)
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Divides a time range into before and after periods
 *
 * @param timeRange - Time range string (e.g. "7d")
 * @returns Object with start, mid, and end points as ISO strings
 */
export function divideTimeRange(timeRange: string): {
  startPoint: string;
  midPoint: string;
  endPoint: string;
} {
  const now = new Date();
  const durationMs = parseDuration(timeRange);

  const endPoint = now.toISOString();
  const midPoint = new Date(now.getTime() - durationMs / 2).toISOString();
  const startPoint = new Date(now.getTime() - durationMs).toISOString();

  return {
    startPoint,
    midPoint,
    endPoint,
  };
}
