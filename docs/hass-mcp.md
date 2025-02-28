# Home Assistant MCP Guide

## Introduction

This document explains how to use the Home Assistant MCP server with language models like Claude. The server provides natural language control over your Home Assistant smart home system, allowing you to:

- Check device status
- Control lights, switches, and other devices
- Get historical data
- Trigger automations
- Render custom templates

## Prerequisites

- A running Home Assistant instance
- A long-lived access token from Home Assistant
- The Home Assistant MCP server

## Example Interactions

### Checking Device Status

You can ask about the state of any device:

```
What devices are in my home?
Is the living room light on?
What's the temperature in the bedroom?
Which doors are open right now?
Are any lights left on?
```

### Controlling Devices

You can control your smart home devices:

```
Turn on the kitchen light
Set the living room light to 50% brightness
Turn off all the lights in the house
Turn the bedroom fan to medium speed
Set the temperature to 72 degrees
```

### Historical Data

You can request historical data about your devices:

```
Show me the temperature history for the last 24 hours
When was the front door last opened?
How long has the TV been on today?
What was the energy usage yesterday?
```

### Advanced Features

You can work with more complex Home Assistant features:

```
Run the "Good Morning" automation
Show me all the zones defined in my Home Assistant
Render a template that shows the number of lights currently on
List all available services
```

## Tools Reference

### get_states

Get the current state of entities:

```
# Get all states
get_states()

# Get specific entity
get_states(entity_id="light.living_room")
```

### service

Call any Home Assistant service:

```
# Turn on a light
service(domain="light", service="turn_on", service_data={"entity_id": "light.kitchen"})

# Set properties
service(domain="light", service="turn_on", service_data={
  "entity_id": "light.living_room",
  "brightness": 127,
  "color_name": "blue"
})

# Run an automation
service(domain="automation", service="trigger", service_data={
  "entity_id": "automation.good_morning"
})

# Set the climate
service(domain="climate", service="set_temperature", service_data={
  "entity_id": "climate.living_room",
  "temperature": 72
})
```

### get_history

Retrieve historical state data:

```
# Get history for an entity
get_history(entity_id="sensor.temperature", start_time="2023-04-01T00:00:00Z")

# Specific time range
get_history(
  entity_id="binary_sensor.door",
  start_time="2023-04-01T00:00:00Z",
  end_time="2023-04-02T00:00:00Z"
)
```

### list_services

List all available services:

```
# Get all services
list_services()
```

The output will contain domains and their available services, which can help discover what functionality is available in the Home Assistant instance.

### get_config

Get Home Assistant configuration:

```
# Get system configuration
get_config()
```

This returns system settings like location, units, version, and loaded components.

### list_events

List available event types:

```
# Get all event types
list_events()
```

This can be useful to discover what events can be triggered or listened for.

### fire_event

Trigger a custom event:

```
# Fire a simple event
fire_event(event_type="my_custom_event")

# Fire event with data
fire_event(
  event_type="my_custom_event",
  event_data={
    "source": "mcp",
    "value": 42
  }
)
```

### render_template

Process Jinja2 templates:

```
# Simple template
render_template(template="{{ states('sensor.temperature') }}")

# Complex template
render_template(template="""
  {% set count = 0 %}
  {% for entity_id in states.light if states(entity_id) == 'on' %}
    {% set count = count + 1 %}
  {% endfor %}
  {{ count }} lights are currently on.
""")

# Formatting time
render_template(template="""
  The current time is {{ now().strftime('%H:%M') }}
""")

# Conditional logic
render_template(template="""
  {% if is_state('binary_sensor.front_door', 'on') %}
    The front door is open.
  {% else %}
    The front door is closed.
  {% endif %}
""")
```

### WebSocket Real-Time Updates

#### subscribe_entities

Subscribe to entity changes to receive real-time updates:

```
# Subscribe to specific entities
subscribe_entities(
  entity_ids=["light.living_room", "binary_sensor.front_door"],
  subscription_id="my_lights_and_door"
)

# Subscribe to all lights
# First get all light entities
light_entities = [
  entity["entity_id"]
  for entity in get_states()
  if entity["entity_id"].startswith("light.")
]

# Then subscribe to them
subscribe_entities(
  entity_ids=light_entities,
  subscription_id="all_lights"
)
```

#### unsubscribe_entities

Stop receiving updates for a subscription:

```
# Unsubscribe from a specific subscription
unsubscribe_entities(subscription_id="my_lights_and_door")
```

#### get_recent_changes

Check for any entity state changes since the last check:

```
# Get all changes since last check
changes = get_recent_changes()

# Example output analysis
for entity in changes:
  print(f"Entity {entity['entity_id']} changed to {entity['state']}")
```

## Common Service Domains

Home Assistant organizes functionality into domains. Here are common ones:

- **light**: Control lights (turn_on, turn_off, toggle)
- **switch**: Control switches and outlets
- **automation**: Trigger or control automations
- **scene**: Activate scenes
- **script**: Run scripts
- **media_player**: Control TVs, speakers, etc.
- **climate**: Control thermostats and HVAC
- **cover**: Control blinds, garage doors, etc.
- **fan**: Control fans
- **notify**: Send notifications
- **input_boolean**: Toggle boolean helpers
- **input_select**: Control dropdown helpers

## Working with Mock Mode

If the server can't connect to your Home Assistant instance, it will use mock data. This is useful for:

- Testing without a live Home Assistant instance
- Developing automations offline
- Demonstrating functionality

Mock mode provides simulated data for:

- Basic entity states (lights, switches, sensors)
- Service calls (which return success but don't control real devices)
- Configuration data
- Event types

## Troubleshooting

- If you get authentication errors, check if your token is correct and not expired
- If entity data is missing, verify the entity exists in Home Assistant
- Check that your Home Assistant URL is correct and accessible
- For service call failures, verify the service exists and parameters are correct
- If you're getting timeout errors, check if Home Assistant is running
- When getting unexpected data, check if you're in mock mode (the server may be using simulated data)
- For WebSocket issues:
  - Ensure `HASS_WEBSOCKET=true` is set in your environment
  - Check that your Home Assistant instance supports WebSocket API (all modern installations do)
  - WebSocket subscriptions can sometimes disconnect; use `get_recent_changes()` periodically to check connection status
  - If updates stop coming in, try unsubscribing and resubscribing to refresh the connection
