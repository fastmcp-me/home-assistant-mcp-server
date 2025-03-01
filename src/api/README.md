# Home Assistant API Client

This directory contains a type-safe client for interacting with the Home Assistant API.

## Overview

The `client.ts` file provides a fully typed `HassClient` class that handles all the details of API authentication, request formatting, and response parsing. This makes API interactions more robust and maintainable.

## Using the Client

### Basic Usage

The recommended way to use the client is through the utility functions in `utils.ts`:

```typescript
import { getHassClient } from "../api/utils";

// Get a client instance
const hassClient = getHassClient(hassUrl, hassToken);

// Use the client methods
const states = await hassClient.getAllStates();
const entityState = await hassClient.getEntityState("light.living_room");
const configInfo = await hassClient.getConfig();
```

### Type Conversion

When migrating from direct API calls to the HassClient, you might need to convert between types:

```typescript
import { getHassClient, convertToHassEntities } from "../api/utils";
import type { HassEntity } from "../types";

// Get a client instance
const hassClient = getHassClient(hassUrl, hassToken);

// Get states and convert to HassEntity format
const states = await hassClient.getAllStates();
const entities: HassEntity[] = convertToHassEntities(states);
```

## Available Methods

The HassClient provides numerous methods to interact with Home Assistant:

### Entity State

- `getAllStates()` - Get all entity states
- `getEntityState(entityId)` - Get state of a specific entity
- `updateEntityState(entityId, state, attributes)` - Update entity state

### Services

- `getServices(domain?)` - Get all or domain-specific services
- `callService(domain, service, data?)` - Call a service

### Configuration

- `getConfig()` - Get Home Assistant configuration
- `checkConfig()` - Check configuration validity

### History & Logs

- `getHistory(timestamp, options?)` - Get historical state data
- `getHistoryDefault(options?)` - Get history for the past day
- `getLogbook(timestamp, options?)` - Get logbook entries
- `getLogbookDefault(options?)` - Get logbook for the past day
- `getErrorLog()` - Get error log

### Other Features

- `getEvents()` - Get all events
- `fireEvent(eventType, eventData?)` - Fire an event
- `renderTemplate(template)` - Render a template
- `getCalendars()` - Get all calendars
- `getCalendarEvents(calendarEntityId, start, end)` - Get calendar events

## Migration Guide

When updating existing tool implementations to use the client, follow these steps:

1. Import the client utilities:
   ```typescript
   import { getHassClient, convertToHassEntities } from "../api/utils";
   ```

2. Get a client instance:
   ```typescript
   const hassClient = getHassClient(hassUrl, hassToken);
   ```

3. Replace direct API calls with client methods:
   ```typescript
   // Before:
   const states = await getStates(hassUrl, hassToken, entityId);

   // After:
   if (entityId) {
     const state = await hassClient.getEntityState(entityId);
     const hassState = convertToHassEntity(state);
     // Use hassState...
   } else {
     const states = await hassClient.getAllStates();
     const hassStates = convertToHassEntities(states);
     // Use hassStates...
   }
   ```

4. Update error handling if necessary, ensuring consistent patterns.
