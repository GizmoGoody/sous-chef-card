// The grill's trend, for the features that show it (Sous Chef ambient and
// heat): degrees a minute over the last five minutes, from the grill's
// history and its readings since.
import { numberOf, type HomeAssistant } from "../ha";
import { trendOf } from "../sous-chef";

export class GrillTrend {
  private _samples: [number, number][] = [];
  private _loaded?: string;

  /** host: the feature, drawn again once the history is in. */
  constructor(private _host: { requestUpdate(): void }) {}

  /** The trend now (°/min), or undefined until there are readings enough. */
  rate(hass: HomeAssistant, sensor: string): number | undefined {
    if (this._loaded !== sensor) {
      this._samples = [];
      this._load(hass, sensor);
    }
    this._sample(hass, sensor);
    return trendOf(this._samples);
  }

  /** The grill's readings of the last ten minutes, from Home Assistant's history. */
  private async _load(hass: HomeAssistant, sensor: string): Promise<void> {
    this._loaded = sensor;
    try {
      const start = new Date(Date.now() - 10 * 60000).toISOString();
      const result = await hass.callWS<Record<string, { s: string; lu: number }[]>>({
        type: "history/history_during_period", start_time: start, entity_ids: [sensor],
        minimal_response: true, no_attributes: true, significant_changes_only: false,
      });
      const past = (result?.[sensor] ?? []).map((row): [number, number] => [row.lu * 1000, Number(row.s)]).filter(([, v]) => Number.isFinite(v));
      this._samples = [...past, ...this._samples].sort((a, b) => a[0] - b[0]);
      this._host.requestUpdate();
    } catch {
      // Without history, the trend follows the readings from now on
    }
  }

  private _sample(hass: HomeAssistant, sensor: string): void {
    const stateObj = hass.states[sensor];
    const value = numberOf(stateObj);
    if (value === undefined) return;
    const t = Date.parse(stateObj.last_updated ?? "") || Date.now();
    const last = this._samples[this._samples.length - 1];
    if (!last || last[0] !== t) this._samples.push([t, value]);
    const keep = Date.now() - 15 * 60000;
    while (this._samples.length && this._samples[0][0] < keep) this._samples.shift();
  }
}
