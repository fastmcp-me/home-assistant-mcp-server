import { z } from "zod";

// Define types for Home Assistant API responses
export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export interface HassConfig {
  location_name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  unit_system: {
    length: string;
    mass: string;
    temperature: string;
    volume: string;
  };
  version: string;
  components: string[];
}

export interface HassServiceField {
  description?: string;
  example?: unknown;
  required?: boolean;
  selector?: Record<string, unknown>;
}

export interface HassService {
  domain: string;
  services: string[];
  // Enhanced fields for detailed service information
  service?: string;
  description?: string;
  fields?: Record<string, HassServiceField>;
  target?: Record<string, unknown>;
}

export interface HassEvent {
  event: string;
  listener_count: number;
}

// Define interface for device data
export interface HassDevice {
  id: string;
  name?: string;
  manufacturer?: string;
  model?: string;
  area_id?: string;
  config_entries?: string[];
  disabled_by?: string | null;
  entry_type?: string | null;
  name_by_user?: string | null;
  via_device_id?: string | null;
}

// Define interface for internal service call response (object only, no strings)
export interface ServiceCallResponse {
  context: {
    id: string;
    parent_id?: string | null;
    user_id?: string | null;
  };
  [key: string]: unknown;
}

// Define interface for processed service call response (after parsing)
export interface ProcessedServiceCallResponse {
  context?: {
    id: string;
    parent_id?: string | null;
    user_id?: string | null;
  };
  message?: string;
  raw_response?: string;
  [key: string]: unknown;
}

// Zod schemas for tool validation
export const callServiceSchema = {
  domain: z
    .string()
    .describe("Service domain (e.g., 'light', 'switch', 'automation')"),
  service: z.string().describe("Service name (e.g., 'turn_on', 'turn_off')"),
  service_data: z
    .record(z.any())
    .optional()
    .describe("Optional service data to pass to the service"),
  target: z
    .record(z.any())
    .optional()
    .describe("Optional target entities for the service call"),
};

export const getStatesSchema = {
  entity_id: z
    .string()
    .optional()
    .describe(
      "Optional entity ID to get a specific entity state, if omitted all states are returned",
    ),
  simplified: z
    .boolean()
    .optional()
    .describe("Return simplified entity data structure"),
};

export const getHistorySchema = {
  entity_id: z
    .string()
    .optional()
    .describe("Optional entity ID to filter history"),
  start_time: z
    .string()
    .optional()
    .describe("Start time in ISO format (e.g., '2023-01-01T00:00:00Z')"),
  end_time: z.string().optional().describe("End time in ISO format"),
  simplified: z
    .boolean()
    .optional()
    .describe("Return simplified history data structure"),
  minimal_response: z
    .boolean()
    .optional()
    .describe("Return minimal response with fewer attributes"),
  significant_changes_only: z
    .boolean()
    .optional()
    .describe("Only return states with significant changes"),
};

export const renderTemplateSchema = {
  template: z.string().describe("Jinja2 template to render"),
};

export const fireEventSchema = {
  event_type: z.string().describe("Event type to fire"),
  event_data: z.record(z.any()).optional().describe("Optional event data"),
};

export const getLogbookSchema = {
  start_time: z
    .string()
    .optional()
    .describe("Start time in ISO format (e.g., '2023-01-01T00:00:00Z')"),
  entity_id: z
    .string()
    .optional()
    .describe("Optional entity ID to filter logbook entries"),
};

export const getCameraImageSchema = {
  camera_entity_id: z
    .string()
    .describe("Entity ID of the camera (e.g., 'camera.front_door')"),
};

export const getCalendarEventsSchema = {
  calendar_entity_id: z
    .string()
    .describe("Entity ID of the calendar (e.g., 'calendar.home')"),
  start_time: z
    .string()
    .describe("Start time in ISO format (e.g., '2023-01-01T00:00:00Z')"),
  end_time: z.string().describe("End time in ISO format"),
};

export const handleIntentSchema = {
  intent_name: z.string().describe("Name of the intent to handle"),
  intent_data: z
    .record(z.any())
    .optional()
    .describe("Optional data for the intent slots"),
};

export const updateEntityStateSchema = {
  entity_id: z.string().describe("Entity ID to update or create"),
  state: z.string().describe("New state value"),
  attributes: z
    .record(z.any())
    .optional()
    .describe("Optional attributes for the entity"),
};
