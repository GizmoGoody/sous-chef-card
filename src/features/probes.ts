// Sous Chef probes: a tile for each probe that is on, as a feature of the
// grill, so it takes its place among the grill's features (or is left out).
// Each probe is Home Assistant's tile card (see card/tile.ts), with the
// probe features chosen in this feature's editor, in that order: Home
// Assistant's own features editor, as the grill's Features.
import { css, html, nothing, type TemplateResult } from "lit";
import { FEATURES, PROBE_FEATURES, PROBES_EDITOR_TYPE, TILE_TYPE } from "../const";
import type { Config } from "../ha";
import { probeConfig } from "../card/options";
import type { SousChefTile } from "../card/tile";
import { allProbes, isActive, probeNames, type Probe } from "../sous-chef";
import { SousChefFeature } from "./base";

/** The probe features shown: as chosen, or progress, cook, channels and timing. */
export const probeFeaturesOf = (config?: Config): Config[] =>
  Array.isArray(config?.features) ? config!.features : PROBE_FEATURES.map((type) => ({ type: `custom:${type}` }));

export class SousChefProbeTiles extends SousChefFeature {
  static override tag = FEATURES.probes;
  static override pickerName = "Sous Chef probes";
  static override forKind = "grill" as const;

  static override getConfigElement(): HTMLElement {
    return document.createElement(PROBES_EDITOR_TYPE);
  }

  static override get configurable(): boolean {
    return true;
  }

  // As wide as the grill's tile: each probe's tile has its own padding
  static override styles = css`
    :host { display: block; margin: 0 calc(-1 * var(--ha-space-3, 12px)); }
    .tiles { display: grid; }
  `;

  // One tile per probe that is on, kept by device while it stays on
  private _tiles = new Map<string, SousChefTile>();
  private _key = "";

  protected override watched(): string[] {
    const hass = this._hass;
    return hass ? allProbes(hass).flatMap((p) => [...Object.values(p.entities), ...p.channels, ...(p.internal ? [p.internal] : [])])
      .filter((id): id is string => !!id) : [];
  }

  protected override render(): TemplateResult | typeof nothing {
    const hass = this._hass!;
    const probes = allProbes(hass);
    const names = probeNames(probes);
    const on: Probe[] = this.ambient ? probes.filter((p) => isActive(hass, p)) : [];
    this.showNothing(!on.length);
    if (!on.length) return nothing;
    const features = probeFeaturesOf(this._config);
    // The tiles' configurations change when a probe comes or goes, is renamed, or the features change
    const key = JSON.stringify([on.map((p) => [p.device, names.get(p.device), p.colors, p.entities.food_type]), features]);
    const fresh = key !== this._key;
    this._key = key;
    for (const p of on) {
      let tile = this._tiles.get(p.device);
      if (!tile) {
        tile = document.createElement(TILE_TYPE) as SousChefTile;
        tile.kind = "probe";
        this._tiles.set(p.device, tile);
        tile.setConfig(probeConfig(p, names.get(p.device)!, features));
      } else if (fresh) tile.setConfig(probeConfig(p, names.get(p.device)!, features));
      tile.hass = hass;
    }
    for (const device of [...this._tiles.keys()]) if (!on.some((p) => p.device === device)) this._tiles.delete(device);
    return html`<div class="tiles">${on.map((p) => this._tiles.get(p.device))}</div>`;
  }
}
