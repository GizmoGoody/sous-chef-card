/**
 * Grill card for Home Assistant.
 *
 * It is Home Assistant's own tile card, wrapped: the card builds a tile card
 * and adds to it. Everything a tile card does works the same way, with the
 * same editor. Every corner, color and size comes from the theme's variables.
 *
 * The card shows what the Grill integration keeps for each meat probe: its
 * cook type, doneness and target, its progress, its rate and when it will be
 * done. Those are Home Assistant entities, so every browser shows the same
 * cook at once, and a change made in one shows in all.
 *
 * One card, two layouts, chosen by its entity:
 *   - a probe's reading (a ThermoWorks RFX MEAT's channel 0): a probe card,
 *     whose tile is the probe, with the features Grill progress, Grill cook
 *     and Grill channels;
 *   - any other entity (the grill's ambient sensor, say): a grill card, with
 *     one Grill probe feature for each probe, which opens to show the same
 *     cook and channels.
 *
 * Sections: shared helpers; probes (as the Grill integration describes
 * them); features; the card; editors; registration.
 */

const VERSION = "0.1.0-alpha.1";
const DOMAIN = "grill";
const CARD_TYPE = "grill-card";
const EDITOR_TYPE = "grill-card-editor";
const TILE_EDITOR_TYPE = "grill-tile-card-editor";
const FEATURE_EDITOR_TYPE = "grill-feature-editor";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const fire = (el, type, detail) =>
  el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));

/** A press on a control is not a tap on the card around it. */
function keepTaps(el) {
  for (const type of ["click", "touchstart", "touchend", "mousedown", "mouseup"]) {
    el.addEventListener(type, (ev) => ev.stopPropagation());
  }
}

const cssColor = (color) => `var(--${color}-color)`;

const number = (state) => {
  if (state === undefined || state === null || state === "unavailable" || state === "unknown") return null;
  const value = Number(state);
  return Number.isFinite(value) ? value : null;
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Minutes as "12 min" or "1 h 05 min". */
function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** What this browser remembers (whether a card is open), or null. */
function readFromStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeToStorage(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // A private window, or blocked storage: the card simply does not remember
  }
}

// ---------------------------------------------------------------------------
// Probes, as the Grill integration describes them
// ---------------------------------------------------------------------------

// The icon of each cook type (the Grill integration's icons for them)
const TYPE_ICONS = {
  beef: "mdi:cow", ground_beef: "mdi:hamburger", pork: "mdi:pig", poultry: "mdi:food-drumstick",
  seafood: "mdi:fish", manual: "mdi:thermometer-probe",
};
const DEFAULT_COLOR = "deep-orange";

// The Grill integration's Progress sensors, by Home Assistant's entity registry
const progressCache = new WeakMap();
function progressSensors(hass) {
  const entities = hass?.entities;
  if (!entities) return [];
  let found = progressCache.get(entities);
  if (!found) {
    found = Object.values(entities).filter((e) => e.platform === DOMAIN && e.translation_key === "progress");
    progressCache.set(entities, found);
  }
  return found;
}

/** Every probe's reading. */
function probeReadings(hass) {
  return progressSensors(hass).map((e) => hass.states[e.entity_id]?.attributes?.reading).filter(Boolean);
}

/**
 * The probe that follows a reading, as the Grill integration describes it:
 * its entities (by what they are), its own sensors in channel order, its
 * colors and which channel is at its tip. Undefined for an entity that is
 * no probe's reading.
 */
function probeOf(hass, reading) {
  if (!hass || !reading) return undefined;
  const progress = progressSensors(hass).find((e) => hass.states[e.entity_id]?.attributes?.reading === reading);
  if (!progress) return undefined;
  const ids = {};
  for (const e of Object.values(hass.entities)) {
    if (e.platform === DOMAIN && e.device_id === progress.device_id && e.translation_key) ids[e.translation_key] = e.entity_id;
  }
  const attributes = hass.states[progress.entity_id].attributes;
  return {
    reading,
    ids,
    channels: Array.isArray(attributes.channels) ? attributes.channels : [],
    colors: Array.isArray(attributes.colors) && attributes.colors.length ? attributes.colors : [DEFAULT_COLOR],
    tipChannel: attributes.tip_channel === 4 ? 4 : 1,
    start: number(attributes.start),
  };
}

/** The probe's name: its device's, else its reading's. */
function probeName(hass, probe) {
  const device = hass.devices?.[hass.entities?.[probe.reading]?.device_id];
  return device?.name_by_user || device?.name || hass.states[probe.reading]?.attributes?.friendly_name || probe.reading;
}

/** How the probe's cook is coming along now. */
function cookOf(hass, probe) {
  const s = (key) => hass.states[probe.ids[key]];
  const readingObj = hass.states[probe.reading];
  const value = number(readingObj?.state);
  const doneAt = s("done_at")?.state;
  const doneTime = doneAt && !["unknown", "unavailable"].includes(doneAt) ? Date.parse(doneAt) : NaN;
  return {
    value,
    inUse: value !== null,
    unit: readingObj?.attributes?.unit_of_measurement ?? "",
    target: number(s("target")?.state),
    progress: number(s("progress")?.state),
    rate: number(s("rate")?.state),
    minutesLeft: Number.isFinite(doneTime) ? Math.max(0, Math.ceil((doneTime - Date.now()) / 60000)) : null,
    done: s("done")?.state === "on",
    stalled: s("stalled")?.state === "on",
    type: s("cook_type")?.state,
    doneness: s("doneness")?.state,
  };
}

/** The probe's colors as a fill: one color, or a band for each. */
function colorFill(colors, direction = "180deg") {
  if (colors.length === 1) return cssColor(colors[0]);
  const step = 100 / colors.length;
  return `linear-gradient(${direction}, ${colors.map((c, i) => `${cssColor(c)} ${(i * step).toFixed(1)}% ${((i + 1) * step).toFixed(1)}%`).join(", ")})`;
}

/** The probe's sensors from the tip: [{ entity, channel, tip }]. */
function sensorsFromTip(probe) {
  const list = probe.channels.map((entity, i) => ({ entity, channel: i + 1 }));
  if (probe.tipChannel === 4) list.reverse();
  return list.map((sensor, i) => ({ ...sensor, tip: i === 0 }));
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

const FEATURE_CSS = `
  :host {
    display: block;
    --height: var(--feature-height, 42px);
    --radius: var(--feature-border-radius, 12px);
    --tint: color-mix(in srgb, var(--tc) 20%, transparent);
  }
  .hidden { display: none !important; }
`;

/**
 * A Grill feature: a tile feature for a probe. Its probe is the tile's
 * entity, or the one its configuration names (the Grill probe feature, and
 * the features inside it).
 */
class GrillFeature extends HTMLElement {
  static getStubConfig() {
    return { type: `custom:${this.type}` };
  }

  /** Home Assistant's feature picker offers it for a probe's tile. */
  static supports(hass, entityId) {
    return !!probeOf(hass, entityId);
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    keepTaps(this);
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  get hass() {
    return this._hass;
  }

  set context(context) {
    this._context = context;
    this._render();
  }

  connectedCallback() {
    this._render();
  }

  get _probe() {
    return probeOf(this._hass, this._config?.probe ?? this._context?.entity_id);
  }

  _render() {
    if (!this._hass || !this._config) return;
    const probe = this._probe;
    this._showNothing(!probe);
    if (!probe) return;
    this.style.setProperty("--tc", cssColor(probe.colors[0]));
    this.style.setProperty("--fill", colorFill(probe.colors));
    this.update(probe, cookOf(this._hass, probe));
  }

  /**
   * A feature with nothing to show shows nothing at all: neither itself nor
   * its place among the card's features.
   */
  _showNothing(nothing) {
    const display = nothing ? "none" : "";
    if (this.style.display !== display) this.style.display = display;
    const host = this.getRootNode()?.host;
    if (host?.localName === "hui-card-feature" && host.style.display !== display) host.style.display = display;
  }
}

/** Grill progress: how far the reading has come to the target, with the time left. */
class GrillProgress extends GrillFeature {
  static type = "grill-progress";
  static pickerName = "Grill progress";

  constructor() {
    super();
    this.shadowRoot.innerHTML = `
      <style>${FEATURE_CSS}
        .bar { position: relative; height: var(--height); border-radius: var(--radius); background: var(--tint); overflow: hidden; }
        .fill { position: absolute; inset: 0 auto 0 0; background: var(--fill); transition: width 400ms ease; }
        .stalled .fill { background-image: repeating-linear-gradient(135deg, rgba(255, 255, 255, .28) 0 6px, transparent 6px 12px), var(--fill); }
        .label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding: 0 12px; color: var(--primary-text-color); font-size: var(--ha-font-size-m, 14px); font-weight: var(--ha-font-weight-medium, 500); }
        .label > span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chip { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; padding: 2px 8px 2px 6px; border-radius: 999px;
          background: var(--ha-card-background, var(--card-background-color)); font-size: var(--ha-font-size-s, 12px); }
        .chip ha-icon { --mdc-icon-size: 16px; }
        @media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
      </style>
      <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100">
        <div class="fill"></div>
        <div class="label"><span class="text"></span><span class="chip hidden"><ha-icon></ha-icon><span></span></span></div>
      </div>`;
    this._bar = this.shadowRoot.querySelector(".bar");
  }

  update(probe, cook) {
    const hass = this._hass;
    const bar = this._bar;
    const fmt = (id) => (hass.states[id] ? hass.formatEntityState(hass.states[id]) : "");
    bar.classList.toggle("stalled", cook.stalled);
    bar.setAttribute("aria-valuenow", String(Math.round(cook.progress ?? 0)));
    bar.setAttribute("aria-label", `${probeName(hass, probe)} progress`);
    bar.querySelector(".fill").style.width = `${cook.done ? 100 : cook.progress ?? 0}%`;
    bar.querySelector(".text").textContent = !cook.inUse ? "Not in use"
      : cook.target === null ? fmt(probe.reading) : `${fmt(probe.reading)} → ${fmt(probe.ids.target)}`;
    let chip;
    if (!cook.inUse) chip = null;
    else if (cook.done) chip = { icon: "mdi:check-circle", color: "var(--success-color)", text: "Done" };
    else if (cook.stalled) chip = { icon: "mdi:pause-circle", color: "var(--warning-color)", text: "Stalled" };
    else if (cook.minutesLeft !== null) chip = { icon: "mdi:timer-outline", color: "var(--secondary-text-color)", text: formatMinutes(cook.minutesLeft) };
    const el = bar.querySelector(".chip");
    el.classList.toggle("hidden", !chip);
    if (chip) {
      const icon = el.querySelector("ha-icon");
      icon.icon = chip.icon;
      icon.style.color = chip.color;
      el.querySelector("span").textContent = chip.text;
    }
  }
}

/**
 * Grill cook: the cook type and doneness, in Home Assistant's own select
 * menus. Choosing them sets the target. With Manual, Home Assistant's own
 * number feature for the target takes the doneness's place.
 */
class GrillCook extends GrillFeature {
  static type = "grill-cook";
  static pickerName = "Grill cook";

  constructor() {
    super();
    this.shadowRoot.innerHTML = `
      <style>${FEATURE_CSS}
        .row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: var(--ha-card-feature-gap, 12px); }
        ha-control-select-menu { display: block; width: 100%;
          --control-select-menu-height: var(--height); --control-select-menu-border-radius: var(--radius);
          --control-select-menu-background-color: var(--tc); --control-select-menu-focus-color: var(--tc); }
        hui-card-feature { display: block; --feature-color: var(--tc); }
      </style>
      <div class="row"></div>`;
    this._row = this.shadowRoot.querySelector(".row");
    this._type = this._menu("type", "cook_type");
    this._doneness = this._menu("doneness", "doneness");
    this._target = document.createElement("hui-card-feature");
    this._row.append(this._type, this._doneness, this._target);
  }

  /** One of Home Assistant's select menus, which selects its option on the entity it is for. */
  _menu(className, key) {
    const menu = document.createElement("ha-control-select-menu");
    menu.className = className;
    menu.setAttribute("show-arrow", "");
    menu.addEventListener("wa-select", (ev) => {
      const option = ev.detail?.item?.value;
      const entityId = this._probe?.ids[key];
      if (option === undefined || !entityId || option === this._hass.states[entityId]?.state) return;
      this._hass.callService("select", "select_option", { entity_id: entityId, option });
    });
    return menu;
  }

  _setMenu(menu, entityId, label) {
    const stateObj = this._hass.states[entityId];
    menu.hass = this._hass;
    menu.label = label;
    menu.options = (stateObj?.attributes?.options ?? []).map((value) => ({ value, label: this._hass.formatEntityState(stateObj, value) }));
    menu.value = stateObj?.state;
    menu.disabled = !stateObj || stateObj.state === "unavailable";
  }

  update(probe, cook) {
    this._setMenu(this._type, probe.ids.cook_type, "Cook type");
    const manual = cook.type === "manual";
    this._doneness.classList.toggle("hidden", manual);
    this._target.classList.toggle("hidden", !manual);
    if (manual) {
      if (!same(this._target.context, { entity_id: probe.ids.target })) {
        this._target.feature = { type: "numeric-input", style: "buttons" };
        this._target.context = { entity_id: probe.ids.target };
      }
      this._target.hass = this._hass;
    } else {
      this._setMenu(this._doneness, probe.ids.doneness, "Doneness");
    }
  }
}

/**
 * Grill channels: each of the probe's own sensors, in order from the tip.
 * The coldest is the probe's reading, so it is outlined. A tap shows the
 * sensor's more-info.
 */
class GrillChannels extends GrillFeature {
  static type = "grill-channels";
  static pickerName = "Grill channels";

  static supports(hass, entityId) {
    return (probeOf(hass, entityId)?.channels.length ?? 0) > 0;
  }

  constructor() {
    super();
    this.shadowRoot.innerHTML = `
      <style>${FEATURE_CSS}
        .row { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; }
        button { height: var(--height); min-width: 0; border: 0; border-radius: var(--radius); padding: 0 2px; cursor: pointer;
          display: grid; align-content: center; justify-items: center; line-height: 1.15; color: var(--primary-text-color);
          background: color-mix(in srgb, var(--primary-text-color) 6%, transparent); font-family: inherit; }
        button.coldest { box-shadow: inset 0 0 0 2px var(--tc); }
        button:focus-visible { outline: 2px solid var(--tc); outline-offset: 1px; }
        .value { font-size: var(--ha-font-size-m, 14px); font-weight: var(--ha-font-weight-medium, 500); font-variant-numeric: tabular-nums; }
        .name { font-size: 10px; color: var(--secondary-text-color); letter-spacing: .3px; white-space: nowrap; }
      </style>
      <div class="row" role="group"></div>`;
    this._row = this.shadowRoot.querySelector(".row");
    this._row.addEventListener("click", (ev) => {
      const entityId = ev.target.closest("button")?.dataset.entity;
      if (entityId) fire(this, "hass-more-info", { entityId });
    });
  }

  update(probe) {
    const hass = this._hass;
    const sensors = sensorsFromTip(probe);
    const values = sensors.map((s) => number(hass.states[s.entity]?.state));
    const known = values.filter((v) => v !== null);
    const coldest = known.length ? Math.min(...known) : null;
    const key = JSON.stringify(sensors.map((s, i) => [s.entity, values[i], s.tip]));
    if (key === this._key) return;
    this._key = key;
    this._row.setAttribute("aria-label", `${probeName(hass, probe)} sensors`);
    this._row.replaceChildren(...sensors.map((sensor, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.entity = sensor.entity;
      button.classList.toggle("coldest", values[i] !== null && values[i] === coldest);
      const stateObj = hass.states[sensor.entity];
      const value = values[i] === null ? "—" : `${hass.formatEntityState(stateObj).replace(/\s*°[CF]$/, "")}°`;
      const name = `Ch ${sensor.channel}${sensor.tip ? " · Tip" : ""}`;
      button.title = `Channel ${sensor.channel}${sensor.tip ? ", at the tip" : ""}`;
      button.innerHTML = `<span class="name"></span><span class="value"></span>`;
      button.querySelector(".name").textContent = name;
      button.querySelector(".value").textContent = value;
      return button;
    }));
  }
}

/**
 * Grill probe: one probe on a grill card. Its row shows the probe in its
 * colors, its progress and its reading against its target; a tap opens it
 * to show Grill cook and Grill channels for the probe.
 */
class GrillProbeFeature extends GrillFeature {
  static type = "grill-probe";
  static pickerName = "Grill probe";

  static getStubConfig(hass) {
    return { type: `custom:${this.type}`, probe: probeReadings(hass)[0] ?? "" };
  }

  static getConfigElement() {
    return document.createElement(FEATURE_EDITOR_TYPE);
  }

  /** Offered on a grill card: any tile that is not itself a probe, once a probe exists. */
  static supports(hass, entityId) {
    return !probeOf(hass, entityId) && probeReadings(hass).length > 0;
  }

  constructor() {
    super();
    this.shadowRoot.innerHTML = `
      <style>${FEATURE_CSS}
        .probe { border-radius: var(--radius); background: color-mix(in srgb, var(--tc) 12%, transparent); overflow: hidden; }
        .head { display: grid; grid-template-columns: 28px minmax(0, max-content) minmax(24px, 1fr) auto; align-items: center; gap: 10px;
          height: var(--height); padding: 0 12px 0 7px; cursor: pointer; color: var(--primary-text-color); }
        .head:focus-visible { outline: 2px solid var(--tc); outline-offset: -2px; border-radius: var(--radius); }
        .icon { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; background: var(--tint); color: var(--tc); }
        .icon ha-icon { --mdc-icon-size: 18px; }
        .name { font-weight: var(--ha-font-weight-medium, 500); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mini { height: 8px; border-radius: 4px; background: var(--tint); overflow: hidden; }
        .mini > i { display: block; height: 100%; background: var(--fill); border-radius: inherit; }
        .stalled .mini > i { background-image: repeating-linear-gradient(135deg, rgba(255, 255, 255, .35) 0 4px, transparent 4px 8px), var(--fill); }
        .reading { white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: var(--ha-font-weight-medium, 500); }
        .reading small { color: var(--secondary-text-color); font-weight: var(--ha-font-weight-normal, 400); }
        .body { display: grid; gap: 8px; padding: 0 8px 8px; }
      </style>
      <div class="probe">
        <div class="head" role="button" tabindex="0" aria-expanded="false">
          <span class="icon"><ha-icon></ha-icon></span><span class="name"></span>
          <span class="mini"><i></i></span><span class="reading"></span>
        </div>
        <div class="body hidden"></div>
      </div>`;
    this._head = this.shadowRoot.querySelector(".head");
    this._body = this.shadowRoot.querySelector(".body");
    this._head.addEventListener("click", () => this._toggle());
    this._head.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        this._toggle();
      }
    });
  }

  get _storageKey() {
    return `grill-card:probe:${this._config?.probe}`;
  }

  _toggle() {
    this._open = !this._open;
    writeToStorage(this._storageKey, this._open ? "open" : "closed");
    this._render();
  }

  update(probe, cook) {
    const hass = this._hass;
    this._open ??= readFromStorage(this._storageKey) === "open";
    const open = this._open && cook.inUse;
    this.shadowRoot.querySelector(".probe").classList.toggle("stalled", cook.stalled);
    this.shadowRoot.querySelector(".icon ha-icon").icon = TYPE_ICONS[cook.type] ?? "mdi:thermometer-probe";
    this.shadowRoot.querySelector(".name").textContent = probeName(hass, probe);
    this.shadowRoot.querySelector(".mini > i").style.width = `${cook.done ? 100 : cook.progress ?? 0}%`;
    const reading = this.shadowRoot.querySelector(".reading");
    if (!cook.inUse) reading.textContent = "Not in use";
    else {
      const target = hass.states[probe.ids.target];
      reading.innerHTML = `<span></span><small></small>`;
      reading.firstChild.textContent = hass.formatEntityState(hass.states[probe.reading]);
      reading.lastChild.textContent = target && cook.target !== null ? ` / ${hass.formatEntityState(target)}` : "";
    }
    this._head.setAttribute("aria-expanded", String(open));
    this._body.classList.toggle("hidden", !open);
    if (open) {
      if (!this._parts) {
        this._parts = [document.createElement(GrillCook.type), document.createElement(GrillChannels.type)];
        this._body.append(...this._parts);
      }
      for (const part of this._parts) {
        if (part._config?.probe !== probe.reading) part.setConfig({ type: `custom:${part.localName}`, probe: probe.reading });
        part.hass = hass;
      }
    }
  }
}

const FEATURES = [GrillProgress, GrillCook, GrillChannels, GrillProbeFeature];

// ---------------------------------------------------------------------------
// The card
// ---------------------------------------------------------------------------

// Options the card adds to the tile card's
const OWN_KEYS = ["collapsible", "always_show"];

/** The State content shown unless one is chosen: the reading, the target and the time left (see probeStateObj). */
const PROBE_STATE_CONTENT = ["state", "target", "time_left"];

/** The tile card's own options (as its editor shows them), with the card's defaults. */
function tileConfig(config, probe) {
  const tile = { ...config, type: "tile" };
  for (const key of OWN_KEYS) delete tile[key];
  if (probe) {
    tile.color ??= probe.colors[0];
    tile.state_content ??= PROBE_STATE_CONTENT;
  }
  return tile;
}

/** The tile card inside the card: a tap opens or closes it (unless it is not collapsible), and a closed card leaves its features out. */
function innerTileConfig(config, probe, open) {
  const tile = tileConfig(config, probe);
  if (config.collapsible !== false) {
    tile.tap_action = { action: "fire-dom-event", grill_card: "toggle" };
    if (!open) tile.features = [];
  }
  return tile;
}

/**
 * The probe's reading as the tile card gets it: with the cook type's icon,
 * and the target, time left and cook as attributes, so Home Assistant's own
 * State content can show them.
 */
function probeStateObj(hass, probe) {
  const stateObj = hass.states[probe.reading];
  if (!stateObj) return stateObj;
  const cook = cookOf(hass, probe);
  const target = hass.states[probe.ids.target];
  const extra = { icon: TYPE_ICONS[cook.type] ?? "mdi:thermometer-probe" };
  if (cook.inUse && target && cook.target !== null) extra.target = `→ ${hass.formatEntityState(target)}`;
  if (cook.inUse) {
    if (cook.done) extra.time_left = "Done";
    else if (cook.stalled) extra.time_left = "Stalled";
    else if (cook.minutesLeft !== null) extra.time_left = `${formatMinutes(cook.minutesLeft)} left`;
  }
  const typeObj = hass.states[probe.ids.cook_type], donenessObj = hass.states[probe.ids.doneness];
  if (typeObj && donenessObj) {
    extra.cook = cook.type === "manual" ? hass.formatEntityState(typeObj)
      : `${hass.formatEntityState(typeObj)}, ${hass.formatEntityState(donenessObj)}`;
  }
  return { ...stateObj, attributes: { ...stateObj.attributes, ...extra } };
}

/** Home Assistant's states with one state object in place of the entity's, without copying the others. */
function statesWith(states, entityId, stateObj) {
  return new Proxy(states, {
    get: (target, key, receiver) => (key === entityId ? stateObj : Reflect.get(target, key, receiver)),
    getOwnPropertyDescriptor: (target, key) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(target, key);
      return key === entityId && descriptor ? { ...descriptor, value: stateObj } : descriptor;
    },
  });
}

// Whether each card is open in the editor's preview while the editor is open
const PREVIEW_OPEN = new Map();

class GrillCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        .frame { height: 100%; }
        .tile { display: block; height: 100%; }
      </style>
      <div class="frame"></div>`;
    this._frame = this.shadowRoot.querySelector(".frame");
    this._frame.addEventListener("ll-custom", (ev) => {
      if (ev.detail?.grill_card !== "toggle") return;
      ev.stopPropagation();
      this._setOpen(!this._open);
    });
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TYPE);
  }

  /** A new card: the first probe, with its progress, cook and channels. */
  static getStubConfig(hass) {
    const entity = probeReadings(hass)[0];
    if (!entity) return { entity: "" };
    return { entity, features: FEATURES.filter((f) => f !== GrillProbeFeature).map((f) => ({ type: `custom:${f.type}` })) };
  }

  setConfig(config) {
    if (!config?.entity) throw new Error("Choose an entity: a probe's reading, or a sensor for the grill");
    this._config = config;
    this._open = this._preview ? PREVIEW_OPEN.get(config.entity) ?? true : readFromStorage(this._storageKey) !== "closed";
    this._signature = undefined;
    if (this._tile) this._updateTile();
    else if (customElements.get("hui-tile-card")) this._createTile();
    else {
      // The tile card is loaded on demand; the card helpers load it
      window.loadCardHelpers?.().then(async (helpers) => {
        helpers.createCardElement({ type: "tile", entity: config.entity });
        await customElements.whenDefined("hui-tile-card");
        if (!this._tile) this._createTile();
      });
    }
  }

  get _storageKey() {
    return `grill-card:${this._config?.entity}`;
  }

  get _probe() {
    return probeOf(this._hass, this._config?.entity);
  }

  /** Open, as tapped; a probe not in use stays closed unless Always show is on. */
  get _shownOpen() {
    const probe = this._probe;
    if (probe && !this._config.always_show && this._hass && !cookOf(this._hass, probe).inUse) return false;
    return this._open;
  }

  _setOpen(open) {
    this._open = open;
    if (this._preview) PREVIEW_OPEN.set(this._config.entity, open);
    else writeToStorage(this._storageKey, open ? "open" : "closed");
    this._signature = undefined;
    this._updateTile();
  }

  _createTile() {
    this._tile = document.createElement("hui-tile-card");
    this._tile.classList.add("tile");
    if (this._preview !== undefined) this._tile.preview = this._preview;
    if (this._layoutValue !== undefined) this._tile.layout = this._layoutValue;
    this._frame.append(this._tile);
    this._updateTile();
  }

  /** The tile card gets its configuration anew only when it changed, and the probe's reading with the cook on it. */
  _updateTile() {
    if (!this._tile || !this._config) return;
    const probe = this._probe;
    const tile = innerTileConfig(this._config, probe, this._shownOpen);
    const signature = JSON.stringify(tile);
    if (signature !== this._signature) {
      this._signature = signature;
      this._tile.setConfig(tile);
    }
    const hass = this._hass;
    if (!hass) return;
    if (!probe) {
      this._tile.hass = hass;
      return;
    }
    const stateObj = probeStateObj(hass, probe);
    // The tile redraws only when what it shows changed
    if (!this._stateObj || !same(this._stateObj, stateObj)) this._stateObj = stateObj;
    this._tile.hass = { ...hass, states: statesWith(hass.states, probe.reading, this._stateObj) };
  }

  set hass(hass) {
    this._hass = hass;
    this._updateTile();
  }

  get hass() {
    return this._hass;
  }

  // Dashboard properties the tile card uses. In the editor's preview the card starts open and changes only when tapped
  set preview(value) {
    const was = this._preview;
    this._preview = value;
    if (this._tile) this._tile.preview = value;
    if (!this._config || !value === !was) return;
    this._open = value ? PREVIEW_OPEN.get(this._config.entity) ?? true : readFromStorage(this._storageKey) !== "closed";
    this._updateTile();
  }

  set layout(value) {
    this._layoutValue = value;
    if (this._tile) this._tile.layout = value;
  }

  getCardSize() {
    return 1 + (this._shownOpen === false ? 0 : (this._config?.features ?? []).length);
  }

  /** The tile card's columns, and a height that follows the content as it opens and closes. */
  getGridOptions() {
    const options = { ...(this._tile?.getGridOptions?.() ?? { columns: 6 }), rows: "auto" };
    delete options.min_rows;
    return options;
  }
}

// ---------------------------------------------------------------------------
// Editors
// ---------------------------------------------------------------------------

/** A form schema without the named options, at any depth. */
function hideOptions(schema, names) {
  return schema
    .filter((item) => !names.includes(item.name))
    .map((item) => (Array.isArray(item.schema) ? { ...item, schema: hideOptions(item.schema, names) } : item));
}

/**
 * The tile card's editor without its entity picker (the card's own picker,
 * above it, is filtered to probes or grill sensors). It is the tile card's
 * own editor class, so it keeps every future change to it. If a Home
 * Assistant update renames its form layout, the editor still works and
 * simply shows the entity picker again.
 */
function tileEditorType() {
  if (customElements.get(TILE_EDITOR_TYPE)) return TILE_EDITOR_TYPE;
  const Base = customElements.get("hui-tile-card-editor");
  if (!Base) return null;
  customElements.define(TILE_EDITOR_TYPE, class extends Base {
    constructor() {
      super();
      const original = this._schema;
      if (typeof original !== "function") return;
      let lastIn, lastOut;
      this._schema = (...args) => {
        const schema = original.apply(this, args);
        if (schema !== lastIn) {
          lastIn = schema;
          lastOut = Array.isArray(schema) ? hideOptions(schema, ["entity"]) : schema;
        }
        return lastOut;
      };
    }
  });
  return TILE_EDITOR_TYPE;
}

/** The configuration as the editor saves it: options at their defaults left out. */
function minimal(config, probe) {
  const c = { ...config };
  if (c.collapsible !== false) delete c.collapsible;
  if (c.always_show !== true) delete c.always_show;
  if (probe) {
    if (c.color === probe.colors[0]) delete c.color;
    if (same(c.state_content, PROBE_STATE_CONTENT)) delete c.state_content;
  }
  if (c.vertical === false) delete c.vertical;
  if (Array.isArray(c.features) && !c.features.length) delete c.features;
  return c;
}

/**
 * A drawing of an RFX MEAT probe, as its instructions show it: the reduced
 * tip, its four sensors along the lower part of the shaft, the immersion
 * lines and the antenna end, with each sensor's channel and temperature.
 */
function probeDrawing(hass, probe) {
  const sensors = sensorsFromTip(probe);
  // Where the four sensors sit, from the tip (in drawing units; the tip is at the left)
  const at = [34, 66, 104, 136];
  const marks = sensors.slice(0, 4).map((sensor, i) => {
    const stateObj = hass.states[sensor.entity];
    const value = number(stateObj?.state) === null ? "—" : `${hass.formatEntityState(stateObj).replace(/\s*°[CF]$/, "")}°`;
    return `
      <line x1="${at[i]}" y1="34" x2="${at[i]}" y2="47" stroke="var(--secondary-text-color)" stroke-width="1"/>
      <circle cx="${at[i]}" cy="54" r="3.5" fill="var(--tc)"/>
      <text x="${at[i]}" y="20" text-anchor="middle" class="ch">Ch ${sensor.channel}</text>
      <text x="${at[i]}" y="31" text-anchor="middle" class="v">${value}</text>`;
  }).join("");
  return `
    <svg viewBox="0 0 400 76" role="img" aria-label="Where each sensor is in the probe">
      <style>
        text { font-family: var(--ha-font-family-body, Roboto, sans-serif); fill: var(--primary-text-color); }
        .ch { font-size: 10px; font-weight: 500; } .v { font-size: 10px; fill: var(--secondary-text-color); }
        .note { font-size: 9px; fill: var(--secondary-text-color); }
      </style>
      <path d="M8 54 L22 50.5 L120 50.5 L128 48 L392 48 L392 60 L128 60 L120 57.5 L22 57.5 Z"
        fill="var(--secondary-background-color, #e5e5e5)" stroke="var(--secondary-text-color)" stroke-width="1"/>
      <line x1="262" y1="48" x2="262" y2="60" stroke="var(--primary-text-color)" stroke-width="1"/>
      <rect x="270" y="48" width="14" height="12" fill="var(--primary-text-color)"/>
      <text x="337" y="57.5" text-anchor="middle" class="ch" style="font-style: italic; font-weight: 700;">RFX</text>
      <text x="22" y="72" class="note">Tip</text>
      <text x="262" y="72" text-anchor="middle" class="note">Insert to here</text>
      ${marks}
    </svg>`;
}

class GrillCardEditor extends HTMLElement {
  constructor() {
    super();
    PREVIEW_OPEN.clear();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        #pick { display: block; margin-bottom: 24px; }
        #tile { display: block; }
        ha-expansion-panel { display: block; margin-top: 24px; --expansion-panel-content-padding: 0;
          border-radius: var(--ha-border-radius-md, 8px); --ha-card-border-radius: var(--ha-border-radius-md, 8px); }
        .content { padding: 12px; display: grid; gap: 16px; }
        .drawing { display: grid; gap: 6px; }
        .drawing svg { width: 100%; height: auto; display: block; }
        .help { color: var(--secondary-text-color); font-size: var(--ha-font-size-s, 12px); margin: 0; }
        .help a { color: var(--primary-color); }
      </style>
      <ha-form id="pick"></ha-form>
      <div id="tile"></div>
      <ha-expansion-panel outlined expanded>
        <div slot="header" role="heading" aria-level="3">Grill</div>
        <div class="content">
          <div class="drawing"></div>
          <ha-form id="form"></ha-form>
        </div>
      </ha-expansion-panel>`;
    this._pick = this.shadowRoot.getElementById("pick");
    this._form = this.shadowRoot.getElementById("form");
    this._drawing = this.shadowRoot.querySelector(".drawing");
    for (const form of [this._pick, this._form]) {
      form.computeLabel = (s) => s.label ?? s.name;
      form.computeHelper = (s) => s.helper;
    }
    this._pick.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      const { show, entity } = ev.detail.value;
      if (show !== this._show) {
        this._show = show;
        this._render();
        return;
      }
      if (entity && entity !== this._config.entity) this._update({ entity });
    });
    this._form.addEventListener("value-changed", (ev) => {
      ev.stopPropagation();
      this._update({ collapsible: ev.detail.value.collapsible !== false, always_show: ev.detail.value.always_show === true });
    });
  }

  set hass(hass) {
    this._hass = hass;
    this._pick.hass = hass;
    this._form.hass = hass;
    if (this._tileEditor) this._tileEditor.hass = hass;
    this._render();
  }

  set lovelace(lovelace) {
    this._lovelace = lovelace;
    if (this._tileEditor) this._tileEditor.lovelace = lovelace;
  }

  setConfig(config) {
    this._config = config;
    this._show ??= !config.entity || probeOf(this._hass, config.entity) || !this._hass ? "probe" : "grill";
    this._render();
    this._setTileEditorConfig();
  }

  get _probe() {
    return probeOf(this._hass, this._config?.entity);
  }

  _update(changes) {
    this._config = minimal({ ...this._config, ...changes }, this._probe);
    fire(this, "config-changed", { config: this._config });
    this._render();
    this._setTileEditorConfig();
  }

  async _setTileEditorConfig() {
    if (!this._tileEditor) {
      this._loading ??= (async () => {
        const helpers = await window.loadCardHelpers();
        helpers.createCardElement({ type: "tile", entity: this._config.entity });
        await customElements.whenDefined("hui-tile-card");
        const original = await customElements.get("hui-tile-card").getConfigElement();
        const type = tileEditorType();
        const editor = type ? document.createElement(type) : original;
        editor.addEventListener("config-changed", (ev) => {
          // The tile card's options changed: keep the card's own and pass the whole card on
          ev.stopPropagation();
          const own = Object.fromEntries(OWN_KEYS.filter((k) => k in this._config).map((k) => [k, this._config[k]]));
          this._config = minimal({ ...ev.detail.config, ...own, type: this._config.type }, this._probe);
          fire(this, "config-changed", { config: this._config });
          editor.setConfig(tileConfig(this._config, this._probe));
        });
        if (this._hass) editor.hass = this._hass;
        if (this._lovelace) editor.lovelace = this._lovelace;
        this._tileEditor = editor;
        this.shadowRoot.getElementById("tile").replaceWith(editor);
      })();
      await this._loading;
    }
    this._tileEditor.setConfig(tileConfig(this._config, this._probe));
  }

  _render() {
    if (!this._config || !this._hass) return;
    const readings = probeReadings(this._hass);
    const probeMode = this._show !== "grill";
    this._pick.schema = [
      {
        name: "show", label: "Show",
        selector: { select: { mode: "list", options: [
          { value: "probe", label: "A probe" },
          { value: "grill", label: "A grill, with a Grill probe feature for each probe" },
        ] } },
      },
      probeMode
        ? { name: "entity", label: "Probe", helper: readings.length ? "The probes of the Grill integration, by their reading."
          : "Add a probe to a grill in the Grill integration first.", selector: { entity: { include_entities: readings } } }
        : { name: "entity", label: "Grill sensor", helper: "The grill's own temperature, such as its ambient sensor.",
          selector: { entity: { domain: "sensor", device_class: "temperature", exclude_entities: readings } } },
    ];
    this._pick.data = { show: this._show, entity: probeMode === !!this._probe ? this._config.entity : undefined };

    const probe = this._probe;
    this._drawing.hidden = !probe;
    if (probe) {
      this._drawing.style.setProperty("--tc", cssColor(probe.colors[0]));
      const key = JSON.stringify([probe.channels.map((id) => this._hass.states[id]?.state), probe.tipChannel, probe.colors]);
      if (key !== this._drawingKey) {
        this._drawingKey = key;
        const thermoworks = this._hass.entities?.[probe.reading]?.platform === "thermoworks_cloud";
        this._drawing.innerHTML = `${thermoworks && probe.channels.length === 4 ? probeDrawing(this._hass, probe) : ""}
          <p class="help">The probe's colors and which sensor is at its tip are set on the probe, so every card shows it the same way:
          <a href="/config/integrations/integration/${DOMAIN}">Settings › Devices &amp; services › Grill</a>.</p>`;
      }
    }
    this._form.schema = [
      { name: "collapsible", label: "Collapsible", helper: "Tapping the card opens or closes it, in place of its Tap behavior.", selector: { boolean: {} } },
      ...(probe ? [{ name: "always_show", label: "Always show", helper: "Keep the card open while the probe is not in use.", selector: { boolean: {} } }] : []),
    ];
    this._form.data = { collapsible: this._config.collapsible !== false, always_show: this._config.always_show === true };
  }
}

/** The Grill probe feature's editor: which probe it shows. */
class GrillFeatureEditor extends HTMLElement {
  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  setConfig(config) {
    this._config = config;
    this._render();
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => s.label;
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        this._config = { ...this._config, probe: ev.detail.value.probe };
        fire(this, "config-changed", { config: this._config });
      });
      this.append(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = [{ name: "probe", label: "Probe", required: true, selector: { entity: { include_entities: probeReadings(this._hass) } } }];
    this._form.data = { probe: this._config.probe };
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const define = (name, cls) => {
  if (!customElements.get(name)) customElements.define(name, cls);
};

if (!customElements.get(CARD_TYPE)) {
  for (const feature of FEATURES) define(feature.type, feature);
  define(FEATURE_EDITOR_TYPE, GrillFeatureEditor);
  define(CARD_TYPE, GrillCard);
  define(EDITOR_TYPE, GrillCardEditor);

  window.customCardFeatures = window.customCardFeatures || [];
  for (const feature of FEATURES) {
    if (window.customCardFeatures.some((f) => f.type === feature.type)) continue;
    window.customCardFeatures.push({
      type: feature.type,
      name: feature.pickerName,
      isSupported: (hass, context) => feature.supports(hass, context?.entity_id),
      ...(feature === GrillProbeFeature ? { configurable: true } : {}),
    });
  }

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD_TYPE,
    name: "Grill",
    description: "A tile card for a meat probe, or for a grill and its probes: the cook type, doneness and target, progress, time left and each sensor's reading.",
    preview: true,
    documentationURL: "https://github.com/GizmoGoody/grill-card",
  });
  console.info(`%c GRILL CARD %c ${VERSION} `, "color: #fff; background: #555; font-weight: bold", "color: #fff; background: #e8590c");
}
