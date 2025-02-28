import {
  HassEntity,
  HassConfig,
  HassService,
  HassDevice,
  ServiceCallResponse,
} from "./types.js";
import {
  makeHassRequest,
  apiCache,
  HassError,
  createHassError,
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
    return await makeHassRequest<HassConfig>("/config", hassUrl, hassToken);
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

    if (startTime) {
      params.append("start_time", startTime);
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

    const queryString = params.toString();
    const endpoint = `/history/period${queryString ? `?${queryString}` : ""}`;

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
      : createHassError("/devices", error);
  }
}

/**
 * Call a Home Assistant service
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
): Promise<ServiceCallResponse> {
  try {
    const endpoint = `/services/${domain}/${service}`;

    // Prepare the request body
    const data: Record<string, unknown> = {};

    // Add service data if provided
    if (serviceData && Object.keys(serviceData).length > 0) {
      Object.assign(data, serviceData);
    }

    // Add target if provided
    if (target && Object.keys(target).length > 0) {
      data.target = target;
    }

    // Invalidate cache on service calls
    apiCache.handleServiceCall(domain, service);

    return await makeHassRequest<ServiceCallResponse>(
      endpoint,
      hassUrl,
      hassToken,
      "POST",
      data,
    );
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
  hassToken: string
): Promise<string> {
  try {
    // Use makeHassRequest with explicit handling for text/plain content
    // The error_log endpoint returns text/plain, not JSON
    const response = await makeHassRequest<string>(
      "/error_log",
      hassUrl,
      hassToken,
      "GET",
      undefined,
      {
        ttl: 10000, // Short TTL as logs change frequently
        bypassCache: true // Always fetch fresh logs
      }
    );

    // Ensure we're returning a string
    return typeof response === 'string' ? response : JSON.stringify(response);
  } catch (error) {
    throw error instanceof HassError
      ? error
      : createHassError(error, "/error_log", "GET");
  }
}
