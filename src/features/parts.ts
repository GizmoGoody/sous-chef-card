// The parts the features share: a probe's ring, status, preset and
// channels. Values are formatted by Home Assistant (formatEntityState,
// hui-timestamp-display), and the preset's controls are Home Assistant's own
// tile features (select-options, numeric-input) in hui-card-features.
import { html, nothing, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { showChartDialog } from "../chart/dialog";
import { known, moreInfo, type Config, type HomeAssistant } from "../ha";
import {
  colorsOf, internalSensor, maxChannel, progressOf, ringGradient, statusOf, STATUS_LABELS, swatch, type Probe, type Status,
} from "../sous-chef";

/** A state as Home Assistant shows it; a dash without a value. */
export function shown(hass: HomeAssistant, entityId?: string): string {
  const stateObj = entityId ? hass.states[entityId] : undefined;
  return known(stateObj) ? hass.formatEntityState(stateObj) : "—";
}

/** A temperature as Home Assistant shows it, with only the degree sign for its unit (88 °F: 88°). */
export function degrees(hass: HomeAssistant, entityId?: string): string {
  const text = shown(hass, entityId);
  return text === "—" ? text : text.replace(/\s*°\s*[CF]$/, "°");
}

const STALLED_COLORS = ["var(--disabled-color, #bdbdbd)"];

/** A probe's progress ring: its colors (grey while stalled) and the internal temperature inside. */
export function ring(hass: HomeAssistant, probe: Probe, host: EventTarget, small = false): TemplateResult {
  const status = statusOf(hass, probe);
  const colors = status === "stalled" ? STALLED_COLORS : colorsOf(probe);
  const progress = progressOf(hass, probe);
  const inside = status === "no_reading" || status === "off" ? "—" : degrees(hass, internalSensor(hass, probe));
  return html`<button class="ring ${small ? "small" : ""}" style=${styleMap({ "--ring": ringGradient(colors, progress) })}
    aria-label="${probe.name}: progress ${Math.round(progress)} %" @click=${() => moreInfo(host, probe.entities.progress)}>
    <span>${inside}</span>
  </button>`;
}

export const swatchOf = (probe: Probe): TemplateResult =>
  html`<span class="swatch" style=${styleMap({ "--swatch": swatch(colorsOf(probe)) })}></span>`;

export const pill = (status: Status): TemplateResult => html`<span class="pill ${status}">${STATUS_LABELS[status]}</span>`;

/** Done at in the tile card's time format. */
export function doneAt(hass: HomeAssistant, probe: Probe, format: string): TemplateResult | typeof nothing {
  const stateObj = probe.entities.done_at ? hass.states[probe.entities.done_at] : undefined;
  if (!known(stateObj)) return nothing;
  const ts = new Date(stateObj.state);
  if (Number.isNaN(ts.getTime())) return nothing;
  return html`<hui-timestamp-display .hass=${hass} .ts=${ts} .format=${format}></hui-timestamp-display>`;
}

/** Where a cook stands: Done at while cooking, otherwise its pill. */
export function status(hass: HomeAssistant, probe: Probe, format: string): TemplateResult | typeof nothing {
  const now = statusOf(hass, probe);
  if (now !== "cooking") return pill(now);
  return doneAt(hass, probe, format);
}

// A feature's configuration objects, kept between draws so Home Assistant's
// features are not made again on every state change
export class Controls {
  private _cache = new Map<string, { context: Config; features: Config[] }>();

  of(entityId: string, feature: Config): { context: Config; features: Config[] } {
    const key = `${entityId}|${JSON.stringify(feature)}`;
    let hit = this._cache.get(key);
    if (!hit) {
      hit = { context: { entity_id: entityId }, features: [feature] };
      this._cache.set(key, hit);
    }
    return hit;
  }
}

/** One of Home Assistant's own tile features, for an entity. */
function control(hass: HomeAssistant, controls: Controls, entityId: string | undefined, feature: Config, color: string) {
  if (!entityId || !hass.states[entityId]) return nothing;
  const { context, features } = controls.of(entityId, feature);
  return html`<hui-card-features .hass=${hass} .context=${context} .features=${features} .color=${color}></hui-card-features>`;
}

/**
 * A probe's preset: Food type and Doneness, Target, and the source. Tapping
 * the source opens its whole chart (the chart view); the icon beside it opens
 * the published chart.
 */
export function preset(hass: HomeAssistant, probe: Probe, controls: Controls, host: EventTarget): TemplateResult {
  const e = probe.entities;
  const color = colorsOf(probe)[0];
  const source = e.source ? hass.states[e.source] : undefined;
  const doneness = e.doneness ? hass.states[e.doneness] : undefined;
  const url: unknown = source?.attributes.url;
  const rest = doneness?.attributes.rest_minutes;
  const hold = doneness?.attributes.hold_minutes;
  return html`<div class="preset">
    <div class="pair">
      ${control(hass, controls, e.food_type, { type: "select-options" }, color)}
      ${control(hass, controls, e.doneness, { type: "select-options" }, color)}
    </div>
    ${control(hass, controls, e.target, { type: "numeric-input", style: "buttons" }, color)}
    <div class="source secondary">
      <button class="chart" @click=${() => showChartDialog(host, {
        name: probe.name, source: e.source, food_type: e.food_type, doneness: e.doneness, target: e.target,
      })}>${shown(hass, e.source)}</button>
      ${typeof url === "string" && url
        ? html`<a href=${url} target="_blank" rel="noopener noreferrer" title="Open the published chart"><ha-icon icon="mdi:open-in-new"></ha-icon></a>`
        : nothing}
      ${rest ? html`<span>Rest ${rest} min</span>` : nothing}
      ${hold ? html`<span>Hold ${hold} min</span>` : nothing}
    </div>
  </div>`;
}

/** A probe's channels, from the tip, with Max outlined; nothing for a one-sensor probe. */
export function channels(hass: HomeAssistant, probe: Probe, host: EventTarget): TemplateResult | typeof nothing {
  if (!probe.channels.length) return nothing;
  const max = maxChannel(hass, probe);
  return html`<div class="channels" style=${styleMap({ "--count": String(probe.channels.length) })}>
    ${probe.channels.map((id, i) => html`<button class=${id === max ? "max" : ""} title=${id === max ? "Max" : ""}
      @click=${() => moreInfo(host, id)}>ch ${i + 1}<b>${degrees(hass, id)}</b></button>`)}
  </div>`;
}
