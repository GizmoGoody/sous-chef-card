// #region ===== IMPORTS AND IDENTIFICATION CONSTANTS =====

import { LitElement, html, css } from "https://unpkg.com/lit@2.8.0/index.js?module";

const CARD_VERSION = "1.1.0";
const CARD_TYPE = "grill-card";

// #endregion

// #region ===== ICON LOOKUP TABLES =====

const TYPE_ICONS = {
  beef: "mdi:cow",
  steak: "mdi:cow",
  brisket: "mdi:cow",
  veal: "mdi:cow",
  hamburger: "mdi:hamburger",
  chicken: "mdi:food-drumstick",
  poultry: "mdi:food-drumstick",
  turkey: "mdi:turkey",
  pork: "mdi:pig",
  ham: "mdi:pig",
  "pork ribs": "mdi:bone",
  "beef ribs": "mdi:bone",
  fish: "mdi:fish",
  salmon: "mdi:fish",
  seafood: "mdi:fish",
  lamb: "mdi:sheep",
  rabbit: "mdi:rabbit",
  game: "mdi:rabbit",
  venison: "mdi:rabbit",
  sausage: "mdi:food-hot-dog",
  "hot dog": "mdi:food-hot-dog",
  vegetable: "mdi:carrot",
};

const TYPE_ICON_FALLBACK = "mdi:thermometer-probe";

const DONENESS_ICONS = {
  blue: "mdi:thermometer-low",
  "blue rare": "mdi:thermometer-low",
  rare: "mdi:thermometer-low",
  "medium rare": "mdi:thermometer",
  medium: "mdi:thermometer",
  "medium well": "mdi:thermometer-high",
  "well done": "mdi:thermometer-alert",
  well: "mdi:thermometer-alert",
  done: "mdi:check-circle",
};
const DONENESS_ICON_FALLBACK = "mdi:thermometer";

const DEFAULT_PROGRESS_MIN = 40;

// #endregion

// #region ===== UTILITY FUNCTIONS =====

function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveTypeIcon(typeState, iconOverride) {
  if (iconOverride) return iconOverride;
  if (!typeState) return TYPE_ICON_FALLBACK;
  return TYPE_ICONS[String(typeState).toLowerCase().trim()] || TYPE_ICON_FALLBACK;
}

function resolveDonenessIcon(donenessState) {
  if (!donenessState) return DONENESS_ICON_FALLBACK;
  return DONENESS_ICONS[String(donenessState).toLowerCase().trim()] || DONENESS_ICON_FALLBACK;
}

function normalizeAmbient(ambient) {
  if (!ambient) return [];
  if (typeof ambient === "string") return [{ entity: ambient, label: null }];
  if (!Array.isArray(ambient)) return [];

  return ambient
    .map((entry) => {
      if (typeof entry === "string") {
        return { entity: entry, label: null };
      }
      
      const labelVal = entry.label !== undefined && entry.label !== null ? String(entry.label).trim() : null;
      
      return {
        entity: entry.entity,
        label: labelVal,
      };
    })
    .filter((entry) => typeof entry.entity === "string" && entry.entity.length > 0);
}

function normalizeColorList(color) {
  if (Array.isArray(color)) {
    return color
      .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
      .filter((entry) => entry.length > 0);
  }

  if (typeof color === "string") {
    return color
      .split(/[,|]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  return [];
}

function normalizeEntities(entities) {
  if (!entities) return [];
  if (typeof entities === "string") return [{ entity: entities, label: null, hidden: false }];
  if (!Array.isArray(entities)) return [];

  return entities
    .map((entry) => {
      if (typeof entry === "string") {
        return { entity: entry, label: null, hidden: false };
      }

      return {
        entity: entry.entity,
        label: entry.label || null,
        hidden: entry.hidden === true,
      };
    })
    .filter((entry) => typeof entry.entity === "string" && entry.entity.length > 0);
}

function normalizeToggle(toggle) {
  if (!toggle) return null;

  if (typeof toggle === "string") {
    return { entity: toggle };
  }

  if (typeof toggle.entity !== "string" || toggle.entity.length === 0) {
    return null;
  }

  return {
    entity: toggle.entity,
  };
}

function normalizeProbe(probe) {
  const colors = normalizeColorList(probe.color);

  return {
    id: probe.id || slugify(probe.name),
    name: probe.name || "Probe",
    active: probe.active || null,
    derivative: probe.derivative || null,
    type: probe.type || null,
    doneness: probe.doneness || null,
    target: probe.target || null,
    heading: probe.heading || null,
    color: colors,
    icon: probe.icon || null,
    entities: normalizeEntities(probe.entities),
    toggle: normalizeToggle(probe.toggle),
  };
}

function normalizeProgressMin(progressMin) {
  if (progressMin === undefined || progressMin === null || progressMin === "") {
    return DEFAULT_PROGRESS_MIN;
  }

  if (typeof progressMin === "number") {
    return Number.isFinite(progressMin) ? progressMin : DEFAULT_PROGRESS_MIN;
  }

  if (typeof progressMin === "string") {
    const trimmed = progressMin.trim();
    if (!trimmed) return DEFAULT_PROGRESS_MIN;

    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber)) return asNumber;

    return trimmed;
  }

  if (typeof progressMin === "object" && typeof progressMin.entity === "string") {
    return progressMin.entity;
  }

  return DEFAULT_PROGRESS_MIN;
}

function countDecimalPlaces(value) {
  if (value === undefined || value === null || value === "") return null;

  const normalized = String(value).toLowerCase();
  if (normalized.includes("e-")) {
    const [base, exponent] = normalized.split("e-");
    const baseDecimals = (base.split(".")[1] || "").length;
    return Number.parseInt(exponent, 10) + baseDecimals;
  }

  const decimals = normalized.split(".")[1];
  return decimals ? decimals.length : 0;
}

function joinStateParts(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return "";
  return parts.map((part) => part?.value || "").join("");
}

function isUnavailableState(stateObj) {
  return !stateObj || stateObj.state === "unavailable" || stateObj.state === "unknown";
}

function parsePrecision(value) {
  if (value === undefined || value === null || value === "") return null;

  const parsedPrecision = Number(value);
  if (!Number.isFinite(parsedPrecision) || parsedPrecision < 0) return null;
  return Math.floor(parsedPrecision);
}

function getEntityDisplayPrecision(entityId, stateObj, hass) {
  const entityConfig = entityId ? hass?.entities?.[entityId] : undefined;
  const entityPrecision = parsePrecision(entityConfig?.display_precision);
  if (entityPrecision !== null) return entityPrecision;

  const attributes = stateObj?.attributes;
  if (!attributes) return null;

  const configuredPrecision =
    parsePrecision(attributes.display_precision)
    ?? parsePrecision(attributes.suggested_display_precision)
    ?? parsePrecision(attributes.precision);

  if (configuredPrecision !== null) return configuredPrecision;

  if (attributes.step !== undefined && attributes.step !== null && attributes.step !== "") {
    return countDecimalPlaces(attributes.step);
  }

  return null;
}

function formatNumericValue(value, precision) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value);
  if (precision === null || precision === undefined) return String(value);
  return numericValue.toFixed(precision);
}

function formatEntityStateValue(entityId, stateObj, hass, valueOverride) {
  if (isUnavailableState(stateObj)) return "—";

  const rawState = valueOverride ?? stateObj.state;
  const isNumeric = stateObj.attributes?.unit_of_measurement !== undefined || 
                    stateObj.attributes?.state_class !== undefined ||
                    !Number.isNaN(Number(rawState));

  // Determine explicit precision if natively defined.
  const precision = getEntityDisplayPrecision(entityId, stateObj, hass);
  
  // If we found a specific numeric precision, format it completely locally, bypassing HA routines
  // which might try to override or ignore it.
  if (isNumeric && precision !== null) {
      const numericValue = Number(rawState);
      if (Number.isFinite(numericValue)) {
          let formattedValue = numericValue.toFixed(precision);
          try {
             formattedValue = new Intl.NumberFormat(hass?.locale?.language || navigator.language || 'en-US', {
               minimumFractionDigits: precision,
               maximumFractionDigits: precision,
             }).format(numericValue);
          } catch(e) {}

          const unit = stateObj.attributes?.unit_of_measurement || "";
          if (unit && valueOverride === undefined) {
              return `${formattedValue} ${unit}`;
          }
          return formattedValue;
      }
  }

  // Use Home Assistant's native formatter (translates select options, formats states).
  if (typeof hass?.formatEntityState === "function") {
    try {
      const rendered = hass.formatEntityState(stateObj, valueOverride);
      if (rendered) return rendered;
    } catch (_error) {}
  }

  // Raw Fallback
  const unit = stateObj.attributes?.unit_of_measurement || "";
  return rawState + ((unit && valueOverride === undefined) ? ` ${unit}` : "");
}

// #endregion

// #region ===== GRILL CARD =====

class GrillCard extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _collapsed: { type: Boolean, state: true },
      _collapsedToggles: { type: Boolean, state: true },
      _collapsedProbes: { type: Object, state: true },
    };
  }

  constructor() {
    super();
    this._collapsed = false;
    this._collapsedToggles = false;
    this._collapsedProbes = {};
    this.__textMeasureCtx = null;
    this._storageKeyBase = null;
    this._lastLayoutSignature = "";
  }

  static getConfigElement() {
    return document.createElement("grill-card-editor");
  }

  static getStubConfig() {
    return {
      title: "Grill Session",
      ambient: [],
      probes: [],
    };
  }

  static get styles() {
    return css`
      :host {
        display: block;
        --grill-card-gap: 12px;
        --grill-card-gap-sm: 8px;
        --grill-card-surface: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.06);
        --summary-ring-progress-angle: 0deg;
      }

      ha-card {
        background: var(--grill-card-surface);
        backdrop-filter: blur(14px);
        border: 1px solid rgba(var(--rgb-card-background-color, 255, 255, 255), 0.10);
        border-radius: var(--ha-card-border-radius, 16px);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        gap: 0;
        overflow: hidden;
        padding: 0;
        position: relative;
      }

      .card-top-strip {
        background: inherit;
        display: flex;
        flex-direction: column;
        gap: 0;
        overflow: hidden;
        padding: 0;
        position: relative;
      }

      .card-header-bar {
        align-items: center;
        background: transparent;
        border: none;
        cursor: pointer;
        display: flex;
        justify-content: space-between;
        min-height: 56px;
        padding: 4px var(--ha-space-3, 12px) 4px;
      }

      .card-header-chevron {
        color: var(--secondary-text-color);
        display: flex;
      }

      .card-title {
        color: var(--primary-text-color);
        font-family: var(--ha-font-family-body, Roboto, Noto, sans-serif);
        font-size: var(--ha-font-size-l, 16px);
        font-weight: var(--ha-font-weight-bold, 700);
        letter-spacing: 0;
        line-height: var(--ha-line-height-condensed, 1.2);
        margin: 0;
      }

      .summary-row {
        align-items: center;
        background: transparent;
        border: none;
        display: flex;
        flex-wrap: wrap;
        gap: clamp(4px, 1vw, 8px);
        justify-content: flex-start;
        margin: 0;
        min-width: 0;
        padding: 4px var(--ha-space-3, 12px) 4px;
      }

      .summary-items {
        align-items: center;
        display: flex;
        flex: 1;
        flex-wrap: wrap;
        gap: clamp(3px, 0.8vw, 6px);
        justify-content: space-evenly;
        min-width: 0;
        width: 100%;
      }

      .summary-collapse-toggle {
        align-items: center;
        cursor: pointer;
        display: flex;
        flex-shrink: 0;
        margin-left: auto;
        padding-left: 6px;
      }

      .summary-row-empty {
        border: none;
        background: none;
        backdrop-filter: none;
        box-shadow: none;
        justify-content: flex-end;
        min-height: 24px;
        margin: 0;
        padding: 0 var(--ha-space-3, 12px);
      }

      .collapse-icon {
        color: var(--secondary-text-color);
      }

      .summary-badge {
        align-items: center;
        justify-content: center;
        background: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.04);
        border: 1px solid rgba(var(--rgb-card-background-color, 255, 255, 255), 0.08);
        border-radius: 999px;
        backdrop-filter: blur(3px);
        color: var(--primary-text-color);
        display: inline-flex;
        font-family: var(--ha-font-family-body, Roboto, Noto, sans-serif);
        font-size: 0.875rem;
        font-weight: 500;
        gap: 0;
        max-width: 100%;
        min-height: 52px;
        min-width: 48px;
        flex-shrink: 1;
        overflow: visible;
        padding: 8px;
        position: relative;
        white-space: nowrap;
      }

      .summary-badge.has-progress {
        background: transparent;
        border-color: transparent;
        height: 52px;
        min-height: 52px;
        min-width: 52px;
        padding: 0;
        width: 52px;
      }

      .ambient-stack {
        min-width: auto;
        padding: 6px 12px;
      }

      .ambient-stack .summary-badge-content {
        align-items: center;
        width: auto;
      }

      .summary-badge-values.ambient-stack-values {
        align-items: flex-end;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 0px;
        width: auto;
      }

      span.summary-badge-current.ambient-stack-entry {
        color: inherit;
        cursor: pointer;
        display: block;
        line-height: var(--ha-line-height-condensed, 1.2);
        margin: 0;
        padding: 0;
        text-align: right;
        width: auto;
      }

      .summary-badge-content {
        align-items: center;
        justify-content: center;
        display: inline-flex;
        gap: 8px;
        text-align: center;
        position: relative;
        z-index: 1;
        width: 100%;
      }

      .summary-progress-ring-wrap {
        border-radius: 999px;
        inset: 0;
        pointer-events: none;
        position: absolute;
        z-index: 0;
      }

      .summary-inner-circle {
        position: absolute;
        inset: 8px;
        border-radius: 50%;
        background: var(--summary-inner-bg, rgba(var(--rgb-card-background-color, 255, 255, 255), 0.04));
        border: 1px solid rgba(var(--rgb-card-background-color, 255, 255, 255), 0.08);
        box-sizing: border-box;
        z-index: -1;
      }

      .summary-progress-ring-wrap::before,
      .summary-progress-ring-wrap::after {
        content: "";
        position: absolute;
        border-radius: inherit;
        pointer-events: none;
        transform-origin: center;
      }

      .summary-progress-ring-wrap::before {
        inset: 0;
        background: var(--summary-ring-solid, var(--probe-accent, var(--primary-color)));
        z-index: 1;
        -webkit-mask: radial-gradient(circle, transparent 18px, black 18px, black 20px, transparent 20px);
        mask: radial-gradient(circle, transparent 18px, black 18px, black 20px, transparent 20px);
      }

      .summary-progress-ring-wrap::after {
        inset: 0;
        background: var(--summary-ring-progress, transparent);
        filter: none;
        transform: rotate(0deg);
        z-index: 0;
        -webkit-mask: radial-gradient(circle, transparent 20px, black 20px, black 24px, transparent 24px);
        mask: radial-gradient(circle, transparent 20px, black 20px, black 24px, transparent 24px);
      }

      .is-heating .summary-progress-ring-wrap::before {
        opacity: 0;
      }

      .is-heating .summary-progress-ring-wrap::after {
        -webkit-mask: radial-gradient(circle, transparent 18px, black 18px, black 24px, transparent 24px);
        mask: radial-gradient(circle, transparent 18px, black 18px, black 24px, transparent 24px);
      }

      .clickable {
        cursor: pointer;
      }

      .summary-badge-values {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        line-height: 1.1;
        text-align: center;
        width: 100%;
      }

      .summary-badge-current {
        color: var(--primary-text-color);
        font-size: var(--ha-font-size-m, 14px);
        font-weight: var(--ha-font-weight-bold, 700);
        line-height: var(--ha-line-height-condensed, 1.2);
      }

      .summary-badge-target {
        color: var(--secondary-text-color);
        font-size: var(--ha-font-size-s, 12px);
        font-weight: var(--ha-font-weight-medium, 500);
        opacity: 0.9;
      }

      .summary-badge ha-icon {
        --mdc-icon-size: 18px;
        align-self: center;
        flex-shrink: 0;
      }

      .probe-section {
        border: none;
        border-radius: var(--grill-card-border-radius);
        background: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.05);
        backdrop-filter: var(--ha-card-backdrop-filter, blur(8px));
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }

      .probe-header {
        align-items: center;
        background: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.06);
        display: grid;
        grid-template-columns:
          var(--probe-header-name-column, auto)
          minmax(0, 1fr)
          var(--probe-header-reading-column, auto)
          32px;
        column-gap: var(--grill-card-gap-sm);
        padding: 8px 10px;
      }

      .probe-header-title {
        display: flex;
        align-items: center;
        gap: var(--grill-card-gap-sm);
        min-width: 0;
        overflow: hidden;
      }
      .probe-icon-stack {
        --probe-icon-size: 36px;
        align-items: center;
        display: inline-flex;
        flex-shrink: 0;
        height: var(--probe-icon-size);
        justify-content: center;
        position: relative;
        width: var(--probe-icon-size);
      }

      .probe-icon-layer {
        inset: 0;
        position: absolute;
      }

      .probe-header-name {
        color: var(--primary-text-color);
        font-size: 1rem;
        font-weight: 600;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .probe-header-progress {
        align-self: center;
        width: 100%;
      }

      .probe-header-progress-track {
        background: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.12);
        border-radius: 999px;
        height: 8px;
        overflow: hidden;
        position: relative;
        --probe-progress-width: 0%;
        --probe-progress-gradient: var(--probe-accent, var(--primary-color));
        box-shadow: inset 0 0 0 1px rgba(var(--rgb-card-background-color, 255, 255, 255), 0.28);
      }

      .probe-header-progress-track::after {
        content: "";
        position: absolute;
        inset: 0;
        border: 1px solid rgba(0, 0, 0, 0.35);
        border-radius: inherit;
        pointer-events: none;
        mix-blend-mode: soft-light;
      }

      .probe-header-progress-track.is-unavailable {
        opacity: 0.3;
      }

      .probe-header-progress-fill {
        background: var(--probe-progress-gradient);
        border-radius: inherit;
        height: 100%;
        width: var(--probe-progress-width);
        transform-origin: left center;
        transition: width 180ms ease;
      }

      .probe-header-reading {
        align-items: flex-end;
        display: flex;
        flex-direction: column;
        line-height: 1.1;
        min-width: var(--probe-header-reading-column, 120px);
        max-width: var(--probe-header-reading-column, 120px);
        white-space: nowrap;
      }

      .probe-header-current {
        color: var(--primary-text-color);
        font-size: 1.1rem;
        font-weight: 700;
      }

      .probe-header-current.unavailable {
        color: var(--disabled-color, var(--secondary-text-color));
        font-size: 0.875rem;
        font-style: italic;
        font-weight: 400;
      }

      .probe-header-target {
        color: var(--secondary-text-color);
        font-size: 0.78rem;
        font-weight: 600;
      }

      .probe-body {
        display: flex;
        flex-direction: column;
        padding: 0 10px 10px;
      }

      .probe-entities {
        display: flex;
        flex-wrap: nowrap;
        gap: 6px;
        justify-content: space-between;
        overflow-x: auto;
        padding: 8px 0;
      }

      .entity-badge {
        align-items: center;
        background: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.06);
        border: 1px solid rgba(var(--rgb-card-background-color, 255, 255, 255), 0.10);
        border-radius: 12px;
        color: var(--primary-text-color);
        display: flex;
        font-size: 0.8rem;
        gap: 0;
        justify-content: center;
        min-width: 0;
        padding: 3px 8px;
        white-space: nowrap;
        flex: 1 1 0;
      }

      .entity-label {
        color: var(--secondary-text-color);
        font-size: 0.75rem;
      }

      .probe-controls {
        display: flex;
        flex-direction: column;
        gap: var(--grill-card-gap-sm);
      }

      .control-row {
        align-items: center;
        display: flex;
        justify-content: space-between;
        gap: var(--grill-card-gap);
        min-height: 48px;
      }

      .control-icon {
        align-items: center;
        display: flex;
        flex-shrink: 0;
        justify-content: center;
        width: 40px;
      }

      .control-select {
        flex: 1;
        min-width: 0;
      }

      ha-control-select-menu {
        width: 100%;
      }

      .toggle-row {
        display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        column-gap: clamp(3px, 0.8vw, var(--ha-space-2, 8px));
        row-gap: 6px;
        align-items: center;
        justify-content: flex-start;
        padding: 6px 10px 8px;
        width: 100%;
      }

      .toggle-section {
        border: none;
        border-radius: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      .toggle-collapse-bar {
        align-items: center;
        background: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.03);
        color: var(--secondary-text-color);
        cursor: pointer;
        display: flex;
        justify-content: center;
        min-height: 24px;
        width: 100%;
      }

      .toggle-item {
        align-items: center;
        display: flex;
        flex: 1 1 0;
        justify-content: center;
        min-width: 0;
        max-width: none;
      }

      .toggle-icon-tile {
        align-items: center;
        appearance: none;
        background: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.12);
        border: 1px solid rgba(var(--rgb-card-background-color, 255, 255, 255), 0.14);
        border-radius: var(--ha-border-radius-circle, 50%);
        color: var(--secondary-text-color);
        cursor: pointer;
        display: flex;
        height: 36px;
        justify-content: center;
        padding: 0;
        transition: background var(--ha-animation-duration-fast, 150ms) ease,
                    border-color var(--ha-animation-duration-fast, 150ms) ease,
                    color var(--ha-animation-duration-fast, 150ms) ease,
                    transform var(--ha-animation-duration-fast, 150ms) ease;
        width: 36px;
      }

      .toggle-icon-tile:hover {
        transform: translateY(-1px);
      }

      .toggle-icon-tile.on {
        border-color: transparent;
        color: var(--text-primary-color, #fff);
        opacity: 1;
      }

      .toggle-icon-tile.off {
        opacity: 0.22;
      }

      .probes-container {
        background: inherit;
        display: flex;
        flex-direction: column;
        gap: 0;
        min-height: auto;
        overflow-y: visible;
        padding: 0 10px 10px;
      }

      .probes-container.collapsed {
        display: none;
      }

      .target-slider-group {
        align-items: center;
        display: flex;
        flex: 1;
        gap: var(--grill-card-gap-sm);
        min-width: 0;
        min-height: 56px;
      }

      .target-slider-group ha-control-slider {
        --control-slider-thickness: 40px;
        --control-slider-border-radius: 999px;
        --control-slider-background: rgba(var(--rgb-card-background-color, 255, 255, 255), 0.12);
        --control-slider-background-opacity: 1;
        --control-slider-color: var(--probe-slider-gradient, var(--primary-color));
        --control-slider-tooltip-font-size: var(--ha-font-size-s, 12px);
        flex: 1;
        min-width: 0;
        padding: 0;
        padding-inline: 0;
      }

      .target-slider-background {
        border-radius: inherit;
        border: 1px solid rgba(255, 255, 255, 0.2);
        height: 100%;
        opacity: 0.9;
        width: 100%;
      }

      .probe-section:last-of-type {
        border-bottom-left-radius: var(--ha-card-border-radius, 16px);
        border-bottom-right-radius: var(--ha-card-border-radius, 16px);
      }

      .target-value {
        color: var(--primary-text-color);
        font-size: 0.9rem;
        font-weight: 600;
        min-width: 36px;
        padding-left: 4px;
        text-align: right;
        white-space: nowrap;
      }

      .control-divider {
        border: none;
        border-top: 1px solid var(--ha-color-border-neutral-quiet, var(--divider-color, rgba(0, 0, 0, 0.08)));
        margin: 4px 0;
        display: none;
      }

      .probe-header-collapse {
        align-items: center;
        color: var(--probe-accent, var(--secondary-text-color));
        display: flex;
        flex-shrink: 0;
        justify-content: center;
        width: 32px;
      }
    `;
  }

  setConfig(config) {
    if (!config) throw new Error("GrillCard: config is required");

    this.config = {
      ...config,
      probes: Array.isArray(config.probes) ? config.probes.map(normalizeProbe) : [],
      ambient: normalizeAmbient(config.ambient),
      progress_min: normalizeProgressMin(config.progress_min),
    };

    this._storageKeyBase = this._computeStorageKey(this.config);
    this._restoreCollapsedState(this.config.probes);
  }

  getCardSize() {
    if (!this.config) return 2;

    const probes = this.config.probes || [];
    const activeProbes = probes.filter((probe) => this._isProbeActive(probe));
    const toggleItems = this._toggleItems(probes);

    if (this._collapsed) {
      return 2;
    }

    let rows = 2;

    if (toggleItems.length) {
      rows += this._collapsedToggles ? 1 : 2;
    }

    for (const probe of activeProbes) {
      rows += this._isProbeCollapsed(probe.id) ? 2 : 4;
    }

    return Math.max(2, rows);
  }

  getGridOptions() {
    return {
      columns: 12
    };
  }

  updated(changedProps) {
    super.updated(changedProps);
  }

  _state(entityId) {
    if (!entityId || !this.hass) return null;
    const stateObj = this.hass.states[entityId];
    if (isUnavailableState(stateObj)) return null;
    return stateObj.state;
  }

  _stateObj(entityId) {
    if (!entityId || !this.hass) return null;
    return this.hass.states[entityId] || null;
  }

  _isProbeActive(probe) {
    if (!probe?.active) return true;
    return this._isEntityOnState(this._state(probe.active));
  }

  _buildLayoutSignature() {
    const probes = this.config?.probes || [];
    const activeProbeIds = probes
      .filter((probe) => this._isProbeActive(probe))
      .map((probe) => `${probe.id}:${this._isProbeCollapsed(probe.id) ? "c" : "e"}`)
      .join("|");

    return [
      this._collapsed ? "card:c" : "card:e",
      this._collapsedToggles ? "toggles:c" : "toggles:e",
      activeProbeIds,
    ].join(";");
  }

  _isEntityOnState(state) {
    if (state === undefined || state === null) return false;
    const normalized = String(state).trim().toLowerCase();
    return normalized === "on"
      || normalized === "true"
      || normalized === "1"
      || normalized === "yes";
  }

  _resolveProgressMin() {
    const configured = this.config?.progress_min;

    if (typeof configured === "number") {
      return Number.isFinite(configured) ? configured : DEFAULT_PROGRESS_MIN;
    }

    if (typeof configured === "string") {
      const numericConfigured = Number(configured);
      if (Number.isFinite(numericConfigured)) {
        return numericConfigured;
      }

      const entityState = this._state(configured);
      const entityNumeric = Number(entityState);
      if (Number.isFinite(entityNumeric)) {
        return entityNumeric;
      }

      return DEFAULT_PROGRESS_MIN;
    }

    return DEFAULT_PROGRESS_MIN;
  }

  _selectOptions(entityId) {
    return this._stateObj(entityId)?.attributes?.options || [];
  }

  _numberAttrs(entityId) {
    const stateObj = this._stateObj(entityId);
    if (!stateObj) return { min: 0, max: 300, step: 1, unit: "°", value: 0 };
    const attrs = stateObj.attributes;
    return {
      min: Number.parseFloat(attrs.min) || 0,
      max: Number.parseFloat(attrs.max) || 300,
      step: Number.parseFloat(attrs.step) || 1,
      unit: attrs.unit_of_measurement || "°",
      value: Number.parseFloat(stateObj.state) || 0,
    };
  }

  _formatState(entityId, removeUnit = false) {
    const stateObj = this._stateObj(entityId);
    if (!stateObj) return "—";
    const formatted = formatEntityStateValue(entityId, stateObj, this.hass);
    if (removeUnit && stateObj?.attributes?.unit_of_measurement) {
      return formatted.replace(stateObj.attributes.unit_of_measurement, "").trim();
    }
    return formatted;
  }

  _formatOption(entityId, option) {
    const stateObj = this._stateObj(entityId);
    if (!stateObj) return option;
    return formatEntityStateValue(entityId, stateObj, this.hass, option);
  }

  _callService(domain, service, data) {
    if (!this.hass || typeof this.hass.callService !== "function") return;
    this.hass.callService(domain, service, data);
  }

  _toggleItems(probes) {
    return probes
      .filter((probe) => probe.toggle?.entity)
      .map((probe) => ({
        entity: probe.toggle.entity,
        label: probe.name || probe.toggle.entity,
        color: normalizeColorList(probe.color),
      }));
  }

  _tileBackground(colors) {
    const normalizedColors = normalizeColorList(colors);
    if (!normalizedColors.length) {
      return "var(--primary-color)";
    }

    if (normalizedColors.length === 1) {
      return normalizedColors[0];
    }

    const segmentSize = 100 / normalizedColors.length;
    const stops = normalizedColors
      .map((color, index) => {
        const start = (index * segmentSize).toFixed(2);
        const end = ((index + 1) * segmentSize).toFixed(2);
        return `${color} ${start}% ${end}%`;
      })
      .join(", ");

    return `linear-gradient(180deg, ${stops})`;
  }

  _probePrimaryColor(probe) {
    const colors = normalizeColorList(probe?.color);
    return colors[0] || "var(--primary-color)";
  }

  _probeGradient(probe) {
    const colors = normalizeColorList(probe?.color);
    if (!colors.length) {
      return "var(--slider-track-color, var(--divider-color))";
    }

    if (colors.length === 1) {
      return colors[0];
    }

    const segmentSize = 100 / colors.length;
    const stops = colors
      .map((color, index) => {
        const start = (index * segmentSize).toFixed(2);
        const end = ((index + 1) * segmentSize).toFixed(2);
        return `${color} ${start}% ${end}%`;
      })
      .join(", ");

    return `linear-gradient(180deg, ${stops})`;
  }

  _probeConicGradient(probe) {
    const colors = normalizeColorList(probe?.color);
    if (!colors.length) {
      return "conic-gradient(from -90deg, var(--primary-color) 0deg 360deg)";
    }

    if (colors.length === 1) {
      return `conic-gradient(from -90deg, ${colors[0]} 0deg 360deg)`;
    }

    const segmentSize = 360 / colors.length;
    const stops = colors
      .map((color, index) => {
        const start = (index * segmentSize).toFixed(2);
        const end = ((index + 1) * segmentSize).toFixed(2);
        return `${color} ${start}deg ${end}deg`;
      })
      .join(", ");

    return `conic-gradient(from -90deg, ${stops})`;
  }

  _probeProgressConicGradient(probe, progress) {
    const safeProgress = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    if (safeProgress <= 0) return "transparent";

    const colors = normalizeColorList(probe?.color);
    const palette = colors.length ? colors : ["var(--primary-color)"];
    const stops = [];

    for (let index = 0; index < palette.length; index += 1) {
      const color = palette[index];
      const start = (safeProgress * index) / palette.length;
      const end = (safeProgress * (index + 1)) / palette.length;
      const startDeg = (start * 360).toFixed(2);
      const endDeg = (end * 360).toFixed(2);
      stops.push(`${color} ${startDeg}deg ${endDeg}deg`);
    }

    const progressDeg = (safeProgress * 360).toFixed(2);
    stops.push(`transparent ${progressDeg}deg 360deg`);
    return `conic-gradient(from -90deg, ${stops.join(", ")})`;
  }

  _computeProbeProgress(probe) {
    if (!probe?.heading || !probe?.target) return null;
    const headingState = this._stateObj(probe.heading);
    const targetState = this._stateObj(probe.target);
    if (!headingState || !targetState) return null;

    const currentValue = Number(headingState.state);
    const targetValue = Number(targetState.state);
    if (!Number.isFinite(currentValue) || !Number.isFinite(targetValue)) return null;

    const progressMin = this._resolveProgressMin();
    const range = targetValue - progressMin;
    if (range <= 0) return null;

    const progress = (currentValue - progressMin) / range;
    return Math.max(0, Math.min(1, progress));
  }

  _renderProbeIcon(probe, icon, size = 36) {
    const normalizedColors = normalizeColorList(probe?.color);
    const palette = normalizedColors.length ? normalizedColors : [this._probePrimaryColor(probe)];

    return html`
      <div class="probe-icon-stack" style="--probe-icon-size: ${size}px;">
        ${palette.map((color, index) => {
          const start = (index / palette.length) * 100;
          const end = ((index + 1) / palette.length) * 100;
          const insetTop = start.toFixed(2);
          const insetBottom = (100 - end).toFixed(2);
          return html`
            <ha-icon
              class="probe-icon-layer"
              icon="${icon}"
              style="--mdc-icon-size: var(--probe-icon-size); color: ${color}; clip-path: inset(${insetTop}% 0 ${insetBottom}% 0);"
            ></ha-icon>
          `;
        })}
      </div>
    `;
  }

  _getTextMeasureContext() {
    if (!this.__textMeasureCtx) {
      const canvas = document.createElement("canvas");
      this.__textMeasureCtx = canvas.getContext("2d");
    }
    return this.__textMeasureCtx;
  }

  _measureTextWidth(text, font, fallbackCharWidth = 10) {
    if (!text) return 0;
    const ctx = this._getTextMeasureContext();
    if (!ctx) {
      return text.length * fallbackCharWidth;
    }
    const previousFont = ctx.font;
    if (font) {
      ctx.font = font;
    }
    const metrics = ctx.measureText(text);
    const width = metrics?.width ?? text.length * fallbackCharWidth;
    ctx.font = previousFont;
    return width;
  }

  _estimateNameColumnWidth(probes) {
    if (!Array.isArray(probes) || !probes.length) {
      return null;
    }

    const nameFont = "600 16px 'Roboto','Segoe UI','Noto',sans-serif";
    let maxLabelWidth = 0;

    for (const probe of probes) {
      const label = probe?.name || "Probe";
      const width = this._measureTextWidth(label, nameFont, 9);
      maxLabelWidth = Math.max(maxLabelWidth, width);
    }

    if (!Number.isFinite(maxLabelWidth) || maxLabelWidth <= 0) {
      return null;
    }

    const iconWidth = 36; // px
    const spacing = 16; // icon margin + grid gap buffer
    return Math.ceil(maxLabelWidth + iconWidth + spacing);
  }

  _estimateReadingColumnWidth(probes) {
    if (!Array.isArray(probes) || !probes.length) {
      return null;
    }

    const currentFont = "700 17px 'Roboto','Segoe UI','Noto',sans-serif";
    const targetFont = "600 13px 'Roboto','Segoe UI','Noto',sans-serif";
    let maxWidth = 0;

    for (const probe of probes) {
      const headingState = this._stateObj(probe.heading);
      const unavailable = isUnavailableState(headingState);
      const headingDisplay = unavailable ? "Unavailable" : this._formatState(probe.heading, true);
      const targetDisplay = probe.target ? this._formatState(probe.target, true) : "";

      const headingWidth = this._measureTextWidth(headingDisplay, currentFont, 10);
      const targetWidth = targetDisplay ? this._measureTextWidth(targetDisplay, targetFont, 8) : 0;
      const entryWidth = Math.max(headingWidth, targetWidth);
      maxWidth = Math.max(maxWidth, entryWidth);
    }

    if (!Number.isFinite(maxWidth) || maxWidth <= 0) {
      return null;
    }

    const padding = 2;
    return Math.ceil(maxWidth + padding);
  }

  _computeStorageKey(config) {
    const base =
      config?.storage_key
      || config?.title
      || (config?.probes || []).map((probe) => probe.id).join("|")
      || "default";
    const slug = slugify(base) || "default";
    return `grill-card::state::${slug}`;
  }

  _persistCollapsedState() {
    const key = this._storageKeyBase;
    if (!key || typeof window === "undefined" || !window.localStorage) return;

    const payload = {
      collapsed: this._collapsed,
      collapsedToggles: this._collapsedToggles,
      collapsedProbes: this._collapsedProbes,
    };

    try {
      window.localStorage.setItem(key, JSON.stringify(payload));
    } catch (_error) {}
  }

  _restoreCollapsedState(probes) {
    const key = this._storageKeyBase;
    if (!key || typeof window === "undefined" || !window.localStorage) return;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.collapsed === "boolean") {
        this._collapsed = parsed.collapsed;
      }
      if (typeof parsed?.collapsedToggles === "boolean") {
        this._collapsedToggles = parsed.collapsedToggles;
      }
      const validIds = new Set((probes || []).map((probe) => probe.id));
      if (parsed?.collapsedProbes && typeof parsed.collapsedProbes === "object") {
        const restored = {};
        for (const [probeId, value] of Object.entries(parsed.collapsedProbes)) {
          if (validIds.has(probeId) && value === true) {
            restored[probeId] = true;
          }
        }
        this._collapsedProbes = restored;
      }
    } catch (_error) {}
  }

  _renderProbeHeaderProgress(probe) {
    const progressValue = this._computeProbeProgress(probe);
    const hasProgress = Number.isFinite(progressValue);
    const safeProgress = hasProgress ? Math.max(0, Math.min(1, progressValue)) : 0;
    const progressPercent = (safeProgress * 100).toFixed(1);
    const progressStyle = `
      --probe-progress-width: ${progressPercent}%;
      --probe-progress-gradient: ${this._probeGradient(probe)};
    `;

    return html`
      <div
        class="probe-header-progress"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="${Math.round(Number(progressPercent))}"
        aria-label="Cook progress"
      >
        <div class="probe-header-progress-track ${hasProgress ? "" : "is-unavailable"}" style=${progressStyle}>
          <div class="probe-header-progress-fill"></div>
        </div>
      </div>
    `;
  }

  _onTypeChanged(probe, event) {
    const option = event.detail?.item?.value ?? event.detail?.value ?? event.target?.value;
    if (!option || !probe.type) return;
    const domain = probe.type.split('.')[0];
    this._callService(domain, "select_option", { entity_id: probe.type, option });
  }

  _onDonenessChanged(probe, event) {
    const option = event.detail?.item?.value ?? event.detail?.value ?? event.target?.value;
    if (!option || !probe.doneness) return;
    const domain = probe.doneness.split('.')[0];
    this._callService(domain, "select_option", { entity_id: probe.doneness, option });
  }

  _setTargetValue(probe, value) {
    if (!probe?.target) return;
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) return;
    const domain = probe.target.split('.')[0];
    this._callService(domain, "set_value", { entity_id: probe.target, value: numericValue });
  }

  _onTargetSliderChanged(probe, event) {
    const detailValue = event.detail?.value;
    if (detailValue === undefined) return;
    this._setTargetValue(probe, detailValue);
  }

  _onTogglePressed(event, entityId) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!entityId) return;
    const isOn = this._isEntityOnState(this._state(entityId));
    const domain = entityId.split(".")[0];
    const serviceDomain = ["input_boolean", "switch", "light"].includes(domain) ? domain : "homeassistant";
    this._callService(serviceDomain, isOn ? "turn_off" : "turn_on", { entity_id: entityId });
  }

  _isProbeCollapsed(probeId) {
    return this._collapsedProbes?.[probeId] === true;
  }

  _toggleTogglesCollapsed() {
    this._collapsedToggles = !this._collapsedToggles;
    this._persistCollapsedState();
    this._notifyLayoutEngine();
  }

  _toggleProbeCollapsed(probeId) {
    this._collapsedProbes = {
      ...(this._collapsedProbes || {}),
      [probeId]: !this._isProbeCollapsed(probeId),
    };
    this._persistCollapsedState();
    this._notifyLayoutEngine();
  }

  _toggleCollapsed() {
    this._collapsed = !this._collapsed;
    this._persistCollapsedState();
    this._notifyLayoutEngine();
  }

  _renderCollapseToggle() {
    return html`
      <div class="summary-collapse-toggle" @click=${() => this._toggleCollapsed()}>
        <ha-icon class="collapse-icon" icon=${this._collapsed ? "mdi:chevron-down" : "mdi:chevron-up"}></ha-icon>
      </div>
    `;
  }

  render() {
    if (!this.config) return html``;

    const probes = this.config.probes || [];
    const activeProbes = probes.filter((probe) => this._isProbeActive(probe));
    const toggleItems = this._toggleItems(probes);
    const summaryRow = this._renderSummaryRow(this.config.ambient || [], activeProbes);
    const showTopStrip = this.config.title || Boolean(summaryRow);
    const nameColumnWidth = this._estimateNameColumnWidth(activeProbes);
    const readingColumnWidth = this._estimateReadingColumnWidth(activeProbes);
    const styleParts = [];
    if (nameColumnWidth) {
      styleParts.push(`--probe-header-name-column: ${nameColumnWidth}px`);
    }
    if (readingColumnWidth) {
      styleParts.push(`--probe-header-reading-column: ${readingColumnWidth}px`);
    }
    const cardStyle = styleParts.join("; ");

    return html`
      <ha-card style=${cardStyle}>
        ${showTopStrip ? html`
          <div class="card-top-strip ${this._collapsed ? "is-collapsed" : "is-expanded"}">
            ${this.config.title ? html`
              <div class="card-header-bar" @click=${() => this._toggleCollapsed()}>
                <div class="card-title">${this.config.title}</div>
                <ha-icon class="card-header-chevron" icon=${this._collapsed ? "mdi:chevron-down" : "mdi:chevron-up"}></ha-icon>
              </div>
            ` : ""}
            ${summaryRow}
          </div>
        ` : ""}
        <div class="probes-container ${this._collapsed ? "collapsed" : ""}">
          ${toggleItems.length ? this._renderToggleRow(toggleItems) : ""}
          ${activeProbes.map((probe) => this._renderProbeSection(probe))}
        </div>
      </ha-card>
    `;
  }

  _renderSummaryRow(ambient, activeProbes) {
    if (!ambient.length && !activeProbes.length) {
      if (!this.config.title) {
        return html`
          <div class="summary-row summary-row-empty">
            ${this._renderCollapseToggle()}
          </div>
        `;
      }
      return "";
    }

    const ambientStack = Array.isArray(ambient) ? ambient.slice(0, 3) : [];

    return html`
      <div class="summary-row ${this._collapsed ? "is-collapsed" : "is-expanded"}">
        <div class="summary-items">
          ${ambientStack.length ? this._renderAmbientStack(ambientStack) : ""}
          ${activeProbes.map((probe) => this._renderProbeSummaryBadge(probe))}
        </div>
        ${!this.config.title ? this._renderCollapseToggle() : ""}
      </div>
    `;
  }

  _renderAmbientStack(ambientList) {
    if (!ambientList.length) return "";

    const entries = ambientList.map((entry) => {
      const shortLabel = entry.label !== null && entry.label.length > 0 
        ? Array.from(entry.label)[0] 
        : "";
      return {
        entityId: entry.entity,
        display: shortLabel + this._formatState(entry.entity, true),
      };
    });

    return html`
      <div class="summary-badge ambient-stack">
        <div class="summary-badge-content">
          <div class="summary-badge-values ambient-stack-values">
            ${entries.map(
              (entry) => html`
                <span
                  class="summary-badge-current ambient-stack-entry"
                  @click=${() => this._openMoreInfo(entry.entityId)}
                >
                  ${entry.display}
                </span>
              `,
            )}
          </div>
        </div>
      </div>
    `;
  }

  _renderProbeSummaryBadge(probe) {
    const headingState = this._stateObj(probe.heading);
    const unavailable = isUnavailableState(headingState);
    const headingDisplay = unavailable ? "Unavailable" : this._formatState(probe.heading, true);
    const targetDisplay = probe.target ? this._formatState(probe.target, true) : "";
    const progress = this._computeProbeProgress(probe);
    const progressValue = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    const solidRing = this._probeConicGradient(probe);
    const progressRing = this._probeProgressConicGradient(probe, progressValue);

    let isCoolingOrStalled = false;
    let isHeating = false;
    if (probe.derivative) {
      const derivVal = Number(this._state(probe.derivative));
      if (!Number.isNaN(derivVal)) {
        if (derivVal <= 0) {
          isCoolingOrStalled = true;
        } else if (derivVal > 0) {
          isHeating = true;
        }
      }
    }

    const badgeStyle = `
      --summary-ring-progress-angle: ${progressValue * 360}deg;
      --summary-ring-solid: ${solidRing};
      --summary-ring-progress: ${progressRing};
      ${isCoolingOrStalled ? "--summary-inner-bg: rgba(128, 128, 128, 0.4);" : ""}
    `;

    return html`
      <div
        class="summary-badge has-progress ${probe.target ? "clickable" : ""} ${isHeating ? "is-heating" : ""}"
        style=${badgeStyle}
        @click=${() => this._scrollToProbe(probe.id)}
      >
        <div class="summary-progress-ring-wrap">
          <div class="summary-inner-circle"></div>
        </div>
        <div class="summary-badge-content">
          <div class="summary-badge-values">
            <span class="summary-badge-current">${headingDisplay}</span>
            ${targetDisplay ? html`<span class="summary-badge-target">${targetDisplay}</span>` : ""}
          </div>
        </div>
      </div>
    `;
  }

  _renderToggleRow(toggleItems) {
    return html`
      <div class="toggle-section">
        ${!this._collapsedToggles ? html`
          <div class="toggle-row">
            ${toggleItems.map((toggle) => {
              const stateObj = this._stateObj(toggle.entity);
              const isOn = stateObj?.state === "on";
              const label = toggle.label || stateObj?.attributes?.friendly_name || toggle.entity;
              const tileStyle = `background: ${this._tileBackground(toggle.color)};`;

              return html`
                <div class="toggle-item">
                  <button
                    type="button"
                    class="toggle-icon-tile ${isOn ? "on" : "off"}"
                    style="${tileStyle}"
                    @click=${(e) => this._onTogglePressed(e, toggle.entity)}
                    title=${label}
                    aria-label=${label}
                    aria-pressed=${isOn ? "true" : "false"}
                  ></button>
                </div>
              `;
            })}
          </div>
        ` : ""}
        <div class="toggle-collapse-bar" @click=${() => this._toggleTogglesCollapsed()}>
          <ha-icon icon=${this._collapsedToggles ? "mdi:chevron-down" : "mdi:chevron-up"}></ha-icon>
        </div>
      </div>
    `;
  }

  _renderProbeSection(probe) {
    const visibleEntities = probe.entities.filter((entity) => !entity.hidden);
    const collapsed = this._isProbeCollapsed(probe.id);
    const accent = this._probePrimaryColor(probe);
    const sectionStyle = `--probe-accent:${accent}; --probe-slider-color:${accent}; --probe-slider-gradient:${this._probeGradient(probe)};`;

    return html`
      <div class="probe-section" style=${sectionStyle}>
        ${this._renderProbeHeader(probe, collapsed)}
        ${collapsed ? "" : html`
          <div class="probe-body">
            ${visibleEntities.length ? this._renderProbeEntities(visibleEntities) : ""}
            ${this._renderProbeControls(probe)}
          </div>
        `}
      </div>
    `;
  }

  _renderProbeHeader(probe, collapsed = false) {
    const typeState = this._state(probe.type);
    const icon = resolveTypeIcon(typeState, probe.icon);
    const headingState = this._stateObj(probe.heading);
    const unavailable = isUnavailableState(headingState);
    const headingDisplay = unavailable ? "Unavailable" : this._formatState(probe.heading, true);
    const targetDisplay = probe.target ? this._formatState(probe.target, true) : "";

    return html`
      <div class="probe-header clickable" @click=${() => this._toggleProbeCollapsed(probe.id)}>
        <div class="probe-header-title">
          ${this._renderProbeIcon(probe, icon, 36)}
          ${!probe.hidden ? html`<span class="probe-header-name">${probe.name}</span>` : ""}
        </div>
        ${this._renderProbeHeaderProgress(probe)}
        <div class="probe-header-reading">
          <span class="probe-header-current ${unavailable ? "unavailable" : ""}">${headingDisplay}</span>
          ${targetDisplay ? html`<span class="probe-header-target">${targetDisplay}</span>` : ""}
        </div>
        <div class="probe-header-collapse">
          <ha-icon icon=${collapsed ? "mdi:chevron-down" : "mdi:chevron-up"}></ha-icon>
        </div>
      </div>
    `;
  }

  _openMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(
      new CustomEvent("hass-more-info", {
        detail: { entityId },
        bubbles: true,
        composed: true,
      })
    );
  }

  _scrollToProbe(probeId) {
    if (!probeId || !this.renderRoot) return;
    const sections = this.renderRoot.querySelectorAll(".probe-section");
    const probes = this.config?.probes || [];
    const activeProbes = probes.filter((probe) => this._isProbeActive(probe));
    const index = activeProbes.findIndex((probe) => probe.id === probeId);
    if (index < 0 || index >= sections.length) return;

    const target = sections[index];
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  _renderProbeEntities(entities) {
    return html`
      <div class="probe-entities">
        ${entities.map(
          (entry) => html`
            <div class="entity-badge clickable" @click=${() => this._openMoreInfo(entry.entity)}>
              <strong>${entry.label ? `${entry.label}: ` : ""}${this._formatState(entry.entity, true)}</strong>
            </div>
          `,
        )}
      </div>
    `;
  }

  _renderProbeControls(probe) {
    return html`
      <div class="probe-controls">
        ${this._renderTypeControl(probe)}
        ${this._renderDonenessControl(probe)}
        ${this._renderTargetControl(probe)}
      </div>
    `;
  }

  _renderTypeControl(probe) {
    if (!probe.type) return "";
    const options = this._selectOptions(probe.type);
    const current = this._state(probe.type) || "";
    const icon = resolveTypeIcon(current, probe.icon);
    const items = options.map((option) => ({ value: option, label: this._formatOption(probe.type, option) }));

    return html`
      <div class="control-row">
        <div class="control-icon">${this._renderProbeIcon(probe, icon, 32)}</div>
        <div class="control-select">
          <ha-control-select-menu
            .hass=${this.hass}
            .value=${current}
            .options=${items}
            .label=${"Type"}
            hide-label
            show-arrow
            @wa-select=${(event) => this._onTypeChanged(probe, event)}
          ></ha-control-select-menu>
        </div>
      </div>
    `;
  }

  _renderDonenessControl(probe) {
    if (!probe.doneness) return "";

    if (probe.type) {
      const typeState = this._state(probe.type);
      if (typeof typeState === "string" && typeState.toLowerCase() === "manual") {
        return "";
      }
    }

    const options = this._selectOptions(probe.doneness);
    const current = this._state(probe.doneness) || "";
    const icon = resolveDonenessIcon(current);
    const items = options.map((option) => ({ value: option, label: this._formatOption(probe.doneness, option) }));

    return html`
      <div class="control-row">
        <div class="control-icon">${this._renderProbeIcon(probe, icon, 32)}</div>
        <div class="control-select">
          <ha-control-select-menu
            .hass=${this.hass}
            .value=${current}
            .options=${items}
            .label=${"Doneness"}
            hide-label
            show-arrow
            @wa-select=${(event) => this._onDonenessChanged(probe, event)}
          ></ha-control-select-menu>
        </div>
      </div>
    `;
  }

  _renderTargetControl(probe) {
    if (!probe.target) return "";

    // Only show the target slider if the type is explicitly manually managed
    if (probe.type) {
      const typeState = this._state(probe.type);
      if (typeof typeState === "string" && typeState.toLowerCase() !== "manual") {
        return "";
      }
    }

    const attrs = this._numberAttrs(probe.target);

    return html`
      <div class="control-row">
        <div class="control-icon">${this._renderProbeIcon(probe, "mdi:target", 32)}</div>
        <div class="target-slider-group">
          <ha-control-slider
            .hass=${this.hass}
            .locale=${this.hass?.locale}
            .value=${attrs.value}
            .min=${attrs.min}
            .max=${attrs.max}
            .step=${attrs.step}
            .unit=${attrs.unit}
            label="Target"
            show-handle
            tooltip-mode="interaction"
            @value-changed=${(event) => this._onTargetSliderChanged(probe, event)}
          >
            <div slot="background" class="target-slider-background" style="background: var(--probe-slider-gradient, var(--primary-color));"></div>
          </ha-control-slider>
          <span class="target-value">${this._formatState(probe.target, true)}</span>
        </div>
      </div>
    `;
  }

  _emitLayoutReflowSignals() {
    const event = new Event("ll-rebuild", { bubbles: true, composed: true });
    this.dispatchEvent(event);
  }

  async _notifyLayoutEngine() {
    this.requestUpdate(); // Ask LitElement to re-render DOM

    await this.updateComplete; // Wait for DOM to finish rendering

    // Wait for browser paint before signaling layout recalc
    // This ensures the grid system sees the actual new height
    requestAnimationFrame(() => {
      this._emitLayoutReflowSignals();
    });
  }
}

// #endregion

// #region ===== GRILL CARD EDITOR (DEFERRED) =====

class GrillCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
    };
  }

  static get styles() {
    return css`
      .editor-placeholder {
        color: var(--secondary-text-color);
        padding: 16px;
      }
    `;
  }

  setConfig(config) {
    this.config = { ...config };
  }

  render() {
    return html`<div class="editor-placeholder">Visual editor coming soon. Use YAML mode to configure.</div>`;
  }
}

// #endregion

// #region ===== REGISTRATION =====

customElements.define(CARD_TYPE, GrillCard);
customElements.define("grill-card-editor", GrillCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TYPE,
  name: "Grill Card",
  description: "A grilling session card with ambient temperature tracking, per-probe cook type/doneness/target controls, and multi-color probe identification.",
  preview: true,
});

console.info(
  `%c GRILL-CARD %c v${CARD_VERSION}`,
  "color: orange; font-weight: bold; background: black",
  "color: white; font-weight: bold; background: dimgray",
);

// #endregion