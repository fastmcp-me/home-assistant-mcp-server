import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { Elasticsearch6SearchParams } from "../../types/elasticsearch.types.js";
import { buildTimeRange } from "../../utils/time.js";
import { EsResponse } from "../../types/elasticsearch.js";

/**
 * Register log resources for the MCP server
 * This implements structured resource access to log data following MCP protocol standards
 */
export function registerLogResources(server: McpServer, client: LogzioClient) {
  // Register a resource for accessing service logs through a standardized URI
  server.resource(
    "service-logs",
    "logs://service/{serviceName}",
    async (uri, extra) => {
      // Extract the service name from the URI path parameters
      const pathParts = uri.pathname.split("/");
      const serviceName = pathParts[pathParts.length - 1];

      if (!serviceName) {
        return {
          isError: true,
          contents: [
            {
              uri: uri.href,
              text: "Error: Service name is required in the URI",
            },
          ],
        };
      }

      // Extract query parameters
      const queryParams = Object.fromEntries(uri.searchParams);
      const timeRange = queryParams.timeRange || "24h";
      const limit = parseInt(queryParams.limit || "100", 10);
      const query = queryParams.query || "";

      try {
        // Build Elasticsearch query to filter by service name
        const serviceQuery: Record<string, unknown> = {
          bool: {
            must: [
              {
                bool: {
                  should: [
                    { term: { service: serviceName } },
                    { term: { "service.keyword": serviceName } },

                    // Alternative field names for service identification
                    { term: { serviceName: serviceName } },
                    { term: { "serviceName.keyword": serviceName } },
                    { term: { service_name: serviceName } },
                    { term: { "service_name.keyword": serviceName } },
                    { term: { app: serviceName } },
                    { term: { "app.keyword": serviceName } },
                    { term: { application: serviceName } },
                    { term: { "application.keyword": serviceName } },
                  ],
                  minimum_should_match: 1,
                },
              },
            ],
            filter: buildTimeRange(timeRange),
          },
        };

        // Add any additional query constraints if specified
        if (query) {
          const boolQuery = serviceQuery.bool as Record<string, unknown>;
          const mustArray = boolQuery.must as Array<Record<string, unknown>>;
          mustArray.push({
            query_string: {
              query,
              default_operator: "AND",
            },
          });
        }

        // Construct search parameters
        const searchParams = {
          query: serviceQuery,
          size: limit,
          sort: [{ "@timestamp": { order: "desc" } }],
        };

        // Execute search
        const response = await client.search(
          searchParams as unknown as Elasticsearch6SearchParams,
        );

        // Type cast the response to EsResponse
        const esResponse = response as unknown as EsResponse;

        // Format the logs as a resource with relevant metadata
        const totalResults = esResponse.hits.total.value || 0;
        const logs = esResponse.hits.hits.map((hit) => hit._source || {});

        // Create links for pagination if needed
        const links = [];
        if (totalResults > limit) {
          // Add a next page link
          const nextUri = new URL(uri.href);
          nextUri.searchParams.set("offset", String(limit));
          links.push({ rel: "next", href: nextUri.href });
        }

        // Format the response to follow resource standards
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(
                {
                  service: serviceName,
                  timeRange,
                  totalResults,
                  logs,
                  _links: links,
                },
                null,
                2,
              ),
              mimeType: "application/json",
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          contents: [
            {
              uri: uri.href,
              text: `Error accessing logs for service ${serviceName}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );

  // Register a resource for accessing error logs through a standardized URI
  server.resource("error-logs", "logs://errors/{level}", async (uri, extra) => {
    // Extract error level from URI path parameters
    const pathParts = uri.pathname.split("/");
    const errorLevel = pathParts[pathParts.length - 1] || "error";

    // Extract query parameters
    const queryParams = Object.fromEntries(uri.searchParams);
    const timeRange = queryParams.timeRange || "24h";
    const limit = parseInt(queryParams.limit || "100", 10);
    const service = queryParams.service || "";

    try {
      // Build Elasticsearch query to filter by error level
      const errorQuery: Record<string, unknown> = {
        bool: {
          must: [
            {
              bool: {
                should: [
                  // Try multiple variations of level fields and values for better matching
                  { term: { level: errorLevel } },
                  { term: { "level.keyword": errorLevel } },
                  { term: { level: errorLevel.toUpperCase() } },
                  { term: { "level.keyword": errorLevel.toUpperCase() } },
                  { term: { severity: errorLevel } },
                  { term: { "severity.keyword": errorLevel } },
                  { term: { log_level: errorLevel } },
                  { term: { "log_level.keyword": errorLevel } },
                ],
                minimum_should_match: 1,
              },
            },
          ],
          filter: buildTimeRange(timeRange),
        },
      };

      // Add service filter if specified
      if (service) {
        const boolQuery = errorQuery.bool as Record<string, unknown>;
        const mustArray = boolQuery.must as Array<Record<string, unknown>>;
        mustArray.push({
          bool: {
            should: [
              { term: { service: service } },
              { term: { "service.keyword": service } },
              { term: { serviceName: service } },
              { term: { "serviceName.keyword": service } },
            ],
            minimum_should_match: 1,
          },
        });
      }

      // Construct search parameters
      const searchParams = {
        query: errorQuery,
        size: limit,
        sort: [{ "@timestamp": { order: "desc" } }],
      };

      // Execute search
      const response = await client.search(
        searchParams as unknown as Elasticsearch6SearchParams,
      );

      // Type cast the response to EsResponse
      const esResponse = response as unknown as EsResponse;

      // Format the logs as a resource with relevant metadata
      const totalResults = esResponse.hits.total.value || 0;
      const logs = esResponse.hits.hits.map((hit) => hit._source || {});

      // Create links for pagination and related resources
      const links = [];

      // Add pagination links if needed
      if (totalResults > limit) {
        const nextUri = new URL(uri.href);
        nextUri.searchParams.set("offset", String(limit));
        links.push({ rel: "next", href: nextUri.href });
      }

      // Add related resource links
      if (service) {
        // Link to the service logs
        const serviceUri = new URL(`logs://service/${service}`, uri.origin);
        serviceUri.searchParams.set("timeRange", timeRange);
        links.push({ rel: "service", href: serviceUri.href });
      }

      // Format the response
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(
              {
                errorLevel,
                service: service || "all",
                timeRange,
                totalResults,
                logs,
                _links: links,
              },
              null,
              2,
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        contents: [
          {
            uri: uri.href,
            text: `Error accessing ${errorLevel} logs: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  });

  // Register a resource for accessing logs within a specific time range
  server.resource(
    "timeframe-logs",
    "logs://timeframe/{timeRange}",
    async (uri, extra) => {
      // Extract timeRange from URI path parameters
      const pathParts = uri.pathname.split("/");
      const timeRange = pathParts[pathParts.length - 1] || "24h";

      // Extract query parameters
      const queryParams = Object.fromEntries(uri.searchParams);
      const limit = parseInt(queryParams.limit || "100", 10);
      const query = queryParams.query || "";
      const fields = queryParams.fields ? queryParams.fields.split(",") : [];

      try {
        // Build Elasticsearch query
        const timeQuery: Record<string, unknown> = {
          bool: {
            filter: buildTimeRange(timeRange),
          },
        };

        // Add text query if specified
        if (query) {
          const boolQuery = timeQuery.bool as Record<string, unknown>;
          boolQuery.must = {
            query_string: {
              query,
              default_operator: "AND",
            },
          };
        }

        // Construct search parameters
        const searchParams: Record<string, unknown> = {
          query: timeQuery,
          size: limit,
          sort: [{ "@timestamp": { order: "desc" } }],
        };

        // Add field selection if specified
        if (fields.length > 0) {
          searchParams._source = fields;
        }

        // Execute search
        const response = await client.search(
          searchParams as unknown as Elasticsearch6SearchParams,
        );

        // Type cast the response to EsResponse
        const esResponse = response as unknown as EsResponse;

        // Format the logs
        const totalResults = esResponse.hits.total.value || 0;
        const logs = esResponse.hits.hits.map((hit) => hit._source || {});

        // Create links for pagination and related resources
        const links = [];

        // Add pagination links if needed
        if (totalResults > limit) {
          const nextUri = new URL(uri.href);
          nextUri.searchParams.set("offset", String(limit));
          links.push({ rel: "next", href: nextUri.href });
        }

        // Format the response
        return {
          contents: [
            {
              uri: uri.href,
              text: JSON.stringify(
                {
                  timeRange,
                  query: query || "all logs",
                  totalResults,
                  logs,
                  _links: links,
                },
                null,
                2,
              ),
              mimeType: "application/json",
            },
          ],
        };
      } catch (error) {
        return {
          isError: true,
          contents: [
            {
              uri: uri.href,
              text: `Error accessing logs for timeframe ${timeRange}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        };
      }
    },
  );

  // Register a resource for discovering available services
  server.resource("discover-services", "logs://services", async (uri) => {
    // Extract query parameters
    const queryParams = Object.fromEntries(uri.searchParams);
    const timeRange = queryParams.timeRange || "7d"; // Default to last 7 days for service discovery

    try {
      // Aggregate logs by service name to find all available services
      const searchParams: Record<string, unknown> = {
        size: 0, // No documents, just aggregations
        query: {
          bool: {
            filter: buildTimeRange(timeRange),
          },
        },
        aggs: {
          services: {
            terms: {
              field: "service.keyword",
              size: 100, // Get up to 100 services
              order: { _count: "desc" },
            },
          },
          // Try alternative service name fields
          alt_services1: {
            terms: {
              field: "serviceName.keyword",
              size: 100,
              order: { _count: "desc" },
            },
          },
          alt_services2: {
            terms: {
              field: "service_name.keyword",
              size: 100,
              order: { _count: "desc" },
            },
          },
        },
      };

      // Execute search
      const response = await client.search(
        searchParams as unknown as Elasticsearch6SearchParams,
      );

      // Type cast the response to get proper type information
      const esResponse = response as unknown as EsResponse;

      // Extract services from all aggregations and deduplicate
      const allServices = new Set<string>();

      // Access aggregations safely
      const aggregations = esResponse.aggregations || {};

      // Process primary service field
      const serviceBuckets = (aggregations.services as any)?.buckets || [];
      serviceBuckets.forEach((bucket: any) => {
        if (typeof bucket.key === "string" && bucket.key) {
          allServices.add(bucket.key);
        }
      });

      // Process alternative service fields
      const altBuckets1 = (aggregations as any)?.alt_services1?.buckets || [];
      altBuckets1.forEach((bucket: any) => {
        if (typeof bucket.key === "string" && bucket.key) {
          allServices.add(bucket.key);
        }
      });

      const altBuckets2 = (aggregations as any)?.alt_services2?.buckets || [];
      altBuckets2.forEach((bucket: any) => {
        if (typeof bucket.key === "string" && bucket.key) {
          allServices.add(bucket.key);
        }
      });

      // Convert to array and create service resources
      const serviceResources = Array.from(allServices).map((service) => {
        const serviceUri = new URL(`logs://service/${service}`, uri.origin);
        return {
          name: service,
          uri: serviceUri.href,
          logCount:
            serviceBuckets.find((b) => b.key === service)?.doc_count ||
            altBuckets1.find((b) => b.key === service)?.doc_count ||
            altBuckets2.find((b) => b.key === service)?.doc_count ||
            0,
        };
      });

      // Sort by log count (descending)
      serviceResources.sort((a, b) => b.logCount - a.logCount);

      // Format the response
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(
              {
                timeRange,
                totalServices: serviceResources.length,
                services: serviceResources,
              },
              null,
              2,
            ),
            mimeType: "application/json",
          },
        ],
      };
    } catch (error) {
      return {
        isError: true,
        contents: [
          {
            uri: uri.href,
            text: `Error discovering services: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  });
}
