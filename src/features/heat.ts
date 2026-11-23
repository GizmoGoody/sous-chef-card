// Sous Chef heat: the grill's temperature on a heat map, one row. The bar
// runs from cold (blue) to hot (red); the low and high alarms are marked on
// it with their numbers above, the range outside them shaded; the reading
// rides on the bar as a marker, with an arrow for its trend (left while it
// falls, right while it rises; doubled when it moves fast). The marker turns
// red while the grill is past an alarm. The grill's target is a notch on the
// bar, its number above. A tap shows the grill's history.
import { css, html, nothing, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { FEATURES } from "../const";
import { moreInfo } from "../ha";
import { CUSTOM, heatScale, rateText, styleLabel, valueOf, whole } from "../sous-chef";
import { SousChefFeature } from "./base";
import { featureStyles } from "./styles";
import { GrillTrend } from "./trend";

// The trend's arrow: one from this many degrees a minute, two from the second
const TREND_SLOW = 0.5;
const TREND_FAST = 3;

/** The trend's arrow: none while steady, one or two pointing the way it moves. */
function trendArrow(rate?: number): string | undefined {
  if (rate === undefined || Math.abs(rate) < TREND_SLOW) return undefined;
  const fast = Math.abs(rate) >= TREND_FAST;
  return rate > 0 ? (fast ? "mdi:chevron-double-right" : "mdi:chevron-right") : (fast ? "mdi:chevron-double-left" : "mdi:chevron-left");
}

export class SousChefHeat extends SousChefFeature {
  static override tag = FEATURES.heat;
  static override pickerName = "Sous Chef heat";
  static override forKind = "grill" as const;
  static override controls: [string, string][] = [["alarms", "Alarms"], ["target", "Target"], ["trend", "Trend arrow"]];
  static override options = [
    {
      name: "scale", label: "Scale", default: "alarms",
      helper: "Around the alarms (and the target), or a fixed range from Scale low to Scale high",
      selector: { select: { mode: "dropdown", options: [{ value: "alarms", label: "Around the alarms" }, { value: "fixed", label: "Fixed range" }] } },
    },
    { name: "scale_min", label: "Scale low", helper: "With Fixed range", default: undefined, selector: { number: { mode: "box", step: "any" } } },
    { name: "scale_max", label: "Scale high", helper: "With Fixed range", default: undefined, selector: { number: { mode: "box", step: "any" } } },
    {
      name: "tap", label: "Tap", default: "history",
      selector: { select: { mode: "dropdown", options: [{ value: "history", label: "The grill's history" }, { value: "styles", label: "The cook style list" }] } },
    },
  ];

  static override styles = [featureStyles, css`
    .heat { position: relative; display: block; width: 100%; height: var(--feature-height, 42px); padding: 0; border: 0; margin: 0;
      background: none; font: inherit; color: var(--sc-text, var(--primary-text-color)); cursor: pointer; outline: none; }
    .bar { position: absolute; left: 0; right: 0; bottom: 6px; height: 16px; border-radius: 8px; overflow: hidden;
      background: linear-gradient(90deg, #1e6fd9 0%, #18a5c4 18%, #3cb371 36%, #e3c21a 56%, #f08a24 74%, #e0402e 90%, #a3161b 100%); }
    .out { position: absolute; top: 0; bottom: 0; background: rgba(0, 0, 0, .38); }
    .tick { position: absolute; bottom: 6px; width: 2px; height: 22px; margin-left: -1px; border-radius: 1px; background: var(--sc-text, var(--primary-text-color)); opacity: .75; }
    .limit { position: absolute; top: 0; transform: translateX(-50%); font-size: 10px; line-height: 12px; color: var(--secondary-text-color); white-space: nowrap; }
    .marker { position: absolute; bottom: 3px; transform: translateX(-50%); display: flex; align-items: center; gap: 0; height: 22px; padding: 0 6px;
      border-radius: 11px; background: #fff; color: rgba(0, 0, 0, .87); font-size: var(--ha-font-size-s, 12px); font-weight: 600;
      box-shadow: 0 1px 3px rgba(0, 0, 0, .5); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .marker.alarm { background: var(--error-color, #db4437); color: #fff; }
    .marker ha-icon { --mdc-icon-size: 16px; color: inherit; margin: 0 -3px; }
    .goal { position: absolute; bottom: 4px; width: 4px; height: 20px; margin-left: -2px; border-radius: 2px; background: #fff;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, .55); }
    .limit.goal-label { font-weight: 600; color: var(--sc-text, var(--primary-text-color)); }
    /* Tap: the cook style list, the browser's own, over the whole bar */
    .wrap { position: relative; }
    .wrap select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font: inherit; }
    :host([sc-console]) .bar { box-shadow: inset 0 2px 4px rgba(0, 0, 0, .45); }
  `];

  private _trend = new GrillTrend(this);
  private _clock?: ReturnType<typeof setInterval>;

  override connectedCallback(): void {
    super.connectedCallback();
    // The trend moves between readings
    this._clock = setInterval(() => this.requestUpdate(), 30000);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._clock);
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this._hass!, ambient = this.ambient;
    const value = ambient ? valueOf(hass, ambient.sensor) : undefined;
    const low = ambient ? valueOf(hass, ambient.low) : undefined, high = ambient ? valueOf(hass, ambient.high) : undefined;
    const target = ambient ? valueOf(hass, ambient.target) : undefined;
    const goal = target && target > 0 ? target : undefined;
    const show = new Set(this.chosen());
    // A fixed range when chosen and set; otherwise around the alarms and the target
    const fixedLow = Number(this._config?.scale_min), fixedHigh = Number(this._config?.scale_max);
    const fixed = this.option<string>("scale") === "fixed" && Number.isFinite(fixedLow) && Number.isFinite(fixedHigh) && fixedHigh > fixedLow;
    const scale = fixed
      ? { min: fixedLow, max: fixedHigh, at: (v: number) => Math.min(1, Math.max(0, (v - fixedLow) / (fixedHigh - fixedLow))) }
      : heatScale(value, low, high, show.has("target") ? goal : undefined);
    this.showNothing(!ambient || !scale);
    if (!ambient || !scale) return nothing;
    const rate = this._trend.rate(hass, ambient.sensor);
    const arrow = show.has("trend") ? trendArrow(rate) : undefined;
    const lo = show.has("alarms") && low && low > 0 ? low : undefined, hi = show.has("alarms") && high && high > 0 ? high : undefined;
    const past = value !== undefined && ((!!low && low > 0 && value < low) || (!!high && high > 0 && value > high));
    // Labels and the marker keep clear of the ends
    const pct = (v: number) => `${scale.at(v) * 100}%`;
    const title = `Grill: ${value === undefined ? "no reading" : `${whole(value)}°`}`
      + `${goal !== undefined ? `, target ${whole(goal)}°` : ""}${lo !== undefined ? `, low alarm ${whole(lo)}°` : ""}${hi !== undefined ? `, high alarm ${whole(hi)}°` : ""}`
      + `${rate !== undefined ? `, ${rateText(rate)}` : ""}`;
    // Tap: the grill's history, or the cook style list (over the bar)
    const style = this.option<string>("tap") === "styles" && ambient.style ? hass.states[ambient.style] : undefined;
    const presets: Record<string, { target?: number }> = style?.attributes.presets ?? {};
    const options: string[] = Array.isArray(style?.attributes.options) ? style!.attributes.options : [];
    const list = style ? html`<select aria-label="Cook style" .value=${style.state === CUSTOM ? "" : style.state}
      @change=${(ev: Event) => this.call("select", "select_option", { entity_id: ambient.style, option: (ev.target as HTMLSelectElement).value })}>
      ${style.state === CUSTOM ? html`<option value="" hidden></option>` : nothing}
      ${options.filter((o) => o !== CUSTOM).map((o) => html`<option value=${o} ?selected=${o === style.state}>${styleLabel(hass.formatEntityState(style, o), presets[o])}</option>`)}
    </select>` : nothing;
    return html`<div class="wrap"><button type="button" class="heat" title=${title} aria-label=${title} @click=${() => moreInfo(this, ambient.sensor)}>
      <span class="bar">
        ${lo !== undefined ? html`<span class="out" style=${styleMap({ left: "0", width: pct(lo) })}></span>` : nothing}
        ${hi !== undefined ? html`<span class="out" style=${styleMap({ left: pct(hi), right: "0" })}></span>` : nothing}
      </span>
      ${[lo, hi].map((v) => (v === undefined ? nothing : html`<span class="tick" style=${styleMap({ left: pct(v) })}></span>
        <span class="limit num" style=${styleMap({ left: `clamp(14px, ${pct(v)}, calc(100% - 14px))` })}>${whole(v)}°</span>`))}
      ${goal === undefined || !show.has("target") ? nothing : html`<span class="goal" style=${styleMap({ left: pct(goal) })}></span>
        <span class="limit goal-label num" style=${styleMap({ left: `clamp(14px, ${pct(goal)}, calc(100% - 14px))` })}>${whole(goal)}°</span>`}
      ${value === undefined ? nothing : html`<span class="marker ${past ? "alarm" : ""}" style=${styleMap({ left: `clamp(32px, ${pct(value)}, calc(100% - 32px))` })}>
        ${arrow && rate! < 0 ? html`<ha-icon .icon=${arrow}></ha-icon>` : nothing}${whole(value)}°${arrow && rate! > 0 ? html`<ha-icon .icon=${arrow}></ha-icon>` : nothing}
      </span>`}
    </button>${list}</div>`;
  }

  // The alarms and the reading
  protected override watched(): string[] {
    const a = this.ambient;
    return a ? [a.sensor, a.alarm, a.low, a.high, a.target, a.style].filter((id): id is string => !!id) : [];
  }
}
