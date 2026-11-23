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
import { fire, same, StatesProvider, statesWith, type Config, type FeatureContext, type HomeAssistant } from "../ha";
import { defaultProbeFeatures, PROBE_BOTTOM, PROBE_TOP, probeFeaturesOf, probeLinesOf } from "../card/options";
import { allProbes, probeLine } from "../sous-chef";

const label = (s: Config) => s.label;
const helper = (s: Config) => s.helper;

export class SousChefProbeTilesEditor extends LitElement {
  private _hass?: HomeAssistant;
  private _config?: Config;
  private _context?: FeatureContext;
  // The state content pickers read the probe as the tile shows it, with its doneness and status
  private _states = new StatesProvider(this);
  private _statesKey?: string;

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
    const probe = allProbes(hass)[0], stateObj = entity ? hass.states[entity] : undefined;
    if (probe && stateObj && entity) {
      const line = probeLine(hass, probe);
      const extra = { doneness: line.doneness ?? "", status: line.status };
      const key = JSON.stringify([stateObj.last_updated, stateObj.state, extra]);
      if (key !== this._statesKey) {
        this._statesKey = key;
        this._states.states = statesWith(hass.states, entity, { ...stateObj, attributes: { ...stateObj.attributes, ...extra } });
      }
    } else if (this._statesKey !== "") {
      this._statesKey = "";
      this._states.states = hass.states;
    }
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
    const lines = probeLinesOf(this._config);
    const entity_id = this._context.entity_id;
    const schema = [
      { name: "name", label: "Name", helper: "Blank: the probe's name. Shown where a line has Name.", selector: { text: {} } },
      { name: "name_content", label: "Top line", selector: { ui_state_content: { entity_id, allow_name: true } } },
      { name: "state_content", label: "Bottom line", selector: { ui_state_content: { entity_id, allow_name: true } } },
    ];
    return html`<ha-form .hass=${this._hass} .schema=${schema} .data=${{ name: lines.name ?? "", name_content: lines.top, state_content: lines.bottom }}
        .computeLabel=${label} .computeHelper=${helper} @value-changed=${this._lines}></ha-form>
      <hui-card-features-editor .hass=${this._hass} .context=${this._context} .features=${probeFeaturesOf(this._config)}
        label="Each probe's features" @features-changed=${this._changed} @edit-detail-element=${this._edit}></hui-card-features-editor>`;
  }

  /** The name and the lines; at their defaults, nothing is written. */
  private _lines = (ev: CustomEvent): void => {
    ev.stopPropagation();
    const value = ev.detail.value ?? {};
    const config: Config = { ...this._config };
    const name = typeof value.name === "string" ? value.name.trim() : "";
    if (name) config.name = name;
    else delete config.name;
    for (const [key, fallback] of [["name_content", PROBE_TOP], ["state_content", PROBE_BOTTOM]] as const) {
      const list = Array.isArray(value[key]) ? value[key] : typeof value[key] === "string" && value[key] ? [value[key]] : [];
      if (!list.length || same(list, fallback)) delete config[key];
      else config[key] = list;
    }
    this._write(config);
  };

  private _write(config: Config): void {
    this._config = config;
    fire(this, "config-changed", { config });
    this.requestUpdate();
  }

  /** The features as chosen; at the defaults, nothing is written. */
  private _save(features: Config[]): void {
    const config: Config = { ...this._config };
    if (same(features, defaultProbeFeatures())) delete config.features;
    else config.features = features;
    this._write(config);
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
