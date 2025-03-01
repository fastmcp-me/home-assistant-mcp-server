// Import and export the HassClient class for use in the application
import { HassClient } from "./client.js";
export { HassClient };

// Export a function to initialize the HassClient singleton
export function initializeHassClient(baseUrl: string, token: string): void {
  // Ensure the baseUrl is properly formatted
  // If baseUrl is just the base (e.g., http://homeassistant.local:8123)
  // we need to make sure it doesn't include /api already
  const apiBaseUrl = baseUrl.endsWith("/api") ? baseUrl : baseUrl;

  // Initialize the singleton
  HassClient.initialize(apiBaseUrl, token);
}

// For backward compatibility, but mark as deprecated
/**
 * @deprecated Use HassClient.getInstance() instead after calling initializeHassClient()
 */
export function createHassClient(baseUrl: string, token: string) {
  // Initialize if not already initialized
  initializeHassClient(baseUrl, token);

  // Return the singleton instance
  return HassClient.getInstance();
}
