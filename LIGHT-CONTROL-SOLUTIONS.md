# Home Assistant Light Control Troubleshooting Guide

## Problem Summary

When attempting to control multiple lights in Home Assistant using the `light.turn_on` service with the following structure:

```json
{
  "tool": "call_service",
  "domain": "light",
  "service": "turn_on",
  "target": {
    "entity_id": [
      "light.light",
      "light.shapes_7fef",
      "light.bed",
      "light.strip"
    ]
  },
  "service_data": {
    "brightness_pct": 100
  }
}
```

You receive a `400 Bad Request` error, which indicates that there's an issue with the structure of your service call.

## Root Causes Analysis

After examining the code and API structure, we've identified several potential causes for this error:

1. **Incorrect Service Call Structure**: The Home Assistant API expects service data to be structured differently than what was provided in the original call.

2. **Entity Incompatibility**: Some of the specified light entities might not support the `brightness_pct` parameter or might have other compatibility issues.

3. **Unavailable Entities**: Including unavailable entities in a bulk call might cause the entire call to fail.

4. **API Version Differences**: Different versions of Home Assistant handle target specifications differently.

## Solution 1: Use entity_id Inside service_data

The most common and reliable pattern for Home Assistant service calls is to include the `entity_id` inside the `service_data` object rather than using a separate `target` object:

```json
{
  "tool": "call_service",
  "domain": "light",
  "service": "turn_on",
  "service_data": {
    "entity_id": [
      "light.shapes_7fef",
      "light.bed",
      "light.strip"
    ],
    "brightness_pct": 100
  }
}
```

This approach follows the traditional Home Assistant API pattern and is the most widely supported across different Home Assistant versions.

## Solution 2: Control Lights Individually

If bulk control is causing issues, controlling each light individually often resolves the problem:

```json
[
  {
    "tool": "call_service",
    "domain": "light",
    "service": "turn_on",
    "service_data": {
      "entity_id": "light.shapes_7fef",
      "brightness_pct": 100
    }
  },
  {
    "tool": "call_service",
    "domain": "light",
    "service": "turn_on",
    "service_data": {
      "entity_id": "light.bed",
      "brightness_pct": 100
    }
  },
  {
    "tool": "call_service",
    "domain": "light",
    "service": "turn_on",
    "service_data": {
      "entity_id": "light.strip",
      "brightness_pct": 100
    }
  }
]
```

This approach has the advantage of:
- Isolating problematic entities
- Providing more detailed error information
- Ensuring that compatible entities still get controlled even if others fail

## Solution 3: Use brightness Instead of brightness_pct

Some light entities may not support the `brightness_pct` parameter but do support the raw `brightness` value:

```json
{
  "tool": "call_service",
  "domain": "light",
  "service": "turn_on",
  "service_data": {
    "entity_id": [
      "light.shapes_7fef",
      "light.bed",
      "light.strip"
    ],
    "brightness": 255
  }
}
```

Notes:
- The `brightness` parameter uses a range of 0-255 (where 255 is 100%)
- This parameter is more universally supported across different light integrations

## Solution 4: Correct Target Structure

If you prefer using the newer `target` parameter approach, ensure it's structured correctly:

```json
{
  "tool": "call_service",
  "domain": "light",
  "service": "turn_on",
  "target": {
    "entity_id": [
      "light.shapes_7fef",
      "light.bed",
      "light.strip"
    ]
  },
  "service_data": {
    "brightness_pct": 100
  }
}
```

This structure is used in newer Home Assistant versions, but it may require specific formatting when sent to the Home Assistant API directly.

## Determining Entity Compatibility

To determine which attributes each light supports, use:

```json
{
  "tool": "get_states",
  "entity_id": "light.shapes_7fef"
}
```

Look for:
- `supported_features` attribute indicating which capabilities are supported
- `supported_color_modes` for color-capable lights
- Whether the light is currently available

## Testing and Validation

We've created test scripts to help you validate these solutions:

1. **Direct API Test**: Use `test-ha-solutions.js` to test against your Home Assistant instance directly.
2. **MCP Server Test**: Use `mcp-fix-lights.js` when working through the MCP server.

## Conclusion

Based on our analysis, we recommend:

1. Start with Solution 1 (entity_id inside service_data) as the most reliable approach
2. If that fails, try Solution 2 (individual control)
3. If specific parameters are causing issues, try Solution 3 (brightness instead of brightness_pct)
4. Use the testing scripts to identify the optimal solution for your specific Home Assistant setup

By implementing these fixes, you should be able to reliably control your lights without encountering the 400 Bad Request error.
