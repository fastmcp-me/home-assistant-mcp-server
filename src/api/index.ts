// Import and export the HassClient class for use in the application
import { HassClient } from "./client.js";
export { HassClient };

// Export a singleton instance creation function
export function createHassClient(baseUrl: string, token: string) {
  // Ensure the baseUrl is properly formatted
  // If baseUrl is just the base (e.g., http://homeassistant.local:8123)
  // we need to make sure it doesn't include /api already
  const apiBaseUrl = baseUrl.endsWith("/api")
    ? baseUrl
    : `${baseUrl}/api`;

  return new HassClient(apiBaseUrl, token);
}
