// The Sous Chef probes feature's editor: the probe features, in Home
// Assistant's own features editor (as the grill's Features): add, remove,
// reorder, and the pencil opens each one's own editor. Without a probe to
// show them for, it says where probes are added.
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { MANAGE_PATH } from "../const";
import { fire, same, type Config, type FeatureContext, type HomeAssistant } from "../ha";
import { probeFeaturesOf } from "../features/probes";
import { allProbes } from "../sous-chef";

export class SousChefProbesEditor extends LitElement {
  private _hass?: HomeAssistant;
  private _config?: Config;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  // The grill's context: the probe features are offered for a probe instead
  set context(_context: FeatureContext) {
    this.requestUpdate();
  }

  setConfig(config: Config): void {
    this._config = config;
    this.requestUpdate();
  }

  /** A probe's context, so Home Assistant offers the features for a probe: the first probe's food type. */
  private _context(): FeatureContext | undefined {
    const probe = this._hass ? allProbes(this._hass)[0] : undefined;
    const entity = probe?.entities.food_type;
    return entity ? { entity_id: entity } : undefined;
  }

  protected override render(): TemplateResult | typeof nothing {
    if (!this._hass || !this._config) return nothing;
    const context = this._context();
    if (!context) {
      return html`<ha-alert alert-type="info">Add a probe in <a href=${MANAGE_PATH} target="_blank" rel="noreferrer">Sous Chef</a>
        to choose the features each probe shows.</ha-alert>`;
    }
    return html`<hui-card-features-editor .hass=${this._hass} .context=${context} .features=${probeFeaturesOf(this._config)}
      label="Each probe's features" @features-changed=${this._changed} @edit-detail-element=${this._edit}></hui-card-features-editor>`;
  }

  /** The features as chosen; at the defaults, nothing is written. */
  private _save(features: Config[]): void {
    const config: Config = { type: this._config!.type };
    if (!same(features, probeFeaturesOf())) config.features = features;
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
    const features = probeFeaturesOf(this._config);
    fire(this, "edit-sub-element", {
      config: features[index], context: this._context(), type: "feature",
      saveConfig: (feature: Config) => {
        const next = probeFeaturesOf(this._config).concat();
        next[index] = feature;
        this._save(next);
      },
    });
  };
}
