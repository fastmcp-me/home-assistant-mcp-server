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

### call_service

Call any Home Assistant service:

```
# Turn on a light
call_service(domain="light", service="turn_on", data={"entity_id": "light.kitchen"})

# Set properties
call_service(domain="light", service="turn_on", data={
  "entity_id": "light.living_room",
  "brightness": 127,
  "color_name": "blue"
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
```

## Troubleshooting

- If you get authentication errors, check if your token is correct and not expired
- If entity data is missing, verify the entity exists in Home Assistant
- Check that your Home Assistant URL is correct and accessible
- For service call failures, verify the service exists and parameters are correct