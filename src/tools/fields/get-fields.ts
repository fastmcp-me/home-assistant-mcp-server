import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";

/**
 * Registers the get-fields tool
 * Lists available fields in the logs with their types
 */
export function registerGetFieldsTool(server: McpServer, client: LogzioClient) {
  // Add a tool for listing available fields
  server.tool(
    "get-fields",
    "Get available fields in your log indices",
    {
      index: z
        .string()
        .optional()
        .describe(
          "Index pattern to retrieve fields from (e.g., 'logstash-*', 'filebeat-*'). If not provided, will attempt to use default indices.",
        ),
    },
    async ({ index }) => {
      try {
        const data = await client.getFields(index);

        // Format the fields into a more user-friendly structure
        const formattedFields = formatFieldData(data);

        return {
          data: data, // Return raw data for programmatic access
          content: [
            {
              type: "text",
              text: `Available Fields in ${index || "default"} index:\n\n${formattedFields}`,
            },
          ],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);

        // Create a more helpful error message
        let userMessage = `Error retrieving fields: ${errorMessage}`;

        if (errorMessage.includes("404")) {
          userMessage +=
            "\n\nThe specified index does not exist. Please check your index pattern and try again.";
        } else if (errorMessage.includes("401")) {
          userMessage +=
            "\n\nAuthentication failed. Please check your API credentials.";
        } else if (errorMessage.includes("available indices")) {
          // This is already a helpful message from our enhanced client
          userMessage = `Error: ${errorMessage}`;
        }

        return {
          isError: true,
          error: errorMessage,
          content: [
            {
              type: "text",
              text: userMessage,
            },
          ],
        };
      }
    },
  );
}

/**
 * Helper function to format field data
 */
function formatFieldData(data: Record<string, unknown>): string {
  if (!data || !data.fields || !Array.isArray(data.fields)) {
    return "No fields found or unexpected data format.";
  }

  // Group fields by type
  const fieldsByType: Record<string, string[]> = {};

  data.fields.forEach((field: Record<string, unknown>) => {
    const fieldName = (field.field as string) || "unknown";
    const fieldType = (field.type as string) || "unknown";

    if (!fieldsByType[fieldType]) {
      fieldsByType[fieldType] = [];
    }

    fieldsByType[fieldType].push(fieldName);
  });

  // Create formatted output
  let output = "";

  for (const [type, fields] of Object.entries(fieldsByType)) {
    output += `## ${type.toUpperCase()} FIELDS\n`;
    fields.sort().forEach((field) => {
      output += `- ${field}\n`;
    });
    output += "\n";
  }

  // Add total count
  output += `Total: ${data.fields.length} fields\n`;

  return output;
}
