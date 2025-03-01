# Home Assistant API TypeScript Definitions

This directory contains TypeScript type definitions for the Home Assistant REST API, automatically generated from the OpenAPI specification.

## Overview

The `hass-api.d.ts` file provides complete TypeScript definitions for:

- All API endpoints
- Request parameters
- Response bodies
- Schema definitions for Home Assistant entities

These types enhance your development experience by providing:

- Autocompletion for API calls
- Type checking for request parameters
- Type safety for response handling
- Documentation via hover information

## Type Aliases

For convenience, we provide a set of reusable type aliases in `hass-types.ts` that make working with the complex generated types easier:

```typescript
import type { HassState, HassConfig, HassServiceData } from '../types/hass-types';

// Instead of this:
// const state: components['schemas']['State'] = ...

// You can use this:
const state: HassState = ...
```

The type aliases include:

- `HassState` - Entity state object
- `HassConfig` - Home Assistant configuration
- `HassAttributes` - Entity attributes
- `HassServiceData` - Service call data
- `HistoryResponse` - History API response
- ...and many more

## Usage

### 1. Direct Type Import

Import types directly from the definition file:

```typescript
import type { components, operations } from '../types/hass-api';

// Use schema types
const handleState = (state: components['schemas']['State']) => {
  console.log(`Entity ${state.entity_id} has state: ${state.state}`);
};

// For API responses
const processConfig = (config: components['schemas']['ConfigResponse']) => {
  console.log(`Home Assistant version: ${config.version}`);
};
```

### 2. Using Type Aliases (Recommended)

Use the provided type aliases for better readability:

```typescript
import type { HassState, HassConfig } from '../types/hass-types';

// Use the aliases
function processState(state: HassState) {
  console.log(`Entity ${state.entity_id} has state: ${state.state}`);
}

function processConfig(config: HassConfig) {
  console.log(`Home Assistant version: ${config.version}`);
}
```

### 3. With Axios or Other HTTP Clients

Use the types with your HTTP client of choice:

```typescript
import axios from 'axios';
import type { HassState } from '../types/hass-types';

async function getEntityState(entityId: string): Promise<HassState> {
  const response = await axios.get(`/api/states/${entityId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data;
}
```

### 4. Use with the HassClient

For a more structured approach, use the provided `HassClient` class, which is fully typed using these definitions:

```typescript
import { HassClient } from '../api/hass-client';

const client = new HassClient('http://homeassistant.local:8123/api', 'your_token');

// All methods are properly typed with request parameters and response types
async function example() {
  const states = await client.getAllStates();
  const livingRoom = await client.getEntityState('light.living_room');

  await client.callService('light', 'turn_on', {
    entity_id: 'light.living_room',
    brightness: 255
  });
}
```

See the example file in `src/examples/hass-usage-example.ts` for a complete demonstration.

## Type Structure

The types are organized as follows:

- `paths`: API endpoint paths and available HTTP methods
- `components.schemas`: Reusable schema objects like `State`, `ConfigResponse`, etc.
- `operations`: API operations with parameters and response types
- `webhooks`: Webhook-related types (empty in current API spec)

## Creating Custom Type Aliases

If you need additional type aliases, you can extend the `hass-types.ts` file:

```typescript
// Import from hass-types.ts
import type { HassState } from '../types/hass-types';

// Create your own alias
export type LightEntity = HassState & {
  attributes: {
    brightness?: number;
    color_temp?: number;
    supported_features?: number;
  }
};
```

## Updating Types

If the Home Assistant API changes or is extended, update the OpenAPI YAML file and regenerate the types:

```bash
npx openapi-typescript ./docs/hass-openapi.yaml -o ./src/types/hass-api.d.ts
```

After regenerating, you may need to update the type aliases in `hass-types.ts` as well.

## Resources

- [Home Assistant REST API Documentation](https://developers.home-assistant.io/docs/api/rest/)
- [openapi-typescript Documentation](https://github.com/drwpow/openapi-typescript)
