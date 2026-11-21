// The features of one probe (the probe view): Progress, Preset and Channels.
import { css, html, nothing, type TemplateResult } from "lit";
import { FEATURES } from "../const";
import { moreInfo } from "../ha";
import { featureStyles } from "./styles";
import { probeEntities, SousChefFeature } from "./base";
import { channels, Controls, preset, ring, shown, status } from "./parts";
import { internalSensor, statusOf } from "../sous-chef";

/** The ring, Internal → Target, Done at or the cook's status, and Rate. */
export class SousChefProgress extends SousChefFeature {
  static override tag = FEATURES.progress;
  static override pickerName = "Sous Chef progress";

  static override styles = [
    featureStyles,
    css`
      .progress {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .lines {
        display: grid;
        gap: 2px;
        min-width: 0;
      }
      .line {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 8px;
      }
    `,
  ];

  protected override watched(): string[] {
    return this.probe ? probeEntities(this.probe) : [];
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this.hass, probe = this.probe;
    if (!hass || !probe) return nothing;
    const e = probe.entities;
    const reading = !["off", "no_reading"].includes(statusOf(hass, probe));
    const internal = internalSensor(hass, probe);
    return html`<div class="progress">
      ${ring(hass, probe, this)}
      <div class="lines">
        <div class="line num">
          <button @click=${() => moreInfo(this, internal)}>Internal ${reading ? shown(hass, internal) : "—"}</button>
          <span aria-hidden="true">→</span>
          <button @click=${() => moreInfo(this, e.target)}>${shown(hass, e.target)}</button>
        </div>
        <div class="line secondary num">
          ${status(hass, probe, this.timeFormat)}
          ${e.rate && reading ? html`<button @click=${() => moreInfo(this, e.rate)}>${shown(hass, e.rate)}</button>` : nothing}
        </div>
      </div>
    </div>`;
  }
}

/** Food type and Doneness, Target, and the source with its chart link. */
export class SousChefPreset extends SousChefFeature {
  static override tag = FEATURES.preset;
  static override pickerName = "Sous Chef preset";

  private _controls = new Controls();

  protected override watched(): string[] {
    return this.probe ? probeEntities(this.probe) : [];
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this.hass, probe = this.probe;
    if (!hass || !probe) return nothing;
    return preset(hass, probe, this._controls, this);
  }
}

/** ch 1 to ch n, from the tip, with Max outlined. */
export class SousChefChannels extends SousChefFeature {
  static override tag = FEATURES.channels;
  static override pickerName = "Sous Chef channels";

  protected override watched(): string[] {
    return this.probe?.channels ?? [];
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this.hass, probe = this.probe;
    if (!hass || !probe) return nothing;
    return channels(hass, probe, this);
  }
}
