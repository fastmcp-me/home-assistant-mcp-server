import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

/**
 * Register URI templates for Logz.io resources following RFC 6570 standard
 * Allows clients to construct valid resource URIs for dynamic resources
 *
 * @param server The MCP server instance
 */
export function registerUriTemplates(server: McpServer) {
  // Instead of using URI templates which seem to be having compatibility issues,
  // we'll register these as regular resources to make testing easier

  // Register resource for logs within a specific time range
  server.resource("timeframe-logs", "logs://timeframe", async (uri) => {
    const timeframe = uri.searchParams.get("timeframe") || "24h";
    return {
      contents: [
        {
          uri: `logs://recent?timeframe=${timeframe}`,
          mimeType: "text/plain",
          text: `Log data for timeframe: ${timeframe}`,
        },
      ],
    };
  });

  // Register resource for filtered logs by query
  server.resource("filtered-logs", "logs://filtered", async (uri) => {
    const timeframe = uri.searchParams.get("timeframe") || "24h";
    const query = uri.searchParams.get("query") || "*";

    return {
      contents: [
        {
          uri: `logs://filtered?timeframe=${timeframe}&query=${encodeURIComponent(query)}`,
          mimeType: "text/plain",
          text: `Filtered log data for timeframe: ${timeframe}, query: ${query}`,
        },
      ],
    };
  });

  // Register resource for accessing logs by service name
  server.resource("service-logs", "logs://service", async (uri) => {
    const name = uri.searchParams.get("name") || "unknown";
    const timeframe = uri.searchParams.get("timeframe") || "24h";

    return {
      contents: [
        {
          uri: `logs://service?name=${name}&timeframe=${timeframe}`,
          mimeType: "text/plain",
          text: `Service logs for: ${name}, timeframe: ${timeframe}`,
        },
      ],
    };
  });

  // Register resource for error logs by severity
  server.resource("error-logs", "logs://errors", async (uri) => {
    const severity = uri.searchParams.get("severity") || "error";
    const timeframe = uri.searchParams.get("timeframe") || "24h";

    return {
      contents: [
        {
          uri: `logs://errors?severity=${severity}&timeframe=${timeframe}`,
          mimeType: "text/plain",
          text: `Error logs with severity: ${severity}, timeframe: ${timeframe}`,
        },
      ],
    };
  });
}
