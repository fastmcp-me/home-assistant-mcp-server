// Type definitions extracted from elasticsearch schema
export type ElasticsearchQueryDSL =
  | {
      match: Record<
        string,
        | string
        | {
            query: string;
            operator?: "AND" | "OR";
          }
      >;
    }
  | {
      term: Record<
        string,
        | string
        | {
            value: string | number | boolean;
          }
      >;
    }
  | {
      bool: {
        must?: ElasticsearchQueryDSL | ElasticsearchQueryDSL[];
        filter?: ElasticsearchQueryDSL | ElasticsearchQueryDSL[];
        should?: ElasticsearchQueryDSL | ElasticsearchQueryDSL[];
        must_not?: ElasticsearchQueryDSL | ElasticsearchQueryDSL[];
      };
    }
  | Record<string, unknown>; // For any other valid query DSL object

export type ElasticsearchAggregation = Record<
  string,
  {
    terms?: {
      field: string;
      size?: number;
      order?: Record<string, string>;
      [key: string]: unknown;
    };
    date_histogram?: {
      field: string;
      interval?: string;
      fixed_interval?: string;
      calendar_interval?: string;
      format?: string;
      [key: string]: unknown;
    };
    top_hits?: {
      size: number;
      sort?: Array<Record<string, string>>;
      [key: string]: unknown;
    };
    avg?: { field: string; [key: string]: unknown };
    sum?: { field: string; [key: string]: unknown };
    min?: { field: string; [key: string]: unknown };
    max?: { field: string; [key: string]: unknown };
    stats?: { field: string; [key: string]: unknown };
    cardinality?: { field: string; [key: string]: unknown };
    filter?: Record<string, unknown>;
    filters?: {
      filters: Record<string, unknown>;
      [key: string]: unknown;
    };
    aggs?: Record<string, unknown>; // Use unknown for nested aggs to avoid circular reference issues
    aggregations?: Record<string, unknown>; // Use unknown for nested aggs
    [key: string]: unknown;
  }
>;

export type ElasticsearchHighlight = {
  fields: Record<
    string,
    {
      type?: string;
      fragment_size?: number;
      number_of_fragments?: number;
      pre_tags?: string[];
      post_tags?: string[];
      [key: string]: unknown;
    }
  >;
  pre_tags?: string[];
  post_tags?: string[];
  [key: string]: unknown;
};

export type ElasticsearchSuggest = Record<
  string,
  {
    text?: string;
    term?: {
      field: string;
      size?: number;
      [key: string]: unknown;
    };
    phrase?: {
      field: string;
      size?: number;
      [key: string]: unknown;
    };
    completion?: {
      field: string;
      size?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
>;

// Define the sort field type to match how it's used in the codebase
export type ElasticsearchSortField =
  | string
  | {
      [field: string]:
        | string
        | "asc"
        | "desc"
        | { order?: "asc" | "desc"; mode?: string; [key: string]: unknown };
    };

export type Elasticsearch6SearchParams = {
  // Query DSL and request body sections
  query?: ElasticsearchQueryDSL;
  aggs?: Record<string, ElasticsearchAggregation>;
  aggregations?: Record<string, ElasticsearchAggregation>;
  post_filter?: ElasticsearchQueryDSL;
  highlight?: ElasticsearchHighlight;
  rescore?: Record<string, unknown>;
  suggest?: ElasticsearchSuggest;
  script_fields?: Record<
    string,
    {
      script: {
        source: string;
        lang?: string;
        params?: Record<string, unknown>;
      };
    }
  >;
  collapse?: {
    field: string;
    inner_hits?: Record<string, unknown>;
    max_concurrent_group_searches?: number;
  };

  // Pagination & sorting
  from?: number;
  size?: number;
  sort?: string | ElasticsearchSortField[];
  search_after?: (string | number | boolean)[];
  timeout?: string;
  terminate_after?: number;

  // Request preferences & routing
  routing?: string;
  preference?: string;
  allow_no_indices?: boolean;
  ignore_unavailable?: boolean;
  ignore_throttled?: boolean;
  expand_wildcards?: "open" | "closed" | "none" | "all";

  // Misc search type and caching
  search_type?: "query_then_fetch" | "dfs_query_then_fetch";
  request_cache?: boolean;
  allow_partial_search_results?: boolean;
  batched_reduce_size?: number;
  ccs_minimize_roundtrips?: boolean;
  max_concurrent_shard_requests?: number;
  scroll?: string;

  // Query string search (simple query via `q` param)
  q?: string;
  df?: string;
  default_operator?: "AND" | "OR";
  analyzer?: string;
  analyze_wildcard?: boolean;
  lenient?: boolean;

  // Response filtering and control
  _source?:
    | boolean
    | string
    | string[]
    | {
        includes?: string[];
        excludes?: string[];
      };
  _source_includes?: string | string[];
  _source_excludes?: string | string[];
  stored_fields?: string | string[];
  docvalue_fields?: string | string[];
  fielddata_fields?: string | string[];
  indices_boost?: Array<Record<string, number>>;
  min_score?: number;
  track_scores?: boolean;
  track_total_hits?: boolean | number;
  explain?: boolean;
  version?: boolean;
  profile?: boolean;
  stats?: string | string[];

  // Suggesters (using URL-based suggestion parameters)
  suggest_field?: string;
  suggest_text?: string;
  suggest_mode?: "missing" | "popular" | "always";
  suggest_size?: number;
};
