import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { LogzioClient } from "../../api/logzio.js";
import { registerPatternRecognitionTool } from "./pattern-recognition.js";
import { registerErrorTrendDetectionTool } from "./error-trend-detection.js";
import { registerDetectTrendsTool } from "./detect-trends.js";

/**
 * Registers all analysis-related tools
 */
export function registerAnalysisTools(server: McpServer, client: LogzioClient) {
  // Register pattern recognition tool
  registerPatternRecognitionTool(server, client);

  // Register error trend detection tool
  registerErrorTrendDetectionTool(server, client);

  // Register trend detection tool
  registerDetectTrendsTool(server, client);
}
