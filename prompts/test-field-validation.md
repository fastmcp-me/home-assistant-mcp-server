# Field Validation Tool Testing Prompt

This prompt demonstrates how to use the newly added `validate-fields` tool to validate field values in your logs against defined rules and ensure data quality.

## Basic Field Validation Example

```json
{
  "tool": "validate-fields",
  "params": {
    "field": "email",
    "rules": [
      {
        "type": "format",
        "format": "email",
        "description": "Check if field contains valid email format"
      }
    ],
    "timeRange": "24h",
    "includeExamples": true
  }
}
```

## Field Value Range Validation Example

```json
{
  "tool": "validate-fields",
  "params": {
    "field": "status_code",
    "rules": [
      {
        "type": "range",
        "min": 200,
        "max": 599,
        "description": "HTTP status code must be between 200-599"
      }
    ],
    "timeRange": "7d",
    "includeExamples": true
  }
}
```

## Multiple Validation Rules Example

```json
{
  "tool": "validate-fields",
  "params": {
    "field": "username",
    "rules": [
      {
        "type": "length",
        "minLength": 3,
        "maxLength": 20,
        "description": "Username must be 3-20 characters"
      },
      {
        "type": "regex",
        "pattern": "^[a-zA-Z0-9_]+$",
        "description": "Username must contain only alphanumeric characters and underscores"
      }
    ],
    "timeRange": "30d",
    "failOnMissing": true
  }
}
```

## Enumeration Validation Example

```json
{
  "tool": "validate-fields",
  "params": {
    "field": "environment",
    "rules": [
      {
        "type": "enum",
        "allowedValues": ["dev", "staging", "production"],
        "description": "Environment must be one of the allowed values"
      }
    ],
    "timeRange": "7d",
    "includeExamples": true
  }
}
```

## Custom Validation Script Example

```json
{
  "tool": "validate-fields",
  "params": {
    "field": "timestamp",
    "rules": [
      {
        "type": "custom",
        "script": "doc['timestamp'].value > new Date('2023-01-01').getTime() && doc['timestamp'].value < new Date().getTime()",
        "description": "Timestamp must be from 2023 onwards and not in the future"
      }
    ],
    "timeRange": "90d",
    "includeExamples": true
  }
}
```

## Multiple Fields Validation

You can validate multiple fields in sequence:

```javascript
// First validate the email field
const emailValidation = await validateFields({
  field: "email",
  rules: [{ type: "format", format: "email" }],
});

// Then validate the user_id field
const userIdValidation = await validateFields({
  field: "user_id",
  rules: [
    { type: "length", minLength: 10, maxLength: 36 },
    { type: "regex", pattern: "^[a-f0-9-]+$" },
  ],
});

// Aggregate the results
const validationSummary = {
  email: emailValidation.summary,
  userId: userIdValidation.summary,
  overallValid:
    emailValidation.summary.valid_percentage > 95 &&
    userIdValidation.summary.valid_percentage > 95,
};
```

## Expected Response Format

The validation tool returns a structured response with:

1. Overall validation statistics
2. Detailed results for each rule
3. Example invalid values (if requested)
4. Recommendations for improving data quality

```json
{
  "field": "email",
  "total_docs": 1500,
  "docs_with_field": 1200,
  "field_coverage": 80.0,
  "valid_docs": 1150,
  "invalid_docs": 50,
  "valid_percentage": 95.83,
  "rule_results": [
    {
      "rule_type": "format",
      "description": "Valid email format",
      "valid_count": 1150,
      "invalid_count": 50,
      "valid_percentage": 95.83,
      "invalid_examples": [
        { "value": "not-an-email" },
        { "value": "missing@domain" },
        { "value": "@incomplete.com" }
      ]
    }
  ],
  "validation_status": "acceptable"
}
```

## Additional Tips

1. Use `timeRange` to limit validation to recent data or specific periods
2. Enable `includeExamples` to see examples of invalid values
3. Set `failOnMissing` to true when field presence is required
4. Combine multiple rules to enforce complex validation requirements
5. Check the `validation_status` for a quick assessment (good, acceptable, poor)
6. Use specific field names for better accuracy (e.g., "user.email" instead of just "email")

## Practical Use Cases

1. Validate email formats in user registration logs
2. Ensure HTTP status codes are in valid ranges
3. Verify that timestamps are neither missing nor in the future
4. Check that log levels conform to your standardized set
5. Validate UUIDs match the expected pattern
6. Ensure geographic coordinates are within valid ranges
7. Verify that currency codes match ISO standards
