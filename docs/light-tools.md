# Home Assistant Light Tools

This component provides specialized tools for managing and controlling Home Assistant lights through the MCP protocol.

## Available Tools

### 1. `get_lights`

Retrieves information about lights in your Home Assistant instance.

#### Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity_id` | string | No | Optional light entity ID to filter results (e.g., "light.living_room") |
| `include_details` | boolean | No | Include detailed information about supported features (default: true) |

#### Example:

```javascript
// Get all lights with basic info
const result = await mcp.executeToolByName("get_lights", {
  include_details: false
});

// Get specific light with full details
const result = await mcp.executeToolByName("get_lights", {
  entity_id: "light.kitchen",
  include_details: true
});
```

### 2. `manage_light`

Controls lights with a wide range of options including turning them on/off, changing brightness, color, and effects.

#### Parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entity_id` | string | Yes | Light entity ID to control (e.g., "light.living_room") |
| `action` | string | Yes | Action to perform: "turn_on", "turn_off", or "toggle" |
| `brightness` | number | No | Brightness level (0-255) |
| `brightness_pct` | number | No | Brightness percentage (0-100%) |
| `color_name` | string | No | Named color (e.g., "red", "green", "blue") |
| `rgb_color` | number[] | No | RGB color as [r, g, b] with values from 0-255 |
| `rgbw_color` | number[] | No | RGBW color as [r, g, b, w] with values from 0-255 |
| `rgbww_color` | number[] | No | RGBWW color as [r, g, b, c_white, w_white] with values from 0-255 |
| `hs_color` | number[] | No | Hue/Saturation color as [hue (0-360), saturation (0-100)] |
| `xy_color` | number[] | No | CIE xy color as [x (0-1), y (0-1)] |
| `color_temp` | number | No | Color temperature in mireds |
| `kelvin` | number | No | Color temperature in Kelvin |
| `effect` | string | No | Light effect to apply (e.g., "colorloop", "random") |
| `transition` | number | No | Transition time in seconds |
| `flash` | string | No | Flash effect ("short" or "long") |
| `color_mode` | string | No | Color mode to use |

#### Example:

```javascript
// Turn on a light at 75% brightness
const result = await mcp.executeToolByName("manage_light", {
  entity_id: "light.living_room",
  action: "turn_on",
  brightness_pct: 75
});

// Set light to blue with a 2-second transition
const result = await mcp.executeToolByName("manage_light", {
  entity_id: "light.bedroom",
  action: "turn_on",
  rgb_color: [0, 0, 255],
  transition: 2
});

// Turn off a light
const result = await mcp.executeToolByName("manage_light", {
  entity_id: "light.kitchen",
  action: "turn_off"
});
```

## Integration with Home Assistant Light Entities

This tool supports all standard Home Assistant light capabilities based on the light integration schema. The available options depend on your specific light's capabilities.

Some lights may only support basic on/off functionality, while others support brightness, color, temperature, and effects. The `get_lights` tool with `include_details: true` can be used to discover the capabilities of your specific lights.

## Error Handling

Both tools perform validation to ensure:
- The light entity exists
- The specified parameters are valid for the light
- The service call succeeds

If any errors occur, the tool will return an error object with a descriptive message.

## More Information

For more details on Home Assistant light controls, refer to the [Home Assistant Light Integration documentation](https://www.home-assistant.io/integrations/light/).
