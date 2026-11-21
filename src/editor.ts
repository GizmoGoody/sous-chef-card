// The card's editor: the probes and ambient sensors to show, a Manage link to
// the Sous Chef page, and Home Assistant's own tile card editor for
// everything else (its features included).
import { css, html, LitElement, type TemplateResult } from "lit";
import { DOMAIN, MANAGE_PATH, OWN_KEYS } from "./const";
import { fire, type Config, type HomeAssistant } from "./ha";
import { ambients } from "./sous-chef";

type TileEditor = HTMLElement & { hass?: HomeAssistant; lovelace?: unknown; setConfig(config: Config): void };
type TileCard = { getConfigElement(): Promise<TileEditor> };

/** The tile card editor's configuration: the card's, without its own options. */
function tileEditorConfig(config: Config): Config {
  const tile: Config = { ...config, type: "tile" };
  for (const key of OWN_KEYS) delete tile[key];
  return tile;
}

const label = (s: Config) => s.label;
const helper = (s: Config) => s.helper;

export class SousChefCardEditor extends LitElement {
  static override styles = css`
    .sous-chef {
      display: grid;
      gap: 8px;
      margin-bottom: 24px;
    }
    .manage {
      justify-self: start;
    }
  `;

  private _hass?: HomeAssistant;
  private _config?: Config;
  private _lovelace?: unknown;
  private _tileEditor?: TileEditor;
  private _loading?: Promise<void>;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    if (this._tileEditor) this._tileEditor.hass = hass;
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  set lovelace(lovelace: unknown) {
    this._lovelace = lovelace;
    if (this._tileEditor) this._tileEditor.lovelace = lovelace;
  }

  get lovelace(): unknown {
    return this._lovelace;
  }

  setConfig(config: Config): void {
    this._config = config;
    this._setTileEditorConfig();
    this.requestUpdate();
  }

  private async _setTileEditorConfig(): Promise<void> {
    this._loading ??= this._loadTileEditor();
    await this._loading;
    if (this._config) this._tileEditor?.setConfig(tileEditorConfig(this._config));
  }

  /** Home Assistant's tile card editor, loaded as the tile card loads it. */
  private async _loadTileEditor(): Promise<void> {
    const helpers = await window.loadCardHelpers!();
    helpers.createCardElement({ type: "tile", entity: this._config?.entity });
    await customElements.whenDefined("hui-tile-card");
    const editor = await (customElements.get("hui-tile-card") as unknown as TileCard).getConfigElement();
    editor.addEventListener("config-changed", (ev) => {
      // The tile card's options changed: keep the card's own and pass the whole card on
      ev.stopPropagation();
      const c = this._config!;
      const own = Object.fromEntries(OWN_KEYS.filter((k) => k in c).map((k) => [k, c[k]]));
      this._config = { ...(ev as CustomEvent).detail.config, ...own, type: c.type };
      this._fire();
    });
    if (this._hass) editor.hass = this._hass;
    if (this._lovelace) editor.lovelace = this._lovelace;
    this._tileEditor = editor;
    this.requestUpdate();
  }

  private _schema(): Config[] {
    const sensors = this._hass ? ambients(this._hass).map((a) => a.sensor) : [];
    return [
      {
        name: "probes", label: "Probes",
        selector: { device: { multiple: true, entity: [{ integration: DOMAIN, domain: "switch" }] } },
      },
      {
        name: "ambient", label: "Ambient sensors",
        helper: sensors.length ? undefined : "Add ambient sensors on the Sous Chef page.",
        selector: { entity: { multiple: true, include_entities: sensors, filter: [{ domain: "sensor" }] } },
      },
    ];
  }

  protected override render(): TemplateResult {
    const c = this._config ?? {};
    return html`
      <div class="sous-chef">
        <ha-form .hass=${this._hass} .schema=${this._schema()} .data=${{ probes: c.probes ?? [], ambient: c.ambient ?? [] }}
          .computeLabel=${label} .computeHelper=${helper} @value-changed=${this._changed}></ha-form>
        <ha-button class="manage" appearance="plain" href=${MANAGE_PATH} target="_blank" rel="noopener">Manage</ha-button>
      </div>
      ${this._tileEditor ?? ""}`;
  }

  private _changed(ev: CustomEvent): void {
    ev.stopPropagation();
    const value = ev.detail.value ?? {};
    const next: Config = { ...this._config };
    for (const key of OWN_KEYS) {
      if (Array.isArray(value[key]) && value[key].length) next[key] = value[key];
      else delete next[key];
    }
    this._config = next;
    this._fire();
    this.requestUpdate();
  }

  private _fire(): void {
    fire(this, "config-changed", { config: this._config });
  }
}
