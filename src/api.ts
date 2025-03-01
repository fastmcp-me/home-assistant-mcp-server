import { response } from "express";
import type {
  HassEntity,
  HassConfig,
  HassService,
  HassDevice,
  ProcessedServiceCallResponse,
} from "./types.js";
import {
  makeHassRequest,
  apiCache,
  HassError,
  createHassError,
  TextParser,
  asJson,
} from "./utils.js";

// === API FUNCTION DEFINITIONS ===

/**
 * Get all entities from Home Assistant
 */
export async function getEntities(
  hassUrl: string,
  hassToken: string,
  domain?: string,
): Promise<HassEntity[]> {
  try {
    const states = await makeHassRequest<HassEntity[]>(
      "/states",
      hassUrl,
      hassToken,
    );

    // Filter by domain if provided
    if (domain) {
      return states.filter((entity) =>
        entity.entity_id.startsWith(`${domain}.`),
      );
    }

    return states;
  } catch (error) {
    throw error instanceof HassError
      ? error
      : createHassError(error, "/states", "GET");
  }
}

/**
 * Get states of entities
 */
export async function getStates(
  hassUrl: string,
  hassToken: string,
  entityId?: string,
): Promise<HassEntity | HassEntity[]> {
  try {
    const endpoint = entityId ? `/states/${entityId}` : "/states";
    return await makeHassRequest<HassEntity | HassEntity[]>(
      endpoint,
      hassUrl,
      hassToken,
    );
  } catch (error) {
    throw error instanceof HassError
      ? error
      : createHassError(
          error,
          entityId ? `/states/${entityId}` : "/states",
          "GET",
        );
  }
}

/**
 * Get Home Assistant configuration
 */
export async function getConfig(
  hassUrl: string,
  hassToken: string,
): Promise<HassConfig> {
  try {
    return await makeHassRequest<HassConfig>(
      "/config",
      hassUrl,
      hassToken,
      "GET",
      undefined,
      {
        parser: asJson<HassConfig>(),
      },
    );
  } catch (error) {
    throw error instanceof HassError
      ? error
      : createHassError(error, "/config", "GET");
  }
}

/**
 * Get all domains from Home Assistant
 */
export async function getAllDomains(
  hassUrl: string,
  hassToken: string,
): Promise<string[]> {
  try {
    const states = await makeHassRequest<HassEntity[]>(
      "/states",
      hassUrl,
      hassToken,
    );

    // Extract unique domains
    const domains = new Set<string>();
    states.forEach((entity) => {
      const domain = entity.entity_id.split(".")[0];
      domains.add(domain);
    });

    return Array.from(domains).sort();
  } catch (error) {
    throw error instanceof HassError
      ? error
      : createHassError(error, "/states", "GET");
  }
}

/**
 * Get all services from Home Assistant
 */
export async function getServices(
  hassUrl: string,
  hassToken: string,
  domain?: string,
): Promise<Record<string, Record<string, HassService>>> {
  try {
    const services = await makeHassRequest<
      Record<string, Record<string, HassService>>
    >("/services", hassUrl, hassToken);

    // Filter by domain if provided
    if (domain && services[domain]) {
      const filteredServices: Record<string, Record<string, HassService>> = {};
      filteredServices[domain] = services[domain];
      return filteredServices;
    }

    return services;
  } catch (error) {
    throw error instanceof HassError
      ? error
      : createHassError(error, "/services", "GET");
  }
}

/**
 * Get history for entity
 */
export async function getHistory(
  hassUrl: string,
  hassToken: string,
  entityId: string,
  startTime?: string,
  endTime?: string,
  minimalResponse?: boolean,
  significantChangesOnly?: boolean,
): Promise<HassEntity[][]> {
  try {
    // Build query parameters
    const params = new URLSearchParams();

    if (entityId) {
      params.append("filter_entity_id", entityId);
    }

    if (endTime) {
      params.append("end_time", endTime);
    }

    if (minimalResponse) {
      params.append("minimal_response", "true");
    }

    if (significantChangesOnly) {
      params.append("significant_changes_only", "true");
    }

    // Construct the endpoint URL
    // If startTime is provided, include it in the path
    let endpoint = "/history/period";
    if (startTime) {
      // URL encode the startTime if it's provided
      const encodedStartTime = encodeURIComponent(startTime);
      endpoint = `/history/period/${encodedStartTime}`;
    }

    // Append query parameters if any
    const queryString = params.toString();
    if (queryString) {
      endpoint = `${endpoint}?${queryString}`;
    }

    return await makeHassRequest<HassEntity[][]>(endpoint, hassUrl, hassToken);
  } catch (error) {
    throw error instanceof HassError
      ? error
      : createHassError(error, "/history/period", "GET");
  }
}

/**
 * Get all devices registered in Home Assistant
 */
export async function getDevices(
  hassUrl: string,
  hassToken: string,
): Promise<HassDevice[]> {
  try {
    return await makeHassRequest<HassDevice[]>("/devices", hassUrl, hassToken);
  } catch (error) {
    throw error instanceof HassError
      ? error
      : createHassError("/devices", error as string);
  }
}

/**
 * Call a Home Assistant service
 *
 * This function always returns a parsed JSON object, handling any string responses
 * that Home Assistant might return.
 *
 * @param hassUrl Home Assistant URL
 * @param hassToken Home Assistant token
 * @param domain Service domain (e.g., 'light', 'switch')
 * @param service Service name (e.g., 'turn_on')
 * @param serviceData Optional service data
 * @param target Optional target (entities, devices, areas) for the service call
 * @returns Promise with the parsed service call response as a JSON object
 */
export async function callService(
  hassUrl: string,
  hassToken: string,
  domain: string,
  service: string,
  serviceData?: Record<string, unknown>,
  target?: {
    entity_id?: string | string[];
    device_id?: string | string[];
    area_id?: string | string[];
  },
): Promise<ProcessedServiceCallResponse> {
  try {
    const endpoint = `/services/${domain}/${service}`;

    // Prepare the request body
    const data: Record<string, unknown> = {};

    // Add service data if provided
    if (serviceData && Object.keys(serviceData).length > 0) {
      // Clone to avoid modifying the original object
      const cleanedServiceData = { ...serviceData };

      // Handle special case: if entity_id is in serviceData and target is also specified,
      // remove entity_id from serviceData to avoid conflicts
      if (target && 'entity_id' in cleanedServiceData) {
        delete cleanedServiceData['entity_id'];
      }

      Object.assign(data, cleanedServiceData);
    }

    // Add target if provided
    if (target && Object.keys(target).length > 0) {
      // For compatibility with older Home Assistant versions
      // If target contains entity_id, also put it directly in the service data
      if (target.entity_id) {
        data["entity_id"] = target.entity_id;
      }

      // Still include the full target object for newer versions
      data["target"] = target;
    }

    // Invalidate cache on service calls
    apiCache.handleServiceCall(domain, service);

    // Get the response from Home Assistant
    const response = await makeHassRequest<unknown>(
      endpoint,
      hassUrl,
      hassToken,
      "POST",
      data,
    );

    // Ensure we always return a JSON object
    if (typeof response === "string") {
      try {
        const parsed = JSON.parse(response);
        if (parsed) {
          // Try to parse the response as JSON
          if (typeof parsed === "object" && parsed !== null) {
            if (!parsed.context) {
              // Add a default context if missing
              parsed.context = {
                id: `generated-${Date.now()}`,
              };
            }
            return parsed as ProcessedServiceCallResponse;
          } else {
            // Convert primitive values to an object
            return {
              context: { id: `generated-${Date.now()}` },
              message: String(parsed),
              raw_response: response,
            };
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_unused) {
        // Ignore parsing error and return structured response
        // If it can't be parsed as JSON, return it as a structured object
        return {
          context: { id: `generated-${Date.now()}` },
          message: response,
          raw_response: response,
        };
      }
    }

    // For object responses, ensure they have the required structure
    if (typeof response === "object" && response !== null) {
      const objResponse = response as Record<string, unknown>;
      if (!objResponse["context"]) {
        // Add a default context if missing
        objResponse["context"] = {
          id: `generated-${Date.now()}`,
        };
      }
      return objResponse as ProcessedServiceCallResponse;
    }

    // For any other case, convert to a structured object
    return {
      context: { id: `generated-${Date.now()}` },
      message: String(response),
      raw_response: String(response),
    };
  } catch (error) {
    throw error instanceof HassError
      ? error
      : createHassError(error, `/services/${domain}/${service}`, "POST");
  }
}

/**
 * Get error log from Home Assistant
 */
export async function getErrorLog(
  hassUrl: string,
  hassToken: string,
  limit?: number,
): Promise<string> {
  console.error("getErrorLog: Initiating request to Home Assistant error log");
  try {
    // Use TextParser to ensure we get text response
    const response = await makeHassRequest<string>(
      "/error_log",
      hassUrl,
      hassToken,
      "GET",
      undefined,
      {
        cacheOptions: {
          ttl: 10000, // Short TTL as logs change frequently
          bypassCache: true, // Always fetch fresh logs
        },
        parser: new TextParser(), // Explicitly use text parser
      },
    );

    console.error(`getErrorLog: Received response of type: ${typeof response}`);

    // Handle case where response is null or undefined (should not happen with TextParser)
    if (response === null || response === undefined) {
      console.error("getErrorLog: Response is null or undefined");
      return "No logs available";
    }

    // Response should always be a string with TextParser
    console.error(
      `getErrorLog: Response is a string (length: ${response.length})`,
    );

    // If limit is specified, return only the specified number of lines
    const lines = response.split("\n");
    const limitedLines = lines.slice(0, limit ?? 20);
    return limitedLines.join("\n");
  } catch (error) {
    console.error(`getErrorLog: Error fetching logs:`, error);
    return (error instanceof HassError).toString();
  }
}
