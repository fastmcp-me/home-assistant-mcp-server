#!/bin/bash

# Load environment variables from .env file if it exists
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Check if API key is available
if [ -z "$LOGZIO_API_KEY" ]; then
  echo "Error: LOGZIO_API_KEY environment variable is required"
  exit 1
fi

# Determine the API endpoint based on region
REGION=${LOGZIO_REGION:-"eu"}
API_ENDPOINT="https://api-${REGION}.logz.io/v1/search"

curl -L -X POST "${API_ENDPOINT}" \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H "X-API-TOKEN: ${LOGZIO_API_KEY}" \
--data-raw '{
  "query": {
    "bool": {
      "must": [
        {
          "range": {
            "@timestamp": {
              "gte": "now-5m",
              "lte": "now"
            }
          }
        }
      ]
    }
  },
  "from": 0,
  "size": 10,
  "sort": [
    {}
  ],
  "_source": false,
  "post_filter": null,
  "docvalue_fields": [
    "@timestamp"
  ],
  "version": true,
  "stored_fields": [
    "*"
  ],
  "highlight": {},
  "aggregations": {
    "byType": {
      "terms": {
        "field": "type",
        "size": 5
      }
    }
  }
}'
