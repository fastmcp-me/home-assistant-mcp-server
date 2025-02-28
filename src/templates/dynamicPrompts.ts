import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register dynamic prompt templates that can include embedded resource context
 *
 * @param server The MCP server instance
 */
export function registerDynamicPrompts(server: McpServer) {
  // Log pattern analysis prompt with embedded log data
  server.prompt(
    "analyze-log-pattern",
    "Analyze logs to identify patterns and anomalies",
    {
      timeRange: z
        .string()
        .describe("Time range to analyze (e.g., '1h', '24h', '7d')"),
      pattern: z.string().describe("Pattern or text to search for in logs"),
      analysisType: z
        .enum(["anomalies", "trends", "failures", "security"])
        .describe("Type of analysis to perform"),
    },
    async (args) => {
      const timeRange = args.timeRange || "24h";
      const pattern = args.pattern || "";
      const analysisType = args.analysisType || "anomalies";

      // Construct the resource URI based on args
      const logsUri = `logs://recent?timeframe=${timeRange}&query=${encodeURIComponent(pattern)}`;

      // This will be populated with actual log data by the resource handler
      const logData =
        "Sample log data would be inserted here from the logs resource";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze these logs for ${analysisType}. Focus on identifying patterns, frequencies, and potential issues:`,
            },
          },
          {
            role: "user",
            content: {
              type: "resource",
              resource: {
                uri: logsUri,
                text: logData,
                mimeType: "text/plain",
              },
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Provide a comprehensive analysis focusing on:
1. Key patterns and frequencies
2. Unusual or anomalous events
3. Potential root causes for identified issues
4. Recommended actions or further investigation
5. Visualization suggestions for better understanding
              
Please organize your analysis in a clear, structured format.`,
            },
          },
        ],
      };
    },
  );

  // Error investigation prompt with embedded log context
  server.prompt(
    "investigate-error",
    "Deep dive investigation into specific error patterns",
    {
      errorMessage: z
        .string()
        .describe("Error message or pattern to investigate"),
      timeRange: z
        .string()
        .describe("Time range to search in (e.g., '1h', '24h', '7d')"),
      service: z.string().optional().describe("Optional service to filter by"),
    },
    async (args) => {
      const errorMessage = args.errorMessage;
      const timeRange = args.timeRange || "24h";
      const serviceFilter = args.service ? `service:${args.service} ` : "";

      // Construct query for error logs
      const query = `${serviceFilter}error:${errorMessage}`;
      const logsUri = `logs://filtered?timeframe=${timeRange}&query=${encodeURIComponent(query)}`;

      // This will be populated with actual log data by the resource handler
      const errorLogs =
        "Sample error logs would be inserted here from the logs resource";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I need a comprehensive investigation of errors matching "${errorMessage}" ${args.service ? `in the ${args.service} service ` : ""}over the past ${timeRange}. Here are the relevant logs:`,
            },
          },
          {
            role: "user",
            content: {
              type: "resource",
              resource: {
                uri: logsUri,
                text: errorLogs,
                mimeType: "text/plain",
              },
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Based on these logs, please provide:

1. A summary of when and how frequently this error occurs
2. The context in which the error happens (preceding events, user actions, etc.)
3. Potential root causes based on the log patterns
4. Correlation with other errors or warnings
5. Recommendations for fixing or mitigating the issue

If there isn't enough information in the logs, please suggest additional data that would help with the investigation.`,
            },
          },
        ],
      };
    },
  );

  // Service health analysis with resource context
  server.prompt(
    "service-health",
    "Analyze health and performance of a specific service",
    {
      service: z.string().describe("Service name to analyze"),
      timeRange: z
        .string()
        .describe("Time range to analyze (e.g., '1h', '24h', '7d')"),
      metrics: z
        .string()
        .optional()
        .describe("Optional comma-separated specific metrics to focus on"),
    },
    async (args) => {
      const service = args.service;
      const timeRange = args.timeRange || "24h";

      // Construct query for service logs
      const serviceUri = `service://${service}/${timeRange}`;

      // This would be populated with actual service metrics by the resource handler
      const serviceData =
        "Sample service metrics would be inserted here from the service resource";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please analyze the health and performance of the ${service} service over the past ${timeRange}. ${args.metrics ? `Focus specifically on these metrics: ${args.metrics}` : ""}`,
            },
          },
          {
            role: "user",
            content: {
              type: "resource",
              resource: {
                uri: serviceUri,
                text: serviceData,
                mimeType: "text/plain",
              },
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Based on this data, please provide:

1. Overall health assessment of the service
2. Performance trends and patterns
3. Any degradation or improvement over time
4. Anomalies or concerning metrics
5. Comparison to expected baseline performance
6. Recommendations for optimization or investigation

Please include both a high-level summary and detailed analysis of specific metrics.`,
            },
          },
        ],
      };
    },
  );
}
