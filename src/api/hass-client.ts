import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
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
  HassAttributes
} from '../types/hass-types';

/**
 * Type-safe Home Assistant API client
 * Uses the generated OpenAPI TypeScript definitions
 */
export class HassClient {
  private client: AxiosInstance;

  /**
   * Create a new Home Assistant API client
   * @param baseUrl The base URL of the Home Assistant API (e.g., 'http://homeassistant.local:8123/api')
   * @param token Long-lived access token from Home Assistant
   */
  constructor(baseUrl: string, token: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Check if the API is running
   * @returns A message indicating the API is running
   */
  async checkApi(): Promise<ApiSuccessResponse> {
    const response = await this.client.get('/');
    return response.data;
  }

  /**
   * Get Home Assistant configuration
   * @returns The current configuration
   */
  async getConfig(): Promise<HassConfig> {
    const response = await this.client.get('/config');
    return response.data;
  }

  /**
   * Get all entity states
   * @returns Array of all entity states
   */
  async getAllStates(): Promise<HassState[]> {
    const response = await this.client.get('/states');
    return response.data;
  }

  /**
   * Get state of a specific entity
   * @param entityId ID of the entity to retrieve state for
   * @returns State details of the specified entity
   */
  async getEntityState(entityId: string): Promise<HassState> {
    const response = await this.client.get(`/states/${entityId}`);
    return response.data;
  }

  /**
   * Update or create state of a specific entity
   * @param entityId ID of the entity to update or create
   * @param state The new state value
   * @param attributes Optional state attributes to set
   * @returns Updated or created state
   */
  async updateEntityState(
    entityId: string,
    state: string,
    attributes?: HassAttributes
  ): Promise<HassState> {
    const response = await this.client.post(`/states/${entityId}`, {
      state,
      attributes
    });
    return response.data;
  }

  /**
   * Call a service within a specific domain
   * @param domain Domain of the service (e.g., light, switch, automation)
   * @param service Name of the service (e.g., turn_on, turn_off)
   * @param data Optional service data including entity_id(s) to target
   * @returns Array of affected entity states
   */
  async callService(
    domain: string,
    service: string,
    data?: HassServiceData
  ): Promise<HassState[]> {
    const response = await this.client.post(`/services/${domain}/${service}`, data || {});
    return response.data;
  }

  /**
   * Get all event listeners
   * @returns Array of event objects with event name and listener count
   */
  async getEvents(): Promise<HassEventObject[]> {
    const response = await this.client.get('/events');
    return response.data;
  }

  /**
   * Fire an event with optional event data
   * @param eventType Type of the event to fire
   * @param eventData Optional event data
   * @returns A message confirming the event was fired
   */
  async fireEvent(
    eventType: string,
    eventData?: Record<string, any>
  ): Promise<ApiSuccessResponse> {
    const response = await this.client.post(`/events/${eventType}`, eventData || {});
    return response.data;
  }

  /**
   * Get historical state changes with default time range (past day)
   * @param options Optional query parameters
   * @returns Array of state changes
   */
  async getHistoryDefault(
    options?: HistoryDefaultOptions
  ): Promise<HistoryResponse> {
    const response = await this.client.get('/history/period', {
      params: options
    });
    return response.data;
  }

  /**
   * Get historical state changes with specific start time
   * @param timestamp The beginning of the period in YYYY-MM-DDThh:mm:ssTZD format
   * @param options Optional query parameters
   * @returns Array of state changes
   */
  async getHistory(
    timestamp: string,
    options?: Omit<HistoryOptions, 'timestamp'>
  ): Promise<HistoryResponse> {
    const response = await this.client.get(`/history/period/${timestamp}`, {
      params: options
    });
    return response.data;
  }

  /**
   * Get logbook entries with default time range (past day)
   * @param options Optional query parameters
   * @returns Array of logbook entries
   */
  async getLogbookDefault(
    options?: LogbookDefaultOptions
  ): Promise<LogbookEntry[]> {
    const response = await this.client.get('/logbook', {
      params: options
    });
    return response.data;
  }

  /**
   * Get logbook entries with specific start time
   * @param timestamp The beginning of the period in YYYY-MM-DDThh:mm:ssTZD format
   * @param options Optional query parameters
   * @returns Array of logbook entries
   */
  async getLogbook(
    timestamp: string,
    options?: Omit<LogbookOptions, 'timestamp'>
  ): Promise<LogbookEntry[]> {
    const response = await this.client.get(`/logbook/${timestamp}`, {
      params: options
    });
    return response.data;
  }

  /**
   * Get error log
   * @returns Plaintext response containing all logged errors
   */
  async getErrorLog(): Promise<string> {
    const response = await this.client.get('/error_log', {
      responseType: 'text'
    });
    return response.data;
  }

  /**
   * Get camera image
   * @param cameraEntityId ID of the camera entity
   * @returns Camera image data as binary string
   */
  async getCameraImage(cameraEntityId: string): Promise<string> {
    const response = await this.client.get(`/camera_proxy/${cameraEntityId}`, {
      responseType: 'arraybuffer'
    });
    return response.data;
  }

  /**
   * Get list of calendars
   * @returns List of calendar entities
   */
  async getCalendars(): Promise<CalendarObject[]> {
    const response = await this.client.get('/calendars');
    return response.data;
  }

  /**
   * Get calendar events
   * @param calendarEntityId ID of the calendar entity
   * @param start Start time of the events in YYYY-MM-DDThh:mm:ssTZD format
   * @param end End time of the events in YYYY-MM-DDThh:mm:ssTZD format
   * @returns List of calendar events
   */
  async getCalendarEvents(
    calendarEntityId: string,
    start: string,
    end: string
  ): Promise<CalendarEvent[]> {
    const response = await this.client.get(`/calendars/${calendarEntityId}`, {
      params: { start, end }
    });
    return response.data;
  }

  /**
   * Render a Home Assistant template
   * @param template The template string to render
   * @returns Rendered template in plain text
   */
  async renderTemplate(template: string): Promise<string> {
    const response = await this.client.post('/template', { template }, {
      responseType: 'text'
    });
    return response.data;
  }

  /**
   * Check configuration.yaml
   * @returns Configuration check results
   */
  async checkConfig(): Promise<ConfigCheckResponse> {
    const response = await this.client.post('/config/core/check_config');
    return response.data;
  }

  /**
   * Handle an intent
   * @param intent The intent to handle
   * @param slots Optional slots to fill intent parameters
   * @returns The response for the handled intent
   */
  async handleIntent(
    intent: string,
    slots?: Record<string, any>
  ): Promise<IntentResponse> {
    const response = await this.client.post('/intent/handle', {
      intent,
      slots
    });
    return response.data;
  }
}
