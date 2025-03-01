/**
 * Core Device Types
 */

export interface Device {
  id: string;
  name: string;
  model?: string;
  manufacturer?: string;
  area_id?: string;
  config_entries?: string[];
  connections?: [string, string][];
  identifiers?: [string, string][];
  sw_version?: string;
  hw_version?: string;
  via_device_id?: string;
  disabled_by?: string | null;
  entry_type?: string | null;
  name_by_user?: string | null;
  configuration_url?: string | null;
}

export interface DeviceListResponse {
  success: boolean;
  devices: Device[];
}

export interface DeviceState {
  id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface DeviceStateResponse {
  success: boolean;
  state: DeviceState;
}

export interface DeviceStatesResponse {
  success: boolean;
  states: DeviceState[];
}

export interface DeviceRegistryEntry {
  id: string;
  config_entries: string[];
  connections: [string, string][];
  identifiers: [string, string][];
  manufacturer: string;
  model: string;
  name: string;
  sw_version?: string;
  hw_version?: string;
  via_device_id?: string;
}

export interface DeviceRegistryResponse {
  success: boolean;
  devices: DeviceRegistryEntry[];
}
