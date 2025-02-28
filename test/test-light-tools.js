import 'dotenv/config';
import { createMcpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerLightTools } from "../dist/tools/light-tools.js";

// Configuration
const hassUrl = process.env.HASS_URL || 'http://localhost:8123';
const hassToken = process.env.HASS_TOKEN || '';

async function testLightTools() {
  console.log("Testing Light Tools");
  console.log("===================");

  // Create a simple MCP server
  const server = createMcpServer();

  // Register only the light tools
  registerLightTools(server, hassUrl, hassToken);

  // Example 1: Get all lights
  console.log("\nExample 1: Get all lights");
  console.log("-------------------------");
  try {
    const result = await server.executeToolByName("get_lights", {});
    console.log(result.content[0].text);
  } catch (error) {
    console.error("Error:", error.message);
  }

  // Example 2: Get a specific light with details
  console.log("\nExample 2: Get a specific light with details");
  console.log("-------------------------------------------");
  try {
    // Replace with your actual light entity ID
    const result = await server.executeToolByName("get_lights", {
      entity_id: "light.living_room",
      include_details: true
    });
    console.log(result.content[0].text);
  } catch (error) {
    console.error("Error:", error.message);
  }

  // Example 3: Turn on a light
  console.log("\nExample 3: Turn on a light");
  console.log("-------------------------");
  try {
    // Replace with your actual light entity ID
    const result = await server.executeToolByName("manage_light", {
      entity_id: "light.living_room",
      action: "turn_on",
      brightness_pct: 50
    });
    console.log(result.content[0].text);
  } catch (error) {
    console.error("Error:", error.message);
  }

  // Example 4: Change light color
  console.log("\nExample 4: Change light color");
  console.log("----------------------------");
  try {
    // Replace with your actual light entity ID
    const result = await server.executeToolByName("manage_light", {
      entity_id: "light.living_room",
      action: "turn_on",
      rgb_color: [255, 0, 0],  // Red
      brightness_pct: 100,
      transition: 2
    });
    console.log(result.content[0].text);
  } catch (error) {
    console.error("Error:", error.message);
  }

  // Example 5: Turn off a light
  console.log("\nExample 5: Turn off a light");
  console.log("--------------------------");
  try {
    // Replace with your actual light entity ID
    const result = await server.executeToolByName("manage_light", {
      entity_id: "light.living_room",
      action: "turn_off",
      transition: 1
    });
    console.log(result.content[0].text);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Run the test
testLightTools().catch(console.error);
