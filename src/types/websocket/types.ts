// Disable the no-namespace rule for this file since we're following the project's type convention
/* eslint-disable @typescript-eslint/no-namespace */

namespace websocket {
  /**
   * Base interface for Home Assistant WebSocket messages
   */
  export interface Message {
    type: string;
    id?: number;
    [key: string]: unknown;
  }

  /**
   * Common message types in Home Assistant WebSocket API
   */
  export type MessageType =
    | "auth"
    | "auth_required"
    | "auth_ok"
    | "auth_invalid"
    | "result"
    | "subscribe_events"
    | "unsubscribe_events"
    | "event";

  /**
   * Authentication related message interfaces
   */
  export interface Auth extends Message {
    type: "auth";
    access_token: string;
  }

  export interface AuthRequired extends Message {
    type: "auth_required";
    ha_version: string;
  }

  export interface AuthOk extends Message {
    type: "auth_ok";
    ha_version: string;
  }

  export interface AuthInvalid extends Message {
    type: "auth_invalid";
    message: string;
  }

  /**
   * Result message for command responses
   */
  export interface Result<T = unknown> extends Message {
    type: "result";
    success: boolean;
    result?: T;
    error?: {
      code: string;
      message: string;
    };
  }

  /**
   * Event related message interfaces
   */
  export interface Event<T = unknown> extends Message {
    type: "event";
    event: {
      event_type: string;
      data: T;
      origin: string;
      time_fired: string;
      context: {
        id: string;
        parent_id?: string;
        user_id?: string;
      };
    };
  }

  /**
   * Type guard to check if a message is a specific type
   */
  export type IsMessageType<T extends Message, K extends MessageType> = T extends { type: K } ? T : never;

  /**
   * Helper type to extract the data type from an event message
   */
  export type EventData<T extends Event> = T extends Event<infer D> ? D : never;
}

export type { websocket };
