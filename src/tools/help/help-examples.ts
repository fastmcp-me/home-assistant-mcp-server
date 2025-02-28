import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LogzioClient } from "../../api/logzio.js";

/**
 * Registers tools that provide examples of using the log analysis tools
 */
export function registerHelpExamples(server: McpServer, client: LogzioClient) {
  // Register the examples tool
  server.tool(
    "log-examples",
    "Get practical examples of using log analysis tools",
    {
      category: z
        .string()
        .optional()
        .describe("Category of examples to show (e.g., 'search', 'analysis')"),
      tool: z
        .string()
        .optional()
        .describe("Specific tool to show examples for"),
      scenario: z
        .string()
        .optional()
        .describe(
          "Type of scenario to show examples for (e.g., 'errors', 'performance')",
        ),
    },
    async (params, extra) => {
      try {
        const category = params.category || "";
        const tool = params.tool || "";
        const scenario = params.scenario || "";

        let helpContent = "# Log Analysis Examples\n\n";

        // If a specific tool is requested
        if (tool) {
          helpContent += getToolExamples(tool);
        }
        // If a specific category is requested
        else if (category) {
          helpContent += getCategoryExamples(category);
        }
        // If a specific scenario is requested
        else if (scenario) {
          helpContent += getScenarioExamples(scenario);
        }
        // Default examples overview
        else {
          helpContent += getGeneralExamples();
        }

        return {
          content: [
            {
              type: "text",
              text: helpContent,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error providing examples: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
}

/**
 * Returns examples for a specific tool
 */
function getToolExamples(toolName: string): string {
  switch (toolName) {
    case "simple-search":
      return `## Simple Search Examples

### Basic Search
\`\`\`
simple-search({
  query: "error",
  timeRange: "24h"
})
\`\`\`

### Search with Field Filters
\`\`\`
simple-search({
  query: "level:error AND service:api",
  timeRange: "7d"
})
\`\`\`

### Search with Result Limit
\`\`\`
simple-search({
  query: "status_code:500",
  timeRange: "3d",
  maxResults: 50
})
\`\`\`
`;

    case "analyze-errors":
      return `## Error Analysis Examples

### Basic Error Analysis
\`\`\`
analyze-errors({
  timeRange: "24h"
})
\`\`\`

### Analysis with Specific Service
\`\`\`
analyze-errors({
  timeRange: "7d",
  service: "payment-api"
})
\`\`\`

### Analysis with Custom Error Field
\`\`\`
analyze-errors({
  timeRange: "3d",
  errorField: "exception_type",
  groupBy: ["service", "endpoint"]
})
\`\`\`
`;

    case "sample-logs":
      return `## Log Sampling Examples

### Basic Random Sample
\`\`\`
sample-logs({
  timeRange: "24h",
  sampleSize: 10
})
\`\`\`

### Filtered Sample
\`\`\`
sample-logs({
  timeRange: "7d",
  sampleSize: 20,
  query: "level:error"
})
\`\`\`

### Reproducible Sample
\`\`\`
sample-logs({
  timeRange: "3d",
  sampleSize: 15,
  seed: 42
})
\`\`\`
`;

    default:
      return `## Examples for ${toolName}

Sorry, specific examples for \`${toolName}\` are not available yet.

Please try getting general examples by category using:
\`\`\`
log-examples({ category: "search" })
\`\`\`

Or see all available examples with:
\`\`\`
log-examples()
\`\`\`
`;
  }
}

/**
 * Returns examples for a specific category
 */
function getCategoryExamples(category: string): string {
  switch (category.toLowerCase()) {
    case "search":
      return `## Search Tool Examples

### Simple Search
\`\`\`
simple-search({
  query: "error",
  timeRange: "24h"
})
\`\`\`

### Search Logs with Elasticsearch DSL
\`\`\`
search-logs({
  query: {
    bool: {
      must: [
        { match: { level: "error" } },
        { range: { "@timestamp": { gte: "now-7d" } } }
      ]
    }
  },
  size: 20
})
\`\`\`

### Quick Search
\`\`\`
quick-search({
  query: "timeout",
  maxResults: 5
})
\`\`\`
`;

    case "analysis":
      return `## Analysis Tool Examples

### Analyze Errors
\`\`\`
analyze-errors({
  timeRange: "24h",
  service: "api-gateway"
})
\`\`\`

### Analyze Patterns
\`\`\`
analyze-patterns({
  timeRange: "7d",
  field: "message",
  maxPatterns: 10
})
\`\`\`

### Recognize Issues
\`\`\`
recognize-issues({
  timeRange: "3d",
  service: "payment-service"
})
\`\`\`
`;

    case "sampling":
      return `## Sampling Tool Examples

### Sample Logs
\`\`\`
sample-logs({
  timeRange: "24h",
  sampleSize: 10
})
\`\`\`

### Stratified Sample
\`\`\`
stratified-sample({
  timeRange: "7d",
  dimension: "service",
  samplesPerCategory: 5
})
\`\`\`
`;

    default:
      return `## Examples for ${category} Category

Sorry, specific examples for the \`${category}\` category are not available yet.

Please try one of these categories:
- \`log-examples({ category: "search" })\`
- \`log-examples({ category: "analysis" })\`
- \`log-examples({ category: "sampling" })\`

Or see all available examples with:
\`\`\`
log-examples()
\`\`\`
`;
  }
}

/**
 * Returns examples for a specific scenario
 */
function getScenarioExamples(scenario: string): string {
  switch (scenario.toLowerCase()) {
    case "errors":
      return `## Error Analysis Scenario Examples

### Finding Error Spikes
\`\`\`
log-histogram({
  timeRange: "24h",
  query: "level:error",
  interval: "15m"
})
\`\`\`

### Identifying Top Error Types
\`\`\`
analyze-errors({
  timeRange: "7d",
  service: "api-gateway",
  groupBy: ["error_type", "endpoint"]
})
\`\`\`

### Getting Error Context
\`\`\`
sample-logs({
  timeRange: "1h",
  query: "level:error AND service:payment-service",
  sampleSize: 10
})
\`\`\`
`;

    case "performance":
      return `## Performance Analysis Scenario Examples

### Response Time Analysis
\`\`\`
analyze-patterns({
  timeRange: "24h",
  field: "response_time",
  ranges: [0, 100, 500, 1000, 5000]
})
\`\`\`

### Finding Slow Endpoints
\`\`\`
field-stats({
  field: "response_time",
  query: "service:api-gateway",
  timeRange: "7d",
  groupBy: "endpoint"
})
\`\`\`

### Performance Trend Analysis
\`\`\`
log-histogram({
  timeRange: "30d",
  query: "response_time:>1000",
  interval: "1d"
})
\`\`\`
`;

    case "security":
      return `## Security Analysis Scenario Examples

### Finding Failed Login Attempts
\`\`\`
simple-search({
  query: "event_type:login AND status:failed",
  timeRange: "7d"
})
\`\`\`

### Analyzing Suspicious IP Addresses
\`\`\`
field-stats({
  field: "source_ip",
  query: "event_type:login AND status:failed",
  timeRange: "24h",
  maxValues: 20
})
\`\`\`

### Detecting Unusual Access Patterns
\`\`\`
analyze-patterns({
  timeRange: "7d",
  field: "user_agent",
  query: "event_type:access AND status:success",
  maxPatterns: 15
})
\`\`\`
`;

    default:
      return `## Examples for ${scenario} Scenario

Sorry, specific examples for the \`${scenario}\` scenario are not available yet.

Please try one of these scenarios:
- \`log-examples({ scenario: "errors" })\`
- \`log-examples({ scenario: "performance" })\`
- \`log-examples({ scenario: "security" })\`

Or see all available examples with:
\`\`\`
log-examples()
\`\`\`
`;
  }
}

/**
 * Returns general examples when no specific category, tool, or scenario is specified
 */
function getGeneralExamples(): string {
  return `## Log Analysis Examples

This tool provides practical examples of using the log analysis tools for different purposes.

### Getting Started

To see examples for a specific tool:
\`\`\`
log-examples({ tool: "simple-search" })
\`\`\`

To see examples for a category of tools:
\`\`\`
log-examples({ category: "search" })
\`\`\`

To see examples for a specific scenario:
\`\`\`
log-examples({ scenario: "errors" })
\`\`\`

### Popular Example Categories

- **Search Examples**: \`log-examples({ category: "search" })\`
- **Analysis Examples**: \`log-examples({ category: "analysis" })\`
- **Sampling Examples**: \`log-examples({ category: "sampling" })\`

### Common Scenario Examples

- **Error Analysis**: \`log-examples({ scenario: "errors" })\`
- **Performance Analysis**: \`log-examples({ scenario: "performance" })\`
- **Security Analysis**: \`log-examples({ scenario: "security" })\`

### Popular Tool Examples

- **Simple Search**: \`log-examples({ tool: "simple-search" })\`
- **Analyze Errors**: \`log-examples({ tool: "analyze-errors" })\`
- **Sample Logs**: \`log-examples({ tool: "sample-logs" })\`
`;
}
