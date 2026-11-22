// custom:sous-chef-card: the grill and its probes on one surface, as the SVS
// Subwoofer panel card holds a group and its subwoofers. The grill (an
// ambient sensor) is Home Assistant's tile card, with every tile card
// option; below it, one tile card for each probe that is on. A tap on the
// grill shows or hides the probes, and this browser remembers which. The
// style's finish covers the whole card.
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { EDITOR_TYPE, TILE_TYPE } from "../const";
import type { Config, HomeAssistant } from "../ha";
import { finishOf } from "../grill/finishes";
import { allProbes, isActive, probeNames, type Probe } from "../sous-chef";
import { checkConfig, grillConfig, optionOf, probeConfig, stubConfig } from "./options";
import { cardStyles } from "./styles";
import type { SousChefTile } from "./tile";

// Whether each card's probes are shown in the editor's preview, while the editor is open
const PREVIEW_OPEN = new Map<string, boolean>();

export class SousChefCard extends LitElement {
  static override styles = cardStyles;

  private _config?: Config;
  private _hass?: HomeAssistant;
  private _open = true;
  private _preview = false;
  private _grill?: SousChefTile;
  // One tile per probe that is on, kept by device while it stays on
  private _probes = new Map<string, SousChefTile>();
  private _shown: string[] = [];

  static getConfigElement(): HTMLElement {
    return document.createElement(EDITOR_TYPE);
  }

  /** A new card: the first grill, with the probes beside its name, its history and its alarms. */
  static getStubConfig(hass: HomeAssistant): Config {
    return stubConfig(hass);
  }

  setConfig(config: Config): void {
    checkConfig(config);
    this._config = config;
    this._grill ??= document.createElement(TILE_TYPE) as SousChefTile;
    this._grill.kind = "grill";
    this._grill.grillIcon = optionOf(config, "grill_icon");
    this._grill.setConfig(grillConfig(config));
    if (this._hass) this._grill.hass = this._hass;
    this._open = optionOf(config, "probes_toggle") === false ? true
      : this._preview ? PREVIEW_OPEN.get(config.entity) ?? true : this._storedOpen() ?? true;
    this._shown = [];
    this._syncProbes();
    this.requestUpdate();
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (this._grill) this._grill.hass = hass;
    this._syncProbes();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  // In the editor's preview the card starts with its probes shown, and changes only when tapped
  set preview(value: boolean) {
    const was = this._preview;
    this._preview = value;
    if (this._grill) this._grill.preview = value;
    for (const tile of this._probes.values()) tile.preview = value;
    if (!this._config || value === was || optionOf(this._config, "probes_toggle") === false) return;
    this._open = value ? PREVIEW_OPEN.get(this._config.entity) ?? true : this._storedOpen() ?? true;
    this.requestUpdate();
  }

  get preview(): boolean {
    return this._preview;
  }

  getCardSize(): number {
    return 1 + (this._config?.features?.length ?? 0) * 2 + (this._open ? this._shown.length * 3 : 0);
  }

  /** Half a section wide by default, as tall as its content. */
  getGridOptions(): Config {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  /** The probes that are on, each a tile card, made once and kept while it stays on. */
  private _syncProbes(): void {
    const hass = this._hass, config = this._config;
    if (!hass || !config) return;
    const probes = allProbes(hass);
    const names = probeNames(probes);
    const on: Probe[] = probes.filter((p) => isActive(hass, p));
    const shown = on.map((p) => `${p.device}|${names.get(p.device)}|${p.colors.join(",")}|${p.entities.food_type}`);
    for (const p of on) {
      let tile = this._probes.get(p.device);
      const fresh = !tile;
      if (!tile) {
        tile = document.createElement(TILE_TYPE) as SousChefTile;
        tile.kind = "probe";
        tile.preview = this._preview;
        this._probes.set(p.device, tile);
      }
      if (fresh || shown.join() !== this._shown.join()) tile.setConfig(probeConfig(p, names.get(p.device)!));
      tile.hass = hass;
    }
    for (const device of [...this._probes.keys()]) if (!on.some((p) => p.device === device)) this._probes.delete(device);
    if (shown.join() !== this._shown.join()) {
      this._shown = shown;
      this.requestUpdate();
    }
  }

  // Whether the probes are shown is remembered in this browser, per grill
  private get _storageKey(): string {
    return `sous-chef-card:${this._config?.entity}`;
  }

  private _storedOpen(): boolean | undefined {
    try {
      const v = window.localStorage.getItem(this._storageKey);
      return v === null ? undefined : v === "1";
    } catch {
      return undefined;
    }
  }

  private _toggle = (ev: CustomEvent): void => {
    if (ev.detail?.sous_chef_card !== "toggle") return;
    ev.stopPropagation();
    this._open = !this._open;
    if (this._preview) PREVIEW_OPEN.set(this._config!.entity, this._open);
    else {
      try {
        window.localStorage.setItem(this._storageKey, this._open ? "1" : "0");
      } catch {
        // Storage can be unavailable (private windows); the card still works
      }
    }
    this.requestUpdate();
  };

  protected override render(): TemplateResult | typeof nothing {
    const c = this._config;
    if (!c) return nothing;
    const finish = finishOf(optionOf(c, "style"));
    const features = finish ? optionOf(c, "features_style") : "match";
    const style = {
      "--sc-surface": finish?.surface, "--sc-border": finish?.border, "--sc-base": finish?.base,
      "--sc-features-style": features, "--sc-badge-ring": finish ? "rgba(0, 0, 0, .55)" : undefined,
    };
    const tiles = this._shown.map((key) => this._probes.get(key.split("|")[0])).filter((t): t is SousChefTile => !!t);
    return html`<div class=${classMap({
      panel: true, open: this._open, finished: !!finish, dark: finish?.tone === "dark", light: finish?.tone === "light",
      solid: !!finish && features !== "match",
    })} style=${styleMap(style)} @ll-custom=${this._toggle}>
      ${this._grill ?? nothing}
      <div class="probes">${tiles}</div>
    </div>`;
  }
}
