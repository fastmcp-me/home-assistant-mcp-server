const axios = require("axios");
require("dotenv").config();

const HASS_URL = process.env.HASS_URL || "https://ha.oleander.io";
const HASS_TOKEN =
  process.env.HASS_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJlMDYzMDE5ZTNlZTk0ZjQwOTQ1ZDIzYzU4ZTgxZjQxNCIsImlhdCI6MTc0MDc2MTQ0MCwiZXhwIjoyMDU2MTIxNDQwfQ.8H2P699Rr3iIOQd8jzo0Hq3Om2vey9qBWywyLYCQMgM";

const ENTITY_ID = "light.shapes_7fef";
const START_BRIGHTNESS = 5; // 5%
const END_BRIGHTNESS = 100; // 100%
const DURATION = 39; // seconds
const STEPS = 39; // One step per second

// Create HTTP client with authorization
const client = axios.create({
  baseURL: HASS_URL,
  headers: {
    Authorization: `Bearer ${HASS_TOKEN}`,
    "Content-Type": "application/json",
  },
});

async function callService(domain, service, data) {
  try {
    const response = await client.post(
      `/api/services/${domain}/${service}`,
      data,
    );
    return response.data;
  } catch (error) {
    console.error(`Error calling service ${domain}.${service}:`, error.message);
    throw error;
  }
}

async function setLightBrightness(brightness_pct) {
  console.log(`Setting ${ENTITY_ID} brightness to ${brightness_pct}%`);
  return callService("light", "turn_on", {
    entity_id: ENTITY_ID,
    brightness_pct: brightness_pct,
  });
}

async function fadeLight() {
  // Start by turning on the light at the initial brightness
  await setLightBrightness(START_BRIGHTNESS);
  console.log(
    `Starting fade of ${ENTITY_ID} from ${START_BRIGHTNESS}% to ${END_BRIGHTNESS}% over ${DURATION} seconds`,
  );

  // Calculate the brightness increment per step
  const brightnessIncrement = (END_BRIGHTNESS - START_BRIGHTNESS) / STEPS;

  // Perform the fade
  for (let step = 1; step <= STEPS; step++) {
    // Calculate the current brightness
    const currentBrightness = START_BRIGHTNESS + brightnessIncrement * step;
    // Add a small delay to distribute the steps over the duration
    await new Promise((resolve) =>
      setTimeout(resolve, (DURATION * 1000) / STEPS),
    );
    // Set the brightness
    await setLightBrightness(Math.round(currentBrightness));
  }

  console.log(
    `Fade complete. ${ENTITY_ID} brightness is now ${END_BRIGHTNESS}%`,
  );
}

fadeLight()
  .then(() => console.log("Fade operation completed successfully"))
  .catch((error) => console.error("Error during fade operation:", error));
