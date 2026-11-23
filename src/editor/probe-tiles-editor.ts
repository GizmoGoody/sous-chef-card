// The Sous Chef probes feature's editor: the features of each probe's tile,
// in Home Assistant's own features editor (as the grill's Features): add,
// remove, reorder, and the pencil opens each one's own editor. Without a
// probe to show them for, it says where probes are added.
//
// Built once: Home Assistant's own hass is handed to it, and its context
// object is kept while the probe it is for stays the same, so it does not
// check every feature again on each state change.
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { MANAGE_PATH } from "../const";
import { fire, same, type Config, type FeatureContext, type HomeAssistant } from "../ha";
import { defaultProbeFeatures, probeFeaturesOf } from "../card/options";
import { allProbes } from "../sous-chef";

export class SousChefProbeTilesEditor extends LitElement {
  private _hass?: HomeAssistant;
  private _config?: Config;
  private _context?: FeatureContext;

  set hass(hass: HomeAssistant) {
    const first = !this._hass;
    this._hass = hass;
    // A probe's food type, so Home Assistant offers the features for a probe
    const entity = allProbes(hass)[0]?.entities.food_type;
    if (entity !== this._context?.entity_id) {
      this._context = entity ? { entity_id: entity } : undefined;
      this.requestUpdate();
    } else if (first) this.requestUpdate();
    const editor = this.shadowRoot?.querySelector<HTMLElement & { hass?: HomeAssistant }>("hui-card-features-editor");
    if (editor) editor.hass = hass;
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  // The grill's context: the features are offered for a probe instead
  set context(_context: FeatureContext) {}

  setConfig(config: Config): void {
    if (this._config && same(config, this._config)) return;
    this._config = config;
    this.requestUpdate();
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this._hass || !this._config) return nothing;
    if (!this._context) {
      return html`<ha-alert alert-type="info">Add a probe in <a href=${MANAGE_PATH} target="_blank" rel="noreferrer">Sous Chef</a>
        to choose the features each probe shows.</ha-alert>`;
    }
    return html`<hui-card-features-editor .hass=${this._hass} .context=${this._context} .features=${probeFeaturesOf(this._config)}
      label="Each probe's features" @features-changed=${this._changed} @edit-detail-element=${this._edit}></hui-card-features-editor>`;
  }

  /** The features as chosen; at the defaults, nothing is written. */
  private _save(features: Config[]): void {
    const config: Config = { type: this._config!.type };
    if (!same(features, defaultProbeFeatures())) config.features = features;
    this._config = config;
    fire(this, "config-changed", { config });
    this.requestUpdate();
  }

  private _changed = (ev: CustomEvent): void => {
    ev.stopPropagation();
    this._save(ev.detail.features ?? []);
  };

  /** A feature's pencil: its own editor, as the grill's Features open one (Home Assistant's sub-editor, with Back). */
  private _edit = (ev: CustomEvent): void => {
    ev.stopPropagation();
    const index: number = ev.detail.subElementConfig.index;
    fire(this, "edit-sub-element", {
      config: probeFeaturesOf(this._config)[index], context: this._context, type: "feature",
      saveConfig: (feature: Config) => {
        const next = [...probeFeaturesOf(this._config)];
        next[index] = feature;
        this._save(next);
      },
    });
  };
}
