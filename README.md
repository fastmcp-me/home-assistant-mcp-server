# Logz.io MCP Server

[![Test](https://github.com/yourusername/logzio-mcp-server/actions/workflows/test.yml/badge.svg)](https://github.com/yourusername/logzio-mcp-server/actions/workflows/test.yml)

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

## Continuous Integration

This project uses GitHub Actions for continuous integration:

- **Test Workflow**: Runs tests and linting on Node.js 18.x and 20.x
- **Package Validation**: Ensures the package can be built and published correctly

These workflows run automatically on push to the main branch and for pull requests.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- A Logz.io account with API access

### Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with your Logz.io API key:

```
LOGZIO_API_KEY=your-api-key-here
LOGZIO_REGION=us  # Optional: Set to your Logz.io region (default: us)
```

> **Security Note**: Never commit your `.env` file to version control. The `.gitignore` and `.npmignore` files already exclude it, but double-check to ensure your API credentials remain secure.

### Running the Server

Start the server with:

```bash
npm start
```

Or for development:

```bash
npm run dev
```

### Using as a Binary

After installing globally:

```bash
npm install -g logzio-mcp-server
```

You can run the server directly:

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

The codebase is organized into the following structure:

```
src/
├── api/
│   └── logzio.ts       # Logz.io API client
├── schemas/
│   ├── aggregation.ts  # Schemas for aggregations
│   ├── highlight.ts    # Schemas for highlighting
│   └── query.ts        # Schemas for queries
├── tools/
│   ├── advanced.ts     # Advanced log tools
│   ├── analysis.ts     # Log analysis tools
│   ├── fields.ts       # Field management tools
│   ├── resources.ts    # Resource examples
│   └── search.ts       # Search tools
├── utils/
│   ├── formatter.ts    # Result formatting utilities
│   └── time.ts         # Time-related utilities
└── index.ts            # Main entry point
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

## Resources

- `query-examples`: Common query examples for different log search scenarios

## Development Tools

This project uses several development tools:

### Build & Runtime Tools

- **TypeScript**: Static typing for JavaScript
- **Node.js**: JavaScript runtime (v18+)
- **npm**: Package manager

### Testing

- **Jest**: JavaScript testing framework
- **ts-jest**: TypeScript support for Jest

### Code Quality

- **ESLint**: Linting tool for identifying problematic patterns
- **@typescript-eslint/eslint-plugin & @typescript-eslint/parser**: TypeScript support for ESLint
- **Prettier**: Code formatter

### MCP Integration

- **@modelcontextprotocol/sdk**: SDK for implementing Model Context Protocol
- **MCP Inspector**: Testing tool for MCP compatibility

### CI/CD Tools

- **GitHub Actions**: Automated workflows for testing and package validation
  - **Test Workflow**: Runs tests and linting on Node.js 22.x
  - **Package Validation**: Ensures package can be built and published correctly
- **actions/checkout**: GitHub Action for checking out repository code
- **actions/setup-node**: GitHub Action for setting up Node.js
- **npm ci**: Clean installation of dependencies in CI environment
- **knip**: Tool for checking missing or unnecessary dependencies

## Releasing to npm

This project is configured for automated npm publishing via GitHub Actions:

### Using GitHub Actions (Recommended)

1. Navigate to the GitHub repository
2. Go to the "Actions" tab
3. Select the "NPM Publish" workflow
4. Click "Run workflow"
5. Choose a version increment:
   - `patch` (1.0.0 → 1.0.1) for bug fixes
   - `minor` (1.0.0 → 1.1.0) for new features
   - `major` (1.0.0 → 2.0.0) for breaking changes
   - Or specify an explicit version (e.g., `1.2.3`)
6. Click "Run workflow" to start the release process

The workflow will:
- Run tests to ensure the package is ready for release
- Build the package
- Increment the version based on your input
- Publish to npm
- Create a git tag and push changes back to the repository

### Prerequisites for npm Publishing

1. Create an npm access token with publish permissions
2. Add the token as a repository secret named `NPM_TOKEN` in your GitHub repository:
   - Go to your GitHub repository
   - Click Settings > Secrets and variables > Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your npm access token

### Manual Publishing

If you prefer to publish manually:

```bash
# Ensure tests pass
npm test

# Build the package
npm run build

# Increment version
npm version patch|minor|major

# Publish to npm
npm publish

# Push changes including the version tag
git push --follow-tags
```

### Utilities

- **dotenv**: Environment variable management
- **node-fetch**: HTTP client for making API requests
- **zod**: Schema validation library

## License

MIT
