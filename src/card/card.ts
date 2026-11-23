// custom:sous-chef-card: the grill and its probes on one surface, as the SVS
// Subwoofer panel card holds a group and its subwoofers. The grill (an
// ambient sensor) is Home Assistant's tile card, with every tile card
// option; its features include Sous Chef probes, a tile for each probe that
// is on. A tap on the grill folds the card to its title row and opens it
// again, and this browser remembers which. The style's finish covers the
// whole card.
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { EDITOR_TYPE, TILE_TYPE } from "../const";
import type { Config, HomeAssistant } from "../ha";
import { finishOf } from "../grill/finishes";
import { checkConfig, grillConfig, optionOf, stubConfig } from "./options";
import { cardStyles } from "./styles";
import type { SousChefTile } from "./tile";

// Whether each card is open in the editor's preview, while the editor is open
const PREVIEW_OPEN = new Map<string, boolean>();

export class SousChefCard extends LitElement {
  static override styles = cardStyles;

  private _config?: Config;
  private _hass?: HomeAssistant;
  private _open = true;
  private _preview = false;
  private _grill?: SousChefTile;

  static getConfigElement(): HTMLElement {
    return document.createElement(EDITOR_TYPE);
  }

  /** A new card: the first grill, with the probes' keys beside its name, its history, its alarms and its probes. */
  static getStubConfig(hass: HomeAssistant): Config {
    return stubConfig(hass);
  }

  setConfig(config: Config): void {
    checkConfig(config);
    this._config = config;
    this._grill ??= document.createElement(TILE_TYPE) as SousChefTile;
    this._grill.kind = "grill";
    this._grill.grillIcon = optionOf(config, "grill_icon");
    this._open = optionOf(config, "fold") === false ? true
      : this._preview ? PREVIEW_OPEN.get(config.entity) ?? true : this._storedOpen() ?? true;
    this._grill.setConfig(grillConfig(config, this._open));
    if (this._hass) this._grill.hass = this._hass;
    this.requestUpdate();
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (this._grill) this._grill.hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  // In the editor's preview the card starts open, and changes only when tapped
  set preview(value: boolean) {
    const was = this._preview;
    this._preview = value;
    if (this._grill) this._grill.preview = value;
    if (!this._config || value === was || optionOf(this._config, "fold") === false) return;
    this._open = value ? PREVIEW_OPEN.get(this._config.entity) ?? true : this._storedOpen() ?? true;
    this._grill?.setConfig(grillConfig(this._config, this._open));
    this.requestUpdate();
  }

  get preview(): boolean {
    return this._preview;
  }

  getCardSize(): number {
    return this._grill?.getCardSize() ?? 1;
  }

  /** Half a section wide by default, as tall as its content. */
  getGridOptions(): Config {
    return { columns: 12, min_columns: 6, rows: "auto" };
  }

  // Whether the card is open is remembered in this browser, per grill
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
    this._grill?.setConfig(grillConfig(this._config!, this._open));
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
      // The history graph's screen, in the finish's colors
      "--sc-screen": finish?.screen.background, "--sc-screen-solid": finish?.screen.solid, "--sc-screen-text": finish?.screen.text,
      "--sc-screen-secondary": finish?.screen.secondary, "--sc-screen-grid": finish?.screen.grid,
    };
    return html`<div class=${classMap({
      panel: true, open: this._open, finished: !!finish, dark: finish?.tone === "dark", light: finish?.tone === "light",
      solid: !!finish && features !== "match",
    })} style=${styleMap(style)} @ll-custom=${this._toggle}>${this._grill ?? nothing}</div>`;
  }
}
