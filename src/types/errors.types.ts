/**
 * Error categories to classify different types of errors
 */
export enum ErrorCategory {
  QUERY_SYNTAX = "QUERY_SYNTAX",
  FIELD_NOT_FOUND = "FIELD_NOT_FOUND",
  INDEX_NOT_FOUND = "INDEX_NOT_FOUND",
  AUTHENTICATION = "AUTHENTICATION",
  TIMEOUT = "TIMEOUT",
  AGGREGATION = "AGGREGATION",
  CONNECTION = "CONNECTION",
  UNKNOWN = "UNKNOWN",
}

/**
 * Error context containing information about where the error occurred
 */
export interface ErrorContext {
  tool: string;
  operation?: string;
  params?: Record<string, unknown> | unknown;
}

/**
 * Standard API error response structure
 * Follows MCP protocol requirements for error responses
 */
export interface StandardizedErrorResponse {
  isError: true;
  error: string;
  errorCode: string;
  category: ErrorCategory;
  troubleshooting: {
    suggestions: string[];
    related_commands?: string[];
    available_time_ranges?: string[]; // Optional time ranges for time-based tools
  };
  content: {
    type: "text"; // Use literal "text" type to match MCP SDK
    text: string;
  }[];
  diagnostics?: Record<string, unknown>;
}
