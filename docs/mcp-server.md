# Home Assistant MCP Server

This MCP server provides integration with Home Assistant, allowing LLMs to interact with smart home devices and automation systems through the Home Assistant REST API. The server enables natural language control and status querying of connected devices, sensors, and services.

## Features

- **State Management**: Query the state of all entities or specific devices
- **Service Control**: Call Home Assistant services to control devices (turn on/off, adjust settings)
- **History Access**: Retrieve historical state data for analysis and patterns
- **Configuration Tools**: Get information about Home Assistant setup and components
- **Event Handling**: View available events and trigger custom events
- **Template Rendering**: Process Jinja2 templates for dynamic data

## Core Tools

The server exposes several key tools for Home Assistant interaction:

1. **get_states**: Query the current state of Home Assistant entities
   - View all entity states at once
   - Filter to a specific entity by ID
   - Get detailed attribute data for sensors and devices

2. **call_service**: Control devices and trigger automations
   - Execute any Home Assistant service
   - Specify domain, service name, and parameters
   - Control lights, switches, media players, and other devices

3. **get_history**: Analyze historical state changes
   - Filter by entity ID
   - Specify custom time ranges
   - Track device state changes over time

4. **render_template**: Process dynamic templates
   - Use Home Assistant's template engine
   - Format data from entities
   - Create computed values and text

## Setup Instructions

1. Create a long-lived access token in your Home Assistant instance:
   - In Home Assistant, go to your profile (click your username in the sidebar)
   - Scroll down to "Long-Lived Access Tokens"
   - Create a new token with a descriptive name (e.g., "MCP Server")
   - Copy the generated token (you won't be able to see it again)

2. Configure your `.env` file:
   ```
   HASS_URL=http://your-home-assistant:8123
   HASS_TOKEN=your_long_lived_access_token
   PORT=3000
   ```

3. Build and run the server:
   ```
   npm run build
   npm run start
   ```

4. For Claude Desktop integration, add this to your `claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "hass": {
         "command": "node",
         "args": ["/path/to/mcp-hass-server/dist/index.js"],
         "env": {
           "HASS_URL": "http://your-home-assistant:8123",
           "HASS_TOKEN": "your_token_here"
         }
       }
     }
   }
   ```

## Connection Options

The server supports two transport modes:

1. **SSE (Server-Sent Events)**: Default mode, starts an HTTP server for web clients
   - Runs on port 3000 (configurable via PORT env var)
   - Exposes `/sse` endpoint for client connections
   - Includes health check at `/health`

2. **STDIO**: For direct process communication (like Claude Desktop)
   - Activated by passing `--stdio` flag
   - Ideal for local integration with MCP hosts