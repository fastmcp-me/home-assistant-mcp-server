/**
 * Core API Types
 */

import type { components } from "../../api";

export namespace api.core {
  export type Error = components["schemas"]["Error"];
  export type Response<T> = T;
  export type SuccessResponse = { message: string };

  export interface EntityIdParam {
    entity_id: string;
  }

  export interface TimestampParam {
    timestamp: string;
  }
}

export interface BaseResponse {
  success: boolean;
  message?: string;
}

export interface ErrorResponse extends BaseResponse {
  success: false;
  error: string;
}

export interface ConfigResponse extends BaseResponse {
  success: true;
  config: {
    latitude: number;
    longitude: number;
    elevation: number;
    unit_system: {
      length: string;
      mass: string;
      temperature: string;
      volume: string;
    };
    location_name: string;
    time_zone: string;
    components: string[];
    version: string;
    config_dir: string;
    whitelist_external_dirs: string[];
    allowlist_external_dirs: string[];
    allowlist_external_urls: string[];
    config_source: string;
    safe_mode: boolean;
    state: string;
    external_url: string | null;
    internal_url: string | null;
    currency: string;
    country: string | null;
    language: string;
  };
}

export interface EventObject {
  event_type: string;
  data: Record<string, unknown>;
  origin: string;
  time_fired: string;
  context: {
    id: string;
    parent_id: string | null;
    user_id: string | null;
  };
}

export interface CalendarObject {
  entity_id: string;
  name: string;
  device_id: string | null;
}

export interface CalendarEvent {
  start: string;
  end: string;
  summary: string;
  description: string | null;
  location: string | null;
  uid: string | null;
  recurrence_id: string | null;
  rrule: string | null;
}

export interface Service {
  name: string;
  description: string;
  target?: Record<string, unknown>;
  fields: Record<string, {
    description: string;
    example: unknown;
    selector?: Record<string, unknown>;
  }>;
}

// API Response Types
export interface ApiStatusResponse extends BaseResponse {
  success: true;
  message: string;
}

export interface ApiConfigResponse extends BaseResponse {
  success: true;
  config: ConfigResponse['config'];
}

export interface ApiErrorResponse extends ErrorResponse {
  error_code?: string;
}

export interface ApiEventsResponse extends BaseResponse {
  success: true;
  events: EventObject[];
}

export interface ApiCalendarsResponse extends BaseResponse {
  success: true;
  calendars: CalendarObject[];
}

export interface ApiCalendarEventsResponse extends BaseResponse {
  success: true;
  events: CalendarEvent[];
}

export interface ApiServicesResponse extends BaseResponse {
  success: true;
  services: Record<string, Record<string, Service>>;
}
