import axios from 'axios';
import type { AxiosInstance } from 'axios';
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
    return await this.client.get('/api/').then((res) => res.data);
  }

  /**
   * Get Home Assistant configuration
   * @returns The current configuration
   */
  async getConfig(): Promise<HassConfig> {
    return await this.client.get('/api/config').then((res) => res.data);
  }

  /**
   * Get all entity states
   * @returns Array of all entity states
   */
  async getAllStates(): Promise<HassState[]> {
    return await this.client.get('/api/states').then((res) => res.data);
  }

  /**
   * Get state of a specific entity
   * @param entityId ID of the entity to retrieve state for
   * @returns State details of the specified entity
   */
  async getEntityState(entityId: string): Promise<HassState> {
    return await this.client.get(`/api/states/${entityId}`).then((res) => res.data);
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
    return await this.client.post(`/api/states/${entityId}`, {
      state,
      attributes
    }).then((res) => res.data);
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
    return await this.client.post(`/api/services/${domain}/${service}`, data || {}).then((res) => res.data);
  }

  /**
   * Get all event listeners
   * @returns Array of event objects with event name and listener count
   */
  async getEvents(): Promise<HassEventObject[]> {
    return await this.client.get('/api/events').then((res) => res.data);
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
    return await this.client.post(`/api/events/${eventType}`, eventData || {}).then((res) => res.data);
  }

  /**
   * Get historical state changes with default time range (past day)
   * @param options Optional query parameters
   * @returns Array of state changes
   */
  async getHistoryDefault(
    options?: HistoryDefaultOptions
  ): Promise<HistoryResponse> {
    return await this.client.get('/api/history/period', {
      params: options
    }).then((res) => res.data);
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
    return await this.client.get(`/api/history/period/${timestamp}`, {
      params: options
    }).then((res) => res.data);
  }

  /**
   * Get logbook entries with default time range (past day)
   * @param options Optional query parameters
   * @returns Array of logbook entries
   */
  async getLogbookDefault(
    options?: LogbookDefaultOptions
  ): Promise<LogbookEntry[]> {
    return await this.client.get('/api/logbook', {
      params: options
    }).then((res) => res.data);
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
    return await this.client.get(`/api/logbook/${timestamp}`, {
      params: options
    }).then((res) => res.data);
  }

  /**
   * Get error log
   * @returns Plaintext response containing all logged errors
   */
  async getErrorLog(): Promise<string> {
    return await this.client.get('/api/error_log', {
      responseType: 'text'
    }).then((res) => res.data);
  }

  /**
   * Get camera image
   * @param cameraEntityId ID of the camera entity
   * @returns Camera image data as binary string
   */
  async getCameraImage(cameraEntityId: string): Promise<string> {
    return await this.client.get(`/api/camera_proxy/${cameraEntityId}`, {
      responseType: 'arraybuffer'
    }).then((res) => res.data);
  }

  /**
   * Get list of calendars
   * @returns List of calendar entities
   */
  async getCalendars(): Promise<CalendarObject[]> {
    return await this.client.get('/api/calendars').then((res) => res.data);
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
    return await this.client.get(`/api/calendars/${calendarEntityId}`, {
      params: { start, end }
    }).then((res) => res.data);
  }

  /**
   * Render a Home Assistant template
   * @param template The template string to render
   * @returns Rendered template in plain text
   */
  async renderTemplate(template: string): Promise<string> {
    return await this.client.post('/api/template', { template }, {
      responseType: 'text'
    }).then((res) => res.data);
  }

  /**
   * Check configuration.yaml
   * @returns Configuration check results
   */
  async checkConfig(): Promise<ConfigCheckResponse> {
    return await this.client.post('/api/config/core/check_config').then((res) => res.data);
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
    return await this.client.post('/api/intent/handle', {
      intent,
      slots
    }).then((res) => res.data);
  }
}
