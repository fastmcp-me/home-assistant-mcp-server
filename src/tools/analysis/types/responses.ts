/**
 * Common response interfaces for analysis tools.
 */
import { EsResponse } from "../../../types/elasticsearch.js";

// Define interface for MCP Tool Response
export interface McpToolResponse {
  content: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
    resource?: {
      text?: string;
      mimeType?: string;
      uri?: string;
    };
    [key: string]: unknown;
  }>;
  [Symbol.iterator]?: unknown;
  [key: string]: unknown;
}

// Interface for trend analysis
export interface Trend {
  value: string;
  beforeCount: number;
  afterCount: number;
  absoluteChange: number;
  percentageChange: number;
  trend: "increasing" | "decreasing" | "stable";
}

// Interface for error responses
export interface ErrorResponse extends McpToolResponse {
  isError: true;
  error: string;
  errorCode?: string;
  category?: string;
  troubleshooting?: {
    suggestions: string[];
    related_commands?: string[];
  };
  diagnostics?: Record<string, unknown>;
  [key: string]: unknown;
}

// Interface for successful responses with data
export interface SuccessResponse extends McpToolResponse {
  data: EsResponse;
  summary: Record<string, unknown>;
  related_tools?: Record<string, unknown>;
}
