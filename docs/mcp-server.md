# Home Assistant MCP Server

This MCP server provides integration with Home Assistant, allowing LLMs to interact with smart home devices and automation systems through the Home Assistant REST API. The server enables natural language control and status querying of connected devices, sensors, and services.

## Features

- **State Management**: Query the state of all entities or specific devices
- **Service Control**: Call Home Assistant services to control devices (turn on/off, adjust settings)
- **History Access**: Retrieve historical state data for analysis and patterns
- **Configuration Tools**: Get information about Home Assistant setup and components
- **Event Handling**: View available events and trigger custom events
- **Template Rendering**: Process Jinja2 templates for dynamic data
- **WebSocket Support**: Real-time updates via Home Assistant WebSocket API
- **Mock Mode**: Functioning demo mode when Home Assistant isn't available

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

4. **list_services**: View available services
   - See all domains and their services
   - Discover service capabilities

5. **get_config**: View system configuration
   - Get Home Assistant version
   - View location settings
   - Check loaded components

6. **list_events**: View available event types
   - See all event types that can be triggered
   - Check listener counts

7. **fire_event**: Trigger custom events
   - Fire any event on the Home Assistant bus
   - Include custom event data

8. **render_template**: Process dynamic templates
   - Use Home Assistant's template engine
   - Format data from entities
   - Create computed values and text

9. **subscribe_entities**: Subscribe to real-time entity state changes
   - Get updates when entity states change
   - Filter to specific entities of interest
   - Create named subscriptions for tracking

10. **unsubscribe_entities**: Remove entity subscriptions
    - Stop receiving updates for specific subscriptions
    - Free resources when no longer needed

11. **get_recent_changes**: Get recent state changes
    - View entities that changed since last check
    - Get details about state transitions

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
   HASS_MOCK=false  # Set to true to enable mock mode
   HASS_WEBSOCKET=true  # Set to true to enable WebSocket for real-time updates
   ```

3. Installation options:

   **Global installation:**
   ```
   npm install -g hass-mcp-server
   hass-mcp
   ```

   **Local installation:**
   ```
   npm install
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
           "HASS_TOKEN": "your_token_here",
           "HASS_WEBSOCKET": "true"
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
   - Check Home Assistant connection status at `/ha-status`

2. **STDIO**: For direct process communication (like Claude Desktop)
   - Activated by passing `--stdio` flag
   - Ideal for local integration with MCP hosts

## Run Modes

### Normal Mode
Connects to your Home Assistant instance and relays all requests:
```
npm run start       # SSE mode (web server)
npm run start:stdio # STDIO mode (for Claude Desktop)
```

### Mock Mode
Provides simulated responses when Home Assistant is unavailable:
```
npm run start:mock        # SSE mode with mock data
npm run start:stdio:mock  # STDIO mode with mock data
```

You can also enable mock mode by:
- Setting `HASS_MOCK=true` in your `.env` file
- Adding the `--mock` flag to any command
- The server automatically falls back to mock mode if Home Assistant is unreachable

## API Status Endpoint

Check if the server can reach your Home Assistant instance:
```
GET /ha-status
```

Response:
```json
{
  "status": "connected",
  "message": "Successfully connected to Home Assistant"
}
```

Or if disconnected:
```json
{
  "status": "disconnected",
  "message": "Cannot connect to Home Assistant: Connection refused",
  "url": "http://localhost:8123"
}
```

## Health Check

Basic server health check endpoint:
```
GET /health
```

Response:
```json
{
  "status": "ok"
}
```