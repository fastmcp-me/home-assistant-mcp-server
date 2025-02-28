import { SearchSummary } from "../../types/tools/search.types.js";

/**
 * Safely extracts field names from search results
 */
export function extractFieldNames(data: unknown): string[] {
  const fieldNames: string[] = [];

  if (
    typeof data !== "object" ||
    data === null ||
    !("hits" in data) ||
    typeof data.hits !== "object" ||
    data.hits === null
  ) {
    return fieldNames;
  }

  const hits = data.hits;

  if (!("hits" in hits) || !Array.isArray(hits.hits)) {
    return fieldNames;
  }

  // Extract fields from each hit's _source
  hits.hits.forEach((hit: Record<string, unknown>) => {
    if (
      hit &&
      typeof hit === "object" &&
      "_source" in hit &&
      typeof hit._source === "object" &&
      hit._source !== null
    ) {
      Object.keys(hit._source as Record<string, unknown>).forEach((field) => {
        if (!fieldNames.includes(field)) {
          fieldNames.push(field);
        }
      });
    }
  });

  return fieldNames.sort();
}

/**
 * Safely extracts summary information from search results
 */
export function extractSearchSummary(data: unknown): SearchSummary {
  // Default values
  const summary: SearchSummary = {
    total_hits: 0,
    took_ms: 0,
    result_count: 0,
    available_fields: [] as string[],
  };

  // Return default values if data is not an object
  if (typeof data !== "object" || data === null) {
    return summary;
  }

  // Extract total hits
  if ("hits" in data && typeof data.hits === "object" && data.hits !== null) {
    if ("total" in data.hits) {
      const total = data.hits.total;
      if (typeof total === "number") {
        summary.total_hits = total;
      } else if (
        typeof total === "object" &&
        total !== null &&
        "value" in total &&
        typeof total.value === "number"
      ) {
        summary.total_hits = total.value;
      }
    }

    // Extract result count
    if ("hits" in data.hits && Array.isArray(data.hits.hits)) {
      summary.result_count = data.hits.hits.length;
    }
  }

  // Extract took
  if ("took" in data && typeof data.took === "number") {
    summary.took_ms = data.took;
  }

  // Extract field names
  summary.available_fields = extractFieldNames(data);

  return summary;
}
