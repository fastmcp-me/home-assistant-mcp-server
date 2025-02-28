// Helper functions for Home Assistant API interactions

import { HassEntity, HassConfig, HassService, HassEvent } from './types.js';

// Global state tracking
export let homeAssistantAvailable = false;
export let useMockData = false;

/**
 * Set the mock data flag
 */
export function setMockData(value: boolean): void {
  useMockData = value;
}

/**
 * Helper function to make requests to Home Assistant API
 */
export async function makeHassRequest<T = unknown>(
  endpoint: string,
  hassUrl: string,
  hassToken: string,
  method: "GET" | "POST" = "GET",
  data?: Record<string, unknown>
): Promise<T> {
  // If we've determined that Home Assistant is not available and mock data is enabled
  if (!homeAssistantAvailable && useMockData) {
    return getMockData<T>(endpoint, method, data);
  }

  const url = `${hassUrl}/api${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${hassToken}`,
      "Content-Type": "application/json",
    },
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    console.error(`Making request to Home Assistant: ${method} ${url}`);

    // Add a timeout to avoid hanging indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    options.signal = controller.signal;

    const response = await fetch(url, options);
    clearTimeout(timeoutId);

    // If we get a successful response, update availability flag
    homeAssistantAvailable = true;

    if (!response.ok) {
      throw new Error(
        `Home Assistant API error: ${response.status} ${response.statusText}`
      );
    }

    // For some endpoints that return text instead of JSON
    if (response.headers.get("content-type")?.includes("text/plain")) {
      return (await response.text()) as unknown as T;
    }

    return await response.json();
  } catch (error: unknown) {
    const err = error as Error & { name?: string; cause?: { code?: string } };
    if (err.name === "AbortError") {
      console.error(`Request to Home Assistant timed out: ${method} ${url}`);
      homeAssistantAvailable = false;

      if (useMockData) {
        return getMockData<T>(endpoint, method, data);
      }

      throw new Error(
        `Home Assistant request timed out. Please check if Home Assistant is running at ${hassUrl}`
      );
    } else if (err.cause && err.cause.code === "ECONNREFUSED") {
      console.error(
        `Connection refused to Home Assistant at ${hassUrl}. Please check if Home Assistant is running.`
      );
      homeAssistantAvailable = false;

      if (useMockData) {
        return getMockData<T>(endpoint, method, data);
      }

      throw new Error(
        `Cannot connect to Home Assistant at ${hassUrl}. Please check if it's running.`
      );
    } else {
      console.error("Error making request to Home Assistant:", error);

      if (useMockData) {
        return getMockData<T>(endpoint, method, data);
      }

      throw error;
    }
  }
}

/**
 * Mock data for demonstration purposes when Home Assistant is unavailable
 */
export function getMockData<T>(
  endpoint: string,
  method: string,
  data?: Record<string, unknown>
): T {
  console.error(`Using mock data for ${method} ${endpoint}`);

  // Mock for states endpoint
  if (endpoint === "/states") {
    return [
      {
        entity_id: "light.living_room",
        state: "off",
        attributes: {
          friendly_name: "Living Room Light",
          supported_features: 1,
        },
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      },
      {
        entity_id: "switch.kitchen",
        state: "on",
        attributes: {
          friendly_name: "Kitchen Switch",
        },
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      },
      {
        entity_id: "sensor.temperature",
        state: "22.5",
        attributes: {
          friendly_name: "Temperature",
          unit_of_measurement: "°C",
        },
        last_changed: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      },
    ] as unknown as T;
  }

  // Mock for specific entity state
  if (endpoint.startsWith("/states/")) {
    const entityId = endpoint.split("/states/")[1];
    return {
      entity_id: entityId,
      state: entityId.includes("light")
        ? "off"
        : entityId.includes("switch")
          ? "on"
          : "unknown",
      attributes: {
        friendly_name: entityId
          .split(".")[1]
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase()),
      },
      last_changed: new Date().toISOString(),
      last_updated: new Date().toISOString(),
    } as unknown as T;
  }

  // Mock for services
  if (endpoint === "/services") {
    return [
      {
        domain: "light",
        services: ["turn_on", "turn_off", "toggle"],
      },
      {
        domain: "switch",
        services: ["turn_on", "turn_off", "toggle"],
      },
    ] as unknown as T;
  }

  // Mock for config
  if (endpoint === "/config") {
    return {
      location_name: "Mock Home",
      latitude: 37.7749,
      longitude: -122.4194,
      elevation: 100,
      unit_system: {
        length: "m",
        mass: "kg",
        temperature: "°C",
        volume: "L",
      },
      version: "2023.12.0",
      components: [
        "homeassistant",
        "frontend",
        "http",
        "light",
        "switch",
        "sensor",
      ],
    } as unknown as T;
  }

  // Mock for events
  if (endpoint === "/events") {
    return [
      {
        event: "state_changed",
        listener_count: 1,
      },
      {
        event: "service_executed",
        listener_count: 1,
      },
    ] as unknown as T;
  }

  // Mock for service call
  if (endpoint.startsWith("/services/")) {
    return {} as unknown as T;
  }

  // Mock for template rendering
  if (endpoint === "/template" && method === "POST") {
    const template = data?.template as string | undefined;
    if (template) {
      // Very basic template parsing for demonstration
      if (template.includes("states(")) {
        const entityId = template.match(/states\(['"]([^'"]+)['"]\)/)?.[1];
        if (entityId) {
          return `${entityId.includes("light") ? "off" : "on"}` as unknown as T;
        }
      }
      return "Template result" as unknown as T;
    }
  }

  // Default mock response
  return {} as unknown as T;
}

/**
 * Check Home Assistant connectivity and setup mock mode if needed
 */
export async function checkHomeAssistantConnection(
  hassUrl: string,
  hassToken: string,
  enableMock: boolean = false
): Promise<boolean> {
  try {
    console.error(`Checking connectivity to Home Assistant at ${hassUrl}`);
    await makeHassRequest("/config", hassUrl, hassToken, "GET", undefined);
    console.error("✅ Successfully connected to Home Assistant!");
    homeAssistantAvailable = true;
    return true;
  } catch (error) {
    console.error("❌ Could not connect to Home Assistant:");
    console.error(`   ${error.message}`);
    console.error(
      `   Please check that Home Assistant is running at ${hassUrl}`
    );
    console.error(`   and that your token is valid.`);

    // Enable mock mode for demonstration purposes
    homeAssistantAvailable = false;

    // Check if we should use mock data
    if (enableMock) {
      console.error("🔄 Enabling mock data mode for demonstration");
      useMockData = true;
    } else {
      console.error(
        "⚠️ To enable mock data for demonstration, run with --mock flag"
      );
      console.error("   or set HASS_MOCK=true in your .env file");
    }

    // We'll still continue, connection might become available later or mock data will be used
    return useMockData;
  }
}
