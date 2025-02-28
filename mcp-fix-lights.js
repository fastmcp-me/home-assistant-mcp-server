// MCP Server light control fixes
// Use this script with the MCP server to test the solutions

// This script provides examples for fixing the 400 Bad Request error
// when controlling multiple light entities in Home Assistant

// ========== SOLUTION 1: USING ENTITY_ID INSIDE SERVICE_DATA ==========
// This is the preferred approach for most Home Assistant instances

async function testSolution1(server) {
  console.log("\nTesting Solution 1: entity_id inside service_data");

  try {
    const result = await server.tool("call_service", {
      domain: "light",
      service: "turn_on",
      service_data: {
        entity_id: ["light.shapes_7fef", "light.bed", "light.strip"],
        brightness_pct: 100,
      },
    });

    console.log("Solution 1 result:", result);
    return true;
  } catch (error) {
    console.error("Solution 1 failed:", error.message);
    return false;
  }
}

// ========== SOLUTION 2: CONTROL EACH LIGHT INDIVIDUALLY ==========
// If bulk control fails, controlling lights one at a time may work

async function testSolution2(server) {
  console.log("\nTesting Solution 2: individual light control");
  const entities = ["light.shapes_7fef", "light.bed", "light.strip"];

  let allSuccessful = true;

  for (const entity of entities) {
    try {
      console.log(`Controlling ${entity}...`);
      const result = await server.tool("call_service", {
        domain: "light",
        service: "turn_on",
        service_data: {
          entity_id: entity,
          brightness_pct: 100,
        },
      });

      console.log(`Success for ${entity}`);
    } catch (error) {
      console.error(`Failed for ${entity}:`, error.message);
      allSuccessful = false;
    }
  }

  return allSuccessful;
}

// ========== SOLUTION 3: USE BRIGHTNESS INSTEAD OF BRIGHTNESS_PCT ==========
// Some light entities might not support brightness_pct but do support brightness

async function testSolution3(server) {
  console.log(
    "\nTesting Solution 3: using brightness instead of brightness_pct",
  );

  try {
    const result = await server.tool("call_service", {
      domain: "light",
      service: "turn_on",
      service_data: {
        entity_id: ["light.shapes_7fef", "light.bed", "light.strip"],
        brightness: 255, // 0-255 range
      },
    });

    console.log("Solution 3 result:", result);
    return true;
  } catch (error) {
    console.error("Solution 3 failed:", error.message);
    return false;
  }
}

// ========== SOLUTION 4: PROPER TARGET AND SERVICE_DATA STRUCTURE ==========
// Using the target parameter according to current Home Assistant best practices

async function testSolution4(server) {
  console.log("\nTesting Solution 4: proper target and service_data structure");

  try {
    const result = await server.tool("call_service", {
      domain: "light",
      service: "turn_on",
      target: {
        entity_id: ["light.shapes_7fef", "light.bed", "light.strip"],
      },
      service_data: {
        brightness_pct: 100,
      },
    });

    console.log("Solution 4 result:", result);
    return true;
  } catch (error) {
    console.error("Solution 4 failed:", error.message);
    return false;
  }
}

// Main function to run all tests with the MCP server
async function runAllTests(server) {
  const success1 = await testSolution1(server);
  const success2 = await testSolution2(server);
  const success3 = await testSolution3(server);
  const success4 = await testSolution4(server);

  console.log("\n========== TEST RESULTS ==========");
  console.log(
    "Solution 1 (entity_id in service_data):",
    success1 ? "SUCCESS" : "FAILED",
  );
  console.log(
    "Solution 2 (individual control):",
    success2 ? "SUCCESS" : "FAILED",
  );
  console.log(
    "Solution 3 (brightness instead of brightness_pct):",
    success3 ? "SUCCESS" : "FAILED",
  );
  console.log(
    "Solution 4 (target structure):",
    success4 ? "SUCCESS" : "FAILED",
  );

  console.log("\nRecommended solution based on test results:");
  if (success1) {
    console.log("Use Solution 1: Put entity_id inside service_data");
  } else if (success2) {
    console.log("Use Solution 2: Control lights individually");
  } else if (success3) {
    console.log("Use Solution 3: Use brightness instead of brightness_pct");
  } else if (success4) {
    console.log("Use Solution 4: Use proper target and service_data structure");
  } else {
    console.log("All solutions failed. Further investigation required.");
  }
}

// Export the test functions for use with the MCP server
module.exports = {
  testSolution1,
  testSolution2,
  testSolution3,
  testSolution4,
  runAllTests,
};
