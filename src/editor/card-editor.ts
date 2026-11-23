// The card's editor: the tile card's own editor for the grill (its entity
// picker offers the grills, and Content, Interactions and Features are Home
// Assistant's), then the Sous Chef section with the card's own options and
// a button to Sous Chef's page.
import { css, html, LitElement, nothing, type TemplateResult } from "lit";
import { FEATURES_STYLES, ICONS, MANAGE_PATH, STYLES } from "../const";
import { fire, same, select, StatesProvider, statesWith, type Config, type HomeAssistant } from "../ha";
import { allProbes, ambientOf, ambients, grillLine } from "../sous-chef";
import { minimal, optionOf, OWN_KEYS, tileConfig } from "../card/options";
import { createTileEditor, type TileEditor } from "./tile-editor";

const label = (s: Config) => s.label ?? s.name;
const helper = (s: Config) => s.helper;

/** The card's own options, as the form shows them: Features style only with a style. */
function schemaFor(style: string): Config[] {
  return [
    { name: "style", label: "Style", helper: "A grill's finish behind the whole card. None follows your theme.", selector: select(STYLES) },
    {
      name: "grill_icon", label: "Icon",
      helper: "The grill icon, or the mark of Bull, Weber, Traeger, Big Green Egg or Kamado Joe.", selector: select(ICONS),
    },
    ...(style === "none" ? [] : [{
      name: "features_style", label: "Features style",
      helper: "Match: the controls sit on the finish. Flat: on a plain patch of it. Console: keys that press in.",
      selector: select(FEATURES_STYLES),
    }]),
    { name: "probes_toggle", label: "Tap the card to show or hide the probes", selector: { boolean: {} } },
  ];
}

export class SousChefCardEditor extends LitElement {
  static override styles = css`
    ha-expansion-panel {
      display: block; margin-top: 24px; --expansion-panel-content-padding: 0;
      border-radius: var(--ha-border-radius-md, 8px); --ha-card-border-radius: var(--ha-border-radius-md, 8px);
    }
    ha-expansion-panel > [slot="header"] { margin: 0; font-size: inherit; font-weight: inherit; }
    .content { padding: 12px; display: grid; gap: 16px; }
    .manage { justify-self: start; }
  `;

  private _hass?: HomeAssistant;
  private _config?: Config;
  private _lovelace?: unknown;
  private _tileEditor?: TileEditor;
  private _loading?: Promise<void>;
  private _statesProvider = new StatesProvider(this);

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this._setTileEditorHass();
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
    if (this._config && same(config, this._config)) return;
    this._config = config;
    this._setTileEditorConfig();
    this.requestUpdate();
  }

  /**
   * The tile editor gets Home Assistant's own hass, as in the Prusa Connect
   * card: a new copy on every state change would draw its fields again
   * while they are edited (the name lost its changes). The states context,
   * which its State content picker reads, carries the grill's cook.
   */
  private _setTileEditorHass(): void {
    const hass = this._hass, entity = this._config?.entity;
    if (!hass) return;
    const stateObj = entity ? hass.states[entity] : undefined;
    this._statesProvider.states = stateObj
      ? statesWith(hass.states, entity, { ...stateObj, attributes: { ...stateObj.attributes, cook: grillLine(hass, ambientOf(hass, entity), allProbes(hass)) } })
      : hass.states;
    if (!this._tileEditor) return;
    this._tileEditor.hass = hass;
    this._tileEditor.scEntities = ambients(hass).map((a) => a.sensor);
  }

  private async _setTileEditorConfig(): Promise<void> {
    if (!this._config) return;
    this._loading ??= (async () => {
      const editor = await createTileEditor(this._config!.entity);
      editor.addEventListener("config-changed", (ev) => {
        // The tile card's options changed: keep the card's own and pass the whole card on
        ev.stopPropagation();
        const c = this._config!;
        const own = Object.fromEntries(OWN_KEYS.filter((k) => k in c).map((k) => [k, c[k]]));
        const next: Config = { ...(ev as CustomEvent).detail.config, ...own, type: c.type };
        delete next.show_entity_picture;
        this._config = next;
        this._fire();
        this.requestUpdate();
        // The tile editor shows a change once it is handed back (as a dashboard's editor does), as in the Prusa Connect card
        editor.setConfig(tileConfig(next));
      });
      editor.scEntityHelper = "The grill: a Sous Chef ambient sensor.";
      if (this._lovelace) editor.lovelace = this._lovelace;
      this._tileEditor = editor;
      this._setTileEditorHass();
      this.requestUpdate();
    })();
    await this._loading;
    this._setTileEditorHass();
    this._tileEditor!.setConfig(tileConfig(this._config));
  }

  protected override render(): TemplateResult | typeof nothing {
    const c = this._config;
    if (!c) return nothing;
    const data = Object.fromEntries(OWN_KEYS.map((key) => [key, optionOf(c, key)]));
    return html`${this._tileEditor ?? nothing}
      <ha-expansion-panel outlined expanded>
        <div slot="header" role="heading" aria-level="3">Sous Chef</div>
        <div class="content">
          <ha-form .hass=${this._hass} .schema=${schemaFor(data.style)} .data=${data} .computeLabel=${label}
            .computeHelper=${helper} @value-changed=${this._changed}></ha-form>
          <ha-button class="manage" href=${MANAGE_PATH} target="_blank" rel="noopener">Manage Sous Chef<ha-icon slot="end" icon="mdi:arrow-right"></ha-icon></ha-button>
        </div>
      </ha-expansion-panel>`;
  }

  private _changed = (ev: CustomEvent): void => {
    ev.stopPropagation();
    const value = ev.detail.value ?? {};
    const next: Config = { ...this._config };
    for (const key of OWN_KEYS) if (key in value) next[key] = value[key];
    if (next.style === "none" || next.style === undefined) delete next.features_style;
    this._config = minimal(next);
    this.requestUpdate();
    this._fire();
  };

  private _fire(): void {
    fire(this, "config-changed", { config: this._config });
  }
}
