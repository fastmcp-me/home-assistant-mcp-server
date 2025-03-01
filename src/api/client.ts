import axios from "axios";
import type { AxiosInstance } from "axios";
import type {
  HassState,
  HassConfig,
  HassEventObject,
  HassServiceData,
  HistoryResponse,
  HistoryOptions,
  HistoryDefaultOptions,
  LogbookEntry,
  LogbookOptions,
  LogbookDefaultOptions,
  CalendarObject,
  CalendarEvent,
  ConfigCheckResponse,
  IntentResponse,
  ApiSuccessResponse,
  HassAttributes,
} from "../types/types";

// Define the service interfaces
interface HassServiceField {
  description?: string;
  example?: unknown;
  required?: boolean;
  selector?: Record<string, unknown>;
}

interface HassServiceDetail {
  name: string;
  description?: string;
  fields?: Record<string, HassServiceField>;
  target?: Record<string, unknown>;
}

// Type for services response
export type HassServices = Record<string, Record<string, HassServiceDetail>>;

/**
 * Type-safe Home Assistant API client
 * Uses the generated OpenAPI TypeScript definitions
 */
export class HassClient {
  private client: AxiosInstance;

  /**
   * Creates a new Home Assistant API client
   *
   * @param baseUrl The base URL of the Home Assistant instance (e.g. http://localhost:8123)
   * @param token The long-lived access token for authentication
   */
  constructor(baseUrl: string, token: string) {
    this.client = axios.create({
      baseURL: `${baseUrl}/api`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Checks if the API is running
   * @returns A success message if the API is running
   */
  async checkApi(): Promise<ApiSuccessResponse> {
    const response = await this.client.get<ApiSuccessResponse>("/");
    return response.data;
  }

  /**
   * Gets the current configuration
   * @returns The current Home Assistant configuration
   */
  async getConfig(): Promise<HassConfig> {
    const response = await this.client.get<HassConfig>("/config");
    return response.data;
  }

  /**
   * Gets all services
   * @param domain Optional domain to filter services by
   * @returns A record of services by domain
   */
  async getServices(domain?: string): Promise<HassServices> {
    const response = await this.client.get<HassServices>("/services");

    // If domain is specified, filter the services
    if (domain && response.data[domain]) {
      return { [domain]: response.data[domain] };
    }

    return response.data;
  }

  /**
   * Gets all entity states
   * @returns An array of all entity states
   */
  async getAllStates(): Promise<HassState[]> {
    const response = await this.client.get<HassState[]>("/states");
    return response.data;
  }

  /**
   * Gets the state of a specific entity
   * @param entityId The entity ID to get the state for
   * @returns The state of the specified entity
   * @throws Error if the entity does not exist
   */
  async getEntityState(entityId: string): Promise<HassState> {
    try {
      const response = await this.client.get<HassState>(`/states/${entityId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(`Entity ${entityId} not found`);
      }
      throw error;
    }
  }

  /**
   * Updates the state of a specific entity
   * @param entityId The entity ID to update
   * @param state The new state value
   * @param attributes Optional attributes to set
   * @returns The updated state
   */
  async updateEntityState(
    entityId: string,
    state: string,
    attributes?: HassAttributes,
  ): Promise<HassState> {
    const response = await this.client.post<HassState>(`/states/${entityId}`, {
      state,
      attributes,
    });
    return response.data;
  }

  /**
   * Calls a service
   * @param domain The domain of the service (e.g. light, switch, automation)
   * @param service The service to call (e.g. turn_on, turn_off)
   * @param data Optional service data
   * @returns An array of states that changed as a result of the service call
   */
  async callService(
    domain: string,
    service: string,
    data?: HassServiceData,
  ): Promise<HassState[]> {
    const response = await this.client.post<HassState[]>(
      `/services/${domain}/${service}`,
      data,
    );
    return response.data;
  }

  /**
   * Gets all events
   * @returns An array of all event objects
   */
  async getEvents(): Promise<HassEventObject[]> {
    const response = await this.client.get<HassEventObject[]>("/events");
    return response.data;
  }

  /**
   * Fires an event
   * @param eventType The type of event to fire
   * @param eventData Optional event data
   * @returns A success message if the event was fired
   */
  async fireEvent(
    eventType: string,
    eventData?: Record<string, unknown>,
  ): Promise<ApiSuccessResponse> {
    const response = await this.client.post<ApiSuccessResponse>(
      `/events/${eventType}`,
      eventData,
    );
    return response.data;
  }

  /**
   * Gets the history for the past day (default time range)
   * @param options Optional query parameters
   * @returns Historical state changes
   */
  async getHistoryDefault(
    options?: HistoryDefaultOptions,
  ): Promise<HistoryResponse> {
    const response = await this.client.get<HistoryResponse>("/history/period", {
      params: options,
    });
    return response.data;
  }

  /**
   * Gets the history from a specific timestamp
   * @param timestamp The timestamp to start from (ISO 8601 format)
   * @param options Optional query parameters
   * @returns Historical state changes
   */
  async getHistory(
    timestamp: string,
    options?: Omit<HistoryOptions, "timestamp">,
  ): Promise<HistoryResponse> {
    const response = await this.client.get<HistoryResponse>(
      `/history/period/${timestamp}`,
      {
        params: options,
      },
    );
    return response.data;
  }

  /**
   * Gets the logbook entries for the past day (default time range)
   * @param options Optional query parameters
   * @returns Logbook entries
   */
  async getLogbookDefault(
    options?: LogbookDefaultOptions,
  ): Promise<LogbookEntry[]> {
    const response = await this.client.get<LogbookEntry[]>("/logbook", {
      params: options,
    });
    return response.data;
  }

  /**
   * Gets the logbook entries from a specific timestamp
   * @param timestamp The timestamp to start from (ISO 8601 format)
   * @param options Optional query parameters
   * @returns Logbook entries
   */
  async getLogbook(
    timestamp: string,
    options?: Omit<LogbookOptions, "timestamp">,
  ): Promise<LogbookEntry[]> {
    const response = await this.client.get<LogbookEntry[]>(
      `/logbook/${timestamp}`,
      {
        params: options,
      },
    );
    return response.data;
  }

  /**
   * Gets the error log
   * @returns The error log as plain text
   */
  async getErrorLog(): Promise<string> {
    const response = await this.client.get<string>("/error_log", {
      responseType: "text",
      headers: {
        Accept: "text/plain",
      },
    });
    return response.data;
  }

  /**
   * Gets a camera image
   * @param cameraEntityId The entity ID of the camera
   * @returns The camera image as base64 data URI
   */
  async getCameraImage(cameraEntityId: string): Promise<string> {
    const response = await this.client.get<string>(
      `/camera_proxy/${cameraEntityId}`,
      {
        responseType: "arraybuffer",
      },
    );
    const contentType = response.headers["content-type"];
    const base64Image = Buffer.from(response.data, "binary").toString("base64");
    return `data:${contentType};base64,${base64Image}`;
  }

  /**
   * Gets all calendars
   * @returns An array of calendar objects
   */
  async getCalendars(): Promise<CalendarObject[]> {
    const response = await this.client.get<CalendarObject[]>("/calendars");
    return response.data;
  }

  /**
   * Gets calendar events for a specific calendar
   * @param calendarEntityId The entity ID of the calendar
   * @param start The start time (ISO 8601 format)
   * @param end The end time (ISO 8601 format)
   * @returns An array of calendar events
   */
  async getCalendarEvents(
    calendarEntityId: string,
    start: string,
    end: string,
  ): Promise<CalendarEvent[]> {
    const response = await this.client.get<CalendarEvent[]>(
      `/calendars/${calendarEntityId}`,
      {
        params: {
          start,
          end,
        },
      },
    );
    return response.data;
  }

  /**
   * Renders a template
   * @param template The template string to render
   * @returns The rendered template as a string
   */
  async renderTemplate(template: string): Promise<string> {
    const response = await this.client.post<string>(
      "/template",
      { template },
      {
        responseType: "text",
        headers: {
          Accept: "text/plain",
        },
      },
    );
    return response.data;
  }

  /**
   * Checks the configuration
   * @returns The configuration check response
   */
  async checkConfig(): Promise<ConfigCheckResponse> {
    const response = await this.client.post<ConfigCheckResponse>(
      "/config/core/check_config",
    );
    return response.data;
  }

  /**
   * Handles an intent
   * @param intent The intent to handle
   * @param slots Optional slots to fill intent parameters
   * @returns The intent response
   */
  async handleIntent(
    intent: string,
    slots?: Record<string, unknown>,
  ): Promise<IntentResponse> {
    const response = await this.client.post<IntentResponse>("/intent/handle", {
      intent,
      slots,
    });
    return response.data;
  }
}
