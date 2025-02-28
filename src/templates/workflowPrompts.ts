import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/**
 * Register multi-step workflow templates for complex log analysis sequences
 *
 * @param server The MCP server instance
 */
export function registerWorkflowPrompts(server: McpServer) {
  // Incident investigation workflow
  server.prompt(
    "incident-workflow",
    "Multi-step workflow for investigating a service incident",
    {
      incidentId: z.string().describe("Unique identifier for the incident"),
      service: z.string().describe("Service experiencing the incident"),
      timeRange: z.string().describe("Time range to analyze"),
    },
    async (args) => {
      const incidentId = args.incidentId;
      const service = args.service;
      const timeRange = args.timeRange || "6h";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I need to investigate incident ${incidentId} affecting the ${service} service over the past ${timeRange}. Let's work through this systematically.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll help you investigate this incident step by step. First, let's get an overview of the error patterns in the affected service.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Please use analyze-errors tool to gather the error data for ${service} over the past ${timeRange}.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "Based on the error patterns, we should look at performance metrics next to identify any resource constraints or bottlenecks.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Now use log-histogram to visualize the error frequency over time to identify when the incident started and if there are any patterns.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "Let's also check for any recent deployments or configuration changes that might have triggered this incident.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Use simple-search tool to find any recent deployment logs for the ${service} service.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "Now let's check for correlations with other services that might be dependencies.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Use log-dashboard tool to create a correlation view between ${service} and its dependent services.`,
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Based on all the gathered data, please provide:

1. A timeline of the incident
2. Root cause analysis
3. Impact assessment
4. Recommended remediation steps
5. Prevention measures for the future

Format this as a comprehensive incident report that can be shared with the team.`,
            },
          },
        ],
      };
    },
  );

  // Progressive log debugging workflow
  server.prompt(
    "debug-workflow",
    "Step-by-step workflow for debugging application errors",
    {
      errorMessage: z.string().describe("The error message to debug"),
      application: z.string().describe("Application name"),
      timeRange: z.string().describe("Time range to analyze"),
    },
    async (args) => {
      const errorMessage = args.errorMessage;
      const application = args.application;
      const timeRange = args.timeRange || "24h";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I need to debug this error: "${errorMessage}" in the ${application} application that occurred within the last ${timeRange}.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll help you debug this error step by step. First, let's locate instances of this error in the logs to understand the context.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Use simple-search to find logs containing this exact error message in the ${application} application.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "Now that we have the error occurrences, let's look at the surrounding logs to understand what was happening before the error occurred.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `For one of the error instances, use log-context to see the logs immediately before and after the error.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "Let's see if this error correlates with any specific conditions or patterns. I'll check when the error started occurring and look for any frequency patterns.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Use log-histogram to visualize when this error has been occurring over time.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "Now let's check for any related warnings or other errors that might give us more context about the root cause.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Use analyze-errors to find related errors or warnings that might be connected to this issue.`,
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Based on all this investigation, please provide:

1. A clear explanation of what's causing the error
2. The execution context when the error occurs
3. Potential fixes or workarounds
4. Steps to verify the solution

Please organize this as a debugging report that a developer could use to fix the issue.`,
            },
          },
        ],
      };
    },
  );

  // Security incident response workflow
  server.prompt(
    "security-incident-workflow",
    "Multi-step workflow for analyzing and responding to security incidents",
    {
      alertType: z
        .enum([
          "unauthorized-access",
          "data-exfiltration",
          "injection",
          "account-compromise",
        ])
        .describe("Type of security alert"),
      severity: z
        .enum(["low", "medium", "high", "critical"])
        .describe("Severity of the security alert"),
      timeRange: z.string().describe("Time range to investigate"),
    },
    async (args) => {
      const alertType = args.alertType;
      const severity = args.severity;
      const timeRange = args.timeRange || "24h";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `I need to investigate a ${severity} severity ${alertType} security alert that was triggered within the past ${timeRange}.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "I'll help you investigate this security incident following standard security incident response procedures. First, let's locate and understand the alert details.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Use simple-search to find logs related to this ${alertType} alert with ${severity} severity.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "Now let's check for any related security events or suspicious activities around the same time.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Use log-context to examine activities before and after this security event to establish a timeline.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "Let's identify all affected systems, accounts, or data that might be compromised.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Use analyze-errors to identify any affected systems or accounts.`,
            },
          },
          {
            role: "assistant",
            content: {
              type: "text",
              text: "Let's check for any unusual access patterns or sources that might indicate the origin of the attack.",
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Use log-dashboard to visualize access patterns and sources around the time of the incident.`,
            },
          },
          {
            role: "user",
            content: {
              type: "text",
              text: `Based on this investigation, please provide:

1. A comprehensive security incident report
2. Timeline of the incident
3. Systems and data potentially affected
4. Recommended immediate containment actions
5. Recommendations for long-term prevention
6. Required notifications (legal, customers, etc.)

Please format this as a security incident response report following standard security protocols.`,
            },
          },
        ],
      };
    },
  );
}
