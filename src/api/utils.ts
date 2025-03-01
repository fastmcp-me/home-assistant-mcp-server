import type { HassEntity } from "../types";
import type { HassState } from "../types/types";
import { initializeHassClient } from "./index.js";
import { HassClient } from "./client.js";
// Import and re-export the HassServices type
import type { HassServices } from "./client.js";

export type { HassServices };

/**
 * Get a singleton instance of the HassClient
 *
 * This is the recommended way to get a reference to the client in tool implementations.
 *
 * Example usage:
 * ```typescript
 * // In your tool file:
 * const hassClient = getHassClient(); // Will use environment variables
 * // Or with explicit parameters:
 * const hassClient = getHassClient(hassUrl, hassToken);
 *
 * // Then use the client methods:
 * const states = await hassClient.getAllStates();
 * const config = await hassClient.getConfig();
 * const serviceResult = await hassClient.callService('light', 'turn_on', { entity_id: 'light.living_room' });
 * ```
 *
 * @param baseUrl Optional base URL of the Home Assistant API (defaults to HASS_URL environment variable)
 * @param token Optional long-lived access token for authentication (defaults to HASS_TOKEN environment variable)
 * @returns A HassClient instance
 */
export function getHassClient(baseUrl?: string, token?: string) {
  // Use provided parameters or fall back to environment variables
  const url = baseUrl || process.env.HASS_URL;
  const accessToken = token || process.env.HASS_TOKEN;

  if (!url || !accessToken) {
    throw new Error(
      "Home Assistant URL and token must be provided either as parameters or environment variables (HASS_URL, HASS_TOKEN)",
    );
  }

  try {
    // Try to get the instance first - it might already be initialized
    // Using type assertion to avoid TypeScript errors since the static methods are defined in the class
    return (HassClient as any).getInstance();
  } catch (error) {
    // If getInstance throws an error, it means we need to initialize first
    initializeHassClient(url, accessToken);
    // Using type assertion to avoid TypeScript errors since the static methods are defined in the class
    return (HassClient as any).getInstance();
  }
}
