import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { z } from "zod";

/**
 * Category metadata for organizing tools
 */
interface ToolCategory {
  name: string;
  description: string;
  tools: string[];
}

/**
 * Tool metadata for help documentation
 */
interface ToolInfo {
  name: string;
  description: string;
  category: string;
  parameters: ParameterInfo[];
  examples: Example[];
  relatedTools: string[];
  learnMoreUrl?: string;
}

/**
 * Parameter metadata
 */
interface ParameterInfo {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue?: string | number | boolean;
  validValues?: string[];
}

/**
 * Example usage
 */
interface Example {
  title: string;
  description: string;
  code: string;
  expectedResult?: string;
}

/**
 * Cache of tool information to avoid rebuilding on each help request
 */
let toolInfoCache: ToolInfo[] = [];
let categoryCache: ToolCategory[] = [];

/**
 * Registers the help command tools
 */
export function registerHelpCommands(server: McpServer, client: LogzioClient) {
  // Master help command shows all available tools by category
  server.tool(
    "help",
    "Get help with available log analysis tools",
    {
      category: z
        .string()
        .optional()
        .describe(
          "Optional category to filter help by (e.g., 'search', 'analysis')",
        ),
      tool: z
        .string()
        .optional()
        .describe(
          "Optional tool name to get specific help (e.g., 'simple-search')",
        ),
      format: z
        .enum(["brief", "detailed", "examples"])
        .optional()
        .default("brief")
        .describe(
          "Help format: brief for summary, detailed for all info, examples for usage examples",
        ),
    },
    async ({ category, tool, format = "brief" }) => {
      try {
        // Initialize tool metadata if empty
        if (toolInfoCache.length === 0) {
          populateToolInfo();
        }

        // Process based on input parameters
        if (tool) {
          return getToolHelp(tool, format);
        } else if (category) {
          return getCategoryHelp(category, format);
        } else {
          return getAllHelpCategories(format);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          error: errorMessage,
          content: [
            {
              type: "text",
              text: `Error fetching help: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );

  // Command list - simplified version of help that just lists commands
  server.tool(
    "commands",
    "List all available log analysis commands",
    {
      category: z
        .string()
        .optional()
        .describe(
          "Optional category to filter commands by (e.g., 'search', 'analysis')",
        ),
    },
    async ({ category }) => {
      try {
        // Initialize tool metadata if empty
        if (toolInfoCache.length === 0) {
          populateToolInfo();
        }

        // Filter tools by category if provided
        const tools = category
          ? toolInfoCache.filter(
              (t) => t.category.toLowerCase() === category.toLowerCase(),
            )
          : toolInfoCache;

        // Group tools by category
        const toolsByCategory: Record<string, ToolInfo[]> = {};
        tools.forEach((tool) => {
          if (!toolsByCategory[tool.category]) {
            toolsByCategory[tool.category] = [];
          }
          toolsByCategory[tool.category].push(tool);
        });

        // Format the output
        let output = "# Available Log Analysis Commands\n\n";

        if (category) {
          output += `Commands in category: **${category}**\n\n`;
        }

        Object.keys(toolsByCategory)
          .sort()
          .forEach((categoryName) => {
            output += `## ${categoryName}\n\n`;

            toolsByCategory[categoryName].forEach((tool) => {
              output += `- \`${tool.name}\` - ${tool.description}\n`;
            });

            output += "\n";
          });

        output +=
          'For detailed help on any command, use `help(tool: "command-name")`\n';

        return {
          content: [
            {
              type: "text",
              text: output,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          error: errorMessage,
          content: [
            {
              type: "text",
              text: `Error listing commands: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );

  // Examples tool - show examples of common queries and analyses
  server.tool(
    "examples",
    "Show examples of common log analysis tasks",
    {
      task: z
        .string()
        .optional()
        .describe(
          "Type of task to show examples for (e.g., 'search', 'error-analysis')",
        ),
    },
    async ({ task }) => {
      try {
        // Initialize tool metadata if empty
        if (toolInfoCache.length === 0) {
          populateToolInfo();
        }

        if (task) {
          return getTaskExamples(task);
        } else {
          return getAllExampleCategories();
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          isError: true,
          error: errorMessage,
          content: [
            {
              type: "text",
              text: `Error fetching examples: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
}

/**
 * Returns detailed help for a specific tool
 */
function getToolHelp(toolName: string, format: string): any {
  // Find the tool info
  const toolInfo = toolInfoCache.find(
    (t) => t.name.toLowerCase() === toolName.toLowerCase(),
  );

  if (!toolInfo) {
    return {
      content: [
        {
          type: "text",
          text: `Tool "${toolName}" not found. Use the \`help\` command without parameters to see all available tools.`,
        },
      ],
    };
  }

  // Format the output based on requested format
  let output = `# ${toolInfo.name}\n\n`;
  output += `**Category:** ${toolInfo.category}\n\n`;
  output += `**Description:** ${toolInfo.description}\n\n`;

  // Add parameter information for detailed view
  if (format === "detailed" || format === "examples") {
    output += "## Parameters\n\n";

    // Table header for parameters
    output += "| Parameter | Type | Required | Default | Description |\n";
    output += "|-----------|------|----------|---------|-------------|\n";

    toolInfo.parameters.forEach((param) => {
      const required = param.required ? "Yes" : "No";
      const defaultValue =
        param.defaultValue !== undefined ? String(param.defaultValue) : "-";
      output += `| \`${param.name}\` | ${param.type} | ${required} | ${defaultValue} | ${param.description} |\n`;
    });

    output += "\n";
  }

  // Add examples for examples view
  if (format === "examples" && toolInfo.examples.length > 0) {
    output += "## Examples\n\n";

    toolInfo.examples.forEach((example, index) => {
      output += `### ${index + 1}. ${example.title}\n\n`;
      if (example.description) {
        output += `${example.description}\n\n`;
      }
      output += "```javascript\n";
      output += example.code + "\n";
      output += "```\n\n";

      if (example.expectedResult) {
        output += "Expected result:\n";
        output += "```\n";
        output += example.expectedResult + "\n";
        output += "```\n\n";
      }
    });
  }

  // Add related tools
  if (toolInfo.relatedTools.length > 0) {
    output += "## Related Tools\n\n";
    toolInfo.relatedTools.forEach((relatedTool) => {
      const related = toolInfoCache.find((t) => t.name === relatedTool);
      if (related) {
        output += `- \`${related.name}\` - ${related.description}\n`;
      }
    });
    output += "\n";
  }

  // Add learn more link if available
  if (toolInfo.learnMoreUrl) {
    output += `## Learn More\n\nFor more information, see: ${toolInfo.learnMoreUrl}\n\n`;
  }

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}

/**
 * Returns help for all tools in a specific category
 */
function getCategoryHelp(categoryName: string, format: string): any {
  // Find the category
  const category = categoryCache.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase(),
  );

  if (!category) {
    // Show available categories if the specified one wasn't found
    return {
      content: [
        {
          type: "text",
          text: `Category "${categoryName}" not found. Available categories are: ${categoryCache.map((c) => c.name).join(", ")}`,
        },
      ],
    };
  }

  // Format the output
  let output = `# ${category.name} Tools\n\n`;
  output += `**Description:** ${category.description}\n\n`;
  output += "## Available Tools\n\n";

  // List tools in this category
  const categoryTools = toolInfoCache.filter(
    (t) => t.category.toLowerCase() === categoryName.toLowerCase(),
  );

  if (format === "brief") {
    // Simple list for brief format
    categoryTools.forEach((tool) => {
      output += `- \`${tool.name}\` - ${tool.description}\n`;
    });
  } else {
    // More detailed information for detailed format
    categoryTools.forEach((tool) => {
      output += `### ${tool.name}\n\n`;
      output += `${tool.description}\n\n`;

      // Add parameter summary
      output += "**Parameters:**\n\n";

      // Required parameters
      const requiredParams = tool.parameters.filter((p) => p.required);
      if (requiredParams.length > 0) {
        output += "Required:\n";
        requiredParams.forEach((param) => {
          output += `- \`${param.name}\` (${param.type}): ${param.description}\n`;
        });
        output += "\n";
      }

      // Optional parameters
      const optionalParams = tool.parameters.filter((p) => !p.required);
      if (optionalParams.length > 0) {
        output += "Optional:\n";
        optionalParams.forEach((param) => {
          const defaultText =
            param.defaultValue !== undefined
              ? ` (default: ${param.defaultValue})`
              : "";
          output += `- \`${param.name}\` (${param.type})${defaultText}: ${param.description}\n`;
        });
      }

      output += "\n";

      // Example usage
      if (tool.examples.length > 0 && format === "examples") {
        output += "**Example:**\n\n";
        output += "```javascript\n";
        output += tool.examples[0].code + "\n";
        output += "```\n\n";
      }
    });
  }

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}

/**
 * Returns an overview of all help categories
 */
function getAllHelpCategories(format: string): any {
  let output = "# Log Analysis Tools Help\n\n";
  output += "## Available Categories\n\n";

  categoryCache.forEach((category) => {
    output += `### ${category.name}\n\n`;
    output += `${category.description}\n\n`;

    const categoryTools = toolInfoCache.filter(
      (t) => t.category === category.name,
    );
    categoryTools.forEach((tool) => {
      output += `- \`${tool.name}\` - ${tool.description}\n`;
    });

    output += "\n";
  });

  output += "## Getting Started\n\n";
  output += "To get detailed help for a specific tool, use:\n";
  output += "```\n";
  output += 'help(tool: "tool-name", format: "detailed")\n';
  output += "```\n\n";

  output += "To see examples for a specific tool, use:\n";
  output += "```\n";
  output += 'help(tool: "tool-name", format: "examples")\n';
  output += "```\n\n";

  output += "To list all commands in a category, use:\n";
  output += "```\n";
  output += 'help(category: "category-name")\n';
  output += "```\n\n";

  output += "## Quick References\n\n";
  output += "- For exploring available fields, use: `get-fields`\n";
  output += "- For simple log searches, use: `simple-search`\n";
  output += "- For error analysis, use: `analyze-errors`\n";
  output += "- For usage examples, use: `log-examples`\n";

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}

/**
 * Returns examples for a specific task
 */
function getTaskExamples(taskName: string): any {
  // Define task examples
  const taskExamples: Record<string, any> = {
    search: {
      title: "Log Search Examples",
      description: "Examples of different ways to search logs",
      examples: [
        {
          title: "Basic Text Search",
          code: `simple-search({ query: "error connection refused" })`,
          description:
            "Search for logs containing the words 'error' AND 'connection' AND 'refused'",
        },
        {
          title: "Field-Specific Search",
          code: `simple-search({ query: "level:error AND message:timeout" })`,
          description:
            "Search for logs with level 'error' that mention 'timeout' in the message",
        },
        {
          title: "Time-Bounded Search",
          code: `simple-search({ query: "status:500", timeRange: "15m" })`,
          description:
            "Search for logs with status code 500 from the last 15 minutes",
        },
        {
          title: "Wildcard Search",
          code: `simple-search({ query: "message:auth*failed" })`,
          description:
            "Search for logs with messages containing terms that start with 'auth' and end with 'failed'",
        },
      ],
    },
    "error-analysis": {
      title: "Error Analysis Examples",
      description: "Examples of analyzing errors in logs",
      examples: [
        {
          title: "Basic Error Analysis",
          code: `analyze-errors({ timeRange: "24h" })`,
          description: "Analyze error patterns from the last 24 hours",
        },
        {
          title: "Custom Error Field",
          code: `analyze-errors({ timeRange: "6h", errorField: "severity", errorValue: "critical" })`,
          description: "Analyze critical severity errors from the last 6 hours",
        },
        {
          title: "Grouped Error Analysis",
          code: `analyze-errors({ timeRange: "7d", groupBy: "service.keyword" })`,
          description:
            "Analyze errors from the last 7 days, grouped by service",
        },
        {
          title: "Error Categorization",
          code: `categorize-errors({ timeRange: "24h", categorizeBy: "component", detectErrorTypes: true })`,
          description:
            "Categorize errors by component and automatically detect error types",
        },
      ],
    },
    visualization: {
      title: "Log Visualization Examples",
      description: "Examples of visualizing log data",
      examples: [
        {
          title: "Basic Log Histogram",
          code: `log-histogram({ timeRange: "6h", interval: "15m" })`,
          description:
            "Create a histogram of log volume over the last 6 hours in 15-minute intervals",
        },
        {
          title: "Filtered Histogram",
          code: `log-histogram({ query: "level:error", timeRange: "24h", interval: "1h" })`,
          description:
            "Create a histogram of error logs over the last 24 hours in 1-hour intervals",
        },
        {
          title: "Log Dashboard",
          code: `log-dashboard({ timeRange: "12h" })`,
          description:
            "Generate a comprehensive dashboard of log activity for the last 12 hours",
        },
        {
          title: "Trend Detection",
          code: `detect-trends({ timeRange: "7d", field: "http.status_code", minTrendSignificance: 15 })`,
          description:
            "Detect trends in HTTP status codes over the last 7 days with at least 15% change",
        },
      ],
    },
    "field-discovery": {
      title: "Field Discovery Examples",
      description: "Examples of discovering and exploring log fields",
      examples: [
        {
          title: "List Available Fields",
          code: `get-fields()`,
          description: "Get a list of all available fields in logs",
        },
        {
          title: "Field Statistics",
          code: `field-stats({ field: "service", timeRange: "24h" })`,
          description:
            "Get statistics about the 'service' field over the last 24 hours",
        },
        {
          title: "Field Value Distribution",
          code: `field-values({ field: "status_code", timeRange: "6h" })`,
          description:
            "Get the distribution of values for the 'status_code' field over the last 6 hours",
        },
        {
          title: "Field Recommendations",
          code: `discover-fields({ query: "error", maxFields: 15 })`,
          description: "Discover relevant fields for logs containing 'error'",
        },
      ],
    },
    "pattern-analysis": {
      title: "Pattern Analysis Examples",
      description: "Examples of analyzing patterns in logs",
      examples: [
        {
          title: "Identify Common Patterns",
          code: `analyze-patterns({ timeRange: "24h", minCount: 10 })`,
          description:
            "Analyze recurring patterns in logs from the last 24 hours",
        },
        {
          title: "Error Patterns",
          code: `analyze-patterns({ timeRange: "12h", filter: "level:error", minCount: 5 })`,
          description: "Analyze patterns in error logs from the last 12 hours",
        },
        {
          title: "Service-Specific Patterns",
          code: `analyze-patterns({ timeRange: "48h", filter: "service:api-gateway", includeExamples: true })`,
          description:
            "Analyze patterns for the api-gateway service over the last 48 hours",
        },
        {
          title: "Message Patterns",
          code: `analyze-patterns({ timeRange: "7d", messageField: "exception", patternField: "exception.keyword" })`,
          description:
            "Analyze patterns in exception messages over the last 7 days",
        },
      ],
    },
    sampling: {
      title: "Log Sampling Examples",
      description: "Examples of sampling logs for analysis",
      examples: [
        {
          title: "Random Sample",
          code: `sample-logs({ timeRange: "24h", count: 50 })`,
          description: "Get a random sample of 50 logs from the last 24 hours",
        },
        {
          title: "Service Sample",
          code: `sample-logs({ query: "service:database", timeRange: "12h", count: 20 })`,
          description:
            "Get 20 random logs from the database service over the last 12 hours",
        },
        {
          title: "Error Sample",
          code: `sample-logs({ query: "level:error", timeRange: "6h", count: 30, fields: ["timestamp", "message", "service"] })`,
          description:
            "Sample 30 error logs from the last 6 hours, including specific fields",
        },
        {
          title: "Representative Sample",
          code: `sample-logs({ timeRange: "48h", strategy: "representative", count: 40 })`,
          description:
            "Get a representative sample of 40 logs covering different log types from the last 48 hours",
        },
      ],
    },
  };

  // Check if the task exists
  if (!taskExamples[taskName.toLowerCase()]) {
    return {
      content: [
        {
          type: "text",
          text: `No examples found for task "${taskName}". Available tasks are: ${Object.keys(taskExamples).join(", ")}`,
        },
      ],
    };
  }

  // Format the output
  const task = taskExamples[taskName.toLowerCase()];
  let output = `# ${task.title}\n\n`;

  if (task.description) {
    output += `${task.description}\n\n`;
  }

  task.examples.forEach((example: any, index: number) => {
    output += `## ${index + 1}. ${example.title}\n\n`;

    if (example.description) {
      output += `${example.description}\n\n`;
    }

    output += "```javascript\n";
    output += example.code + "\n";
    output += "```\n\n";
  });

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}

/**
 * Returns an overview of all example categories
 */
function getAllExampleCategories(): any {
  let output = "# Log Analysis Examples\n\n";
  output += "Choose a category to see specific examples:\n\n";

  const exampleTasks = [
    { name: "search", description: "Different ways to search and query logs" },
    {
      name: "error-analysis",
      description: "Analyze, categorize, and investigate errors",
    },
    {
      name: "visualization",
      description: "Create histograms, dashboards, and visualizations",
    },
    {
      name: "field-discovery",
      description: "Discover and explore available log fields",
    },
    {
      name: "pattern-analysis",
      description: "Identify recurring patterns and trends in logs",
    },
    {
      name: "sampling",
      description: "Sample logs for analysis using different strategies",
    },
  ];

  exampleTasks.forEach((task) => {
    output += `## ${task.name}\n\n`;
    output += `${task.description}\n\n`;
    output += `To see examples: \`log-examples(task: "${task.name}")\`\n\n`;
  });

  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
}

/**
 * Populate tool metadata for all available tools
 */
function populateToolInfo() {
  // Define tool categories
  categoryCache = [
    {
      name: "Search",
      description: "Tools for searching and querying logs",
      tools: ["simple-search", "quick-search", "elasticsearch-search"],
    },
    {
      name: "Analysis",
      description: "Tools for analyzing log patterns and trends",
      tools: [
        "analyze-errors",
        "analyze-patterns",
        "categorize-errors",
        "detect-trends",
      ],
    },
    {
      name: "Visualization",
      description: "Tools for visualizing log data",
      tools: ["log-histogram", "log-dashboard"],
    },
    {
      name: "Field Discovery",
      description: "Tools for discovering and exploring log fields",
      tools: ["get-fields", "field-stats", "field-values", "discover-fields"],
    },
    {
      name: "Sampling",
      description: "Tools for sampling logs",
      tools: ["sample-logs"],
    },
    {
      name: "Help",
      description: "Tools for getting help and learning about log analysis",
      tools: ["help", "commands", "examples", "query-helper"],
    },
  ];

  // Define tool information with parameters, examples, etc.
  toolInfoCache = [
    {
      name: "simple-search",
      description: "Search logs with a simple text query",
      category: "Search",
      parameters: [
        {
          name: "query",
          type: "string | object",
          description:
            "A simple text query or complex Elasticsearch query DSL object",
          required: true,
        },
        {
          name: "fields",
          type: "string[]",
          description: "Specific fields to search within",
          required: false,
        },
        {
          name: "timeRange",
          type: "string",
          description: "Time range to search (e.g., '15m', '1h', '24h', '7d')",
          required: false,
        },
        {
          name: "from",
          type: "number",
          description: "Starting offset for pagination",
          required: false,
          defaultValue: 0,
        },
        {
          name: "size",
          type: "number",
          description: "Number of results to return",
          required: false,
          defaultValue: 10,
        },
        {
          name: "sortField",
          type: "string",
          description: "Field to sort results by",
          required: false,
        },
        {
          name: "sortOrder",
          type: "string",
          description: "Sort order (asc or desc)",
          required: false,
          defaultValue: "desc",
          validValues: ["asc", "desc"],
        },
      ],
      examples: [
        {
          title: "Basic Search",
          description:
            "Search for logs containing error messages from the last hour",
          code: `simple-search({
  query: "error",
  timeRange: "1h"
})`,
        },
        {
          title: "Field-Specific Search",
          description: "Search for specific HTTP status codes",
          code: `simple-search({
  query: "status_code:500 OR status_code:503",
  timeRange: "24h",
  sortField: "@timestamp"
})`,
        },
        {
          title: "Complex Query",
          description:
            "Use a complex Elasticsearch query for advanced filtering",
          code: `simple-search({
  query: {
    bool: {
      must: [
        { term: { "level": "error" } },
        { match: { "message": "connection refused" } }
      ],
      filter: [
        { range: { "@timestamp": { gte: "now-6h" } } }
      ]
    }
  }
})`,
        },
      ],
      relatedTools: ["quick-search", "elasticsearch-search", "sample-logs"],
    },
    {
      name: "analyze-errors",
      description: "Analyze error patterns in logs",
      category: "Analysis",
      parameters: [
        {
          name: "timeRange",
          type: "string",
          description: "Time range to analyze (e.g., '15m', '1h', '24h', '7d')",
          required: false,
          defaultValue: "24h",
        },
        {
          name: "errorField",
          type: "string",
          description: "Field name that contains error level information",
          required: false,
          defaultValue: "level",
        },
        {
          name: "errorValue",
          type: "string",
          description: "Value in errorField that indicates an error",
          required: false,
          defaultValue: "error",
        },
        {
          name: "groupBy",
          type: "string",
          description: "Field to group errors by",
          required: false,
          defaultValue: "message.keyword",
        },
        {
          name: "maxGroups",
          type: "number",
          description: "Maximum number of error groups to return",
          required: false,
          defaultValue: 20,
        },
        {
          name: "useSimpleAggregation",
          type: "boolean",
          description:
            "Use simplified aggregation to avoid nested bucket errors",
          required: false,
          defaultValue: false,
        },
      ],
      examples: [
        {
          title: "Basic Error Analysis",
          description: "Analyze error patterns from the last 24 hours",
          code: `analyze-errors({
  timeRange: "24h"
})`,
        },
        {
          title: "Custom Error Field",
          description: "Use a custom field for error identification",
          code: `analyze-errors({
  timeRange: "12h",
  errorField: "severity",
  errorValue: "critical"
})`,
        },
        {
          title: "Grouped Analysis",
          description: "Group errors by service for better categorization",
          code: `analyze-errors({
  timeRange: "7d",
  groupBy: "service.keyword",
  maxGroups: 10
})`,
        },
      ],
      relatedTools: ["categorize-errors", "log-dashboard", "simple-search"],
    },
    {
      name: "log-histogram",
      description: "Get log counts over time intervals for trend analysis",
      category: "Visualization",
      parameters: [
        {
          name: "query",
          type: "string",
          description:
            "Optional query string to filter logs (e.g., 'level:error')",
          required: false,
        },
        {
          name: "interval",
          type: "string",
          description: "Time interval for histogram buckets (e.g., '1h', '1d')",
          required: true,
        },
        {
          name: "timeRange",
          type: "string",
          description: "Time range to analyze (e.g., '24h', '7d')",
          required: true,
        },
        {
          name: "field",
          type: "string",
          description: "Timestamp field to use for the histogram",
          required: false,
          defaultValue: "@timestamp",
        },
        {
          name: "format",
          type: "string",
          description:
            "Response format: text for human-readable, json for data",
          required: false,
          defaultValue: "text",
          validValues: ["text", "json"],
        },
      ],
      examples: [
        {
          title: "Basic Histogram",
          description:
            "Get log volume over time for the last 24 hours in 1-hour intervals",
          code: `log-histogram({
  timeRange: "24h",
  interval: "1h"
})`,
        },
        {
          title: "Error Histogram",
          description: "Visualize error frequency over time",
          code: `log-histogram({
  query: "level:error",
  timeRange: "7d",
  interval: "12h"
})`,
        },
        {
          title: "Custom Field Histogram",
          description: "Use a custom time field for specialized analysis",
          code: `log-histogram({
  query: "service:payment-api",
  timeRange: "3d",
  interval: "6h",
  field: "event_time"
})`,
        },
      ],
      relatedTools: ["log-dashboard", "detect-trends", "simple-search"],
    },
    {
      name: "help",
      description: "Get help with available log analysis tools",
      category: "Help",
      parameters: [
        {
          name: "category",
          type: "string",
          description:
            "Optional category to filter help by (e.g., 'search', 'analysis')",
          required: false,
        },
        {
          name: "tool",
          type: "string",
          description:
            "Optional tool name to get specific help (e.g., 'simple-search')",
          required: false,
        },
        {
          name: "format",
          type: "string",
          description:
            "Help format: brief for summary, detailed for all info, examples for usage examples",
          required: false,
          defaultValue: "brief",
          validValues: ["brief", "detailed", "examples"],
        },
      ],
      examples: [
        {
          title: "Get All Help",
          description: "List all available tool categories",
          code: `help()`,
        },
        {
          title: "Category Help",
          description: "Get help for all search tools",
          code: `help({ category: "search" })`,
        },
        {
          title: "Tool Help",
          description: "Get detailed help for a specific tool",
          code: `help({ tool: "simple-search", format: "detailed" })`,
        },
        {
          title: "Tool Examples",
          description: "See examples for a specific tool",
          code: `help({ tool: "analyze-errors", format: "examples" })`,
        },
      ],
      relatedTools: ["commands", "examples", "query-helper"],
    },
    // Add more tools as needed
  ];
}
