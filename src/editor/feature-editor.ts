// The features' editor: one element; the form is the feature's (its static
// editor), as in the Prusa Connect card. Only what differs from the
// feature's defaults is written.
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { fire, same, type Config, type FeatureContext, type HomeAssistant } from "../ha";
import type { SousChefFeature } from "../features/base";
import type { FeatureForm } from "../features/form";

const label = (s: Config) => s.label ?? s.name;
const helper = (s: Config) => s.helper;

export class SousChefFeatureEditor extends LitElement {
  // The features, by element name (set where they are registered)
  static features = new Map<string, typeof SousChefFeature>();

  private _hass?: HomeAssistant;
  private _context?: FeatureContext;
  private _config?: Config;

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this.requestUpdate();
  }

  get hass(): HomeAssistant | undefined {
    return this._hass;
  }

  set context(context: FeatureContext) {
    this._context = context;
    this.requestUpdate();
  }

  get context(): FeatureContext | undefined {
    return this._context;
  }

  setConfig(config: Config): void {
    this._config = config;
    this.requestUpdate();
  }

  private _form(): FeatureForm | undefined {
    const tag = `${this._config?.type ?? ""}`.replace(/^custom:/, "");
    return SousChefFeatureEditor.features.get(tag)?.editor();
  }

  protected override render(): TemplateResult | typeof nothing {
    const form = this._form();
    if (!form || !this._hass) return nothing;
    return html`<ha-form .hass=${this._hass} .schema=${form.schema} .data=${form.data(this._config!)} .computeLabel=${label}
      .computeHelper=${helper} @value-changed=${this._changed}></ha-form>`;
  }

  private _changed(ev: CustomEvent): void {
    ev.stopPropagation();
    const form = this._form();
    if (!form) return;
    const value: Config = { ...ev.detail.value };
    const defaults = form.data({ type: this._config!.type });
    for (const [key, option] of Object.entries(value)) {
      if ((key in defaults && same(option, defaults[key])) || option === undefined || option === "") delete value[key];
    }
    this._config = { type: this._config!.type, ...value };
    fire(this, "config-changed", { config: this._config });
    this.requestUpdate();
  }
}
