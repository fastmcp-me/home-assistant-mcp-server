// Fix for Home Assistant light control issue
// Solution 1: Using entity_id inside service_data (traditional approach)

const serviceFix1 = {
  tool: "call_service",
  domain: "light",
  service: "turn_on",
  service_data: {
    entity_id: ["light.shapes_7fef", "light.bed", "light.strip"],
    brightness_pct: 100,
  },
};

// Solution 2: Control each light individually
const serviceFix2 = [
  {
    tool: "call_service",
    domain: "light",
    service: "turn_on",
    service_data: {
      entity_id: "light.shapes_7fef",
      brightness_pct: 100,
    },
  },
  {
    tool: "call_service",
    domain: "light",
    service: "turn_on",
    service_data: {
      entity_id: "light.bed",
      brightness_pct: 100,
    },
  },
  {
    tool: "call_service",
    domain: "light",
    service: "turn_on",
    service_data: {
      entity_id: "light.strip",
      brightness_pct: 100,
    },
  },
];

// Solution 3: Using brightness instead of brightness_pct
const serviceFix3 = {
  tool: "call_service",
  domain: "light",
  service: "turn_on",
  service_data: {
    entity_id: ["light.shapes_7fef", "light.bed", "light.strip"],
    brightness: 255, // Maximum brightness on the 0-255 scale
  },
};

// Solution 4: Using both target and service_data properly
const serviceFix4 = {
  tool: "call_service",
  domain: "light",
  service: "turn_on",
  target: {
    entity_id: ["light.shapes_7fef", "light.bed", "light.strip"],
  },
  service_data: {
    brightness_pct: 100,
  },
};

// Print the solutions for reference
console.log("Solution 1:", JSON.stringify(serviceFix1, null, 2));
console.log(
  "Solution 2 (first call):",
  JSON.stringify(serviceFix2[0], null, 2),
);
console.log("Solution 3:", JSON.stringify(serviceFix3, null, 2));
console.log("Solution 4:", JSON.stringify(serviceFix4, null, 2));

// Export the solutions for use in test scripts
module.exports = {
  serviceFix1,
  serviceFix2,
  serviceFix3,
  serviceFix4,
};
