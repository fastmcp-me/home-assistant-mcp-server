import { ElasticsearchQueryDSL } from "./elasticsearch.types.js";

// Type definitions extracted from query schema
export type SortOrder = "asc" | "desc";

export type Sort = Array<
  | {
      field: string;
      order?: SortOrder;
    }
  | Record<string, SortOrder>
>;

export type QueryString = {
  query: string;
  allow_leading_wildcard?: false;
  analyze_wildcard?: boolean;
  analyzer?: string;
  auto_generate_synonyms_phrase_query?: boolean;
  default_field?: string;
  default_operator?: "AND" | "OR";
  enable_position_increments?: boolean;
  fields?: string[];
  fuzziness?: string | number;
  lenient?: boolean;
  minimum_should_match?: string | number;
  quote_analyzer?: string;
  phrase_slop?: number;
  quote_field_suffix?: string;
  time_zone?: string;
  type?:
    | "best_fields"
    | "most_fields"
    | "cross_fields"
    | "phrase"
    | "phrase_prefix";
};

export type Range = Record<
  string,
  {
    gt?: string | number | boolean;
    gte?: string | number | boolean;
    lt?: string | number | boolean;
    lte?: string | number | boolean;
    format?: string;
    relation?: "INTERSECTS" | "CONTAINS" | "WITHIN";
    time_zone?: string;
    boost?: number;
  }
>;

export type Term = Record<
  string,
  | {
      value: string | number | boolean;
      boost?: number;
    }
  | string
  | number
  | boolean
>;

export type Terms = Record<string, Array<string | number | boolean>>;

export type Match = Record<
  string,
  | {
      query: string | number | boolean;
      operator?: "AND" | "OR";
      minimum_should_match?: string | number;
      analyzer?: string;
      boost?: number;
    }
  | string
  | number
  | boolean
>;

export type BoolQuery = {
  must?: ElasticsearchQueryDSL | ElasticsearchQueryDSL[];
  must_not?: ElasticsearchQueryDSL | ElasticsearchQueryDSL[];
  should?: ElasticsearchQueryDSL | ElasticsearchQueryDSL[];
  filter?: ElasticsearchQueryDSL | ElasticsearchQueryDSL[];
  minimum_should_match?: number | string;
  boost?: number;
};

export type QueryClause = ElasticsearchQueryDSL;

export type SourceField =
  | boolean
  | string
  | string[]
  | {
      includes?: string[];
      excludes?: string[];
    };

export type SearchRequest = {
  query?: ElasticsearchQueryDSL;
  dayOffset?: number;
  from?: number;
  size?: number;
  sort?: Sort;
  _source?: SourceField;
  post_filter?: ElasticsearchQueryDSL;
  docvalue_fields?: string[];
  version?: boolean;
  stored_fields?: string[];
  highlight?: Record<string, unknown>; // Will be imported from highlight.types.ts
  aggregations?: Record<string, unknown>; // Will be imported from aggregation.types.ts
  aggs?: Record<string, unknown>; // Will be imported from aggregation.types.ts
};
