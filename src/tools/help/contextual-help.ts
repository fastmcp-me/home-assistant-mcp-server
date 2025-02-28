import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LogzioClient } from "../../api/logzio.js";

/**
 * Registers contextual help tools for providing context-aware assistance
 */
export function registerContextualHelp(
  server: McpServer,
  client: LogzioClient,
) {
  // Register the contextual-help tool
  server.tool(
    "contextual-help",
    "Get contextual help based on your current task or error",
    {
      context: z
        .object({
          task: z
            .string()
            .optional()
            .describe("Current task you're working on"),
          error: z
            .string()
            .optional()
            .describe("Error message you're encountering"),
          tool: z.string().optional().describe("Tool you're trying to use"),
        })
        .optional(),
      topic: z.string().optional().describe("Topic to get help about"),
    },
    async (params, extra) => {
      try {
        const context = params.context || {};
        const topic = params.topic || "";

        let helpContent = "";

        // Generate help based on context
        if (context.error) {
          helpContent = `# Troubleshooting Help\n\nIt looks like you encountered an error: "${context.error}"\n\n`;
          helpContent += "Here are some possible solutions:\n\n";
          helpContent += "- Check the syntax of your query\n";
          helpContent += "- Verify the field names exist in your logs\n";
          helpContent +=
            "- Consider reducing the time range if dealing with a large volume of logs\n";
        } else if (context.tool) {
          helpContent = `# Help for ${context.tool}\n\n`;
          helpContent += `For detailed help on this tool, try using the \`help(tool: "${context.tool}")\` command.\n`;
        } else if (topic) {
          helpContent = `# Help on "${topic}"\n\n`;
          helpContent +=
            "This is a placeholder for contextual help on this topic.\n";
        } else if (context.task) {
          helpContent = `# Task Assistance\n\nFor your task: "${context.task}"\n\n`;
          helpContent +=
            "Here are some tips to help you accomplish this task:\n\n";
          helpContent += "- Break down the problem into smaller steps\n";
          helpContent +=
            "- Start with basic search queries to find relevant logs\n";
          helpContent += "- Use analysis tools to identify patterns\n";
        } else {
          helpContent = "# Contextual Help\n\n";
          helpContent += "To get more specific help, please provide:\n\n";
          helpContent += "- A specific topic using the `topic` parameter\n";
          helpContent +=
            "- Context about your current task using the `context.task` parameter\n";
          helpContent +=
            "- An error message using the `context.error` parameter\n";
          helpContent +=
            "- The tool you're using via the `context.tool` parameter\n";
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
              text: `Error providing contextual help: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
}
