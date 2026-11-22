// A probe's features, two to a row below its title:
// - Sous Chef progress: the cook's bar, internal → target
// - Sous Chef cook: the food type, the target (or its doneness) and the chart
// - Sous Chef channels: each channel from the tip, by its heat, against the reference
// - Sous Chef timing: the rate, and the time left (or the rest once done)
import { css, html, nothing, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { showChartDialog } from "../chart/dialog";
import { FEATURES } from "../const";
import { known, moreInfo, type HassEntity } from "../ha";
import {
  channelReadings, colorOf, CUSTOM, doneAtOf, durationText, internalSensor, internalValue, progressOf, rateIcon, rateText,
  statusOf, valueOf, whole,
} from "../sous-chef";
import { SousChefFeature } from "./base";
import { numberField } from "./field";
import { featureStyles } from "./styles";

/** The cook's bar: filled to its progress in the probe's color, internal → target on it; striped while stalled, with the goal marked once past it. */
export class SousChefProgress extends SousChefFeature {
  static override tag = FEATURES.progress;
  static override pickerName = "Sous Chef progress";

  static override styles = [featureStyles, css`
    .bar {
      position: relative; display: block; width: 100%; height: var(--feature-height, 42px); padding: 0; border: 0; cursor: pointer;
      border-radius: var(--feature-border-radius, 12px); overflow: hidden; font: inherit;
      background: var(--sc-backing, var(--sc-scrim, transparent)); color: var(--sc-text, var(--primary-text-color));
    }
    .bar::before { content: ""; position: absolute; inset: 0; background: var(--c); opacity: .2; }
    .fill { position: absolute; top: 0; bottom: 0; left: 0; background: var(--c); transition: width 600ms ease-in-out; }
    .fill.stalled { background: repeating-linear-gradient(135deg, rgba(255,255,255,.35) 0 6px, transparent 6px 12px), var(--c); }
    .goal { position: absolute; top: 8px; bottom: 8px; width: 3px; margin-left: -1px; border-radius: 2px; background: rgba(0,0,0,.55); }
    .label {
      position: absolute; inset: 0; display: flex; align-items: center; padding: 0 16px; font-size: var(--ha-font-size-m, 14px);
      font-weight: 500; text-shadow: 0 1px 2px rgba(0,0,0,.6); color: #fff;
    }
    :host([sc-console]) .bar { box-shadow: inset 0 2px 4px rgba(0,0,0,.45), inset 0 -1px 0 rgba(255,255,255,.18); }
    @media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
  `];

  protected override render(): TemplateResult | typeof nothing {
    const hass = this._hass!, probe = this.probe;
    this.showNothing(!probe);
    if (!probe) return nothing;
    const e = probe.entities;
    const status = statusOf(hass, probe);
    const internal = internalValue(hass, probe), target = valueOf(hass, e.target);
    const reading = internal !== undefined && status !== "no_reading";
    const over = reading && target !== undefined && internal! > target;
    const start = probe.start ?? Math.min(internal ?? 0, target ?? 0);
    const fill = over ? 100 : progressOf(hass, probe);
    const goal = over && internal! > start ? ((target! - start) / (internal! - start)) * 100 : undefined;
    const unit = hass.states[e.target ?? ""]?.attributes.unit_of_measurement ?? "°";
    const label = !reading ? "" : target !== undefined ? `${whole(internal!)} → ${whole(target)} ${unit}` : `${whole(internal!)} ${unit}`;
    return html`<button type="button" class="bar" style=${styleMap({ "--c": colorOf(probe) })} role="progressbar"
      aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(fill)} title="${probe.name}: ${label || "no reading"}"
      aria-label="${probe.name} progress" @click=${() => moreInfo(this, e.progress)}>
      <div class="fill ${status === "stalled" ? "stalled" : ""}" style=${styleMap({ width: `${fill}%` })}></div>
      ${goal !== undefined ? html`<div class="goal" style=${styleMap({ left: `${goal}%` })}></div>` : nothing}
      <span class="label num">${label}</span>
    </button>`;
  }
}

/** The options of a select as Home Assistant shows them. */
function optionsOf(hass: SousChefFeature["hass"], stateObj?: HassEntity): { value: string; label: string }[] {
  const options: string[] = Array.isArray(stateObj?.attributes.options) ? stateObj!.attributes.options : [];
  return options.map((value) => ({ value, label: stateObj ? hass!.formatEntityState(stateObj, value) : value }));
}

/**
 * The food type (its icon; a tap lists the foods), the target (typed in
 * with Custom; with a doneness, its temperature, and a tap lists the
 * doneness levels), and the chart, which opens the chart view.
 */
export class SousChefCook extends SousChefFeature {
  static override tag = FEATURES.cook;
  static override pickerName = "Sous Chef cook";

  static override styles = [featureStyles, css`
    .food { flex: 0 0 60px; }
    .chart { flex: 0 0 42px; }
    .preset { cursor: pointer; font-size: var(--ha-font-size-m, 14px); }
  `];

  private _choose(entityId: string | undefined, option: string): void {
    if (entityId && option) this.call("select", "select_option", { entity_id: entityId, option });
  }

  private _menu(entityId: string | undefined, stateObj: HassEntity | undefined, label: string): TemplateResult {
    return html`<select aria-label=${label} ?disabled=${!known(stateObj)} .value=${stateObj?.state ?? ""}
      @click=${(ev: Event) => ev.stopPropagation()}
      @change=${(ev: Event) => this._choose(entityId, (ev.target as HTMLSelectElement).value)}>
      ${optionsOf(this._hass, stateObj).map((o) => html`<option value=${o.value} ?selected=${o.value === stateObj?.state}>${o.label}</option>`)}
    </select>`;
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this._hass!, probe = this.probe;
    this.showNothing(!probe);
    if (!probe) return nothing;
    const e = probe.entities;
    const food = e.food_type ? hass.states[e.food_type] : undefined;
    const doneness = e.doneness ? hass.states[e.doneness] : undefined;
    const target = valueOf(hass, e.target);
    const custom = !doneness || doneness.state === CUSTOM;
    const foodName = food ? hass.formatEntityState(food) : "";
    const level = doneness ? hass.formatEntityState(doneness) : "";
    return html`<div class="row" style=${styleMap({ "--c": colorOf(probe) })}>
      ${food ? html`<label class="key food" title="Food type: ${foodName}">
        <ha-state-icon .hass=${hass} .stateObj=${food}></ha-state-icon><ha-icon class="arrow" icon="mdi:menu-down"></ha-icon>
        ${this._menu(e.food_type, food, "Food type")}
      </label>` : nothing}
      ${custom
        ? numberField(hass, e.target, { placeholder: "Target", title: "Target: type it in" })
        : html`<label class="field preset" title="Doneness: ${level}${target !== undefined ? `, ${whole(target)}°` : ""}">
            ${target !== undefined ? html`<span class="num">${whole(target)}°</span>` : html`<span class="note">Target</span>`}
            <ha-icon class="arrow" icon="mdi:menu-down"></ha-icon>
            ${this._menu(e.doneness, doneness, "Doneness")}
          </label>`}
      <button type="button" class="key chart" title="Chart view: pick from a chart" aria-label="Chart view"
        ?disabled=${!e.source || !e.food_type || !e.doneness}
        @click=${() => showChartDialog(this, { name: probe.name, source: e.source, food_type: e.food_type, doneness: e.doneness, target: e.target })}>
        <ha-icon icon="mdi:book-open-variant"></ha-icon>
      </button>
    </div>`;
  }
}

/**
 * One key for each channel, from the tip (its key pointed): the coldest the
 * faintest and the hottest the strongest, each with its difference from the
 * reference (the lowest), which says REF. Nothing for a one-sensor probe.
 */
export class SousChefChannels extends SousChefFeature {
  static override tag = FEATURES.channels;
  static override pickerName = "Sous Chef channels";

  static override styles = [featureStyles, css`
    .key { flex-direction: column; gap: 1px; padding: 0; font-size: 13px; }
    .key.tip { border-radius: 0 var(--feature-border-radius, 12px) var(--feature-border-radius, 12px) 0; padding-left: 8px;
      clip-path: polygon(12px 0, 100% 0, 100% 100%, 12px 100%, 0 50%); }
    .key .value { line-height: 14px; min-height: 14px; }
    .key .delta { font-size: 10px; font-weight: 400; line-height: 11px; color: var(--secondary-text-color); }
    .key .delta.ref { text-transform: uppercase; letter-spacing: .05em; }
  `];

  protected override render(): TemplateResult | typeof nothing {
    const hass = this._hass!, probe = this.probe;
    const multi = !!probe && probe.channels.length > 1;
    this.showNothing(!multi);
    if (!probe || !multi) return nothing;
    const reading = statusOf(hass, probe) !== "no_reading";
    const unit = hass.states[probe.channels[0]]?.attributes.unit_of_measurement ?? "°";
    const channels = channelReadings(probe.channels.map((id) => (reading ? valueOf(hass, id) : undefined)), probe.channels);
    return html`<div class="row tight" style=${styleMap({ "--c": colorOf(probe) })}>
      ${channels.map((ch, i) => {
        const title = `Channel ${i + 1}${ch.tip ? ", at the tip" : ""}: ${ch.value === undefined ? "unknown"
          : `${whole(ch.value)} ${unit}${ch.reference ? ", the reference" : `, ${ch.delta} ${unit} above the reference`}`}`;
        return html`<button type="button" class="key ${ch.tip ? "tip" : ""}" title=${title} aria-label=${title}
          style=${styleMap({ "--tint": (0.14 + 0.5 * ch.heat).toFixed(2) })} @click=${() => moreInfo(this, ch.id)}>
          <span class="value num">${ch.value === undefined ? "" : whole(ch.value)}</span>
          <span class="delta ${ch.reference ? "ref" : ""}">${ch.value === undefined ? "" : ch.reference ? "Ref" : `+${ch.delta}°`}</span>
        </button>`;
      })}
    </div>`;
  }
}

/** The rate, and the time left; once done, the rest the chart asks for. */
export class SousChefTiming extends SousChefFeature {
  static override tag = FEATURES.timing;
  static override pickerName = "Sous Chef timing";

  private _clock?: ReturnType<typeof setInterval>;

  override connectedCallback(): void {
    super.connectedCallback();
    // The time left counts down between state changes
    this._clock = setInterval(() => this.requestUpdate(), 30000);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._clock);
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this._hass!, probe = this.probe;
    this.showNothing(!probe);
    if (!probe) return nothing;
    const e = probe.entities;
    const status = statusOf(hass, probe);
    const reading = status !== "no_reading" && status !== "off";
    const rate = reading ? valueOf(hass, e.rate) : undefined;
    const done = status === "done";
    const rest = Number(e.doneness ? hass.states[e.doneness]?.attributes.rest_minutes : undefined);
    const at = doneAtOf(hass, probe);
    const left = !reading ? "" : done ? (rest > 0 ? `Rest ${rest} min` : "") : at && at.getTime() > Date.now() ? durationText(at.getTime() - Date.now()) : "";
    const rateTitle = `Rate: ${rate === undefined ? "unknown" : `${rateText(rate)}`}`;
    const timeTitle = done ? `Rest from the chart${rest > 0 ? `: ${rest} min` : ""}` : `Time left: ${left || "unknown"}`;
    return html`<div class="row" style=${styleMap({ "--c": colorOf(probe) })}>
      <button type="button" class="key" title=${rateTitle} aria-label=${rateTitle} @click=${() => moreInfo(this, e.rate)}>
        <ha-icon .icon=${rateIcon(rate, 0.3)}></ha-icon><span class="num">${rateText(rate)}</span>
      </button>
      <button type="button" class="key" title=${timeTitle} aria-label=${timeTitle} @click=${() => moreInfo(this, done ? e.doneness : e.done_at)}>
        <ha-icon .icon=${done ? "mdi:timer-sand" : "mdi:timer-outline"}></ha-icon><span class="num">${left}</span>
      </button>
    </div>`;
  }

  // The internal temperature changes the rate and time left
  protected override watched(): string[] {
    const probe = this.probe;
    return probe && this._hass ? [...super.watched(), internalSensor(this._hass, probe) ?? ""] : super.watched();
  }
}
