import { FieldStats } from "../../types/tools/fields.types.js";
import { ElasticsearchQueryDSL } from "../../types/elasticsearch.types.js";
import { buildTimeRange } from "../time.js";

/**
 * Formats field statistics into a readable string
 */
export function formatFieldStats(stats: FieldStats): string {
  let output = `## Field Statistics: "${stats.field}" (${stats.type})\n\n`;

  output += `- Documents with field: ${stats.doc_count.toLocaleString()} (${(stats.coverage * 100).toFixed(2)}% of total)\n`;
  output += `- Total documents: ${stats.total_docs.toLocaleString()}\n`;
  output += `- Unique values: ${stats.unique_values.toLocaleString()}\n\n`;

  if (stats.numeric_stats) {
    output += "### Numeric Statistics\n";
    if (stats.numeric_stats.min !== undefined)
      output += `- Minimum: ${stats.numeric_stats.min}\n`;
    if (stats.numeric_stats.max !== undefined)
      output += `- Maximum: ${stats.numeric_stats.max}\n`;
    if (stats.numeric_stats.avg !== undefined)
      output += `- Average: ${stats.numeric_stats.avg.toFixed(2)}\n`;
    if (stats.numeric_stats.sum !== undefined)
      output += `- Sum: ${stats.numeric_stats.sum.toLocaleString()}\n`;
    output += "\n";
  }

  if (stats.length_stats) {
    output += "### String Length Statistics\n";
    if (stats.length_stats.min_length !== undefined)
      output += `- Min length: ${stats.length_stats.min_length}\n`;
    if (stats.length_stats.max_length !== undefined)
      output += `- Max length: ${stats.length_stats.max_length}\n`;
    if (stats.length_stats.avg_length !== undefined)
      output += `- Average length: ${stats.length_stats.avg_length.toFixed(2)}\n`;
    output += "\n";
  }

  if (stats.top_values && stats.top_values.length > 0) {
    output += "### Top Values\n";
    stats.top_values.forEach(({ value, count, percentage }) => {
      output += `- "${value}": ${count.toLocaleString()} (${(percentage * 100).toFixed(2)}%)\n`;
    });
  }

  return output;
}

/**
 * Creates a query for field statistics
 */
export function createFieldStatsQuery(
  field: string,
  timeRange?: string,
  query?: string,
): {
  query: ElasticsearchQueryDSL;
  aggs: Record<string, any>;
} {
  // Base query
  let baseQuery: ElasticsearchQueryDSL = { match_all: {} };

  // Add user query if provided
  if (query) {
    baseQuery = {
      query_string: {
        query,
        default_operator: "AND",
      },
    };
  }

  // Add time range if specified
  let fullQuery: ElasticsearchQueryDSL;
  if (timeRange) {
    fullQuery = {
      bool: {
        must: baseQuery,
        filter: buildTimeRange(timeRange),
      },
    };
  } else {
    fullQuery = baseQuery;
  }

  // Determine field type for appropriate aggregations
  // We'll use a dynamic field path to handle nested fields and keyword fields
  const valueFieldPath = `${field}`;
  const keywordFieldPath = `${field}.keyword`;

  // General aggregations that work for all field types
  const aggs: Record<string, any> = {
    field_count: {
      // Count of documents where the field exists
      filter: {
        exists: {
          field: field,
        },
      },
    },
    cardinality: {
      // Approximate count of unique values
      cardinality: {
        field: field,
      },
    },
  };

  // Add terms aggregation for top values (works best with keyword fields)
  aggs.top_values = {
    terms: {
      field: keywordFieldPath,
      size: 10,
      order: {
        _count: "desc",
      },
    },
  };

  // Add numeric stats (will only work with numeric fields)
  aggs.numeric_stats = {
    stats: {
      field: field,
    },
  };

  // Add string length stats through scripting
  aggs.length_stats = {
    stats: {
      script: {
        source: `doc['${keywordFieldPath}'].size() > 0 ? doc['${keywordFieldPath}'].value.length() : 0`,
      },
    },
  };

  return {
    query: fullQuery,
    aggs,
  };
}

/**
 * Processes Elasticsearch response into field statistics
 */
export function processFieldStatsResponse(
  response: Record<string, any>,
  field: string,
): FieldStats {
  const aggregations = response.aggregations || {};
  const hits = response.hits || { total: 0 };
  const totalDocs =
    typeof hits.total === "number"
      ? hits.total
      : hits.total && typeof hits.total.value === "number"
        ? hits.total.value
        : 0;

  // Doc count is the number of documents containing this field
  const docCount = aggregations.field_count?.doc_count || 0;

  // Calculate field coverage percentage
  const coverage = totalDocs > 0 ? docCount / totalDocs : 0;

  // Get field type (best guess based on aggregation results)
  const fieldType = determineFieldType(aggregations);

  // Get cardinality (unique values)
  const uniqueValues = aggregations.cardinality?.value || 0;

  // Prepare result
  const result: FieldStats = {
    field,
    type: fieldType,
    doc_count: docCount,
    coverage,
    total_docs: totalDocs,
    unique_values: uniqueValues,
  };

  // Process top values if available
  if (aggregations.top_values?.buckets?.length > 0) {
    result.top_values = aggregations.top_values.buckets.map((bucket: any) => ({
      value: bucket.key,
      count: bucket.doc_count,
      percentage: docCount > 0 ? bucket.doc_count / docCount : 0,
    }));
  }

  // Process numeric stats if available and field is numeric
  if (fieldType === "number" && aggregations.numeric_stats?.avg !== undefined) {
    result.numeric_stats = {
      min: aggregations.numeric_stats.min,
      max: aggregations.numeric_stats.max,
      avg: aggregations.numeric_stats.avg,
      sum: aggregations.numeric_stats.sum,
    };
  }

  // Process string length stats if available and field is string
  if (fieldType === "text" || fieldType === "keyword") {
    // Check if we have meaningful length stats
    const lengthStats = aggregations.length_stats;
    if (lengthStats?.avg > 0) {
      result.length_stats = {
        min_length: lengthStats.min,
        max_length: lengthStats.max,
        avg_length: lengthStats.avg,
      };
    }
  }

  return result;
}

/**
 * Determines field type based on aggregation results
 */
function determineFieldType(aggregations: Record<string, any>): string {
  // Check if we have numeric stats that make sense
  if (
    aggregations.numeric_stats?.count > 0 &&
    aggregations.numeric_stats?.avg !== undefined
  ) {
    return "number";
  }

  // Check if we have string length stats that make sense
  if (
    aggregations.length_stats?.count > 0 &&
    aggregations.length_stats?.avg > 0
  ) {
    if (aggregations.top_values?.buckets?.length > 0) {
      return "keyword";
    }
    return "text";
  }

  // Check if we have term buckets
  if (aggregations.top_values?.buckets?.length > 0) {
    // Look at the first value to determine the type
    const firstValue = aggregations.top_values.buckets[0]?.key;
    if (typeof firstValue === "boolean") return "boolean";
    if (typeof firstValue === "number") return "number";
    return "keyword";
  }

  return "unknown";
}
