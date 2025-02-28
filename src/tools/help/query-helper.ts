import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LogzioClient } from "../../api/logzio.js";

/**
 * Registers query helper tools that provide assistance with building and understanding queries
 */
export function registerQueryHelper(server: McpServer, client: LogzioClient) {
  // Register the query-helper tool
  server.tool(
    "query-helper",
    "Get help with building and understanding log queries",
    {
      queryType: z
        .enum(["simple", "lucene", "elasticsearch"])
        .optional()
        .describe("Type of query you need help with"),
      objective: z
        .string()
        .optional()
        .describe("What you're trying to accomplish with your query"),
      example: z
        .string()
        .optional()
        .describe("Example query you need help understanding"),
      field: z.string().optional().describe("Field you want to query on"),
    },
    async (params, extra) => {
      try {
        const queryType = params.queryType || "simple";
        const objective = params.objective || "";
        const example = params.example || "";
        const field = params.field || "";

        let helpContent = "# Query Helper\n\n";

        if (example) {
          helpContent += `## Query Explanation\n\nHere's an explanation of your example query:\n\`\`\`\n${example}\n\`\`\`\n\n`;
          helpContent +=
            "This is a placeholder for a detailed explanation of your query.\n\n";
        }

        if (objective) {
          helpContent += `## Building a Query for Your Objective\n\nYou're trying to: ${objective}\n\n`;
          helpContent +=
            "Here's how you might structure a query for this objective:\n\n";

          if (queryType === "simple") {
            helpContent +=
              '```\nsimple-search({\n  query: "your search terms",\n  timeRange: "24h"\n})\n```\n\n';
          } else if (queryType === "lucene") {
            helpContent +=
              '```\nfield:value AND other_field:"exact phrase"\n```\n\n';
          } else if (queryType === "elasticsearch") {
            helpContent +=
              '```json\n{\n  "query": {\n    "bool": {\n      "must": [\n        { "match": { "field": "value" } }\n      ]\n    }\n  }\n}\n```\n\n';
          }
        }

        if (field) {
          helpContent += `## Field Query Tips\n\nFor the field \`${field}\`:\n\n`;
          helpContent +=
            '- For text fields, use quotes for phrases: `field:"exact phrase"`\n';
          helpContent +=
            "- For numeric fields, use ranges: `field:[10 TO 100]`\n";
          helpContent +=
            "- For dates, use ISO format: `field:[2023-01-01 TO 2023-01-31]`\n";
          helpContent +=
            "- For boolean fields, use: `field:true` or `field:false`\n";
        }

        // Add general query syntax tips
        helpContent += "## Query Syntax Tips\n\n";
        helpContent += "### Simple Search\n";
        helpContent += "- Use space-separated terms for AND semantics\n";
        helpContent += '- Use quotes for phrases: `"exact phrase"`\n';
        helpContent += "- Use `-` to exclude terms: `-error`\n\n";

        helpContent += "### Lucene Query Syntax\n";
        helpContent += "- Use `field:value` to search specific fields\n";
        helpContent += "- Use `AND`, `OR`, `NOT` for boolean operations\n";
        helpContent += "- Use wildcards: `field:val*` or `field:v?lue`\n";
        helpContent += "- Use `field:[min TO max]` for range queries\n\n";

        helpContent += "### Elasticsearch DSL\n";
        helpContent += "- Use `match` for full-text search\n";
        helpContent += "- Use `term` for exact value matching\n";
        helpContent += "- Use `range` for range queries\n";
        helpContent +=
          "- Use `bool` with `must`, `should`, and `must_not` for complex logic\n";

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
              text: `Error providing query help: ${errorMessage}`,
            },
          ],
        };
      }
    },
  );
}
