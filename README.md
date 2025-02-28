# Home Assistant MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server for integrating with [Home Assistant](https://www.home-assistant.io/), allowing LLMs to control and query your smart home.

## Features

- Query and control Home Assistant entities via natural language
- Works with any MCP-compatible client (like Claude Desktop)
- Provides tools for state management, service calls, history, and more
- Secure authentication using Home Assistant long-lived access tokens
- Multiple transport options (stdio for local processes, SSE for remote clients)

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-hass-server.git
cd mcp-hass-server

# Install dependencies
npm install

# Build the server
npm run build
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```
HASS_URL=http://your-home-assistant:8123
HASS_TOKEN=your_long_lived_access_token
PORT=3000
```

To get a long-lived access token:
1. Log in to your Home Assistant instance
2. Click on your profile (bottom left)
3. Scroll down to "Long-Lived Access Tokens"
4. Create a new token with a descriptive name
5. Copy the token value (you won't see it again)

## Usage

### Running as a standalone server

```bash
# Start the server with HTTP/SSE transport
npm run start

# Or use stdio mode for direct process communication
npm run start -- --stdio
```

### Integration with Claude Desktop

To use with Claude Desktop:

1. Edit your Claude Desktop config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`

2. Add the server configuration:

```json
{
  "mcpServers": {
    "homeassistant": {
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

3. Restart Claude Desktop

## Available Tools

The server exposes several tools for interacting with Home Assistant:

- `get_states` - Query entity states
- `call_service` - Call Home Assistant services
- `get_history` - Retrieve historical entity data
- `list_services` - List available services
- `get_config` - Get Home Assistant configuration
- `list_events` - List available event types
- `fire_event` - Trigger custom events
- `render_template` - Process Jinja2 templates

For detailed usage examples, see [docs/hass-mcp.md](docs/hass-mcp.md).

## Security

This server requires a Home Assistant access token with full access. Consider these security recommendations:

- Only run the server on trusted networks
- Use HTTPS if exposing the server remotely
- Keep your `.env` file secure and don't commit it to source control
- Consider using a token with limited permissions when possible

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.