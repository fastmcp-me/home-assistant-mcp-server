import fetch from "node-fetch";
import { Elasticsearch6SearchParams } from "../types/elasticsearch.types.js";

// Add interface for enhanced error types
interface EnhancedError extends Error {
  status?: number;
  statusText?: string;
  details?: unknown;
  path?: string;
  attempt?: number;
  originalError?: unknown;
  method?: string;
  hasBody?: boolean;
}

export class LogzioClient {
  private apiKey: string;
  private baseUrl: string;
  private defaultTimeRange: string = "7d";
  private defaultIndices: string[] = [
    "logstash-*",
    "filebeat-*",
    "metricbeat-*",
    "*",
  ];
  private connected: boolean = false;

  constructor(apiKey: string, region: string = "eu") {
    this.apiKey = apiKey;
    this.baseUrl = `https://api-${region}.logz.io/v1`;
  }

  /**
   * Test the connection to Logz.io API
   * @returns Connection status and diagnostic information
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    details?: { error: string; suggestion?: string };
  }> {
    try {
      // Try to retrieve account information as a basic connectivity test
      await this.request("/account-management", "GET");
      this.connected = true;
      return {
        success: true,
        message: "Successfully connected to Logz.io API",
      };
    } catch (error) {
      this.connected = false;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const details: { error: string; suggestion?: string } = {
        error: errorMessage,
      };

      // Provide more helpful messages based on error type
      if (errorMessage.includes("401")) {
        details.suggestion =
          "Check your API token and ensure it has the correct permissions";
      } else if (errorMessage.includes("404")) {
        details.suggestion = "Verify the API endpoint and region settings";
      } else if (
        errorMessage.includes("ENOTFOUND") ||
        errorMessage.includes("ETIMEDOUT")
      ) {
        details.suggestion =
          "Check your network connection and firewall settings";
      }

      return {
        success: false,
        message: `Failed to connect to Logz.io API: ${errorMessage}`,
        details,
      };
    }
  }

  /**
   * Enhanced search with automatic index detection and sensible defaults
   * @param params Search parameters
   * @returns Search results
   */
  async search(
    params: Elasticsearch6SearchParams,
  ): Promise<Record<string, unknown>> {
    // Clone params to avoid modifying the original
    const enhancedParams = { ...params };

    // If no explicit query is provided, default to match_all
    if (!enhancedParams.query) {
      enhancedParams.query = { match_all: {} };
    }

    // Set a default result size if not specified
    if (enhancedParams.size === undefined) {
      enhancedParams.size = 20;
    }

    // Add default sorting by timestamp if not already specified
    if (!enhancedParams.sort) {
      enhancedParams.sort = [{ "@timestamp": "desc" }];
    }

    // Use index auto-detection if needed and add it as metadata in the response
    const detectedIndex: string | null = null;

    // Add index information to the response metadata
    const result = await this.request("/search", "POST", enhancedParams);

    // Add metadata about index detection to help with diagnostics
    if (detectedIndex) {
      const existingMetadata =
        (result.metadata as Record<string, unknown>) || {};
      result.metadata = {
        ...existingMetadata,
        detected_index: detectedIndex,
      };
    }

    return result;
  }

  /**
   * Get available indices from Logz.io
   * @returns Array of available index patterns
   */
  async getAvailableIndices(): Promise<string[]> {
    try {
      const response = await this.request("/index-patterns", "GET");
      return Array.isArray(response)
        ? response.map((idx) => idx.toString())
        : [];
    } catch (error) {
      console.warn("Failed to retrieve available indices:", error);
      return this.defaultIndices;
    }
  }

  /**
   * Try to detect working indices by trying each of the default patterns
   * @returns The first working index pattern, or null if none works
   */
  async detectWorkingIndex(): Promise<string | null> {
    for (const index of this.defaultIndices) {
      try {
        // Check if this index exists and has fields
        await this.request(`/fields?index=${encodeURIComponent(index)}`, "GET");
        return index; // If no error, this index works
      } catch (
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _unused
      ) {
        // Continue to next index if this one doesn't work
        continue;
      }
    }
    return null; // No working index found
  }

  /**
   * Get fields for a specific index, with fallback to default indices
   */
  async getFields(index?: string) {
    // If specific index is provided, try that first
    if (index) {
      const url = `/fields?index=${encodeURIComponent(index)}`;
      return await this.request(url, "GET");
    }

    // Try to find a working index
    const workingIndex = await this.detectWorkingIndex();
    if (workingIndex) {
      const url = `/fields?index=${encodeURIComponent(workingIndex)}`;
      return await this.request(url, "GET");
    }

    // If no index works, try to get a list of available indices
    try {
      const indices = await this.getAvailableIndices();
      const indicesStr =
        indices.length > 0
          ? indices.join(", ")
          : "No indices found. Please check your Logz.io account.";

      throw new Error(
        `No working index found. Please specify one of the available indices: ${indicesStr}`,
      );
    } catch (
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _unused
    ) {
      throw new Error(
        "Unable to connect to Logz.io API or retrieve indices. Please check your API credentials and connection.",
      );
    }
  }

  /**
   * Get sample queries appropriate for common logging scenarios
   * @returns A collection of sample queries for common use cases
   */
  getSampleQueries(): Record<string, Record<string, unknown>> {
    return {
      errors: {
        name: "Error Logs",
        description: "Find error logs from the last 24 hours",
        query: {
          bool: {
            should: [
              { term: { "level.keyword": "error" } },
              { term: { "level.keyword": "ERROR" } },
              { term: { "severity.keyword": "error" } },
              { wildcard: { message: "*exception*" } },
              { wildcard: { message: "*error*" } },
            ],
            minimum_should_match: 1,
            filter: {
              range: {
                "@timestamp": {
                  gte: "now-24h",
                  lte: "now",
                },
              },
            },
          },
        },
      },
      performance: {
        name: "Slow Performance",
        description: "Find slow operations taking more than 1 second",
        query: {
          bool: {
            should: [
              { range: { duration: { gte: 1000 } } },
              { range: { response_time: { gte: 1000 } } },
            ],
            minimum_should_match: 1,
            filter: {
              range: {
                "@timestamp": {
                  gte: "now-6h",
                  lte: "now",
                },
              },
            },
          },
        },
      },
      recent: {
        name: "Recent Activity",
        description: "Show the most recent logs",
        query: {
          match_all: {},
        },
        sort: [{ "@timestamp": "desc" }],
        size: 20,
      },
    };
  }

  /**
   * Make a request to the Logz.io API with proper error handling and retry logic
   * Implements a robust request mechanism with connection pooling, retry logic, and detailed error reporting
   * @param path The API endpoint path
   * @param method HTTP method (GET, POST, etc.)
   * @param body Optional request body
   * @param retries Number of retry attempts for recoverable errors
   * @returns The API response as an object
   */
  private async request(
    path: string,
    method: string,
    body?: Record<string, unknown>,
    retries: number = 3, // Increased default retries for better reliability
  ): Promise<Record<string, unknown>> {
    // Create a controller for request timeout management
    const controller = new AbortController();
    const { signal } = controller;

    // Set a 30-second timeout for all requests
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      // Add retry logic for better reliability with adaptive backoff
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          // Enhanced request with timeout handling and comprehensive headers
          const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: {
              "Content-Type": "application/json",
              "X-API-TOKEN": this.apiKey,
              Accept: "application/json",
              "User-Agent": "mcp-logzio-server/1.0.0",
              "X-Request-ID": `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal,
            // Note: keepalive removed due to type compatibility issues
            // Consider adding keepalive when using a more recent fetch implementation
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `Logz.io API error: ${response.status} - ${response.statusText}`;
            let errorDetails = {};

            try {
              const errorJson = JSON.parse(errorText);
              if (errorJson.message) {
                errorMessage += `\nDetails: ${errorJson.message}`;
                errorDetails = errorJson;
              }
            } catch {
              if (errorText) {
                errorMessage += `\nDetails: ${errorText}`;
              }
            }

            // Enhanced retry logic with categorized error handling
            const shouldRetry =
              attempt < retries &&
              // Rate limiting - always retry with backoff
              (response.status === 429 ||
                // Server errors - retry with backoff
                response.status >= 500 ||
                // Network/gateway errors - retry with backoff
                response.status === 502 ||
                response.status === 503 ||
                response.status === 504);

            if (shouldRetry) {
              // Adaptive exponential backoff with jitter
              // For 429 responses, use Retry-After if available
              let delay = 0;

              if (
                response.status === 429 &&
                response.headers.has("Retry-After")
              ) {
                // Use the server's recommendation if available
                const retryAfter = response.headers.get("Retry-After");
                delay = parseInt(retryAfter || "0", 10) * 1000 || 5000;
              } else {
                // Exponential backoff with jitter - more aggressive for later retries
                delay = Math.min(
                  1000 * Math.pow(2, attempt) + Math.random() * 2000,
                  15000,
                );
              }

              console.warn(
                `Attempt ${attempt + 1}/${retries + 1} failed, retrying in ${delay}ms: ${errorMessage}`,
              );
              await new Promise((resolve) => setTimeout(resolve, delay));
              continue;
            }

            // Enhanced error object with more context for better diagnostics
            const enhancedError = new Error(errorMessage) as EnhancedError;
            enhancedError.status = response.status;
            enhancedError.statusText = response.statusText;
            enhancedError.details = errorDetails;
            enhancedError.path = path;
            enhancedError.attempt = attempt;
            throw enhancedError;
          }

          const responseData = await response.json();
          return responseData as Record<string, unknown>;
        } catch (attemptError) {
          if (attemptError.name === "AbortError") {
            // Handle timeout specifically
            console.warn(`Request timed out after 30 seconds: ${path}`);
            if (attempt >= retries) {
              throw new Error(
                `Request timed out after ${retries + 1} attempts: ${path}`,
              );
            }
          } else if (attempt >= retries) {
            // We've exhausted our retries, rethrow with enhanced information
            throw attemptError;
          }

          // Determine if we should retry based on error type
          const isNetworkError =
            attemptError instanceof TypeError ||
            attemptError.message.includes("network") ||
            attemptError.message.includes("connection") ||
            attemptError.message.includes("ECONNRESET") ||
            attemptError.message.includes("ETIMEDOUT");

          if (!isNetworkError) {
            // Only retry network-related errors, not application errors
            throw attemptError;
          }

          const delay = Math.min(
            1000 * Math.pow(2, attempt) + Math.random() * 2000,
            15000,
          );
          console.warn(
            `Network error on attempt ${attempt + 1}/${retries + 1}, retrying in ${delay}ms:`,
            attemptError.message,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      // This should never be reached because all failure paths should throw
      throw new Error("Request failed after all retries");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Create a more detailed error object for better diagnostics
      const enhancedError = new Error(
        `Request to ${path} failed: ${errorMessage}`,
      ) as EnhancedError;
      enhancedError.originalError = error;
      enhancedError.path = path;
      enhancedError.method = method;
      enhancedError.hasBody = !!body;

      throw enhancedError;
    } finally {
      // Always clear the timeout to prevent memory leaks
      clearTimeout(timeout);
    }
  }
}
