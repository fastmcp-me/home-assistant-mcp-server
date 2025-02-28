export function buildTimeRange(
  timeRange: string,
  field: string = "@timestamp",
) {
  const now = new Date();
  const timeValue = parseInt(timeRange.replace(/\D/g, ""));
  const timeUnit = timeRange.replace(/\d/g, "");

  let gtDate;
  switch (timeUnit) {
    case "d":
      gtDate = new Date(now.getTime() - timeValue * 24 * 60 * 60 * 1000);
      break;
    case "h":
      gtDate = new Date(now.getTime() - timeValue * 60 * 60 * 1000);
      break;
    case "m":
      gtDate = new Date(now.getTime() - timeValue * 60 * 1000);
      break;
    default:
      gtDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24h
  }

  return {
    range: {
      [field]: {
        gte: gtDate.toISOString(),
        lte: now.toISOString(),
      },
    },
  };
}

export function calculateInterval(timeRange: string): string {
  const value = parseInt(timeRange.replace(/\D/g, ""));
  const unit = timeRange.replace(/\d/g, "");

  switch (unit) {
    case "m":
      return value <= 60 ? "30s" : "1m";
    case "h":
      return value <= 3 ? "1m" : value <= 24 ? "5m" : "30m";
    case "d":
      return value <= 2 ? "1h" : value <= 7 ? "3h" : "12h";
    default:
      return "1h";
  }
}
