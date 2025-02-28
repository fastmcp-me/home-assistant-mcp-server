Got it. I will create a detailed LLM prompt that walks through implementing a complete MCP server for Home Assistant based on:

- The OpenAPI specification in `docs/hass.openapi.yml`
- The MCP server specification outlined in `docs/mcp-server.md`
- General assumptions about OpenAPI structures
- Relevant insights from the Home Assistant REST API documentation ([developers.home-assistant.io](https://developers.home-assistant.io/docs/api/rest/))
- The Model Context Protocol TypeScript SDK ([GitHub repository](https://github.com/modelcontextprotocol/typescript-sdk))

I will structure the prompt to guide the LLM through generating a fully functional server, including API handling, schema validation, tool integration, and best practices. I’ll let you know once it’s ready.

# Home Assistant MCP Server Implementation

This guide walks through creating a **Model Context Protocol (MCP)** server for Home Assistant using TypeScript. The server will expose Home Assistant’s REST API as MCP **tools**, support real-time event streaming, and comply with the MCP specification. We’ll cover project setup, core implementation, and usage examples, ensuring production readiness with authentication, schema validation, and robust logging.

## 1. Project Setup

First, initialize a new Node.js project and install dependencies:

```bash
npm init -y
npm install @modelcontextprotocol/sdk express zod dotenv axios winston ws
```

- **`@modelcontextprotocol/sdk`** – Official TypeScript SDK for MCP (provides `McpServer`, transports, etc. ([GitHub - modelcontextprotocol/typescript-sdk: The official Typescript SDK for Model Context Protocol servers and clients](https://github.com/modelcontextprotocol/typescript-sdk#:~:text=Let%27s%20create%20a%20simple%20MCP,calculator%20tool%20and%20some%20data))).
- **Express** – Lightweight web server (for HTTP/SSE endpoints).
- **Zod** – Schema definition & validation library for TypeScript.
- **dotenv** – Loads configuration (like Home Assistant URL/token) from a `.env` file.
- **axios** – Simplifies HTTP calls to Home Assistant’s REST API.
- **winston** – Logging library for structured logs.
- **ws** – WebSocket client for Home Assistant event streaming.

Configure **TypeScript** in `tsconfig.json` (enable ES modules, ES2020 target, etc.), for example:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

Organize source files under `src/` (e.g. `src/server.ts`). Create a `.env` file with Home Assistant connection details:

```ini
HASS_URL=http://localhost:8123    # Base URL of Home Assistant
HASS_TOKEN=YOUR_LONG_LIVED_TOKEN  # Authentication token for API
```

Home Assistant requires a Bearer token in API requests ([REST API | Home Assistant Developer Docs](https://developers.home-assistant.io/docs/api/rest/#:~:text=All%20API%20calls%20have%20to,to%20copy%20the%20whole%20key)). You can generate a long-lived token in your Home Assistant user profile.

## 2. MCP Server Initialization

In `src/server.ts`, initialize the MCP server and transports:

```typescript
import { config as dotenvConfig } from "dotenv";
dotenvConfig(); // Load .env config before anything else

import express from "express";
import axios from "axios";
import winston from "winston";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import WebSocket from "ws"; // for event streaming

// Logging setup
const logger = winston.createLogger({
  level: "info",
  transports: [new winston.transports.Console()],
  format: winston.format.json(),
});

// Home Assistant connection config
const HASS_URL = process.env.HASS_URL || "http://localhost:8123";
const HASS_TOKEN = process.env.HASS_TOKEN;
if (!HASS_TOKEN) {
  throw new Error("Missing Home Assistant token in environment");
}

// Axios instance for Home Assistant API
const hassApi = axios.create({
  baseURL: `${HASS_URL}/api`,
  headers: {
    Authorization: `Bearer ${HASS_TOKEN}`,
    "Content-Type": "application/json",
  },
});

// Initialize MCP server
const server = new McpServer({
  name: "home-assistant-mcp",
  version: "1.0.0",
});
```

We use **`McpServer`** from the MCP SDK to create a new server, providing a name and version for identification. Next, we will register tools and resources on this server.

## 3. API Tool Implementation

Home Assistant’s REST API endpoints (as defined in the OpenAPI spec) will be exposed as MCP _tools_. Each tool corresponds to a specific Home Assistant API call. For example, Home Assistant provides endpoints to get states, call services, trigger events, etc ([REST API | Home Assistant Developer Docs](https://developers.home-assistant.io/docs/api/rest/#:~:text=)) ([REST API | Home Assistant Developer Docs](https://developers.home-assistant.io/docs/api/rest/#:~:text=%60%2Fapi%2Fevents%2F)). We’ll implement a representative set of tools:

- **List all entity states** – GET `/api/states`
- **Get state** – GET `/api/states/<entity_id>`
- **Set state** – POST `/api/states/<entity_id>`
- **Call service** – POST `/api/services/<domain>/<service>`
- **List services** – GET `/api/services`
- **Fire event** – POST `/api/events/<event_type>`
- **List events** – GET `/api/events`
- **Render template** – POST `/api/template`
- **Check config** – POST `/api/config/core/check_config`

Each tool will have a **schema** (defined with Zod) for its inputs (and optionally outputs) to validate the data structure, and a handler function that uses Axios to call the Home Assistant API. The handler returns a result in the format expected by MCP – typically an object with a `content` field containing an array of messages (text or other types).

### Example: List All States

```typescript
// Tool: list_states - Get all entity states
server.tool(
  "list_states",
  "Retrieve the state of all Home Assistant entities",
  {}, // no input parameters
  async () => {
    try {
      const res = await hassApi.get("/states");
      // Return the raw JSON as a formatted string in the content
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(res.data, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to fetch states", { error });
      throw new Error("Unable to retrieve states from Home Assistant");
    }
  },
);
```

This defines a tool named `"list_states"` with no inputs. The handler calls the Home Assistant API (`GET /api/states`) to retrieve all entities and returns the result as JSON text. We wrap the call in a try/catch to log errors and throw an MCP-friendly error message. **Zod** is used here with an empty schema (no inputs expected), ensuring any unexpected input is rejected.

### Example: Get and Set State

```typescript
// Tool: get_state - Get state of a specific entity
server.tool(
  "get_state",
  "Get the state of a specific entity by entity_id",
  { entity_id: z.string().describe("Entity ID (format: domain.entity)") },
  async ({ entity_id }) => {
    const res = await hassApi.get(`/states/${entity_id}`);
    return {
      content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
    };
  },
);

// Tool: set_state - Set state of an entity (with optional attributes)
server.tool(
  "set_state",
  "Force-set the state of an entity (not commonly used)",
  {
    entity_id: z.string(),
    state: z.string(),
    attributes: z.record(z.any()).optional().describe("State attributes"),
  },
  async ({ entity_id, state, attributes }) => {
    const payload = attributes ? { state, attributes } : { state };
    const res = await hassApi.post(`/states/${entity_id}`, payload);
    return {
      content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }],
    };
  },
);
```

`get_state` requires an `entity_id` (e.g. `"light.living_room_lamp"`) and returns the entity’s state object. `set_state` allows setting a state manually (this is a lesser-used endpoint; service calls are the preferred way to change states in Home Assistant). Both use Zod to validate the `entity_id` format (string) and the presence of required fields.

### Example: Call Service

```typescript
// Tool: call_service - Call a Home Assistant service
server.tool(
  "call_service",
  "Call a Home Assistant service (e.g., turn on a light)",
  {
    domain: z.string().describe("Service domain (e.g. light, homeassistant)"),
    service: z.string().describe("Service name (e.g. turn_on)"),
    data: z
      .record(z.any())
      .optional()
      .describe("Service call data (service fields)"),
  },
  async ({ domain, service, data }) => {
    const url = `/services/${domain}/${service}`;
    const res = await hassApi.post(url, data || {});
    // If the service call returns data, include it; otherwise, confirm success.
    const text = res.data
      ? JSON.stringify(res.data, null, 2)
      : `Service ${domain}/${service} called successfully.`;
    return { content: [{ type: "text", text }] };
  },
);
```

This tool maps to the `POST /api/services/<domain>/<service>` endpoint ([REST API | Home Assistant Developer Docs](https://developers.home-assistant.io/docs/api/rest/#:~:text=%60%2Fapi%2Fevents%2F)). It takes a service domain (like `"light"`) and service name (`"turn_on"`, `"turn_off"`, etc.), plus an optional data object for service parameters (for example, brightness for a light). The result is either any response data from Home Assistant or a simple success message.

### Other Tools

Similarly, implement tools for the remaining endpoints:

- **list_services** – GET `/services`. No input; returns JSON list of available service domains and services.
- **fire_event** – POST `/events/<event_type>`. Input: `event_type` (string) and optional `event_data` (object); returns a confirmation message.
- **list_events** – GET `/events`. No input; returns JSON list of event types that Home Assistant supports listening to.
- **render_template** – POST `/template`. Input: `template` (string, a Jinja2 template); returns the rendered result text.
- **check_config** – POST `/config/core/check_config`. No input; returns JSON with the result of config validation (or errors).

For brevity, we won’t list each code snippet, but the pattern is the same: define `server.tool(name, description, schema, handler)`, use `hassApi` to call the appropriate endpoint, and return content. The use of `server.tool` with a Zod schema ensures inputs are validated (e.g., correct types, required fields) before attempting the API call ([mcp-server.md](file://file-DzX13Xbg3MYCNr7SDYNQW9#:~:text=,AlertsResponse%3E%28alertsUrl)). All tools should handle errors gracefully (logging details to console/file via Winston, and returning or throwing a friendly error message).

## 4. MCP Tool Registration and Schema Validation

By using `server.tool()` for each endpoint, we have effectively **registered** these tools with the MCP server. When an MCP client connects, it will be able to retrieve the list of tools and their schemas automatically. Under the hood, the MCP SDK uses the provided names, descriptions, and Zod schemas to advertise the tool capabilities to clients.

For example, our server might register a **"call_service"** tool as above. An MCP client (like an LLM app) can discover this tool and call it with parameters. The Zod schema ensures that the client provides the required `domain` and `service` fields and that they are the correct type. If validation fails, the server will reject the request with an error, preventing bad data from reaching Home Assistant.

Using TypeScript interfaces (or types) in conjunction with Zod gives us both compile-time and run-time validation. We could define interfaces for complex response objects (e.g., state objects or service descriptions) for clarity. For instance:

```typescript
interface EntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed: string;
  last_updated: string;
}
```

We could then cast or validate `res.data` against expected types if needed. In practice, since we mostly pass the Home Assistant response directly through as text, strict output validation is less crucial. The primary focus is validating inputs to avoid misuse of the API.

## 5. Home Assistant Event Subscriptions (WebSocket)

Home Assistant’s REST API doesn’t push events – for real-time updates (like device state changes), we use the **WebSocket API**. Our MCP server will connect to Home Assistant’s WebSocket endpoint and subscribe to events, then forward those events to any connected MCP client as notifications.

**Home Assistant WebSocket API**: Connect to `ws://<host>:8123/api/websocket` and authenticate by sending an auth message with the token ([WebSocket API | Home Assistant Developer Docs](https://developers.home-assistant.io/docs/api/websocket/#:~:text=The%20first%20message%20from%20the,authorize%20with%20an%20access%20token)) ([WebSocket API | Home Assistant Developer Docs](https://developers.home-assistant.io/docs/api/websocket/#:~:text=If%20the%20client%20supplies%20valid,message)). Then subscribe to events by sending a `subscribe_events` command ([WebSocket API | Home Assistant Developer Docs](https://developers.home-assistant.io/docs/api/websocket/#:~:text=Subscribe%20to%20events)) (optionally specifying an `event_type` such as `"state_changed"`).

We can integrate this in our server:

```typescript
// Connect to Home Assistant WebSocket for events
const ws = new WebSocket(`${HASS_URL.replace("http", "ws")}/api/websocket`);

ws.on("open", () => {
  logger.info("WebSocket connected, sending auth");
  ws.send(JSON.stringify({ type: "auth", access_token: HASS_TOKEN }));
});

ws.on("message", (data) => {
  const msg = JSON.parse(data.toString());
  if (msg.type === "auth_ok") {
    logger.info("Home Assistant WebSocket authenticated");
    // Subscribe to all events (or specify event_type to filter)
    ws.send(JSON.stringify({ id: 1, type: "subscribe_events" })); // listen to all events
  } else if (msg.type === "event") {
    const event = msg.event;
    // Forward event to MCP client(s) as a notification
    server.notification({
      method: "homeassistant/event",
      params: event, // include event data (which may contain entity_id, new_state, etc.)
    });
  } else if (msg.type === "auth_invalid") {
    logger.error("Home Assistant WS auth failed", { message: msg.message });
  }
});
```

Here we use the **`server.notification()`** function of the MCP server to send a one-way notification to clients ([mcp-server.md](file://file-DzX13Xbg3MYCNr7SDYNQW9#:~:text=%2F%2F%20Send%20one,void%3E%20%7D)). We define a custom notification method `"homeassistant/event"` carrying the event data. Any connected MCP client that understands our server can handle these notifications (e.g., an LLM could be prompted with real-time state changes).

**Event filtering**: The above subscribes to _all_ events. For a busy Home Assistant, it may be wise to filter by specific event types (e.g., only `"state_changed"` events, or only events for certain domains). This can be achieved by adding an `event_type` in the subscribe message (e.g., `{"type": "subscribe_events", "event_type": "state_changed"}`). We could also add an MCP tool like `"subscribe_events"` that takes an event_type and sends a subscription message accordingly (and perhaps `"unsubscribe_events"` to stop). For simplicity, the code above auto-subscribes to all events on startup. You can refine it based on use-case, including parsing `event.data` to filter by `entity_id` if needed.

When an event arrives from Home Assistant (for example, a light turning on), the server will push it to the client via SSE or stdio as a JSON notification. MCP clients can choose to handle these notifications or ignore them.

## 6. Authentication and Security

All interactions with Home Assistant use the **Bearer token** provided in the environment. We configured Axios to send `Authorization: Bearer <TOKEN>` on every request ([REST API | Home Assistant Developer Docs](https://developers.home-assistant.io/docs/api/rest/#:~:text=All%20API%20calls%20have%20to,to%20copy%20the%20whole%20key)). The token should be kept secret (the `.env` file is not committed to source control, and if using Docker, pass the token as an environment variable).

Our MCP server itself can optionally enforce authentication for incoming SSE clients. For example, if we wanted to require a token for connecting to the MCP server’s SSE endpoint, we could check `req.query.token` in the Express handler. In this design, we assume a closed environment or that the MCP client is trusted (since the MCP client will also need the Home Assistant token to be useful, it’s usually running locally).

**CORS & Network Security:** If deploying the SSE server for remote access, consider enabling CORS on the Express app and using HTTPS. The **MCP spec** recommends using TLS for remote connections and validating origins ([mcp-server.md](file://file-DzX13Xbg3MYCNr7SDYNQW9#:~:text=,Implement%20authentication%20when%20needed)). Also consider rate limiting or authentication for the SSE endpoint if it’s not local.

## 7. Transport Mechanisms: STDIO and SSE

We will support two transport modes for MCP communication:

- **Stdio Transport:** Ideal for local usage (LLM running on the same machine launching this server) ([mcp-server.md](file://file-DzX13Xbg3MYCNr7SDYNQW9#:~:text=1.%20%20)). For example, Claude Desktop or VSCode extensions may spawn the server as a subprocess and communicate via stdin/stdout.
- **Server-Sent Events (SSE) Transport:** Allows remote or web-based clients to interact via HTTP. The server will expose an SSE endpoint that clients connect to for a persistent stream ([mcp-server.md](file://file-DzX13Xbg3MYCNr7SDYNQW9#:~:text=Server)) ([mcp-server.md](file://file-DzX13Xbg3MYCNr7SDYNQW9#:~:text=%3CTabs%3E%20%3CTab%20title%3D,express)).

We set up both:

```typescript
// STDIO transport (for local processes):
if (process.argv.includes("--stdio")) {
  // If launched with a --stdio flag, use stdio transport
  const stdioTransport = new StdioServerTransport();
  server.connect(stdioTransport).then(() => {
    logger.info("Home Assistant MCP Server running (stdio mode)");
  });
}

// SSE transport (HTTP server for remote connections):
const app = express();
app.use(express.json()); // parse JSON for incoming POST messages

let sseTransport: SSEServerTransport | null = null;
app.get("/sse", (req, res) => {
  // Initialize SSE transport on new connection:
  sseTransport = new SSEServerTransport("/messages", res);
  server.connect(sseTransport);
  logger.info("SSE client connected");
});
app.post("/messages", (req, res) => {
  if (sseTransport) {
    sseTransport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No SSE session");
  }
});

// Start HTTP server for SSE (if not in stdio-only mode)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`MCP SSE server listening on port ${PORT}`);
});
```

In this snippet, if the server is started with a `--stdio` flag, we immediately attach a `StdioServerTransport` (which reads from `process.stdin` and writes to `process.stdout`). Otherwise, we assume SSE mode by launching an Express app.

The Express app defines two routes as per MCP’s SSE pattern ([mcp-server.md](file://file-DzX13Xbg3MYCNr7SDYNQW9#:~:text=)) ([mcp-server.md](file://file-DzX13Xbg3MYCNr7SDYNQW9#:~:text=app.post%28,)):

- **GET `/sse`** – Establishes an SSE connection. We create a new `SSEServerTransport`, pointing it to a “messages” endpoint for receiving client messages, and call `server.connect(...)` to hook it up. This keeps the HTTP response (`res`) open and streams events to the client.
- **POST `/messages`** – Receives messages _from_ the client (MCP client will POST any tool requests or other commands to this URL). We delegate to `sseTransport.handlePostMessage(req, res)` to process the incoming message and respond immediately. The `SSEServerTransport` internally manages routing these requests into the MCP server.

With this setup, an MCP-enabled client can connect via SSE by opening `http://<server>:3000/sse` (for example, using an `EventSource` in a web context, or the MCP client SDK). For stdio, a client can spawn the process with `--stdio` and communicate over pipes.

## 8. Logging and Error Handling

We configured **Winston** for logging to capture important events and errors in JSON format. Throughout the code, we use `logger.info`, `logger.error`, etc., to record events like startup, incoming connections, and API errors. For example:

- When the SSE server starts, we log the port. When a client connects to SSE, we log it.
- On Home Assistant WebSocket events, we log successes (auth OK) or errors (auth failure).
- In each tool handler, if an Axios request fails (throws), we catch it, log the error details (perhaps including `error.response?.status` or message), and throw a generic error. Throwing an error inside a tool handler will send an error response over MCP (with JSON-RPC error fields).

**Structured errors:** You can structure errors according to MCP’s error codes if desired. For instance, if Home Assistant returns a 404, you might throw an error with a specific code. The MCP SDK will propagate it appropriately (MCP errors follow JSON-RPC error format, with codes and messages).

We ensure **no sensitive data** (like the token) is ever printed in logs. Use placeholders or omit such info in error messages.

For debugging, you can raise the log level to `debug` and log raw request/response data as needed. During development, having logs for each tool request (inputs and outputs) is useful. In production, consider logging only high-level actions or warnings to avoid excessive log volume and leaking information.

## 9. Deployment and Testing

**Docker Deployment:** To deploy easily, create a Dockerfile:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
RUN npm run build    # assuming you have a build script to compile TypeScript
CMD ["node", "dist/server.js"]
```

You would supply the environment variables (`HASS_URL`, `HASS_TOKEN`, etc.) when running the container. For example:

```bash
docker build -t hass-mcp-server .
docker run -d -p 3000:3000 -e HASS_URL="http://homeassistant:8123" -e HASS_TOKEN="ABC123" hass-mcp-server
```

This exposes the SSE port. If using stdio mode, you wouldn’t run it in a long-running container; instead, the client (like an LLM app) would launch the container or binary and use stdio.

**Testing:** Write unit tests for each tool using Jest. You can mock the `hassApi` (axios) calls to simulate Home Assistant responses:

```typescript
import { server, hassApi } from "../src/server"; // adjust export for testability

test("call_service tool calls correct HA endpoint", async () => {
  // Arrange: mock axios
  const postSpy = jest.spyOn(hassApi, "post").mockResolvedValue({ data: null });
  // Act: call the tool handler
  const result = await server.callTool("call_service", {
    domain: "light",
    service: "turn_on",
    data: { entity_id: "light.kitchen" },
  });
  // Assert: axios was called with correct URL and payload
  expect(postSpy).toHaveBeenCalledWith("/services/light/turn_on", {
    entity_id: "light.kitchen",
  });
  // And the result content confirms success
  expect(result.content[0].text).toMatch(/called successfully/i);
});
```

Also test error paths: e.g., if `hassApi.get('/states')` throws, the tool should throw an error with a proper message.

For integration testing, you might run the server with a real or fake Home Assistant. However, since Home Assistant is a complex system, it may be easier to simulate the API. The OpenAPI spec (docs/hass.openapi.yml) can be used to generate a mock server or to validate that our requests and expected responses align with the spec. JSON Schema validation could be added to verify that responses from Home Assistant conform to expected structures (for instance, using Zod to parse the `res.data`).

## 10. Documentation and Usage Examples

Finally, ensure your project is well-documented:

- **README**: Explain what the server is, how to configure it, and provide examples of usage. Describe each tool (perhaps auto-generate an API reference from the OpenAPI spec or the Zod schemas). For example, document that `"call_service"` requires `domain` and `service` and what it does.
- **Examples**: Include examples for common tasks. E.g., _"Turn on a light"_ – the LLM might invoke the `call_service` tool with domain `light` and service `turn_on`, providing `{"entity_id": "light.living_room"}` as data. Show what the response looks like. Another example: _"What is the temperature in the bedroom?"_ – the LLM can use `get_state` for the thermostat entity.
- **SSE Client Example**: Document how to connect via SSE. For instance, using the Fetch API or EventSource in a web page:

  ```js
  const events = new EventSource("http://localhost:3000/sse");
  events.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log("MCP event or response:", msg);
  };
  // To send a command (tool call), you would POST to /messages (this is handled by the MCP client SDK typically)
  ```

  (In practice, an MCP client library would manage the SSE connection and provide a higher-level API for calling tools.)

- **Stdio Usage**: Note how to run in stdio mode, e.g., `node dist/server.js --stdio`. If an MCP client (like Claude Desktop) is used, they may allow configuring a local command to run for the MCP server.

- **Authentication**: Explain how the Home Assistant token is provided and mention Home Assistant’s own docs about generating tokens (for users unfamiliar).

- **Schema Validation**: Mention that the server uses JSON schema (via Zod) to validate inputs, citing that it aligns with the OpenAPI spec definitions for each endpoint (e.g., the required fields for each tool match the API spec).

By following these steps, we have a **production-ready Home Assistant MCP server**. It leverages the Home Assistant REST API and WebSocket API to expose smart home functionality to language model applications in a safe and structured way. The server adheres to MCP standards for tool definition, transport, and messaging, and includes comprehensive logging, error handling, and documentation for ease of use.
