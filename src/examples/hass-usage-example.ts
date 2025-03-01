import { HassClient } from '../api/hass-client';
import type { HassState } from '../types/hass-types';

/**
 * Example usage of the Home Assistant API client
 */
async function main() {
  // Create a client instance
  const hassUrl = process.env.HASS_URL || 'http://homeassistant.local:8123/api';
  const hassToken = process.env.HASS_TOKEN || 'your_long_lived_access_token';

  const client = new HassClient(hassUrl, hassToken);

  try {
    // Check if API is working
    const apiStatus = await client.checkApi();
    console.log('API Status:', apiStatus.message);

    // Get Home Assistant configuration
    const config = await client.getConfig();
    console.log('Home Assistant Version:', config.version);
    console.log('Location:', config.location_name);

    // Get all states
    const states = await client.getAllStates();
    console.log(`Found ${states.length} entities`);

    // List all light entities
    const lights = states.filter(entity => entity.entity_id?.startsWith('light.'));
    console.log('Light entities:');
    lights.forEach(light => {
      console.log(`- ${light.entity_id}: ${light.state} (${JSON.stringify(light.attributes)})`);
    });

    // Get state of a specific entity
    const livingRoomLight = await client.getEntityState('light.living_room');
    console.log('Living Room Light State:', livingRoomLight.state);

    // Turn on a light
    console.log('Turning on living room light...');
    await client.callService('light', 'turn_on', {
      entity_id: 'light.living_room',
      brightness: 255, // Full brightness
      color_temp: 300 // Warm white
    });

    // Get updated state
    const updatedLight = await client.getEntityState('light.living_room');
    console.log('Updated Living Room Light State:', updatedLight.state);
    console.log('Brightness:', updatedLight.attributes?.brightness);

    // Get history for a specific entity for the last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const historyData = await client.getHistory(
      yesterday.toISOString(),
      { filter_entity_id: 'light.living_room' }
    );

    console.log(`Found ${historyData[0]?.length || 0} history entries for living room light`);

    // Render a template
    const template = "{{ states('sensor.temperature') }}";
    const rendered = await client.renderTemplate(template);
    console.log('Current temperature:', rendered);

    // Turn off the light
    console.log('Turning off living room light...');
    await client.callService('light', 'turn_off', {
      entity_id: 'light.living_room'
    });

    console.log('Example completed successfully!');

  } catch (error) {
    console.error('Error:', error);
  }
}

// Helper function to extract domain from entity_id
function getDomain(entityId: string): string {
  const parts = entityId.split('.');
  return parts[0];
}

// Helper function to group entities by domain
function groupEntitiesByDomain(entities: HassState[]): Record<string, HassState[]> {
  return entities.reduce((groups, entity) => {
    const domain = getDomain(entity.entity_id || '');
    if (!groups[domain]) {
      groups[domain] = [];
    }
    groups[domain].push(entity);
    return groups;
  }, {} as Record<string, HassState[]>);
}

// Run the example if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export functions for reuse
export { groupEntitiesByDomain, getDomain };
