import { z } from "zod";

// Basic service types
export type HassServiceData = Record<string, unknown>;

export interface HassServiceField {
  description?: string;
  example?: unknown;
  required?: boolean;
  selector?: Record<string, unknown>;
}

export interface HassService {
  domain: string;
  services: string[];
  service?: string;
  description?: string;
  fields?: Record<string, HassServiceField>;
  target?: Record<string, unknown>;
}

export interface HassServiceDetail {
  name: string;
  description?: string;
  fields?: Record<string, HassServiceField>;
  target?: Record<string, unknown>;
}

export type HassServices = Record<string, Record<string, HassServiceDetail>>;

// Service call types
export interface ServiceCallRequest {
  domain: string;
  service: string;
  data?: HassServiceData;
}

export interface ServiceCallResponse {
  context: {
    id: string;
    parent_id?: string | null;
    user_id?: string | null;
  };
  [key: string]: unknown;
}

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

// Zod schema for service calls
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
