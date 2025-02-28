import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../api/logzio.js";
import { registerAllResources } from "./resources/index.js";

export function registerResources(server: McpServer, client: LogzioClient) {
  // Register all resources from modular implementation
  registerAllResources(server, client);
  // Add resource for common query examples
  server.resource("query-examples", "examples://queries", async (uri) => {
    const examples = [
      {
        title: "Simple text search",
        description: "Find logs containing a specific text",
        query: {
          query_string: {
            query: "error",
            allow_leading_wildcard: false,
          },
        },
      },
      {
        title: "Field-specific search",
        description: "Search for a specific term in a field",
        query: {
          term: {
            level: "error",
          },
        },
      },
      {
        title: "Time-based search",
        description: "Find logs within a specific time range",
        query: {
          range: {
            "@timestamp": {
              gte: "now-24h",
              lte: "now",
            },
          },
        },
      },
      {
        title: "Combined search",
        description: "Search with multiple conditions",
        query: {
          bool: {
            must: [
              { term: { level: "error" } },
              { query_string: { query: "timeout" } },
            ],
            filter: [
              { range: { "@timestamp": { gte: "now-7d", lte: "now" } } },
            ],
          },
        },
      },
      {
        title: "Aggregation example",
        description: "Count logs by level",
        aggs: {
          log_levels: {
            terms: {
              field: "level",
              size: 10,
            },
          },
        },
      },
      {
        title: "Date histogram with filters",
        description: "Error trend over time",
        query: {
          bool: {
            must: [{ term: { level: "error" } }],
          },
        },
        aggs: {
          error_over_time: {
            date_histogram: {
              field: "@timestamp",
              fixed_interval: "1h",
            },
          },
        },
        usage: "Use to track patterns over time",
      },
      {
        title: "Nested aggregations",
        description: "Error distribution by service and time",
        aggs: {
          services: {
            terms: {
              field: "service.keyword",
              size: 5,
            },
            aggs: {
              errors_over_time: {
                date_histogram: {
                  field: "@timestamp",
                  fixed_interval: "1h",
                },
              },
            },
          },
        },
        usage: "Use to break down metrics by multiple dimensions",
      },
      {
        title: "Wildcard search",
        description: "Search using wildcards",
        query: {
          wildcard: {
            message: "*timeout*",
          },
        },
        usage: "Use when you need partial text matching",
      },
      {
        title: "Exists query",
        description: "Find documents where a field exists",
        query: {
          exists: {
            field: "error_code",
          },
        },
        usage: "Use to filter for presence of specific fields",
      },
      {
        title: "Full-text search with fuzzy matching",
        description: "Search text with typo tolerance",
        query: {
          match: {
            message: {
              query: "authentication",
              fuzziness: "AUTO",
            },
          },
        },
        usage:
          "Use when searching for terms that might have slight variations or typos",
      },
    ];

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(examples, null, 2),
        },
      ],
    };
  });

  // Register a resource to list all available templates
  server.resource(
    "templates-list",
    "resources://templates/list",
    async (uri) => {
      // Collect all registered templates from different categories
      const resourceTemplates = [
        // URI templates
        {
          id: "timeframe-logs",
          type: "uri",
          description: "Logs within a specific time range",
        },
        {
          id: "filtered-logs",
          type: "uri",
          description: "Filtered logs by query",
        },
        {
          id: "service-logs",
          type: "uri",
          description: "Logs for a specific service",
        },
        {
          id: "error-logs",
          type: "uri",
          description: "Error logs by severity",
        },

        // Dynamic prompts
        {
          id: "analyze-log-pattern",
          type: "prompt",
          description: "Analyze logs to identify patterns and anomalies",
        },
        {
          id: "investigate-error",
          type: "prompt",
          description: "Deep dive investigation into specific error patterns",
        },
        {
          id: "service-health",
          type: "prompt",
          description: "Analyze health and performance of a specific service",
        },

        // Workflow prompts
        {
          id: "incident-workflow",
          type: "workflow",
          description:
            "Multi-step workflow for investigating a service incident",
        },
        {
          id: "debug-workflow",
          type: "workflow",
          description: "Step-by-step workflow for debugging application errors",
        },
        {
          id: "security-incident-workflow",
          type: "workflow",
          description:
            "Multi-step workflow for analyzing and responding to security incidents",
        },
      ];

      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({ resourceTemplates }, null, 2),
            mimeType: "application/json",
          },
        ],
      };
    },
  );
}
