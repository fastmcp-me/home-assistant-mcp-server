import type { components, operations } from "./hass-api";

// Entity Types
export type HassState = components["schemas"]["State"];
export type HassAttributes = Record<string, any>;

// Configuration Types
export type HassConfig = components["schemas"]["ConfigResponse"];
export type HassUnitSystem = HassConfig["unit_system"];

// Services and Events
export type HassEventObject = components["schemas"]["EventObject"];
export type HassService = components["schemas"]["Service"];
export type HassServiceData = Record<string, any>;

// Call Service Types
export type ServiceCallRequest = {
  domain: string;
  service: string;
  data?: HassServiceData;
};

// History Types
export type HistoryStateChange = components["schemas"]["HistoryStateChange"];
export type HistoryResponse =
  operations["HistoryPeriod"]["responses"]["200"]["content"]["application/json"];
export type HistoryOptions = operations["HistoryPeriod"]["parameters"]["query"];
export type HistoryDefaultOptions =
  operations["HistoryPeriodDefault"]["parameters"]["query"];

// Logbook Types
export type LogbookEntry = components["schemas"]["LogbookEntry"];
export type LogbookOptions =
  operations["LogbookEntries"]["parameters"]["query"];
export type LogbookDefaultOptions =
  operations["LogbookEntriesDefault"]["parameters"]["query"];

// Template Types
export type TemplateRequest = { template: string };
export type TemplateResponse = string;

// Calendar Types
export type CalendarObject = components["schemas"]["CalendarObject"];
export type CalendarEvent = components["schemas"]["CalendarEvent"];
export type CalendarEventsRequest = {
  calendarEntityId: string;
  start: string;
  end: string;
};

// Intent Types
export type IntentRequest = {
  intent: string;
  slots?: Record<string, any>;
};
export type IntentResponse =
  operations["HandleIntent"]["responses"]["200"]["content"]["application/json"];

// Config Types
export type ConfigCheckResponse =
  operations["CheckConfig"]["responses"]["200"]["content"]["application/json"];

// Error Type
export type HassError = components["schemas"]["Error"];

// Response Types
export type ApiResponse<T> = T;
export type ApiSuccessResponse = { message: string };

// Common Parameter Types
export type EntityIdParam = { entity_id: string };
export type TimestampParam = { timestamp: string };

// Camera Types
export type CameraImageResponse = string;
