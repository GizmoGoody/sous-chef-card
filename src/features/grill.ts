// The grill's features:
// - Sous Chef probes: a key for each probe beside the grill's name, pressed while it is on
// - Sous Chef history: Home Assistant's history graph of the grill and the probes, with projections
// - Sous Chef ambient: the grill's trend, and its low and high alarms
import { css, html, nothing, svg, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { FEATURES, GRILL_COLOR } from "../const";
import { cssColor, entityName, findDeep, moreInfo, numberOf, toHex, type Config, type HomeAssistant } from "../ha";
import {
  allProbes, axisRange, colorOf, cookBar, doneAtOf, internalSensor, internalValue, isActive, probeNames, rateIcon, rateText, statusOf, trendOf,
  valueOf, whole, type Probe,
} from "../sous-chef";
import { SousChefFeature } from "./base";
import { numberField } from "./field";
import { featureStyles } from "./styles";

const probeEntityIds = (probe: Probe): string[] =>
  [...Object.values(probe.entities), ...probe.channels, ...(probe.internal ? [probe.internal] : [])].filter((id): id is string => !!id);

/**
 * A key for each probe: its color, pressed while it is on, with its
 * temperature (or its icon); a tap turns it on or off (its Active switch).
 */
export class SousChefProbes extends SousChefFeature {
  static override tag = FEATURES.probes;
  static override pickerName = "Sous Chef probes";
  static override forKind = "grill" as const;
  static override options = [{
    name: "show", label: "Show on a probe that is on", default: "temperatures",
    selector: { select: { mode: "dropdown", options: [{ value: "temperatures", label: "Its temperature" }, { value: "icons", label: "The probe icon" }] } },
  }];

  static override styles = [featureStyles, css`
    .key { min-width: 0; padding: 0 4px; border-radius: var(--feature-border-radius, 18px); font-size: var(--ha-font-size-m, 14px); }
    .key[aria-pressed="false"] ha-icon { color: var(--c); }
  `];

  protected override watched(): string[] {
    const hass = this._hass;
    return hass ? allProbes(hass).flatMap((p) => [p.entities.active, p.entities.progress, internalSensor(hass, p)].filter((id): id is string => !!id)) : [];
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this._hass!;
    const probes = allProbes(hass);
    this.showNothing(!probes.length);
    if (!probes.length) return nothing;
    const names = probeNames(probes);
    const temperatures = this.option<string>("show") !== "icons";
    return html`<div class="row tight" role="group" aria-label="Probes">
      ${probes.map((p) => {
        const on = isActive(hass, p);
        const t = on && temperatures && statusOf(hass, p) !== "no_reading" ? internalValue(hass, p) : undefined;
        const title = `${names.get(p.device)}: ${on ? `on${t !== undefined ? `, ${whole(t)}°` : ""}` : "off. Take it off its charger, or tap to turn it on"}`;
        return html`<button type="button" class="key ${t === undefined ? "icon" : ""}" aria-pressed=${on ? "true" : "false"} title=${title} aria-label=${title}
          style=${styleMap({ "--c": colorOf(p), "--sc-on-color": p.colors[0] === "yellow" || p.colors[0] === "white" ? "rgba(0,0,0,.85)" : "#fff" })}
          ?disabled=${hass.states[p.entities.active!]?.state === "unavailable"}
          @click=${() => this.call("switch", on ? "turn_off" : "turn_on", { entity_id: p.entities.active })}>
          ${t === undefined ? html`<ha-icon icon="mdi:thermometer-probe"></ha-icon>` : html`<span class="num">${whole(t)}°</span>`}
        </button>`;
      })}
    </div>`;
  }
}

/**
 * The grill's trend (degrees a minute over the last five minutes, from its
 * history and its readings since), then its low and high alarms, typed in
 * place. A field turns red while the grill is past it.
 */
export class SousChefAmbient extends SousChefFeature {
  static override tag = FEATURES.ambient;
  static override pickerName = "Sous Chef ambient";
  static override forKind = "grill" as const;
  static override controls: [string, string][] = [["trend", "Trend"], ["low", "Low alarm"], ["high", "High alarm"]];

  private _samples: [number, number][] = [];
  private _loaded?: string;
  private _clock?: ReturnType<typeof setInterval>;

  override connectedCallback(): void {
    super.connectedCallback();
    this._clock = setInterval(() => this.requestUpdate(), 30000);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearInterval(this._clock);
  }

  /** The grill's readings of the last ten minutes, from Home Assistant's history. */
  private async _load(sensor: string): Promise<void> {
    this._loaded = sensor;
    try {
      const start = new Date(Date.now() - 10 * 60000).toISOString();
      const result = await this._hass!.callWS<Record<string, { s: string; lu: number }[]>>({
        type: "history/history_during_period", start_time: start, entity_ids: [sensor],
        minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      const past = (result?.[sensor] ?? []).map((row): [number, number] => [row.lu * 1000, Number(row.s)]).filter(([, v]) => Number.isFinite(v));
      this._samples = [...past, ...this._samples].sort((a, b) => a[0] - b[0]);
      this.requestUpdate();
    } catch {
      // Without history, the trend follows the readings from now on
    }
  }

  private _sample(sensor: string): void {
    const stateObj = this._hass!.states[sensor];
    const value = numberOf(stateObj);
    if (value === undefined) return;
    const t = Date.parse(stateObj.last_updated ?? "") || Date.now();
    const last = this._samples[this._samples.length - 1];
    if (!last || last[0] !== t) this._samples.push([t, value]);
    const keep = Date.now() - 15 * 60000;
    while (this._samples.length && this._samples[0][0] < keep) this._samples.shift();
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this._hass!, ambient = this.ambient;
    this.showNothing(!ambient || !this.chosen().length);
    if (!ambient || !this.chosen().length) return nothing;
    if (this._loaded !== ambient.sensor) {
      this._samples = [];
      this._load(ambient.sensor);
    }
    this._sample(ambient.sensor);
    const rate = trendOf(this._samples);
    const value = valueOf(hass, ambient.sensor);
    const alarm = hass.states[ambient.alarm]?.state === "on";
    const low = valueOf(hass, ambient.low), high = valueOf(hass, ambient.high);
    const title = `Grill trend: ${rate === undefined ? "unknown" : rateText(rate)}`;
    const controls: Record<string, () => unknown> = {
      trend: () => html`<button type="button" class="key" title=${title} aria-label=${title} @click=${() => moreInfo(this, ambient.sensor)}>
        <ha-icon .icon=${rateIcon(rate, 0.5)}></ha-icon>${rate === undefined ? html`<span class="note">Trend</span>` : html`<span class="num">${rateText(rate)}</span>`}
      </button>`,
      low: () => numberField(hass, ambient.low, {
        icon: "mdi:thermometer-chevron-down", placeholder: "Off", empty: 0,
        title: "Low alarm: Sous Chef alerts when the grill falls below it",
        alarm: alarm && value !== undefined && !!low && value < low,
      }),
      high: () => numberField(hass, ambient.high, {
        icon: "mdi:thermometer-chevron-up", placeholder: "Off", empty: 0,
        title: "High alarm: Sous Chef alerts when the grill rises above it",
        alarm: alarm && value !== undefined && !!high && value > high,
      }),
    };
    return html`<div class="row" style=${styleMap({ "--c": cssColor(GRILL_COLOR) })}>${this.chosen().map((id) => controls[id]())}</div>`;
  }
}

type Card = HTMLElement & { setConfig(config: Config): void; hass?: HomeAssistant };
// What the card reads of the history graph's chart (Apache ECharts, inside Home Assistant's ha-chart-base)
type Chart = {
  getDom(): HTMLElement;
  getModel(): { getComponent(type: string, index: number): any };
};

const HOURS = 1;
// The share of the width the projections take, right of the history
const AHEAD = 0.3;

/** A projection: from now and a reading, to a time ahead (0 to 1 of the hour ahead) and a reading. */
interface Projection {
  color: string;
  from: number;
  to: number;
  at: number;
}

/**
 * The grill and every probe that is on, in Home Assistant's own history
 * graph card, as the Prusa Connect card's history: each probe in its color
 * and its target in the same color, the grill in orange. The key at the
 * top right shows projected temperatures: Home Assistant's graph ends at
 * now, so the hour ahead is drawn beside it, on the graph's own scale, each
 * probe dashed toward its target (reached at its Done at time) and the
 * grill holding its temperature.
 */
export class SousChefHistory extends SousChefFeature {
  static override tag = FEATURES.history;
  static override pickerName = "Sous Chef history";
  static override forKind = "grill" as const;
  static override options = [
    { name: "hours_to_show", label: "Hours to show", default: HOURS, selector: { number: { min: 1, max: 48, mode: "box", unit_of_measurement: "h" } } },
    { name: "projections", label: "Projections key", helper: "A key that shows the hour ahead beside the history", default: true, selector: { boolean: {} } },
  ];

  static override styles = [featureStyles, css`
    .box {
      position: relative; display: flex; height: var(--sc-history-height, 240px); box-sizing: border-box; overflow: hidden;
      border-radius: var(--feature-border-radius, 12px); background: var(--sc-screen, var(--sc-backing, var(--sc-scrim, transparent)));
      --ha-card-background: transparent; --card-background-color: transparent; --ha-card-box-shadow: none;
      --ha-card-border-width: 0; --ha-card-border-color: transparent; --ha-card-backdrop-filter: none;
    }
    :host([sc-console]) .box { box-shadow: inset 0 3px 6px rgba(0,0,0,.6); }
    /* Home Assistant's history graph card sizes its chart from its own height: it needs a box of a set height to fill */
    .graph { flex: 1 1 auto; min-width: 0; height: 100%; }
    .graph > * { display: block; height: 100%; }
    .ahead { position: relative; flex: 0 0 ${AHEAD * 100}%; height: 100%; display: none; }
    .projected .ahead { display: block; }
    .ahead svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    .ahead .label { position: absolute; right: 4px; font-size: 11px; color: var(--secondary-text-color); }
    .project { position: absolute; top: 6px; right: 8px; width: 28px; height: 28px; flex: none; min-width: 28px; padding: 0; z-index: 1;
      border-radius: 14px; }
    .project ha-icon { --mdc-icon-size: 18px; }
  `];

  private _graph?: Card;
  private _loading = false;
  private _shown?: string;
  private _projected = false;
  private _resize = new ResizeObserver(() => this._drawAhead());
  private _ahead: Projection[] = [];
  private _scale?: { top: number; bottom: number; min: number; max: number };
  private _warned = false;
  private _paletteKey?: string;

  protected override watched(): string[] {
    const hass = this._hass, ambient = this.ambient;
    if (!hass || !ambient) return [];
    return [ambient.sensor, ...allProbes(hass).flatMap(probeEntityIds)];
  }

  private get _storageKey(): string {
    return `sous-chef-card:projected:${this._context?.entity_id}`;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    try {
      this._projected = window.localStorage.getItem(this._storageKey) === "1";
    } catch {
      // Storage can be unavailable (private windows)
    }
    this._resize.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resize.disconnect();
  }

  private _toggle(): void {
    this._projected = !this._projected;
    try {
      window.localStorage.setItem(this._storageKey, this._projected ? "1" : "0");
    } catch {
      // The choice still holds while the page is open
    }
    this.requestUpdate();
  }

  /** The history graph card's configuration: the grill, then each probe that is on and its target. */
  private _graphConfig(): Config | undefined {
    const hass = this._hass!, ambient = this.ambient;
    if (!ambient) return undefined;
    const hex = (color: string) => toHex(this, color) ?? "#ff9800";
    const probes = allProbes(hass).filter((p) => isActive(hass, p));
    const names = probeNames(probes);
    const entities: Config[] = [{ entity: ambient.sensor, name: entityName(hass, ambient.sensor), color: hex(cssColor(GRILL_COLOR)) }];
    for (const p of probes) {
      const reading = internalSensor(hass, p);
      const color = hex(colorOf(p));
      if (reading) entities.push({ entity: reading, name: names.get(p.device), color });
      if (p.entities.target && valueOf(hass, p.entities.target) !== undefined) {
        entities.push({ entity: p.entities.target, name: `${names.get(p.device)} target`, color });
      }
    }
    const config: Config = { type: "history-graph", entities, hours_to_show: this.option<number>("hours_to_show"), expand_legend: true, grid_options: { rows: 4 } };
    // Whole tens around the readings, so the axis has no decimals; the graph still fits its history
    const range = axisRange(entities.map((e) => valueOf(hass, e.entity)).filter((v): v is number => v !== undefined));
    if (range) Object.assign(config, { min_y_axis: range[0], max_y_axis: range[1], fit_y_data: true });
    return config;
  }

  /** The projections: the grill level, each probe toward its target at its Done at time (or at its rate). */
  private _projections(): Projection[] {
    const hass = this._hass!, ambient = this.ambient!;
    const out: Projection[] = [];
    const grill = valueOf(hass, ambient.sensor);
    const hex = (color: string) => toHex(this, color) ?? "#ff9800";
    if (grill !== undefined) out.push({ color: hex(cssColor(GRILL_COLOR)), from: grill, to: grill, at: 1 });
    const now = Date.now();
    for (const p of allProbes(hass).filter((probe) => isActive(hass, probe))) {
      const status = statusOf(hass, p);
      const internal = internalValue(hass, p), target = valueOf(hass, p.entities.target);
      if (internal === undefined || status === "no_reading" || status === "done") continue;
      const doneAt = doneAtOf(hass, p);
      const rate = valueOf(hass, p.entities.rate);
      if (target !== undefined && doneAt && doneAt.getTime() > now) {
        const minutes = (doneAt.getTime() - now) / 60000;
        const reach = Math.min(1, 60 / minutes);
        out.push({ color: hex(colorOf(p)), from: internal, to: internal + (target - internal) * reach, at: Math.min(1, minutes / 60) });
      } else if (rate !== undefined) {
        const to = target !== undefined && rate > 0 ? Math.min(target, internal + rate * 60) : internal + rate * 60;
        out.push({ color: hex(colorOf(p)), from: internal, to, at: 1 });
      }
    }
    return out;
  }

  /**
   * The graph's colors on a style: its text, grid lines and tooltip in the
   * finish's colors (the card sets them). The graph reads the theme's colors
   * when it is made, so it is made again when they change.
   */
  private _palette(): Record<string, string> {
    const cs = getComputedStyle(this);
    const get = (name: string) => cs.getPropertyValue(name).trim();
    const text = get("--sc-screen-text");
    if (!text) return {};
    return {
      color: text, "--primary-text-color": text, "--secondary-text-color": get("--sc-screen-secondary"),
      "--divider-color": get("--sc-screen-grid"), "--card-background-color": get("--sc-screen-solid"),
    };
  }

  protected override render(): TemplateResult | typeof nothing {
    const config = this._graphConfig();
    this.showNothing(!config);
    if (!config) return nothing;
    const palette = this._palette();
    const projections = this.option<boolean>("projections") !== false;
    if (!projections) this._projected = false;
    const paletteKey = JSON.stringify(palette);
    if (paletteKey !== this._paletteKey) {
      if (this._graph) {
        this._graph = undefined;
        this._loading = false;
        this._shown = undefined;
      }
      this._paletteKey = paletteKey;
    }
    const key = JSON.stringify(config);
    if (key !== this._shown) {
      this._shown = key;
      if (this._graph) this._graph.setConfig(config);
      else if (!this._loading) {
        // Home Assistant's history graph card, made by its card helpers as a dashboard makes it
        this._loading = true;
        window.loadCardHelpers?.().then((helpers) => {
          this._graph = helpers.createCardElement(JSON.parse(this._shown!)) as Card;
          this.requestUpdate();
        });
      }
    }
    if (this._graph) this._graph.hass = this._hass;
    this._ahead = this._projected ? this._projections() : [];
    const s = this._scale;
    const y = (v: number) => (s && s.max > s.min ? s.top + ((s.max - v) / (s.max - s.min)) * (s.bottom - s.top) : -100);
    return html`<div class="box ${this._projected ? "projected" : ""}" style=${styleMap(palette)}>
      <div class="graph">${this._graph ?? nothing}</div>
      <div class="ahead" aria-hidden="true">
        <svg>
          ${s ? svg`<line x1="0" x2="0" y1=${s.top} y2=${s.bottom} stroke="currentColor" stroke-opacity=".45" stroke-dasharray="2 3"></line>` : nothing}
          ${s ? this._ahead.map((p) => svg`<line x1="0" y1=${y(p.from)} x2=${`${p.at * 100}%`} y2=${y(p.to)} stroke=${p.color}
            stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round"></line>`) : nothing}
        </svg>
        ${s ? html`<span class="label" style=${styleMap({ top: `${s.bottom + 6}px` })}>+1 h</span>` : nothing}
      </div>
      ${projections ? html`<button type="button" class="key project" aria-pressed=${this._projected ? "true" : "false"} title="Projected temperatures"
        aria-label="Projected temperatures" style=${styleMap({ "--c": cssColor(GRILL_COLOR) })} @click=${this._toggle}>
        <ha-icon icon="mdi:chart-timeline-variant"></ha-icon>
      </button>` : nothing}
    </div>`;
  }

  protected override updated(): void {
    if (this._projected) requestAnimationFrame(() => this._drawAhead());
  }

  /**
   * The graph's own scale, read from its chart (Apache ECharts, which Home
   * Assistant's charts use): the plot's top and bottom in this box, and the
   * temperatures there, so the hour ahead lines up with the history. If a
   * Home Assistant update changes the chart, the projections are not drawn.
   */
  private _drawAhead(): void {
    if (!this._projected || !this._graph) return;
    try {
      const base = findDeep(this._graph.shadowRoot, "ha-chart-base") as (HTMLElement & { chart?: Chart }) | null;
      const chart = base?.chart;
      if (!chart) {
        setTimeout(() => this._drawAhead(), 500);
        return;
      }
      const model = chart.getModel();
      const extent: [number, number] = model.getComponent("yAxis", 0).axis.scale.getExtent();
      const rect = model.getComponent("grid", 0).coordinateSystem.getRect();
      const box = this.renderRoot.querySelector(".box")!.getBoundingClientRect();
      const dom = chart.getDom().getBoundingClientRect();
      const scale = { top: dom.top - box.top + rect.y, bottom: dom.top - box.top + rect.y + rect.height, min: extent[0], max: extent[1] };
      const old = this._scale;
      if (!old || Object.entries(scale).some(([k, v]) => Math.abs(v - old[k as keyof typeof scale]) > 0.5)) {
        this._scale = scale;
        this.requestUpdate();
      }
    } catch {
      if (!this._warned) console.warn("Sous Chef card: could not read the history graph's scale for the projections");
      this._warned = true;
    }
  }
}

/**
 * A thin bar for each probe that is on, all in one feature: filled to its
 * cook's progress in its color, striped while stalled, with its reading
 * (68 → 130 °F) beside it. A tap on one shows its progress.
 */
export class SousChefProgressBars extends SousChefFeature {
  static override tag = FEATURES.bars;
  static override pickerName = "Sous Chef progress bars";
  static override forKind = "grill" as const;
  static override options = [
    { name: "readings", label: "Readings", helper: "Each probe's temperature and target beside its bar", default: true, selector: { boolean: {} } },
  ];

  static override styles = [featureStyles, css`
    .bars { display: flex; flex-direction: column; gap: 6px; padding: 2px 0; }
    .line { display: flex; align-items: center; gap: 10px; height: 18px; padding: 0; border: 0; margin: 0; background: none;
      font: inherit; color: var(--sc-text, var(--primary-text-color)); cursor: pointer; text-align: start; }
    .bar { position: relative; flex: 1 1 auto; height: 8px; border-radius: 4px; overflow: hidden; }
    .bar::before { content: ""; position: absolute; inset: 0; background: var(--c); opacity: .22; }
    .fill { position: absolute; top: 0; bottom: 0; left: 0; border-radius: 4px; background: var(--c); transition: width 600ms ease-in-out; }
    .fill.stalled { background: repeating-linear-gradient(135deg, rgba(255,255,255,.4) 0 4px, transparent 4px 8px), var(--c); }
    .goal { position: absolute; top: 0; bottom: 0; width: 2px; margin-left: -1px; background: rgba(0,0,0,.6); }
    .reading { flex: 0 0 auto; min-width: 84px; text-align: end; font-size: var(--ha-font-size-s, 12px); }
    :host([sc-console]) .bar { box-shadow: inset 0 1px 2px rgba(0,0,0,.45); }
    @media (prefers-reduced-motion: reduce) { .fill { transition: none; } }
  `];

  protected override watched(): string[] {
    const hass = this._hass;
    return hass ? allProbes(hass).flatMap(probeEntityIds) : [];
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this._hass!;
    const on = this.ambient ? allProbes(hass).filter((p) => isActive(hass, p)) : [];
    this.showNothing(!on.length);
    if (!on.length) return nothing;
    const names = probeNames(on);
    const readings = this.option<boolean>("readings") !== false;
    return html`<div class="bars">
      ${on.map((p) => {
        const bar = cookBar(hass, p);
        const title = `${names.get(p.device)}: ${bar.label || "no reading"}`;
        return html`<button type="button" class="line" style=${styleMap({ "--c": colorOf(p) })} role="progressbar"
          aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(bar.fill)} title=${title} aria-label=${title}
          @click=${() => moreInfo(this, p.entities.progress)}>
          <span class="bar"><span class="fill ${bar.stalled ? "stalled" : ""}" style=${styleMap({ width: `${bar.fill}%` })}></span>
            ${bar.goal !== undefined ? html`<span class="goal" style=${styleMap({ left: `${bar.goal}%` })}></span>` : nothing}</span>
          ${readings ? html`<span class="reading num">${bar.label}</span>` : nothing}
        </button>`;
      })}
    </div>`;
  }
}
