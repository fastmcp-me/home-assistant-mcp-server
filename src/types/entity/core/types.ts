/**
 * Core Entity Types
 */

export interface State {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
  context: {
    id: string;
    parent_id?: string;
    user_id?: string;
  };
}

export interface UpdateRequest {
  state: string;
  attributes?: Record<string, unknown>;
}

export interface StateResponse {
  success: boolean;
  state: State;
}

export interface StatesResponse {
  success: boolean;
  states: State[];
}
