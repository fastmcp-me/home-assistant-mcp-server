import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { makeHassRequest } from "./utils.js";
import {
  getStatesSchema,
  callServiceSchema,
  getHistorySchema,
  renderTemplateSchema,
  fireEventSchema,
  getLogbookSchema,
  getCameraImageSchema,
  getCalendarEventsSchema,
  handleIntentSchema,
  updateEntityStateSchema
} from "./types.js";

/**
 * Register all Home Assistant tools with the MCP server
 */
export function registerHassTools(
  server: McpServer,
  hassUrl: string,
  hassToken: string
): void {
  // 1. Get states
  server.tool(
    "get_states",
    "Get the state of all entities or a specific entity",
    getStatesSchema,
    async ({ entity_id }) => {
      try {
        const endpoint = entity_id ? `/states/${entity_id}` : "/states";
        const data = await makeHassRequest(endpoint, hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error getting states:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting states: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 2. Call service
  server.tool(
    "call_service",
    "Call a Home Assistant service",
    callServiceSchema,
    async ({ domain, service, service_data }) => {
      try {
        const endpoint = `/services/${domain}/${service}`;
        const response = await makeHassRequest(
          endpoint,
          hassUrl,
          hassToken,
          "POST",
          service_data || {}
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error calling service:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error calling service ${domain}.${service}: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 3. Get history
  server.tool(
    "get_history",
    "Get historical state data for entities",
    getHistorySchema,
    async ({ entity_id, start_time, end_time }) => {
      try {
        let endpoint = "/history/period";

        if (start_time) {
          endpoint += `/${start_time}`;
        }

        const params = new URLSearchParams();
        if (entity_id) {
          params.append("filter_entity_id", entity_id);
        }
        if (end_time) {
          params.append("end_time", end_time);
        }

        const queryString = params.toString();
        if (queryString) {
          endpoint += `?${queryString}`;
        }

        const data = await makeHassRequest(endpoint, hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error getting history:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting history: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 4. List available services
  server.tool(
    "list_services",
    "List all available services in Home Assistant",
    {},
    async () => {
      try {
        const data = await makeHassRequest("/services", hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error listing services:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing services: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 5. Get configuration
  server.tool(
    "get_config",
    "Get Home Assistant configuration",
    {},
    async () => {
      try {
        const data = await makeHassRequest("/config", hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error getting configuration:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting configuration: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // 6. Get events
  server.tool(
    "list_events",
    "List all available event types",
    {},
    async () => {
      try {
        const data = await makeHassRequest("/events", hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error listing events:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing events: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // 7. Fire event
  server.tool(
    "fire_event",
    "Fire an event in Home Assistant",
    fireEventSchema,
    async ({ event_type, event_data }) => {
      try {
        const endpoint = `/events/${event_type}`;
        const response = await makeHassRequest(
          endpoint,
          hassUrl,
          hassToken,
          "POST",
          event_data || {}
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error firing event:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error firing event ${event_type}: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 8. Render template
  server.tool(
    "render_template",
    "Render a Home Assistant template",
    renderTemplateSchema,
    async ({ template }) => {
      try {
        const response = await makeHassRequest(
          "/template",
          hassUrl,
          hassToken,
          "POST",
          { template }
        );

        return {
          content: [
            {
              type: "text",
              text: response as string,
            },
          ],
        };
      } catch (error) {
        console.error("Error rendering template:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error rendering template: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 9. Check API status
  server.tool(
    "check_api_status",
    "Check if the Home Assistant API is running",
    {},
    async () => {
      try {
        const data = await makeHassRequest("", hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error checking API status:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error checking API status: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // 10. Get logbook entries
  server.tool(
    "get_logbook",
    "Get logbook entries from Home Assistant",
    getLogbookSchema,
    async ({ start_time, entity_id }) => {
      try {
        let endpoint = "/logbook";

        if (start_time) {
          endpoint += `/${start_time}`;
        }

        if (entity_id) {
          const params = new URLSearchParams();
          params.append("entity", entity_id);
          endpoint += `?${params.toString()}`;
        }

        const data = await makeHassRequest(endpoint, hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error getting logbook entries:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting logbook entries: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 11. Get error log
  server.tool(
    "get_error_log",
    "Get Home Assistant error log",
    {},
    async () => {
      try {
        const data = await makeHassRequest("/error_log", hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: data as string,
            },
          ],
        };
      } catch (error) {
        console.error("Error getting error log:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting error log: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // 12. Get camera image
  server.tool(
    "get_camera_image",
    "Get image from a camera entity",
    getCameraImageSchema,
    async ({ camera_entity_id }) => {
      try {
        const endpoint = `/camera_proxy/${camera_entity_id}`;

        return {
          content: [
            {
              type: "text",
              text: `Camera image URL: ${hassUrl}/api${endpoint}?token=${hassToken}\n\nNote: This URL will work directly in a browser with proper authorization.`,
            },
          ],
        };
      } catch (error) {
        console.error("Error getting camera image:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting camera image: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 13. List calendars
  server.tool(
    "list_calendars",
    "List all calendars in Home Assistant",
    {},
    async () => {
      try {
        const data = await makeHassRequest("/calendars", hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error listing calendars:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing calendars: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // 14. Get calendar events
  server.tool(
    "get_calendar_events",
    "Get events from a specific calendar",
    getCalendarEventsSchema,
    async ({ calendar_entity_id, start_time, end_time }) => {
      try {
        let endpoint = `/calendars/${calendar_entity_id}`;

        const params = new URLSearchParams();
        params.append("start", start_time);
        params.append("end", end_time);
        endpoint += `?${params.toString()}`;

        const data = await makeHassRequest(endpoint, hassUrl, hassToken);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error getting calendar events:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error getting calendar events: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 15. Check configuration
  server.tool(
    "check_config",
    "Check Home Assistant configuration for errors",
    {},
    async () => {
      try {
        const data = await makeHassRequest(
          "/config/core/check_config",
          hassUrl,
          hassToken,
          "POST"
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error checking configuration:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error checking configuration: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 16. Handle intent
  server.tool(
    "handle_intent",
    "Send an intent to Home Assistant's intent handler",
    handleIntentSchema,
    async ({ intent_name, intent_data }) => {
      try {
        const data = await makeHassRequest(
          "/intent/handle",
          hassUrl,
          hassToken,
          "POST",
          {
            name: intent_name,
            data: intent_data || {},
          }
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error handling intent:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error handling intent: ${error.message}`,
            },
          ],
        };
      }
    },
  );

  // 17. Update entity state
  server.tool(
    "update_entity_state",
    "Update or create an entity state",
    updateEntityStateSchema,
    async ({ entity_id, state, attributes }) => {
      try {
        const endpoint = `/states/${entity_id}`;
        const data = {
          state,
          attributes: attributes || {},
        };

        const response = await makeHassRequest(
          endpoint,
          hassUrl,
          hassToken,
          "POST",
          data
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(response, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error("Error updating entity state:", error);
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error updating entity state: ${error.message}`,
            },
          ],
        };
      }
    },
  );
}
