# Logz.io MCP Server

[![Test](https://github.com/oleander/logzio-mcp-server/actions/workflows/test.yml/badge.svg)](https://github.com/oleander/logzio-mcp-server/actions/workflows/test.yml)

A Model Context Protocol (MCP) server for interacting with Logz.io logs and analytics.

## Overview

This server provides a set of tools for searching, analyzing, and visualizing log data stored in Logz.io. It uses the Model Context Protocol (MCP) to expose these capabilities to language models and other clients.

## Features

- **Search Tools**: Query logs using Elasticsearch DSL, simple text search, or user-friendly quick search
- **Field Tools**: Retrieve available fields in log indices
- **Analysis Tools**: Analyze log patterns, create histograms, and generate dashboards
- **Advanced Tools**: Trace requests across services, search by service, and build custom queries
- **Resources**: Access common query examples and patterns

## MCP Compatibility

This server implements the [Model Context Protocol](https://modelcontextprotocol.io/) specification, making it compatible with various MCP clients including:

- [Claude Desktop App](https://claude.ai/download)
- [Continue](https://github.com/continuedev/continue)
- [Cursor](https://cursor.com)
- Other MCP-compatible clients

### MCP Features Implemented

- **Tools**: Full support for tool discovery and execution
- **Error Handling**: Comprehensive error handling with detailed messages
- **Transport**: Standard stdio transport for local communication

### Testing MCP Compatibility

To test the server with the MCP Inspector:

```bash
./inspect.sh
```

This will launch the MCP Inspector connected to the server, allowing you to explore and test all available tools.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- A Logz.io account with API access

### Installation

#### Install from npm (recommended)

```bash
npm install -g logzio-mcp-server
```

#### Install from source

1. Clone the repository
```bash
git clone https://github.com/oleander/logzio-mcp-server.git
cd logzio-mcp-server
```

2. Install dependencies
```bash
npm install
```

3. Build the project
```bash
npm run build
```

### Configuration

Create a `.env` file in the root directory with your Logz.io API key:

```
LOGZIO_API_KEY=your-api-key-here
LOGZIO_REGION=us  # Optional: Set to your Logz.io region (default: us)
```

> **Security Note**: Never commit your `.env` file to version control. The `.gitignore` and `.npmignore` files already exclude it.

### Running the Server

Start the server with:

```bash
npm start
```

For development:

```bash
npm run dev
```

If installed globally:

```bash
logzio-mcp-server
```

### Integrating with Claude Desktop

To integrate with Claude Desktop, add the following to your Claude Desktop configuration file (located at `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "logzio-mcp": {
      "runtime": "node",
      "command": "logzio-mcp-server",
      "env": {
        "LOGZIO_API_KEY": "your-api-key-here",
        "LOGZIO_REGION": "eu|us"
      }
    }
  }
}
```

Replace `your-api-key-here` with your actual Logz.io API key.

## Project Structure

The codebase is organized as follows:

```
src/
├── api/          # Logz.io API client
├── schemas/      # Data validation schemas
├── tools/        # MCP tools implementation
├── types/        # TypeScript type definitions
├── utils/        # Utility functions
├── templates/    # Template files
├── prompts/      # Prompt templates
└── index.ts      # Main entry point
```

## Available Tools

### Search Tools

- `search-logs`: Search logs using Elasticsearch DSL
- `simple-search`: Search logs with a simple text query
- `quick-search`: Perform a simple log search with user-friendly output

### Field Tools

- `get-fields`: Get available fields in your log indices

### Analysis Tools

- `log-histogram`: Get log counts over time intervals
- `analyze-errors`: Analyze error patterns in logs
- `log-dashboard`: Get a dashboard view of log activity with key metrics

### Advanced Tools

- `service-logs`: Search logs for a specific service with optional severity filter
- `trace-request`: Trace a request across multiple services using a request ID
- `build-query`: Generate a query for common log search patterns

### Resources

- `query-examples`: Common query examples for different log search scenarios

## Development

### Scripts

- `npm run build` - Build the TypeScript project
- `npm run start` - Start the server
- `npm run dev` - Run in development mode with auto-reload
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run mcp` - Build and start the server
- `npm run inspect` - Run the MCP Inspector with the server

## Publishing to npm

### Using GitHub Actions (Recommended)

1. Go to the GitHub repository "Actions" tab
2. Select the "NPM Publish" workflow
3. Click "Run workflow"
4. Choose a version increment: `patch`, `minor`, `major`, or specify a version
5. Click "Run workflow"

The workflow will run tests, build the package, increment the version, publish to npm, and push changes to the repository.

### Prerequisites for npm Publishing

Add an npm access token as a GitHub repository secret named `NPM_TOKEN`.

### Manual Publishing

```bash
npm test
npm run build
npm version patch|minor|major
npm publish
git push --follow-tags
```

## License

MIT
