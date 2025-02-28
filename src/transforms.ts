/**
 * Data transformation system for simplifying Home Assistant API responses
 */

import { HassEntity, HassService } from './types.js';

/**
 * Transformation rule for entities and other data
 */
interface TransformationRule<T, R> {
  selector: string | RegExp | ((item: T) => boolean);
  transform: (item: T) => R;
}

/**
 * Simplified entity structure with essential information
 */
export interface SimplifiedEntity {
  id: string;
  name: string;
  state: string;
  type: string;
  updateTime: string;
  mainAttributes: Record<string, unknown>;
}

/**
 * Simplified service structure
 */
export interface SimplifiedService {
  id: string;
  name: string;
  description?: string;
  requiredParams?: string[];
  optionalParams?: string[];
}

/**
 * Generic transformer for Home Assistant data
 */
export class Transformer<T, R> {
  private rules: TransformationRule<T, R>[] = [];
  private defaultTransform?: (item: T) => R;

  /**
   * Add a transformation rule
   */
  addRule(rule: TransformationRule<T, R>): void {
    this.rules.push(rule);
  }

  /**
   * Set the default transformation for items not matching any rule
   */
  setDefaultTransform(transform: (item: T) => R): void {
    this.defaultTransform = transform;
  }

  /**
   * Transform a single item using the applicable rule
   */
  transform(item: T): R | null {
    // Find the first matching rule
    for (const rule of this.rules) {
      if (this.matchesRule(item, rule.selector)) {
        return rule.transform(item);
      }
    }

    // Use default transform if provided
    if (this.defaultTransform) {
      return this.defaultTransform(item);
    }

    // No matching rule or default transform
    return null;
  }

  /**
   * Transform a collection of items
   */
  transformAll(items: T[]): (R | null)[] {
    return items.map(item => this.transform(item));
  }

  /**
   * Check if an item matches a selector
   */
  private matchesRule(item: T, selector: string | RegExp | ((item: T) => boolean)): boolean {
    if (typeof selector === 'function') {
      return selector(item);
    }

    // For string or RegExp selectors, assume items have an 'id' or similar field
    const itemWithId = item as unknown as { id?: string; entity_id?: string; domain?: string };
    const idField = itemWithId.id || itemWithId.entity_id || itemWithId.domain;

    if (!idField) return false;

    if (typeof selector === 'string') {
      return idField === selector;
    }

    return selector.test(idField);
  }
}

/**
 * Entity transformer that simplifies Home Assistant entities
 */
export class EntityTransformer extends Transformer<HassEntity, SimplifiedEntity> {
  constructor() {
    super();

    // Add default transform for entities
    this.setDefaultTransform(this.defaultEntityTransform.bind(this));

    // Add specific transformers for different entity types
    this.setupEntityRules();
  }

  /**
   * Setup entity-specific transformation rules
   */
  private setupEntityRules(): void {
    // Special handling for light entities
    this.addRule({
      selector: (entity: HassEntity) => entity.entity_id.startsWith('light.'),
      transform: (entity: HassEntity) => {
        const common = this.defaultEntityTransform(entity);
        // Extract relevant light attributes
        return {
          ...common,
          mainAttributes: {
            brightness: entity.attributes.brightness,
            color: entity.attributes.rgb_color || entity.attributes.hs_color,
            colorTemp: entity.attributes.color_temp,
            isOn: entity.state === 'on'
          }
        };
      }
    });

    // Special handling for sensor entities
    this.addRule({
      selector: (entity: HassEntity) => entity.entity_id.startsWith('sensor.'),
      transform: (entity: HassEntity) => {
        const common = this.defaultEntityTransform(entity);
        // Extract relevant sensor attributes
        return {
          ...common,
          mainAttributes: {
            value: entity.state,
            unit: entity.attributes.unit_of_measurement,
            deviceClass: entity.attributes.device_class,
            accuracy: entity.attributes.accuracy
          }
        };
      }
    });

    // Special handling for climate entities
    this.addRule({
      selector: (entity: HassEntity) => entity.entity_id.startsWith('climate.'),
      transform: (entity: HassEntity) => {
        const common = this.defaultEntityTransform(entity);
        // Extract relevant climate attributes
        return {
          ...common,
          mainAttributes: {
            currentTemp: entity.attributes.current_temperature,
            targetTemp: entity.attributes.temperature,
            mode: entity.attributes.hvac_mode,
            action: entity.attributes.hvac_action,
            presets: entity.attributes.preset_modes
          }
        };
      }
    });
  }

  /**
   * Default transform for any entity type
   */
  private defaultEntityTransform(entity: HassEntity): SimplifiedEntity {
    const [domain, id] = entity.entity_id.split('.');
    const friendlyName = typeof entity.attributes.friendly_name === 'string'
      ? entity.attributes.friendly_name
      : id;

    return {
      id: entity.entity_id,
      name: friendlyName,
      state: entity.state,
      type: domain,
      updateTime: entity.last_updated || entity.last_changed || new Date().toISOString(),
      mainAttributes: {
        // Extract a few common attributes by default
        icon: entity.attributes.icon,
        unitOfMeasurement: entity.attributes.unit_of_measurement
      }
    };
  }

  /**
   * Create a simple view of all entities
   */
  createEntitySummary(entities: HassEntity[]): SimplifiedEntity[] {
    return this.transformAll(entities).filter(Boolean) as SimplifiedEntity[];
  }

  /**
   * Group entities by domain
   */
  groupByDomain(entities: HassEntity[]): Record<string, SimplifiedEntity[]> {
    const result: Record<string, SimplifiedEntity[]> = {};

    for (const entity of entities) {
      const transformed = this.transform(entity);
      if (!transformed) continue;

      const domain = transformed.type;

      if (!result[domain]) {
        result[domain] = [];
      }

      result[domain].push(transformed);
    }

    return result;
  }
}

/**
 * Service transformer that simplifies Home Assistant services
 */
export class ServiceTransformer extends Transformer<HassService, SimplifiedService> {
  constructor() {
    super();
    this.setDefaultTransform(this.defaultServiceTransform.bind(this));
  }

  /**
   * Default transform for any service
   */
  private defaultServiceTransform(service: HassService): SimplifiedService {
    const { domain, service: serviceId } = service;
    const fields = service.fields || {};

    // Identify required and optional parameters
    const requiredParams: string[] = [];
    const optionalParams: string[] = [];

    Object.entries(fields).forEach(([fieldName, field]) => {
      if (field.required) {
        requiredParams.push(fieldName);
      } else {
        optionalParams.push(fieldName);
      }
    });

    return {
      id: `${domain}.${serviceId}`,
      name: serviceId,
      description: service.description,
      requiredParams,
      optionalParams
    };
  }

  /**
   * Transform nested service structure from Home Assistant API
   * @param services The nested services object from Home Assistant API
   * @returns Array of simplified services
   */
  transformNestedServices(services: Record<string, Record<string, HassService>>): SimplifiedService[] {
    const allServices: HassService[] = [];

    // Flatten the nested structure
    Object.entries(services).forEach(([domain, domainServices]) => {
      Object.entries(domainServices).forEach(([serviceId, serviceData]) => {
        allServices.push({
          ...serviceData,
          domain,
          service: serviceId
        });
      });
    });

    // Transform the flattened services
    return this.transformAll(allServices).filter(Boolean) as SimplifiedService[];
  }

  /**
   * Create a simpler view of all services
   */
  createServiceSummary(services: HassService[]): SimplifiedService[] {
    return this.transformAll(services).filter(Boolean) as SimplifiedService[];
  }

  /**
   * Group services by domain
   */
  groupByDomain(services: HassService[]): Record<string, SimplifiedService[]> {
    const result: Record<string, SimplifiedService[]> = {};

    for (const service of services) {
      const transformed = this.transform(service);
      if (!transformed) continue;

      const domain = service.domain;

      if (!result[domain]) {
        result[domain] = [];
      }

      result[domain].push(transformed);
    }

    return result;
  }
}

// Create and export singleton instances of transformers
export const entityTransformer = new EntityTransformer();
export const serviceTransformer = new ServiceTransformer();
