// Test script for Home Assistant light control solutions
// For use with the Home Assistant instance at https://ha.oleander.io

// Import the solutions from the fix-light-control.js file
const {
  serviceFix1,
  serviceFix2,
  serviceFix3,
  serviceFix4,
} = require("./fix-light-control.js");

// Note: You'll need to provide your access token
const HASS_URL = "https://ha.oleander.io";
let HASS_TOKEN = ""; // Will be prompted if not provided

const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Function to prompt for the token if needed
function getToken() {
  return new Promise((resolve) => {
    if (HASS_TOKEN) {
      resolve(HASS_TOKEN);
      return;
    }

    rl.question(
      "Please enter your Home Assistant long-lived access token: ",
      (token) => {
        HASS_TOKEN = token.trim();
        resolve(HASS_TOKEN);
      },
    );
  });
}

// Function to make Home Assistant API calls
async function callHassService(domain, service, data) {
  const token = await getToken();

  console.log(`Making service call to ${domain}.${service}...`);
  console.log("Request data:", JSON.stringify(data, null, 2));

  try {
    const response = await fetch(
      `${HASS_URL}/api/services/${domain}/${service}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error (${response.status}): ${errorText}`);
      return { success: false, status: response.status, error: errorText };
    }

    const result = await response.json();
    console.log("Success!");
    return { success: true, result };
  } catch (error) {
    console.error("Error making request:", error.message);
    return { success: false, error: error.message };
  }
}

// Test implementation of Solution 1 (entity_id in service_data)
async function testSolution1() {
  console.log("\n========== TESTING SOLUTION 1 ==========");
  console.log("Using entity_id inside service_data");

  const data = serviceFix1.service_data;
  return await callHassService(serviceFix1.domain, serviceFix1.service, data);
}

// Test implementation of Solution 2 (individual calls)
async function testSolution2() {
  console.log("\n========== TESTING SOLUTION 2 ==========");
  console.log("Controlling lights individually");

  const results = [];

  for (const call of serviceFix2) {
    console.log(`\nControlling ${call.service_data.entity_id}...`);
    const result = await callHassService(
      call.domain,
      call.service,
      call.service_data,
    );
    results.push(result);
  }

  return results;
}

// Test implementation of Solution 3 (brightness instead of brightness_pct)
async function testSolution3() {
  console.log("\n========== TESTING SOLUTION 3 ==========");
  console.log("Using brightness instead of brightness_pct");

  const data = serviceFix3.service_data;
  return await callHassService(serviceFix3.domain, serviceFix3.service, data);
}

// Test implementation of Solution 4 (target and service_data properly structured)
async function testSolution4() {
  console.log("\n========== TESTING SOLUTION 4 ==========");
  console.log("Using both target and service_data properly");

  // For the direct API call, we need to merge target and service_data
  const data = {
    ...serviceFix4.service_data,
    target: serviceFix4.target,
  };

  return await callHassService(serviceFix4.domain, serviceFix4.service, data);
}

// Main function to run all tests
async function runTests() {
  try {
    // Test each solution and collect results
    const result1 = await testSolution1();
    const result2 = await testSolution2();
    const result3 = await testSolution3();
    const result4 = await testSolution4();

    // Summary of results
    console.log("\n========== TEST RESULTS SUMMARY ==========");
    console.log(
      "Solution 1 (entity_id in service_data):",
      result1.success ? "SUCCESS" : "FAILED",
    );

    const solution2Success = result2.every((r) => r.success);
    console.log(
      "Solution 2 (individual calls):",
      solution2Success ? "SUCCESS" : "FAILED",
    );

    console.log(
      "Solution 3 (brightness instead of brightness_pct):",
      result3.success ? "SUCCESS" : "FAILED",
    );
    console.log(
      "Solution 4 (target and service_data structure):",
      result4.success ? "SUCCESS" : "FAILED",
    );

    console.log(
      "\nBased on these results, we recommend using the following approach:",
    );
    if (result1.success) {
      console.log("- Solution 1: Using entity_id inside service_data");
    } else if (solution2Success) {
      console.log("- Solution 2: Controlling lights individually");
    } else if (result3.success) {
      console.log("- Solution 3: Using brightness instead of brightness_pct");
    } else if (result4.success) {
      console.log("- Solution 4: Using both target and service_data properly");
    } else {
      console.log(
        "- None of the solutions worked. Manual investigation required.",
      );
    }
  } catch (error) {
    console.error("Error running tests:", error);
  } finally {
    rl.close();
  }
}

// Run the tests
runTests();
