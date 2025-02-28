import {
  Elasticsearch6SearchParams,
  ElasticsearchQueryDSL,
} from "../elasticsearch.types.js";

/**
 * Extended search parameters that include our custom dayOffset parameter
 */
export interface ExtendedSearchParams extends Elasticsearch6SearchParams {
  dayOffset?: number;
}

/**
 * Search summary information extracted from search results
 */
export interface SearchSummary {
  total_hits: number;
  took_ms: number;
  result_count: number;
  available_fields: string[];
}

/**
 * Simple search parameters
 */
export interface SimpleSearchParams {
  query: string | ElasticsearchQueryDSL;
  fields?: string[];
  timeRange?: string;
  from?: number;
  size?: number;
  sortField?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Quick search parameters
 */
export interface QuickSearchParams {
  query: string | ElasticsearchQueryDSL;
  timeRange?: string;
  maxResults?: number;
  fields?: string[];
}
