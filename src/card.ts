// custom:sous-chef-card is Home Assistant's tile card, wrapped: the tile card
// draws the name, state, icon, actions and features, so every tile card
// option works the same way. The card adds its probes and ambient sensors,
// which it hands to its Sous Chef features.
import { css, LitElement, nothing } from "lit";
import { EDITOR_TYPE, OWN_KEYS } from "./const";
import type { Config, HomeAssistant } from "./ha";
import { stubConfig, tileConfig } from "./options";

type Tile = HTMLElement & {
  setConfig(config: Config): void; hass?: HomeAssistant; preview?: boolean; layout?: string;
  getCardSize?(): number | Promise<number>; getGridOptions?(): Config;
};

export class SousChefCard extends LitElement {
  static override styles = css`
    :host {
      display: block;
      height: 100%;
    }
    hui-tile-card {
      height: 100%;
    }
  `;

  private _config?: Config;
  private _hass?: HomeAssistant;
  private _tile?: Tile;
  private _preview?: boolean;
  private _layout?: string;

  static getConfigElement(): HTMLElement {
    return document.createElement(EDITOR_TYPE);
  }

  static getStubConfig(hass: HomeAssistant): Config {
    return stubConfig(hass);
  }

  setConfig(config: Config): void {
    if (!config) throw new Error("Invalid configuration");
    for (const key of OWN_KEYS) {
      if (config[key] !== undefined && !Array.isArray(config[key])) throw new Error(`${key} must be a list`);
    }
    this._config = config;
    const tile = tileConfig(config);
    if (this._tile) {
      this._tile.setConfig(tile);
    } else if (customElements.get("hui-tile-card")) {
      this._createTile(tile);
    } else {
      // Home Assistant loads the tile card when it is first used; its card helpers do that
      window.loadCardHelpers?.().then(async (helpers) => {
        helpers.createCardElement({ type: "tile", entity: tile.entity });
        await customElements.whenDefined("hui-tile-card");
        if (!this._tile && this._config) this._createTile(tileConfig(this._config));
      });
    }
  }

  private _createTile(config: Config): void {
    const tile = document.createElement("hui-tile-card") as Tile;
    tile.setConfig(config);
    if (this._hass) tile.hass = this._hass;
    if (this._preview !== undefined) tile.preview = this._preview;
    if (this._layout !== undefined) tile.layout = this._layout;
    this._tile = tile;
    this.requestUpdate();
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (this._tile) this._tile.hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  set preview(value: boolean) {
    this._preview = value;
    if (this._tile) this._tile.preview = value;
  }

  get preview(): boolean {
    return !!this._preview;
  }

  set layout(value: string) {
    this._layout = value;
    if (this._tile) this._tile.layout = value;
  }

  get layout(): string | undefined {
    return this._layout;
  }

  getCardSize(): number | Promise<number> {
    return this._tile?.getCardSize?.() ?? 1 + (this._config?.features?.length ?? 0);
  }

  /** The tile card's columns, and a height that follows the content: the Sous Chef features are taller than one row. */
  getGridOptions(): Config {
    const options: Config = { ...(this._tile?.getGridOptions?.() ?? { columns: 6 }), rows: "auto" };
    delete options.min_rows;
    return options;
  }

  protected override render(): unknown {
    return this._tile ?? nothing;
  }
}
