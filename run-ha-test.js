#!/usr/bin/env node

// Direct test script for Home Assistant light control
// This tests against https://ha.oleander.io

const readline = require('readline');
const https = require('https');
const url = require('url');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Configuration
const HASS_URL = 'https://ha.oleander.io';
let HASS_TOKEN = '';

// Solutions to test
const solutions = [
  {
    name: "Solution 1: entity_id in service_data",
    data: {
      entity_id: [
        "light.shapes_7fef",
        "light.bed",
        "light.strip"
      ],
      brightness_pct: 100
    }
  },
  {
    name: "Solution 2: entity_id for single light",
    data: {
      entity_id: "light.shapes_7fef",
      brightness_pct: 100
    }
  },
  {
    name: "Solution 3: brightness instead of brightness_pct",
    data: {
      entity_id: [
        "light.shapes_7fef",
        "light.bed",
        "light.strip"
      ],
      brightness: 255
    }
  },
  {
    name: "Solution 4: target parameter structure",
    data: {
      target: {
        entity_id: [
          "light.shapes_7fef",
          "light.bed",
          "light.strip"
        ]
      },
      brightness_pct: 100
    }
  }
];

// Function to prompt for token
function promptForToken() {
  return new Promise((resolve) => {
    rl.question('Please enter your Home Assistant long-lived access token: ', (token) => {
      HASS_TOKEN = token.trim();
      resolve(HASS_TOKEN);
    });
  });
}

// Make a request to Home Assistant
function makeRequest(endpoint, data) {
  return new Promise((resolve, reject) => {
    const parsedUrl = url.parse(`${HASS_URL}${endpoint}`);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 443,
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${HASS_TOKEN}`
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const parsed = responseData ? JSON.parse(responseData) : {};
            resolve({
              success: true,
              status: res.statusCode,
              data: parsed
            });
          } catch (e) {
            resolve({
              success: true,
              status: res.statusCode,
              data: responseData
            });
          }
        } else {
          reject({
            success: false,
            status: res.statusCode,
            message: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject({
        success: false,
        error: error.message
      });
    });

    req.write(JSON.stringify(data));
    req.end();
  });
}

// Test a specific solution
async function testSolution(solution) {
  console.log(`\n------- Testing ${solution.name} -------`);
  console.log('Request data:', JSON.stringify(solution.data, null, 2));

  try {
    const result = await makeRequest('/api/services/light/turn_on', solution.data);
    console.log(`SUCCESS (Status ${result.status})`);
    console.log('Response:', result.data ? JSON.stringify(result.data).substring(0, 200) + '...' : 'No data');
    return { success: true, solution: solution.name };
  } catch (error) {
    console.error(`FAILED (Status ${error.status || 'unknown'})`);
    console.error('Error:', error.message || error);
    return { success: false, solution: solution.name, error };
  }
}

// Run all tests
async function runTests() {
  if (!HASS_TOKEN) {
    await promptForToken();
  }

  console.log(`\nTesting Home Assistant at ${HASS_URL}`);
  console.log('Testing light control service calls...\n');

  const results = [];

  for (const solution of solutions) {
    const result = await testSolution(solution);
    results.push(result);
  }

  // Print summary
  console.log('\n======== RESULTS SUMMARY ========');
  for (const result of results) {
    console.log(`${result.solution}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
  }

  // Provide recommendation
  const successfulSolutions = results.filter(r => r.success);
  if (successfulSolutions.length > 0) {
    console.log(`\nRECOMMENDATION: Use ${successfulSolutions[0].solution}`);
  } else {
    console.log('\nRECOMMENDATION: None of the solutions worked. Consider:');
    console.log('- Checking if your token has proper permissions');
    console.log('- Verifying the entities exist and are available');
    console.log('- Checking Home Assistant logs for more detailed errors');
  }

  rl.close();
}

// Start the tests
runTests().catch((error) => {
  console.error('Error running tests:', error);
  rl.close();
});
