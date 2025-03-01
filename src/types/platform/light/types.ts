/**
 * Light Platform Types
 */

export interface LightCapabilities {
  supported_color_modes?: string[];
  supported_features?: number;
  min_mireds?: number;
  max_mireds?: number;
  effect_list?: string[];
}

export interface LightStateAttributes extends LightCapabilities {
  min_color_temp_kelvin?: number;
  max_color_temp_kelvin?: number;
  brightness?: number;
  color_temp_kelvin?: number;
  color_mode?: string;
  rgb_color?: [number, number, number];
  rgbw_color?: [number, number, number, number];
  rgbww_color?: [number, number, number, number, number];
  xy_color?: [number, number];
  hs_color?: [number, number];
  effect?: string;
  friendly_name?: string;
  icon?: string;
}

export interface LightControlParams {
  brightness?: number;
  brightness_pct?: number;
  brightness_step?: number;
  brightness_step_pct?: number;
  color_temp_kelvin?: number;
  rgb_color?: [number, number, number];
  rgbw_color?: [number, number, number, number];
  rgbww_color?: [number, number, number, number, number];
  xy_color?: [number, number];
  hs_color?: [number, number];
  effect?: string;
  flash?: 'short' | 'long';
  transition?: number;
  white?: boolean;
}

export interface LightEntity {
  entity_id: string;
  state: 'on' | 'off' | 'unavailable';
  attributes: LightStateAttributes;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id?: string;
    user_id?: string;
  };
}

export interface LightEntityResponse {
  success: boolean;
  light: LightEntity;
}

export interface LightEntitiesResponse {
  success: boolean;
  lights: LightEntity[];
}

export interface LightControlResponse {
  success: boolean;
  result?: unknown;
}
