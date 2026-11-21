// The chart view: one source's whole chart in Home Assistant's own dialog
// (ha-dialog), opened through its dialog manager (the show-dialog event).
// The source is chosen with Home Assistant's select selector, and the chart
// is a selection list (ha-list-selectable, ha-list-item-option) with a
// section title (ha-section-title) for each food. Choosing a row sets the
// probe's Source, Food type and Doneness through their select_option
// actions; the integration sets the target from the doneness.
import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { fire, known, type HomeAssistant } from "../ha";
import { CHARTS_COMMAND, labelOf, rowsOf, stepsFor, temperatureOf, timesOf, type Charts, type ChartSource } from "./data";

export const CHART_DIALOG = "sous-chef-chart-dialog";

export interface ChartDialogParams {
  // The probe's name, and its Source, Food type, Doneness and Target entities
  name: string;
  source?: string;
  food_type?: string;
  doneness?: string;
  target?: string;
}

/** Open the chart view for a probe, as Home Assistant opens its own dialogs. */
export function showChartDialog(host: EventTarget, params: ChartDialogParams): void {
  fire(host, "show-dialog", { dialogTag: CHART_DIALOG, dialogImport: () => Promise.resolve(), dialogParams: params });
}

type Localize = (key: string) => string;

export class SousChefChartDialog extends LitElement {
  static override properties = {
    hass: { attribute: false },
    _params: { state: true },
    _open: { state: true },
    _charts: { state: true },
    _source: { state: true },
    _localize: { state: true },
    _error: { state: true },
    _busy: { state: true },
  };

  hass?: HomeAssistant;
  private _params?: ChartDialogParams;
  private _open = false;
  private _charts?: Charts;
  private _source?: string;
  private _localize?: Localize;
  private _error?: string;
  private _busy = false;

  async showDialog(params: ChartDialogParams): Promise<void> {
    this._params = params;
    this._charts = undefined;
    this._error = undefined;
    this._busy = false;
    this._source = this._state(params.source);
    this._open = true;
    const hass = this.hass!;
    try {
      const [charts, localize] = await Promise.all([
        hass.callWS<Charts>(CHARTS_COMMAND),
        hass.loadBackendTranslation("entity", "sous_chef"),
      ]);
      this._localize = localize;
      this._charts = charts;
      if (!charts.sources.some((s) => s.key === this._source)) this._source = charts.sources[0]?.key;
    } catch (err) {
      this._error = (err as { message?: string })?.message ?? String(err);
    }
  }

  closeDialog(): boolean {
    this._open = false;
    return true;
  }

  private _closed(): void {
    this._params = undefined;
    fire(this, "dialog-closed", { dialog: this.localName });
  }

  private _state(entityId?: string): string | undefined {
    const stateObj = entityId ? this.hass?.states[entityId] : undefined;
    return known(stateObj) ? stateObj.state : undefined;
  }

  private get _chart(): ChartSource | undefined {
    return this._charts?.sources.find((s) => s.key === this._source);
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this._params || !this.hass) return nothing;
    return html`<ha-dialog .open=${this._open} header-title="Chart" header-subtitle=${this._params.name} @closed=${this._closed}>
      ${this._error ? html`<ha-alert alert-type="error">${this._error}</ha-alert>` : nothing}
      ${this._charts ? this._renderChart() : this._error ? nothing : html`<div class="loading"><ha-spinner></ha-spinner></div>`}
    </ha-dialog>`;
  }

  private _renderChart(): TemplateResult {
    const hass = this.hass!, chart = this._chart;
    const options = this._charts!.sources.map((s) => ({ value: s.key, label: labelOf(this._localize, "source", s.key) }));
    return html`
      <ha-selector .hass=${hass} label="Source" .required=${true} .value=${this._source}
        .selector=${{ select: { mode: "dropdown", options } }} @value-changed=${this._sourceChanged}></ha-selector>
      ${chart?.url
        ? html`<ha-button class="link" appearance="plain" size="s" href=${chart.url} target="_blank" rel="noopener noreferrer">
            Open the published chart<ha-icon slot="end" icon="mdi:open-in-new"></ha-icon></ha-button>`
        : nothing}
      ${chart ? this._renderList(chart) : nothing}`;
  }

  private _renderList(chart: ChartSource): TemplateResult {
    const p = this._params!;
    const current = { source: this._state(p.source), food: this._state(p.food_type), level: this._state(p.doneness) };
    const target = p.target ? this.hass!.states[p.target] : undefined;
    const unit: string | undefined = target?.attributes.unit_of_measurement;
    // Each row's place in rowsOf(chart): the levels of the foods before it, then its own
    const offsets = chart.foods.map((_, i) => chart.foods.slice(0, i).reduce((sum, food) => sum + food.levels.length, 0));
    return html`<ha-list-selectable controlled ?inert=${this._busy} @ha-list-item-selected=${this._chosen}>
      ${chart.foods.map((food, f) => html`
        <ha-section-title>${food.icon ? html`<ha-icon icon=${food.icon}></ha-icon>` : nothing}
          ${labelOf(this._localize, "food_type", food.key, chart.key)}</ha-section-title>
        ${food.levels.map((level, l) => {
          const temperature = temperatureOf(level, unit);
          const times = timesOf(level);
          const selected = current.source === chart.key && current.food === food.key && current.level === level.key;
          return html`<ha-list-item-option .selected=${selected} value=${String(offsets[f] + l)}>
            <span slot="headline">${labelOf(this._localize, "doneness", level.key, chart.key)}</span>
            ${times ? html`<span slot="supporting-text">${times}</span>` : nothing}
            <span slot="end" class="temperature">${target ? this.hass!.formatEntityState(target, String(temperature)) : `${temperature} ${unit ?? "°F"}`}</span>
          </ha-list-item-option>`;
        })}`)}
    </ha-list-selectable>`;
  }

  private _sourceChanged(ev: CustomEvent): void {
    ev.stopPropagation();
    if (ev.detail?.value) this._source = ev.detail.value;
  }

  /** Set the probe from a row: Source, then Food type, then Doneness, each through its own select_option action. */
  private async _chosen(ev: CustomEvent<number>): Promise<void> {
    ev.stopPropagation();
    const chart = this._chart, p = this._params;
    // The option the list reports, by its value: its row in the chart
    const option = (ev.currentTarget as HTMLElement & { items?: { value?: string }[] }).items?.[ev.detail];
    const choice = chart && option?.value !== undefined ? rowsOf(chart)[Number(option.value)] : undefined;
    if (!choice || !p || this._busy) return;
    this._busy = true;
    this._error = undefined;
    try {
      for (const [entityId, option] of stepsFor(choice, p)) {
        await this.hass!.callService("select", "select_option", { entity_id: entityId, option });
      }
      this.closeDialog();
    } catch (err) {
      this._error = (err as { message?: string })?.message ?? String(err);
    } finally {
      this._busy = false;
    }
  }

  static override styles = css`
    ha-dialog {
      --dialog-content-padding: 0;
    }
    ha-selector {
      display: block;
      padding: var(--ha-space-2, 8px) var(--ha-space-6, 24px) 0;
    }
    .link {
      margin: var(--ha-space-1, 4px) var(--ha-space-4, 16px);
    }
    ha-alert {
      display: block;
      margin: var(--ha-space-2, 8px) var(--ha-space-6, 24px);
    }
    ha-section-title {
      gap: var(--ha-space-2, 8px);
    }
    ha-section-title ha-icon {
      --mdc-icon-size: 18px;
    }
    .temperature {
      font-variant-numeric: tabular-nums;
    }
    .loading {
      display: flex;
      justify-content: center;
      padding: var(--ha-space-6, 24px);
    }
  `;
}
