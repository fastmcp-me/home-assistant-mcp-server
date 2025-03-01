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

// Define schemas for tools

export const getDevicesSchema = {
  random_string: z
    .string()
    .optional()
    .describe("Dummy parameter for no-parameter tools"),
};

export const getLightsSchema = {
  entity_id: z
    .string()
    .optional()
    .describe("Optional light entity ID to filter results"),
  include_details: z
    .boolean()
    .optional()
    .default(true)
    .describe("Include detailed information about supported features"),
};

export const lightControlSchema = {
  entity_id: z
    .string()
    .describe("Light entity ID to control (e.g., 'light.living_room')"),
  action: z
    .enum(["turn_on", "turn_off", "toggle"])
    .describe("Action to perform on the light"),
  brightness: z
    .number()
    .min(0)
    .max(255)
    .optional()
    .describe("Brightness level (0-255, where 255 is maximum brightness)"),
  brightness_pct: z
    .number()
    .min(0)
    .max(100)
    .optional()
    .describe("Brightness percentage (0-100%)"),
  color_temp: z.number().optional().describe("Color temperature in mireds"),
  kelvin: z.number().optional().describe("Color temperature in Kelvin"),
  hs_color: z
    .array(z.number())
    .length(2)
    .optional()
    .describe("Hue/Saturation color as [hue (0-360), saturation (0-100)]"),
  rgb_color: z
    .array(z.number().min(0).max(255))
    .length(3)
    .optional()
    .describe("RGB color as [r, g, b] with values from 0-255"),
  xy_color: z
    .array(z.number())
    .length(2)
    .optional()
    .describe("CIE xy color as [x (0-1), y (0-1)]"),
  color_name: z
    .string()
    .optional()
    .describe("Named color (e.g., 'red', 'green', 'blue')"),
  effect: z
    .enum([
      "none",
      "colorloop",
      "random",
      "bounce",
      "candle",
      "fireworks",
      "custom",
    ])
    .optional()
    .describe("Light effect to apply"),
  transition: z.number().optional().describe("Transition time in seconds"),
  flash: z
    .enum(["short", "long"])
    .optional()
    .describe("Flash effect (short or long)"),
  color_mode: z
    .enum([
      "color_temp",
      "hs",
      "rgb",
      "rgbw",
      "rgbww",
      "xy",
      "brightness",
      "onoff",
    ])
    .optional()
    .describe("Color mode to use"),
};
