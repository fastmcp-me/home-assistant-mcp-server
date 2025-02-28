import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerPrompts(server: McpServer) {
  // Introduction to Logz.io and available data
  server.prompt(
    "logzio-overview",
    "Introduction to Logz.io log analysis and available data",
    async () => {
      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I need to understand Logz.io and the available data in this system. Please provide an overview of:

1. What kind of data is available in Logz.io logs
2. What fields are commonly used for filtering and searching
3. The main tools available through this MCP server
4. Common patterns and types of analysis I can perform
5. Best practices for effective log analysis in Logz.io

Start by using the get-fields tool to explore available fields, then provide examples of how to use the search and analysis tools effectively.`,
            },
          },
        ],
      };
    },
  );

  // Error analysis prompt
  server.prompt(
    "error-analysis",
    "Comprehensive error analysis for a specified time range",
    {
      timeRange: z
        .string()
        .describe("Time range to analyze (e.g., '1h', '6h', '24h', '7d')"),
      service: z
        .string()
        .optional()
        .describe("Optional service name to filter errors by"),
      errorLevel: z
        .string()
        .optional()
        .describe("Error level to search for (e.g., 'error', 'critical')"),
    },
    async (args) => {
      const timeRange = args.timeRange || "24h";
      const errorLevel = args.errorLevel || "error";
      const serviceFilter = args.service
        ? ` for service "${args.service}"`
        : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please perform a comprehensive error analysis${serviceFilter} over the past ${timeRange}. I need:

1. A summary of total error count and error rate
2. The most common error types grouped by message
3. Any patterns or trends in error occurrence
4. Potential root causes for the most frequent errors
5. Suggested actions for investigation or resolution

Start by using the analyze-errors tool with timeRange: "${timeRange}", errorValue: "${errorLevel}"${args.service ? `, and add a filter for the service in your queries` : ""}.

Then use log-histogram to visualize error trends over time, and examine specific error examples with simple-search.`,
            },
          },
        ],
      };
    },
  );

  // Performance analysis prompt
  server.prompt(
    "performance-analysis",
    "Analyze system performance metrics and latency patterns",
    {
      timeRange: z
        .string()
        .describe("Time range to analyze (e.g., '1h', '6h', '24h', '7d')"),
      service: z
        .string()
        .optional()
        .describe("Optional service name to filter by"),
    },
    async (args) => {
      const timeRange = args.timeRange || "6h";
      const serviceFilter = args.service
        ? ` for service "${args.service}"`
        : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze performance metrics${serviceFilter} over the past ${timeRange}. I need:

1. Performance trends and patterns over time
2. Any latency spikes or performance degradations
3. Correlation between errors and performance issues
4. Resource utilization patterns (if available)
5. Recommendations for performance optimization

Start by searching for latency, duration, or response time metrics using simple-search. Then use log-histogram to visualize performance trends over time. Finally, check if there's correlation with error patterns using analyze-errors.`,
            },
          },
        ],
      };
    },
  );

  // Security incident investigation prompt
  server.prompt(
    "security-investigation",
    "Investigate potential security incidents in logs",
    {
      timeRange: z
        .string()
        .describe("Time range to analyze (e.g., '1h', '6h', '24h', '7d')"),
      incidentType: z
        .enum(["authentication", "authorization", "access", "general"])
        .describe("Type of security incident to focus on"),
    },
    async (args) => {
      const timeRange = args.timeRange || "24h";
      const incidentType = args.incidentType || "general";
      let queryGuidance = "";

      switch (incidentType) {
        case "authentication":
          queryGuidance =
            "authentication failure, login failure, failed login, invalid credentials";
          break;
        case "authorization":
          queryGuidance =
            "permission denied, unauthorized, forbidden, access denied";
          break;
        case "access":
          queryGuidance = "suspicious IP, unusual access, unexpected location";
          break;
        default:
          queryGuidance = "security, vulnerability, exploit, attack, intrusion";
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please investigate potential ${incidentType} security incidents in the logs over the past ${timeRange}. I need:

1. A summary of security-related events
2. Pattern analysis of suspicious activities
3. Frequency and distribution of security events
4. Source IPs or users associated with incidents (if available)
5. Timeline of events for incident reconstruction
6. Recommendations for further investigation

Start by searching for relevant security terms like ${queryGuidance} using simple-search. Then analyze patterns with log-dashboard and log-histogram tools to identify trends and anomalies.`,
            },
          },
        ],
      };
    },
  );

  // Log dashboard creation prompt
  server.prompt(
    "create-dashboard",
    "Create a comprehensive log monitoring dashboard",
    {
      timeRange: z
        .string()
        .describe("Time range to analyze (e.g., '1h', '6h', '24h', '7d')"),
      service: z
        .string()
        .optional()
        .describe("Optional service name to filter by"),
      focus: z
        .enum(["general", "errors", "performance", "security"])
        .describe("Dashboard focus area"),
    },
    async (args) => {
      const timeRange = args.timeRange || "24h";
      const focus = args.focus || "general";
      const serviceFilter = args.service
        ? ` for service "${args.service}"`
        : "";
      let dashboardFocus = "";

      switch (focus) {
        case "errors":
          dashboardFocus = "error patterns and troubleshooting";
          break;
        case "performance":
          dashboardFocus = "performance metrics and optimization";
          break;
        case "security":
          dashboardFocus = "security events and potential threats";
          break;
        default:
          dashboardFocus = "overall system health and activity";
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please help me create a comprehensive log monitoring dashboard${serviceFilter} focusing on ${dashboardFocus} over the past ${timeRange}. I need:

1. Key metrics and visualization recommendations
2. Important trends to monitor
3. Essential alerts to set up
4. Filtering strategies for effective monitoring
5. Suggested refresh intervals and time ranges

Start by using the log-dashboard tool to get an overview, then add specific visualizations using log-histogram and analyze-errors as needed for my focus area.`,
            },
          },
        ],
      };
    },
  );

  // Quick troubleshooting guide prompt
  server.prompt(
    "troubleshoot",
    "Generate a quick troubleshooting guide for a specific issue",
    {
      issue: z
        .string()
        .describe("Brief description of the issue to troubleshoot"),
      timeRange: z
        .string()
        .describe("Time range to analyze (e.g., '1h', '6h', '24h', '7d')"),
      severity: z
        .enum(["low", "medium", "high", "critical"])
        .describe("Issue severity"),
    },
    async (args) => {
      const timeRange = args.timeRange || "6h";
      const severity = args.severity || "medium";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I need to troubleshoot a ${severity} severity issue: "${args.issue}" that occurred within the past ${timeRange}. Please create a troubleshooting guide that includes:

1. Relevant log search queries to identify the problem
2. Key fields and patterns to look for
3. Analysis of potential root causes
4. Step-by-step investigation process
5. Possible solutions or mitigations

Start by formulating search queries related to the issue and use the simple-search tool to find relevant logs. Then use analyze-errors if errors are involved, and log-histogram to identify when the issue started or peaked.`,
            },
          },
        ],
      };
    },
  );

  // User activity analysis prompt
  server.prompt(
    "user-activity",
    "Analyze user activity patterns from logs",
    {
      timeRange: z
        .string()
        .describe("Time range to analyze (e.g., '1h', '6h', '24h', '7d')"),
      userId: z
        .string()
        .optional()
        .describe("Optional specific user ID to analyze"),
      activityType: z
        .enum(["login", "transactions", "errors", "all"])
        .describe("Type of user activity to focus on"),
    },
    async (args) => {
      const timeRange = args.timeRange || "24h";
      const activityType = args.activityType || "all";
      const userFilter = args.userId ? ` for user "${args.userId}"` : "";
      let activityFocus = "";

      switch (activityType) {
        case "login":
          activityFocus =
            "login patterns, session durations, and authentication events";
          break;
        case "transactions":
          activityFocus = "transactions, operations, and user actions";
          break;
        case "errors":
          activityFocus = "errors and issues encountered by users";
          break;
        default:
          activityFocus = "all types of user activity";
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze ${activityFocus}${userFilter} over the past ${timeRange}. I need:

1. Summary of user activity volume and patterns
2. Peak usage times and usage distribution
3. Most common activities or operations
4. Error rates and common user issues
5. Unusual patterns or potential security concerns

Start by searching for user identifiers and ${activityType === "all" ? "activity indicators" : activityType + " events"} using simple-search. Then use log-histogram to visualize activity patterns over time.${activityType === "errors" ? " Also use analyze-errors to identify patterns in user-related errors." : ""}`,
            },
          },
        ],
      };
    },
  );

  // Application deployment analysis prompt
  server.prompt(
    "deployment-analysis",
    "Analyze logs related to an application deployment",
    {
      timeRange: z.string().describe("Time range around deployment to analyze"),
      service: z
        .string()
        .optional()
        .describe("Service or application name that was deployed"),
      deploymentType: z
        .enum(["release", "hotfix", "rollback", "infrastructure"])
        .describe("Type of deployment"),
    },
    async (args) => {
      const timeRange = args.timeRange || "6h";
      const deploymentType = args.deploymentType || "release";
      const serviceFilter = args.service ? ` for "${args.service}"` : "";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze logs related to the recent ${deploymentType} deployment${serviceFilter} within the past ${timeRange}. I need:

1. Deployment event timeline and sequence
2. Error rate before and after deployment
3. Performance impact analysis
4. Service dependencies affected
5. Any deployment-related warnings or errors
6. Verification of successful deployment components

Start by using log-dashboard to get an overview of the system state, then use log-histogram to compare error and activity trends before and after deployment. Finally, search for specific deployment events using simple-search.`,
            },
          },
        ],
      };
    },
  );

  // Log pattern discovery prompt
  server.prompt(
    "discover-patterns",
    "Discover and analyze recurring patterns in logs",
    {
      timeRange: z.string().describe("Time range to analyze"),
      patternType: z
        .enum(["errors", "warnings", "system", "user", "all"])
        .describe("Type of patterns to focus on"),
      minOccurrences: z
        .string()
        .describe("Minimum number of occurrences to consider a pattern"),
    },
    async (args) => {
      const timeRange = args.timeRange || "24h";
      const patternType = args.patternType || "all";
      const minOccurrences = args.minOccurrences || 5;
      let patternFocus = "";

      switch (patternType) {
        case "errors":
          patternFocus = "error messages and exception patterns";
          break;
        case "warnings":
          patternFocus = "warning messages and potential issues";
          break;
        case "system":
          patternFocus =
            "system events, resource usage, and operational patterns";
          break;
        case "user":
          patternFocus = "user behavior and activity patterns";
          break;
        default:
          patternFocus = "all types of recurring patterns";
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please discover and analyze ${patternFocus} in the logs from the past ${timeRange}. I want to identify patterns that occur at least ${minOccurrences} times. Provide:

1. The most frequent recurring patterns
2. Temporal distribution of patterns (e.g., time of day, intervals)
3. Correlation between different pattern types
4. Anomalies or unusual pattern breaks
5. Potential significance or impact of identified patterns

Start by using log-dashboard to get an overview, then analyze specific patterns using simple-search with aggregations. For error patterns specifically, use the analyze-errors tool.`,
            },
          },
        ],
      };
    },
  );

  // Advanced query builder prompt
  server.prompt(
    "query-builder",
    "Build advanced Elasticsearch queries for precise log filtering",
    {
      objective: z
        .string()
        .describe("What you're trying to accomplish with this query"),
      timeRange: z.string().describe("Time range to query"),
    },
    async (args) => {
      const timeRange = args.timeRange || "24h";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I need help building an advanced Elasticsearch query for the following objective: 
"${args.objective}"

Time range: ${timeRange}

Please help me:
1. Create an effective Elasticsearch DSL query based on my objective
2. Explain the components of the query
3. Suggest potential refinements or alternatives
4. Show me how to use it with both search-logs and simple-search tools
5. Provide examples of how to interpret the results

Start by using get-fields to understand available fields, then construct progressively more precise queries to meet my objective.`,
            },
          },
        ],
      };
    },
  );

  // Log data extraction prompt
  server.prompt(
    "extract-data",
    "Extract and format specific data from logs",
    {
      dataType: z
        .string()
        .describe(
          "Type of data to extract (e.g., 'user IDs', 'transaction amounts', 'API responses')",
        ),
      format: z
        .enum(["table", "list", "csv", "summary"])
        .describe("Output format for the extracted data"),
      timeRange: z.string().describe("Time range to search"),
      maxResults: z.string().describe("Maximum number of results to extract"),
    },
    async (args) => {
      const format = args.format || "summary";
      const timeRange = args.timeRange || "24h";
      const maxResults = args.maxResults || 100;

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I need to extract ${args.dataType} from logs over the past ${timeRange} and format the output as a ${format}. Please:

1. Identify the relevant fields that contain this data
2. Create appropriate search queries to find the records
3. Extract up to ${maxResults} instances of the data
4. Format the results as requested
5. Provide any relevant statistics or patterns discovered

Start by using get-fields to identify relevant fields, then use simple-search or search-logs to retrieve the data. Format the output according to my requested format.`,
            },
          },
        ],
      };
    },
  );
}
