/**
 * Standardized error handler for MCP tool responses
 * Provides consistent error formatting across all tools with rich diagnostic information
 */
import {
  ErrorCategory,
  ErrorContext,
  StandardizedErrorResponse,
} from "../types/errors.types.js";

// Add a custom type for enhanced errors
interface DiagnosticError {
  status?: number;
  statusText?: string;
  path?: string;
  details?: unknown;
  stack?: string;
  [key: string]: unknown;
}

/**
 * Determine the error category based on the error message
 */
function categorizeError(error: Error | string): ErrorCategory {
  const message = typeof error === "string" ? error : error.message;

  if (
    message.includes("parsing_exception") ||
    message.includes("query_shard_exception")
  ) {
    return ErrorCategory.QUERY_SYNTAX;
  } else if (
    message.includes("field_not_found") ||
    (message.includes("field [") && message.includes("] not found"))
  ) {
    return ErrorCategory.FIELD_NOT_FOUND;
  } else if (message.includes("404") || message.includes("index_not_found")) {
    return ErrorCategory.INDEX_NOT_FOUND;
  } else if (message.includes("401") || message.includes("unauthorized")) {
    return ErrorCategory.AUTHENTICATION;
  } else if (message.includes("timeout") || message.includes("timed out")) {
    return ErrorCategory.TIMEOUT;
  } else if (message.includes("aggregation") || message.includes("bucket")) {
    return ErrorCategory.AGGREGATION;
  } else if (
    message.includes("connection") ||
    message.includes("ECONNRESET") ||
    message.includes("ENOTFOUND") ||
    message.includes("ETIMEDOUT")
  ) {
    return ErrorCategory.CONNECTION;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Generate suggestions based on error category
 */
function getSuggestions(
  category: ErrorCategory,
  _context?: ErrorContext,
): string[] {
  switch (category) {
    case ErrorCategory.QUERY_SYNTAX:
      return [
        "Check your query syntax for proper formatting",
        "Ensure field names and operators are correct",
        "Verify parentheses are balanced and properly nested",
        "Try simplifying your query to isolate the issue",
      ];

    case ErrorCategory.FIELD_NOT_FOUND:
      return [
        "Verify field names using the get-fields tool",
        "For text fields, try adding .keyword suffix (e.g., 'message.keyword')",
        "Check field case sensitivity (e.g., 'level' vs 'Level')",
        "Ensure fields exist in your log indices",
      ];

    case ErrorCategory.INDEX_NOT_FOUND:
      return [
        "Verify your index pattern is correct",
        "Check if data exists for the specified time range",
        "Ensure your account has access to the requested indices",
        "Try a different index pattern (e.g., 'logstash-*', 'filebeat-*')",
      ];

    case ErrorCategory.AUTHENTICATION:
      return [
        "Check your API credentials",
        "Verify your API token has the necessary permissions",
        "Ensure your API token hasn't expired",
        "Try generating a new API token from your Logz.io account",
      ];

    case ErrorCategory.TIMEOUT:
      return [
        "Try narrowing your search by using a shorter time range",
        "Add more specific filters to reduce the data being processed",
        "Use pagination parameters to request fewer results",
        "Try simplifying complex queries or aggregations",
      ];

    case ErrorCategory.AGGREGATION:
      return [
        "Try with useSimpleAggregation: true",
        "Reduce the number of aggregation buckets or terms",
        "Use a more specific field with fewer distinct values",
        "Check if the field is suitable for aggregation (numeric or keyword)",
      ];

    case ErrorCategory.CONNECTION:
      return [
        "Check your network connection",
        "Verify firewall or proxy settings",
        "Try again after a brief wait",
        "Confirm the Logz.io API is accessible from your network",
      ];

    default:
      return [
        "Check query syntax and parameters",
        "Verify field names using the get-fields tool",
        "Try a shorter time range if searching large volumes of data",
        "Ensure your account has access to the requested indices",
      ];
  }
}

/**
 * Generate related commands based on error category and context
 */
function getRelatedCommands(
  category: ErrorCategory,
  context?: ErrorContext,
): string[] {
  const commands: string[] = [];

  // Always suggest checking fields
  commands.push("get-fields() to discover available fields");

  switch (category) {
    case ErrorCategory.QUERY_SYNTAX:
      commands.push("simple-search() for easier text-based searching");
      commands.push("quick-search() for user-friendly search with formatting");
      break;

    case ErrorCategory.FIELD_NOT_FOUND:
      commands.push("sample-logs() to view example log entries with fields");
      break;

    case ErrorCategory.AGGREGATION:
      if (context?.tool === "analyze-errors") {
        commands.push(
          "analyze-errors({ useSimpleAggregation: true }) to avoid nested aggregation errors",
        );
      }
      commands.push("log-histogram() for simpler time-based analysis");
      break;

    case ErrorCategory.TIMEOUT:
      commands.push(
        "log-dashboard() for a summary view with less data processing",
      );
      commands.push(
        "sample-logs() for a representative sample with faster execution",
      );
      break;

    default:
      if (context?.tool) {
        // Add the tool that was just used as a related command for reference
        commands.push(`${context.tool}() with modified parameters`);
      }
  }

  return commands;
}

/**
 * Create a standardized error message based on the category
 */
function createErrorMessage(
  error: Error | string,
  category: ErrorCategory,
  context?: ErrorContext,
): string {
  const baseMessage = typeof error === "string" ? error : error.message;
  let enhancedMessage = `Error executing ${context?.tool || "tool"}: ${baseMessage}`;

  // Add specific troubleshooting guidance based on error type
  switch (category) {
    case ErrorCategory.QUERY_SYNTAX:
      enhancedMessage = `Invalid query syntax: ${baseMessage.replace("parsing_exception", "").replace("query_shard_exception", "")}`;
      enhancedMessage +=
        "\n\nThere appears to be a syntax error in your query. Please check the query format and try again.";
      break;

    case ErrorCategory.FIELD_NOT_FOUND: {
      const fieldMatch = baseMessage.match(/field \[(.*?)\]/);
      const fieldName = fieldMatch ? fieldMatch[1] : "specified field";
      enhancedMessage = `Field not found: "${fieldName}"`;
      enhancedMessage +=
        "\n\nThe field you're trying to query doesn't exist in your logs or may have a different name.";
      break;
    }

    case ErrorCategory.INDEX_NOT_FOUND:
      enhancedMessage = "Index not found or empty";
      enhancedMessage +=
        "\n\nThe requested index pattern is not found or contains no data for the specified time range.";
      break;

    case ErrorCategory.AUTHENTICATION:
      enhancedMessage = "Authentication failed";
      enhancedMessage +=
        "\n\nYour API credentials may be invalid or expired. Please check your API token.";
      break;

    case ErrorCategory.TIMEOUT:
      enhancedMessage = "Request timed out";
      enhancedMessage +=
        "\n\nThe search request took too long to complete. Try narrowing your search by using a shorter time range or adding more specific filters.";
      break;

    case ErrorCategory.AGGREGATION:
      if (baseMessage.includes("nested") && baseMessage.includes("bucket")) {
        enhancedMessage = "Nested aggregation too complex";
        enhancedMessage +=
          "\n\nThe aggregation is too complex for processing. Try using 'useSimpleAggregation: true' parameter to avoid this error.";
      } else {
        enhancedMessage = "Aggregation error";
        enhancedMessage +=
          "\n\nThere was a problem with the aggregation request. The field might not be suitable for aggregation or the cardinality is too high.";
      }
      break;

    case ErrorCategory.CONNECTION:
      enhancedMessage = "Connection error";
      enhancedMessage +=
        "\n\nUnable to connect to the Logz.io API. Please check your network connection and try again.";
      break;
  }

  return enhancedMessage;
}

/**
 * Generate a standardized error code
 */
function createErrorCode(
  category: ErrorCategory,
  context?: ErrorContext,
): string {
  const toolPrefix = context?.tool
    ? context.tool
        .replace(/[^a-zA-Z0-9]/g, "")
        .toUpperCase()
        .substring(0, 4)
    : "TOOL";
  const categoryCode = category.substring(0, 3);

  // Generate a pseudorandom numeric suffix based on the error message
  // This ensures similar errors get similar codes while providing uniqueness
  const errorHash = Math.abs(
    (context?.tool?.length || 0) * 17 +
      (category?.length || 0) * 31 +
      (Date.now() % 1000),
  )
    .toString()
    .padStart(4, "0");

  return `${toolPrefix}_${categoryCode}_${errorHash}`;
}

/**
 * Process an error into a standardized MCP response
 *
 * @param error The error that occurred
 * @param context Information about where the error occurred
 * @returns A standardized error response object
 */
export function handleToolError(
  error: Error | string,
  context: ErrorContext,
): StandardizedErrorResponse {
  // Determine error category
  const category = categorizeError(error);

  // Create standardized error message
  const errorMessage = createErrorMessage(error, category, context);

  // Generate suggestions
  const suggestions = getSuggestions(category, context);

  // Generate related commands
  const relatedCommands = getRelatedCommands(category, context);

  // Create error code
  const errorCode = createErrorCode(category, context);

  // Extract additional diagnostic information from error object
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    tool: context.tool,
    operation: context.operation,
  };

  // Add additional error properties if available
  if (typeof error !== "string" && error !== null) {
    // First convert to unknown, then to DiagnosticError to avoid TypeScript errors
    const diagnosticError = error as unknown as DiagnosticError;
    if (diagnosticError.status) diagnostics.status = diagnosticError.status;
    if (diagnosticError.statusText)
      diagnostics.statusText = diagnosticError.statusText;
    if (diagnosticError.path) diagnostics.path = diagnosticError.path;
    if (diagnosticError.details) diagnostics.details = diagnosticError.details;
    if (diagnosticError.stack)
      diagnostics.stack = diagnosticError.stack
        .split("\n")
        .slice(0, 3)
        .join("\n");
  }

  // Return standardized error response
  return {
    isError: true,
    error: typeof error === "string" ? error : error.message,
    errorCode,
    category,
    troubleshooting: {
      suggestions,
      related_commands: relatedCommands,
    },
    content: [
      {
        type: "text" as const, // Use const assertion to ensure literal type
        text: errorMessage,
      },
    ],
    diagnostics,
  };
}
