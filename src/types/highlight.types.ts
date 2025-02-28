// Type definitions extracted from highlight schema
export type HighlightField = {
  fragment_size?: number;
  number_of_fragments?: number;
};

export type Highlight = {
  pre_tags?: string[];
  post_tags?: string[];
  fields?: Record<string, HighlightField | undefined>;
};
