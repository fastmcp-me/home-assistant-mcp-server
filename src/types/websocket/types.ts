/**
 * Base interface for Home Assistant WebSocket messages
 */
export interface MessageBase {
  type: string;
  id?: number;
  [key: string]: unknown;
}
