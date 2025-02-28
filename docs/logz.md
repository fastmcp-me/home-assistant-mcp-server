# [Search logs](https://api-docs.logz.io/docs/logz/search)

- **Method:** POST
- **Endpoint:** `/v1/search`

## Request

- **Content-Type:** application/json

### Body

- **query:** object (required)
  - Accepts any parameters from the [Elasticsearch Search API DSL](https://www.elastic.co) with the following exceptions:
    - When using `query_string`, `allow_leading_wildcard` must be set to `false`
    - `wildcard` cannot start with `*` or `?`
    - Cannot contain `fuzzy_max_expansions`, `max_expansions`, or `max_determinized_states`
- **dayOffset:** integer
  - Adjusts the default 2-calendar-day UTC window (today and yesterday)
- **from:** integer
  - Specifies the starting point of the results (first result returned)
- **size:** integer
  - Possible values: `<= 10,000`
  - Default: `10`
  - Number of results to return
- **sort:** object[]
  - Limitations:
    - Cannot sort or aggregate on analyzed fields (e.g., `message`)
- **\_source:** object
  - Contains `includes` (array of fields to return)
    - If omitted, all fields are returned
    - Passing `'_source': false` excludes the `_source` field
- **post_filter:** object
  - Filter applied after aggregations are calculated (useful for multiple outputs)
- **docvalue_fields:** string[]
  - Allows lookup of search terms in a unique sorted list by `@timestamp`
- **version:** boolean
  - Returns a version for each result
- **stored_fields:** string[]
  - Useful for querying fields not in `_source` or for large documents
- **highlight:** object
  - Highlights strings in one or more fields in the results
- **aggregations:** object
  - Applies field aggregations with these limitations:
    - With `size`, value must be ≤ `1000`
    - Cannot nest 2 or more bucket aggregations of types: `date_histogram`, `geohash_grid`, `histogram`, `ip_ranges`, `significant_terms`, `terms`
    - Cannot sort or aggregate on analyzed fields (e.g., `message`)
    - Aggregation types `significant_terms` and `multi_terms` cannot be used
    - Note: Can use `aggs` or `aggregations` as the field name

## Responses

- **200 OK**
  - Returns a JSON object
  - `hits` indicates the total number of matching logs (limited to a 0-2 day range)
  - `total` contains the actual logs returned (not limited by the time range)

## Additional Links

- [Blog](https://logz.io)
- [Videos](https://logz.io)
- [Notices for 3rd Party Software](https://dytvr9ot2sszz.cloudfront.net)
- [Report a security issue](https://docs.logz.io)

## Legal

- [Privacy Policy](https://logz.io)
- [Terms of Use](https://logz.io)
- [Sending Data to Logz.io](https://docs.logz.io)
- [Trademark Legal Notice](https://logz.io)
- [Contributers](https://docs.logz.io)

## Social

- [Facebook](https://www.facebook.com)
- [Twitter](https://twitter.com)
- [YouTube](https://www.youtube.com)
- [LinkedIn](https://www.linkedin.com)
- [GitHub](https://github.com)

- **Copyright © 2025 Logshero Ltd.**
