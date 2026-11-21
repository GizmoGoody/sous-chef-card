// The features of a grill (the grill view): Ambient, and Probes.
import { css, html, nothing, type TemplateResult } from "lit";
import { styleMap } from "lit/directives/style-map.js";
import { FEATURES } from "../const";
import { entityName, moreInfo, type HomeAssistant } from "../ha";
import {
  ambientsFor, colorsOf, internalSensor, isActive, probesFor, shortNames, statusOf, swatch, type Ambient, type Probe,
} from "../sous-chef";
import { featureStyles } from "./styles";
import { probeEntities, SousChefFeature } from "./base";
import { channels, Controls, degrees, pill, preset, ring, shown, status, swatchOf } from "./parts";

const alarmOn = (hass: HomeAssistant, ambient: Ambient) => hass.states[ambient.alarm]?.state === "on";

/**
 * The ambient sensors and their alarms. The tile card's own entity is in its
 * header, so for it only its alarm shows, while it is on.
 */
export class SousChefAmbient extends SousChefFeature {
  static override tag = FEATURES.ambient;
  static override pickerName = "Sous Chef ambient";

  static override styles = [
    featureStyles,
    css`
      .ambient {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sc-gap);
      }
      .ambient button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        min-height: 32px;
        padding: 0 12px;
        border-radius: var(--sc-radius);
        background: var(--sc-surface);
        font-size: 13px;
      }
    `,
  ];

  private get _ambients(): Ambient[] {
    return this.hass ? ambientsFor(this.hass, this._config?.ambient) : [];
  }

  protected override watched(): string[] {
    return this._ambients.flatMap((a) => [a.sensor, a.alarm]);
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this.hass;
    if (!hass) return nothing;
    const own = this.context?.entity_id;
    const shownHere = this._ambients.filter((a) => a.sensor !== own || alarmOn(hass, a));
    if (!shownHere.length) return nothing;
    return html`<div class="ambient">
      ${shownHere.map((a) => html`<button class="num" @click=${() => moreInfo(this, alarmOn(hass, a) ? a.alarm : a.sensor)}>
        <span>${entityName(hass, a.sensor)}</span>
        ${a.sensor !== own ? html`<span class="secondary">${shown(hass, a.sensor)}</span>` : nothing}
        ${alarmOn(hass, a) ? pill("alarm") : nothing}
      </button>`)}
    </div>`;
  }
}

/**
 * A switch for each probe (its Active switch), and a ring and a row for each
 * probe that is on. Tapping a row opens that probe's preset and channels.
 */
export class SousChefProbes extends SousChefFeature {
  static override properties = { ...SousChefFeature.properties, _open: { state: true } };
  static override tag = FEATURES.probes;
  static override pickerName = "Sous Chef probes";

  static override styles = [
    featureStyles,
    css`
      .probes {
        display: grid;
        gap: var(--sc-gap);
      }
      ha-control-button-group {
        --control-button-group-spacing: 6px;
        height: var(--feature-height, 42px);
      }
      ha-control-button {
        --control-button-border-radius: var(--sc-radius);
        --control-button-padding: 0 6px;
        font-size: 12px;
      }
      ha-control-button .face {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        opacity: 0.55;
      }
      ha-control-button.on {
        --control-button-background-color: var(--swatch-on);
        --control-button-background-opacity: 0.25;
      }
      ha-control-button.on .face {
        opacity: 1;
        font-weight: 600;
      }
      .face .name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .rings {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sc-gap);
      }
      .row {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        box-sizing: border-box;
        min-height: 36px;
        padding: 6px 10px;
        border-radius: var(--sc-radius);
        background: var(--sc-surface);
        font-size: 13px;
      }
      .row .grow {
        flex: 1;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .panel {
        display: grid;
        gap: var(--sc-gap);
        padding: var(--sc-gap);
        border: 1px solid var(--divider-color);
        border-radius: var(--sc-radius);
      }
      .empty {
        color: var(--secondary-text-color);
        font-size: 13px;
        padding: 4px 2px;
      }
    `,
  ];

  // The probe whose preset and channels are open
  private _open?: string;
  private _controls = new Controls();

  private get _probes(): Probe[] {
    return this.hass ? probesFor(this.hass, this._config?.probes) : [];
  }

  protected override watched(): string[] {
    return this._probes.flatMap(probeEntities);
  }

  private _toggle(probe: Probe): void {
    this.hass?.callService("switch", "toggle", { entity_id: probe.entities.active });
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this.hass;
    if (!hass) return nothing;
    const probes = this._probes;
    if (!probes.length) return nothing;
    const names = shortNames(probes.map((p) => p.name));
    const nameOf = new Map(probes.map((p, i) => [p.device, names[i]]));
    const active = probes.filter((p) => isActive(hass, p));
    return html`<div class="probes">
      <ha-control-button-group>
        ${probes.map((p) => {
          const on = isActive(hass, p);
          return html`<ha-control-button class=${on ? "on" : ""} .label=${`${p.name}: ${on ? "on" : "off"}`}
            style=${styleMap({ "--swatch-on": colorsOf(p)[0] })} @click=${() => this._toggle(p)}>
            <span class="face"><span class="swatch" style=${styleMap({ "--swatch": swatch(colorsOf(p)) })}></span>
              <span class="name">${nameOf.get(p.device)}</span></span>
          </ha-control-button>`;
        })}
      </ha-control-button-group>
      ${active.length
        ? html`<div class="rings">${active.map((p) => ring(hass, p, this, true))}</div>
          ${active.map((p) => this._row(hass, p, nameOf.get(p.device)!))}`
        : html`<div class="empty">No active probes.</div>`}
    </div>`;
  }

  private _row(hass: HomeAssistant, probe: Probe, name: string): TemplateResult {
    const e = probe.entities;
    const open = this._open === probe.device;
    const reading = !["off", "no_reading"].includes(statusOf(hass, probe));
    return html`<button class="row num" aria-expanded=${open ? "true" : "false"}
        @click=${() => (this._open = open ? undefined : probe.device)}>
        ${swatchOf(probe)}
        <span class="grow">${name} · ${shown(hass, e.food_type)} · ${reading ? `${degrees(hass, internalSensor(hass, probe))} / ` : ""}${shown(hass, e.target)}</span>
        <span class="secondary">${status(hass, probe, this.timeFormat)}</span>
      </button>
      ${open ? html`<div class="panel">${preset(hass, probe, this._controls, this)}${channels(hass, probe, this)}</div>` : nothing}`;
  }
}
