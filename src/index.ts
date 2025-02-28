import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import { LogzioClient } from "./api/logzio.js";
import { registerSearchTools } from "./tools/search/index.js";
import { registerFieldTools } from "./tools/fields/index.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerAdvancedTools } from "./tools/advanced.js";
import { registerSamplingTools } from "./tools/sampling/index.js";
import { registerResources } from "./tools/resources.js";
import { registerPrompts } from "./prompts/prompts.js";
import { registerTemplates } from "./templates/index.js";
import { registerHelpTools } from "./tools/help/index.js";

// Load environment variables
dotenv.config();

// Get API key and region from environment variables
const LOGZIO_API_KEY = process.env.LOGZIO_API_KEY || "";
const LOGZIO_REGION = process.env.LOGZIO_REGION || "us";

// Validate required environment variables
if (!LOGZIO_API_KEY) {
  console.error("Error: LOGZIO_API_KEY environment variable is required");
  process.exit(1);
}

// Initialize MCP server
const server = new McpServer({
  name: "logzio-search",
  version: "1.0.0",
});

// Initialize Logz.io client
const client = new LogzioClient(LOGZIO_API_KEY, LOGZIO_REGION);

// Register all tools and capabilities
registerSearchTools(server, client);
registerFieldTools(server, client);
registerAnalysisTools(server, client);
registerAdvancedTools(server, client);
registerSamplingTools(server, client);
registerResources(server, client);
registerHelpTools(server, client); // Register help and discoverability tools
registerPrompts(server);
registerTemplates(server); // Register URI templates, dynamic prompts, and workflow templates

// Start the server
async function main() {
  console.error("Starting Logz.io MCP Server...");

  try {
    // Set up the server's stdin/stdout transport
    const transport = new StdioServerTransport();

    // Connect the server to the transport
    await server.connect(transport);

    console.error("Logz.io MCP Server connected");
    console.error("Registered prompts to help with common log analysis tasks");
    console.error(
      "Registered templates for URI access, dynamic prompts, and workflows",
    );

    // Keep the process alive
    process.stdin.resume();
  } catch (error) {
    console.error("Error during server initialization:", error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Server error:", err);
  process.exit(1);
});
