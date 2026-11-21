// What the card uses of Home Assistant's frontend: its types (as far as the
// card reads them), events and named colors.

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed?: string;
  last_updated?: string;
}

export interface EntityEntry {
  entity_id: string;
  device_id?: string | null;
  platform?: string;
  translation_key?: string | null;
}

export interface DeviceEntry {
  id: string;
  name?: string | null;
  name_by_user?: string | null;
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  entities?: Record<string, EntityEntry>;
  devices?: Record<string, DeviceEntry>;
  callService(domain: string, service: string, data?: Record<string, unknown>): Promise<unknown>;
  callWS<T>(message: Record<string, unknown>): Promise<T>;
  loadBackendTranslation(category: string, integration?: string): Promise<(key: string) => string>;
  formatEntityState(stateObj: HassEntity, state?: string): string;
  formatEntityName?(stateObj: HassEntity, name: unknown): string;
  [key: string]: unknown;
}

/** A card's or a feature's configuration: its own options, checked where they are read. */
export type Config = Record<string, any>;

/** The context Home Assistant gives a tile feature: the card's entity. */
export interface FeatureContext {
  entity_id?: string;
}

export interface CardHelpers {
  createCardElement(config: Config): HTMLElement;
}

declare global {
  interface Window {
    loadCardHelpers?: () => Promise<CardHelpers>;
    customCards?: Record<string, unknown>[];
    customCardFeatures?: Record<string, unknown>[];
  }
}

export const domainOf = (entityId: string): string => entityId.split(".")[0];

/** Whether a state is known: neither unknown nor unavailable. */
export const known = (stateObj?: HassEntity): stateObj is HassEntity =>
  !!stateObj && !["unknown", "unavailable"].includes(stateObj.state);

/** A state as a number; undefined when it is not one. */
export function numberOf(stateObj?: HassEntity): number | undefined {
  if (!known(stateObj)) return undefined;
  const value = Number(stateObj.state);
  return Number.isFinite(value) ? value : undefined;
}

export function fire(el: EventTarget, type: string, detail?: unknown): void {
  el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
}

/** Open Home Assistant's more-info dialog for an entity. */
export const moreInfo = (host: EventTarget, entityId?: string): void => {
  if (entityId) fire(host, "hass-more-info", { entityId });
};

/** An entity's own name, without its device's, as Home Assistant shows it. */
export function entityName(hass: HomeAssistant, entityId: string): string {
  const stateObj = hass.states[entityId];
  if (!stateObj) return entityId;
  return hass.formatEntityName?.(stateObj, { type: "entity" }) || stateObj.attributes.friendly_name || entityId;
}

/** A device's name, as its user named it or as it came. */
export function deviceName(hass: HomeAssistant, deviceId: string): string {
  const device = hass.devices?.[deviceId];
  return device?.name_by_user || device?.name || deviceId;
}

// Home Assistant's named colors (the ui_color selector's), each a theme variable
const HA_COLORS = new Set([
  "primary", "accent", "red", "pink", "purple", "deep-purple", "indigo", "blue", "light-blue", "cyan",
  "teal", "green", "light-green", "lime", "yellow", "amber", "orange", "deep-orange", "brown",
  "light-grey", "grey", "dark-grey", "blue-grey", "black", "white", "disabled",
]);

/** A color as CSS: one of Home Assistant's named colors as its theme variable, or the color as given. */
export const cssColor = (color: string): string => (HA_COLORS.has(color) ? `var(--${color}-color)` : color);

/** Define an element once (a dashboard can load the card twice). */
export function define(name: string, element: CustomElementConstructor): void {
  if (!customElements.get(name)) customElements.define(name, element);
}
