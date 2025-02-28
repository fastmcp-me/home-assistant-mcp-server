/**
 * Field statistics parameters
 */
export interface FieldStatsParams {
  /** Field to analyze - required */
  field: string;

  /** Optional index pattern (e.g., logstash-*) */
  index?: string;

  /** Optional time range (e.g., 24h, 7d) */
  timeRange?: string;

  /** Optional maximum number of values to return for cardinality stats */
  maxValues?: number;

  /** Optional query to filter logs before calculating statistics */
  query?: string;
}

/**
 * Field statistics response
 */
export interface FieldStats {
  /** Field name that was analyzed */
  field: string;

  /** Field type (text, keyword, number, etc.) */
  type: string;

  /** Count of documents containing this field */
  doc_count: number;

  /** Percentage of documents containing this field */
  coverage: number;

  /** Total number of documents in the dataset */
  total_docs: number;

  /** Number of unique values (cardinality) */
  unique_values: number;

  /** Top values with counts (if applicable) */
  top_values?: Array<{
    value: string | number | boolean;
    count: number;
    percentage: number;
  }>;

  /** Numeric statistics (if applicable) */
  numeric_stats?: {
    min?: number;
    max?: number;
    avg?: number;
    sum?: number;
  };

  /** Value length statistics (if applicable for strings) */
  length_stats?: {
    min_length?: number;
    max_length?: number;
    avg_length?: number;
  };
}

/**
 * Parameters for the discover-fields tool
 */
export interface DiscoverFieldsParams {
  /** Optional index pattern (e.g., logstash-*) */
  index?: string;

  /** Optional time range (e.g., 24h, 7d) */
  timeRange?: string;

  /** Optional query to filter logs before analyzing */
  query?: string;

  /** Optional number of sample documents to analyze */
  sampleSize?: number;

  /** Optional value to include field examples in the output */
  includeExamples?: boolean;
}

/**
 * Field information returned by the discover-fields tool
 */
export interface FieldInfo {
  /** Field name */
  name: string;

  /** Field type (text, keyword, number, etc.) */
  type: string;

  /** Percentage of documents containing this field */
  coverage: number;

  /** Sample values if examples requested */
  examples?: Array<string | number | boolean>;

  /** Path for nested fields */
  path?: string;

  /** Whether field is analyzed (for text fields) */
  analyzed?: boolean;

  /** Whether field is a keyword (exact match) */
  isKeyword?: boolean;
}

/**
 * Parameters for the field-relations tool
 */
export interface FieldRelationsParams {
  /** Array of fields to analyze for relationships (2-5 fields) */
  fields: string[];

  /** Optional index pattern (e.g., logstash-*) */
  index?: string;

  /** Optional time range (e.g., 24h, 7d) */
  timeRange?: string;

  /** Optional query to filter logs before analyzing */
  query?: string;

  /** Maximum number of documents to analyze */
  sampleSize?: number;

  /** Include example value pairs in the results */
  includeExamples?: boolean;

  /** Minimum correlation score to include in results (0-1) */
  minCorrelation?: number;
}

/**
 * Field relationship information returned by the field-relations tool
 */
export interface FieldRelationship {
  /** The first field in the relationship */
  fieldA: string;

  /** The second field in the relationship */
  fieldB: string;

  /** Count of documents where both fields co-occur */
  cooccurrenceCount: number;

  /** Correlation score (0-1) indicating relationship strength */
  correlationScore: number;

  /** Sample values showing common combinations */
  sampleValues?: Array<{
    valueA: string | number | boolean;
    valueB: string | number | boolean;
    count: number;
  }>;
}

/**
 * Parameters for field validation
 */
export interface FieldValidationParams {
  /** Field to validate */
  field: string;

  /** Validation rules for the field */
  rules: ValidationRule[];

  /** Optional index pattern (e.g., logstash-*) */
  index?: string;

  /** Optional time range (e.g., 24h, 7d) */
  timeRange?: string;

  /** Optional query to filter logs before validation */
  query?: string;

  /** Maximum number of documents to validate */
  sampleSize?: number;

  /** Whether to return examples of invalid values */
  includeExamples?: boolean;

  /** Whether to treat missing fields as validation failures */
  failOnMissing?: boolean;
}

/**
 * Validation rule for field validation
 */
export interface ValidationRule {
  /** Type of validation rule */
  type: "regex" | "range" | "enum" | "length" | "format" | "custom";

  /** Pattern for regex validation */
  pattern?: string;

  /** Minimum value for range validation */
  min?: number;

  /** Maximum value for range validation */
  max?: number;

  /** Allowed values for enum validation */
  allowedValues?: Array<string | number | boolean>;

  /** Minimum length for string length validation */
  minLength?: number;

  /** Maximum length for string length validation */
  maxLength?: number;

  /** Format validation (email, url, ip, date, etc.) */
  format?: string;

  /** Custom validation expression (Elasticsearch script) */
  script?: string;

  /** Description of this validation rule */
  description?: string;
}

/**
 * Result of field validation
 */
export interface ValidationResult {
  /** Field name that was validated */
  field: string;

  /** Total documents that were validated */
  total_docs: number;

  /** Number of documents containing this field */
  docs_with_field: number;

  /** Percentage of documents containing the field */
  field_coverage: number;

  /** Number of documents that passed validation */
  valid_docs: number;

  /** Number of documents that failed validation */
  invalid_docs: number;

  /** Percentage of documents with field that passed validation */
  valid_percentage: number;

  /** Detailed results for each validation rule */
  rule_results: Array<{
    /** Type of validation rule */
    rule_type: string;

    /** Description of validation rule */
    description: string;

    /** Number of documents that passed this rule */
    valid_count: number;

    /** Number of documents that failed this rule */
    invalid_count: number;

    /** Percentage of documents that passed this rule */
    valid_percentage: number;

    /** Sample invalid values if examples were requested */
    invalid_examples?: Array<{
      value: string | number | boolean;
      document_id?: string;
    }>;
  }>;
}
