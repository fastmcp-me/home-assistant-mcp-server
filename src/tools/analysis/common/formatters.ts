/**
 * Common formatting utilities for rendering analysis results
 */

/**
 * Formats a number with locale-specific formatting
 *
 * @param value - The number to format
 * @returns Formatted string with thousands separators
 */
export function formatNumber(value: number): string {
  return value.toLocaleString();
}

/**
 * Creates a markdown table from an array of objects
 *
 * @param data - Array of objects to display in table
 * @param columns - Array of column configurations
 * @returns Formatted markdown table string
 */
export function createMarkdownTable<T extends Record<string, unknown>>(
  data: T[],
  columns: Array<{
    key: keyof T;
    header: string;
    formatter?: (value: unknown) => string;
  }>,
): string {
  if (data.length === 0 || columns.length === 0) {
    return "No data to display.";
  }

  // Create header row
  let table = "| " + columns.map((col) => col.header).join(" | ") + " |\n";

  // Create separator row
  table += "| " + columns.map(() => "---").join(" | ") + " |\n";

  // Create data rows
  data.forEach((row) => {
    const cells = columns.map((col) => {
      const value = row[col.key];
      return col.formatter ? col.formatter(value) : String(value || "");
    });
    table += "| " + cells.join(" | ") + " |\n";
  });

  return table;
}

/**
 * Creates a bulleted list from an array of items
 *
 * @param items - Array of items to display in list
 * @param formatter - Optional formatter function for each item
 * @returns Formatted markdown list string
 */
export function createBulletedList<T>(
  items: T[],
  formatter?: (item: T) => string,
): string {
  if (items.length === 0) {
    return "No items to display.";
  }

  return items
    .map((item) => `- ${formatter ? formatter(item) : String(item)}`)
    .join("\n");
}

/**
 * Format a date string or timestamp for display
 *
 * @param dateValue - Date string, timestamp, or Date object
 * @param format - Format style: 'full', 'date', or 'time'
 * @returns Formatted date string
 */
export function formatDate(
  dateValue: string | number | Date,
  format: "full" | "date" | "time" = "full",
): string {
  try {
    const date =
      typeof dateValue === "object" ? dateValue : new Date(dateValue);

    switch (format) {
      case "date":
        return date.toISOString().split("T")[0];
      case "time":
        return date.toISOString().split("T")[1].substring(0, 8);
      case "full":
      default:
        return date.toISOString().replace("T", " ").substring(0, 19);
    }
  } catch (e) {
    return String(dateValue);
  }
}

/**
 * Format a percentage value
 *
 * @param value - Value to format as percentage
 * @param decimalPlaces - Number of decimal places to include
 * @param includeSign - Whether to include a + sign for positive values
 * @returns Formatted percentage string
 */
export function formatPercentage(
  value: number,
  decimalPlaces: number = 1,
  includeSign: boolean = false,
): string {
  const formattedValue = value.toFixed(decimalPlaces);
  return (includeSign && value > 0 ? "+" : "") + formattedValue + "%";
}
