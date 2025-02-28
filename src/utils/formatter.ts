/**
 * Formats search results into a well-structured, readable format with summary information and usage tips
 * @param data The search results data from Elasticsearch
 * @returns A formatted string representation of the results
 */
export function formatSearchResults(data: unknown): string {
  // Handle empty results with a more helpful message
  if (
    typeof data !== "object" ||
    data === null ||
    !("hits" in data) ||
    typeof data.hits !== "object" ||
    data.hits === null ||
    !("hits" in data.hits) ||
    !Array.isArray(data.hits.hits) ||
    data.hits.hits.length === 0
  ) {
    return `# No Results Found

## Possible Reasons
- No logs match your query criteria
- The time range doesn't contain matching logs
- The index pattern doesn't contain the fields you're searching
- Your query syntax may need adjustment

## Suggestions
- Broaden your search by using fewer specific terms
- Check field names with \`get-fields()\` tool
- Try a different time range (e.g., expand from "1h" to "24h")
- Use \`simple-search()\` for simpler query syntax

## Example
\`\`\`
simple-search({ 
  query: "error", 
  timeRange: "24h" 
})
\`\`\``;
  }

  // Type assertion now that we've checked the structure
  const typedData = data as {
    hits: {
      hits: Array<{
        _source?: Record<string, unknown>;
        _score?: number;
        _id?: string;
        _index?: string;
      }>;
      total: number | { value: number };
    };
    took?: number;
    aggregations?: Record<string, unknown>;
  };

  // Extract all available fields from the first result for reference
  const allFields: string[] = [];
  const firstResult = typedData.hits.hits[0];

  if (firstResult && firstResult._source) {
    Object.keys(firstResult._source).forEach((key) => {
      if (!allFields.includes(key)) {
        allFields.push(key);
      }
    });
  }

  // Build a summary header with search stats
  const totalHits =
    typeof typedData.hits.total === "object" &&
    typedData.hits.total !== null &&
    "value" in typedData.hits.total
      ? typedData.hits.total.value
      : typeof typedData.hits.total === "number"
        ? typedData.hits.total
        : 0;

  const tookMs = typedData.took || 0;

  // Get scores safely
  const scores = typedData.hits.hits.map((hit) =>
    typeof hit._score === "number" ? hit._score : 0,
  );
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  // Determine index pattern if available
  const indices = new Set<string>();
  typedData.hits.hits.forEach((hit) => {
    if (hit._index) indices.add(hit._index);
  });
  const indexPattern =
    indices.size > 0 ? Array.from(indices).join(", ") : "unknown";

  // Format the summary section with better structure
  let output = `# Search Results Summary

## Query Statistics
- **Total Matches**: ${totalHits.toLocaleString()}
- **Displayed Results**: ${typedData.hits.hits.length}
- **Search Time**: ${tookMs}ms
- **Max Score**: ${maxScore.toFixed(2)}
- **Index Pattern**: ${indexPattern}

## Available Fields
${
  allFields.length > 0
    ? allFields
        .slice(0, 10)
        .map((f) => `- ${f}`)
        .join("\n") +
      (allFields.length > 10
        ? `\n- _(${allFields.length - 10} more fields available)_`
        : "")
    : "- None found"
}

# Results\n\n`;

  // Format each hit with improved readability and structure
  typedData.hits.hits.forEach((hit, index) => {
    output += `## Result ${index + 1}\n`;

    // Add metadata section with clear formatting
    output += `**ID**: \`${hit._id || "N/A"}\`  |  **Score**: ${hit._score?.toFixed(2) || "N/A"}`;
    if (hit._index) output += `  |  **Index**: \`${hit._index}\``;
    output += "\n\n";

    // Safely handle _source
    if (hit._source) {
      // Add timestamp if it exists with improved formatting
      const timestamp = hit._source["@timestamp"];
      if (timestamp !== undefined) {
        try {
          // Try to format the timestamp in a more readable way if it's a string
          if (typeof timestamp === "string") {
            const date = new Date(timestamp);
            output += `**Time**: ${date.toISOString()} _(${date.toLocaleString()})_\n\n`;
          } else {
            // Fall back to string representation for non-string timestamps
            output += `**Time**: ${String(timestamp)}\n\n`;
          }
        } catch {
          // Fall back to original format if parsing fails
          output += `**Time**: ${String(timestamp)}\n\n`;
        }
      }

      // Add other fields with improved organization
      // First display the most important fields
      const importantFields = [
        "message",
        "level",
        "severity",
        "host",
        "source",
        "application",
        "service",
        "error",
      ];

      // Show important fields in a dedicated section
      let hasImportantFields = false;
      importantFields.forEach((field) => {
        const value = hit._source?.[field];
        if (value !== undefined) {
          if (!hasImportantFields) {
            output += `### Key Fields\n`;
            hasImportantFields = true;
          }

          // Format the value with proper line breaks and indentation for multi-line values
          let valueStr = String(value);
          if (valueStr.includes("\n")) {
            valueStr = "\n```\n" + valueStr + "\n```";
          } else if (field === "message" || field === "error") {
            // Wrap message and error fields in backticks for better readability
            valueStr = `\`${valueStr}\``;
          }

          output += `**${field.charAt(0).toUpperCase() + field.slice(1)}**: ${valueStr}\n`;
        }
      });

      if (hasImportantFields) output += "\n";

      // Then add any other fields that weren't in the important list
      const source = hit._source;
      const otherFields = Object.keys(source).filter(
        (key) => !importantFields.includes(key) && key !== "@timestamp",
      );

      if (otherFields.length > 0) {
        output += `### Additional Fields\n`;

        // Group related fields together for better organization
        const fieldGroups: Record<string, string[]> = {
          System: ["host", "hostname", "ip", "platform", "os", "container_id"],
          Application: [
            "logger",
            "thread",
            "module",
            "class",
            "method",
            "line",
          ],
          Request: [
            "request",
            "response",
            "status",
            "path",
            "method",
            "url",
            "user_agent",
          ],
          Metrics: ["duration", "bytes", "count", "size"],
          Other: [],
        };

        // Assign fields to groups
        otherFields.forEach((field) => {
          let assigned = false;
          for (const [group, fieldList] of Object.entries(fieldGroups)) {
            if (group === "Other") continue;

            // Check if field belongs to this group by doing partial matching
            if (
              fieldList.some(
                (groupField) =>
                  field.includes(groupField) ||
                  field.startsWith(groupField) ||
                  field.endsWith(groupField),
              )
            ) {
              if (!fieldGroups[group].includes(field)) {
                fieldGroups[group].push(field);
                assigned = true;
                break;
              }
            }
          }

          if (!assigned) {
            fieldGroups["Other"].push(field);
          }
        });

        // Output fields by group
        for (const [group, fieldList] of Object.entries(fieldGroups)) {
          if (fieldList.length === 0) continue;

          output += `**${group}**:\n`;
          fieldList.forEach((field) => {
            const value = source[field];
            let valueStr = String(value);

            // Format values appropriately
            if (valueStr.length > 80) {
              valueStr = valueStr.substring(0, 77) + "...";
            }

            // Handle empty values
            if (
              valueStr === "" ||
              valueStr === "undefined" ||
              valueStr === "null"
            ) {
              valueStr = "_(empty)_";
            }

            output += `- \`${field}\`: ${valueStr}\n`;
          });
          output += "\n";
        }
      }
    }
  });

  // Add pagination info with clearer formatting
  if (totalHits > typedData.hits.hits.length) {
    output += `## Pagination

Showing ${typedData.hits.hits.length} of ${totalHits.toLocaleString()} total results.

**Pagination Parameters**:
- \`from\`: Starting record offset (e.g., 10 to start at the 11th record)
- \`size\`: Number of records per page (e.g., 20 to show 20 records)

**Example**:
\`\`\`
search-logs({ 
  query: { match_all: {} },
  from: 20, 
  size: 10,
  sort: [{ "@timestamp": "desc" }]
})
\`\`\`\n`;
  }

  // Add usage tips with examples and better organization
  output += `## Search Tips

### Refining Your Search
- Add specific field filters: \`level:error AND service:api\`
- Use quotes for phrases: \`message:"connection refused"\`
- Use wildcards: \`error*\` or \`*exception\`
- Exclude terms: \`error NOT timeout\`
- Combine operators: \`(error OR warning) AND service:auth\`

### Advanced Tools
- \`field-stats({ field: "status_code" })\` - Get statistics for a specific field
- \`log-histogram({ interval: "30m" })\` - View log distribution over time
- \`analyze-errors()\` - Automatically analyze error patterns
- \`get-fields()\` - Discover all available fields\n`;

  // Add performance tips if the query was slow
  if (tookMs > 5000) {
    output += `
### Performance Optimization
- Narrow your time range to improve search speed
- Use more specific queries to reduce result set
- Consider using \`simple-search()\` for faster results
- If aggregating, try \`useSimpleAggregation: true\`\n`;
  }

  return output;
}
