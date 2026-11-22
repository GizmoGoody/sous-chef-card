// What the card uses of Home Assistant's frontend: its types (as far as the
// card reads them), events, named colors, and the helpers the sibling cards
// share for reaching into the tile card.

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
  locale?: { language?: string; time_format?: string };
  themes?: { darkMode?: boolean };
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

/** Whether an entity can be used: it exists and is not unavailable. */
export const usable = (hass: HomeAssistant | undefined, entityId?: string): boolean =>
  !!entityId && !!hass?.states[entityId] && hass.states[entityId].state !== "unavailable";

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

/** A select selector of [value, label] pairs. */
export const select = (options: [string, string][]) => ({
  select: { mode: "dropdown", options: options.map(([value, label]) => ({ value, label })) },
});

/** Whether two option values are the same. */
export const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Whether the dashboard is in its dark mode. */
export const darkMode = (hass?: HomeAssistant): boolean => !!hass?.themes?.darkMode;

/** All elements matching selector inside root and its shadow roots, a few deep. */
export function findAllDeep(root: ParentNode | null | undefined, selector: string, depth = 5, out: Element[] = []): Element[] {
  if (!root || depth < 0) return out;
  out.push(...root.querySelectorAll(selector));
  for (const el of root.querySelectorAll("*")) if (el.shadowRoot) findAllDeep(el.shadowRoot, selector, depth - 1, out);
  return out;
}

/** The first element matching selector inside root and its shadow roots. */
export function findDeep(root: ParentNode | null | undefined, selector: string, depth = 5): Element | null {
  if (!root || depth < 0) return null;
  const found = root.querySelector(selector);
  if (found) return found;
  for (const el of root.querySelectorAll("*")) {
    const hit = el.shadowRoot && findDeep(el.shadowRoot, selector, depth - 1);
    if (hit) return hit;
  }
  return null;
}

/** Add a style sheet to a shadow root once; false when the root does not take it. */
export function adopt(root: ShadowRoot, sheet: CSSStyleSheet): boolean {
  try {
    if (!root.adoptedStyleSheets.includes(sheet)) root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
    return true;
  } catch {
    return false;
  }
}

export function sheetOf(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

/**
 * Answers Home Assistant's "states" context inside an element, as Home
 * Assistant's own provider does (the Lit context protocol), with the states
 * the card changed, so the tile card's state content and its editor's State
 * content picker see the card's attributes (from the SVS Subwoofer card).
 */
type ContextRequest = Event & { context?: unknown; subscribe?: boolean; callback: (value: unknown, unsubscribe?: () => void) => void };
export class StatesProvider {
  private _states?: Record<string, HassEntity>;
  private _waiting: ContextRequest[] = [];
  private _subscribers = new Map<ContextRequest["callback"], () => void>();

  constructor(host: EventTarget) {
    host.addEventListener("context-request", (event) => {
      const ev = event as ContextRequest;
      if (ev.context !== "states") return;
      ev.stopPropagation();
      if (this._states === undefined) this._waiting.push(ev);
      else this._answer(ev);
    });
  }

  private _answer(ev: ContextRequest): void {
    if (!ev.subscribe) {
      ev.callback(this._states);
      return;
    }
    const unsubscribe = () => this._subscribers.delete(ev.callback);
    this._subscribers.set(ev.callback, unsubscribe);
    ev.callback(this._states, unsubscribe);
  }

  set states(states: Record<string, HassEntity>) {
    if (states === this._states) return;
    this._states = states;
    for (const ev of this._waiting.splice(0)) this._answer(ev);
    for (const [callback, unsubscribe] of this._subscribers) callback(states, unsubscribe);
  }
}

/** Home Assistant's states with one state object in place of the entity's, without copying the others (from the Prusa Connect card). */
export function statesWith(states: Record<string, HassEntity>, entityId: string, stateObj: HassEntity): Record<string, HassEntity> {
  return new Proxy(states, {
    get: (target, key, receiver) => (key === entityId ? stateObj : Reflect.get(target, key, receiver)),
    getOwnPropertyDescriptor: (target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      return key === entityId && descriptor ? { ...descriptor, value: stateObj } : descriptor;
    },
  });
}

/** A color (one of Home Assistant's named colors, or any CSS color) as #rrggbb, read where it is used (from the Prusa Connect card). */
let hexCanvas: CanvasRenderingContext2D | null | undefined;
export function toHex(el: Element, color: string): string | undefined {
  let value = cssColor(color);
  for (let i = 0; i < 4; i++) {
    const named = value.match(/^var\((--[\w-]+)(?:,\s*(.+))?\)$/);
    if (!named) break;
    value = getComputedStyle(el).getPropertyValue(named[1]).trim() || named[2] || "";
  }
  if (!value) return undefined;
  hexCanvas ??= document.createElement("canvas").getContext("2d");
  if (!hexCanvas) return undefined;
  hexCanvas.fillStyle = "#010203";
  hexCanvas.fillStyle = value;
  const hex = String(hexCanvas.fillStyle);
  return hex.startsWith("#") && (hex !== "#010203" || value === "#010203") ? hex : undefined;
}

/** A color half way to the theme's background (#rrggbb), as the Prusa Connect card dims a target. */
export function dim(hex: string, dark: boolean): string {
  const background = dark ? [17, 17, 17] : [255, 255, 255];
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `#${rgb.map((c, i) => Math.round((c + background[i]) / 2).toString(16).padStart(2, "0")).join("")}`;
}

/** Define an element once (a dashboard can load the card twice). */
export function define(name: string, element: CustomElementConstructor): void {
  if (!customElements.get(name)) customElements.define(name, element);
}
