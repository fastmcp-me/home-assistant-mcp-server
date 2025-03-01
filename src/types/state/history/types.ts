/**
 * History State Types
 */

export interface HistoryQueryParams {
  filter_entity_id?: string | string[];
  end_time?: string;
  start_time?: string;
  minimal_response?: boolean;
  significant_changes_only?: boolean;
}

export interface HistoryPeriodParams extends HistoryQueryParams {
  timestamp?: string;
}

export interface HistoryStateChange {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}

export interface HistoryPeriodResponse {
  success: boolean;
  history: HistoryStateChange[];
}

export interface LogbookQueryParams {
  entity_id?: string | string[];
  end_time?: string;
  start_time?: string;
}

export interface LogbookPeriodParams extends LogbookQueryParams {
  timestamp?: string;
}

export interface LogbookEntry {
  when: string;
  name: string;
  message: string;
  domain: string;
  entity_id: string;
}

export interface LogbookResponse {
  success: boolean;
  entries: LogbookEntry[];
}
