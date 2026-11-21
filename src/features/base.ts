// What every Sous Chef feature has: Home Assistant, its context (the tile
// card's entity) and its configuration. In the Sous Chef Card, the card
// hands each feature its probes and ambient sensors; in any other tile card,
// a feature follows the card's entity, or shows every probe.
import { LitElement, type CSSResultGroup, type PropertyValues } from "lit";
import { DEFAULT_TIME_FORMAT, TIME_FORMATS } from "../const";
import type { Config, FeatureContext, HomeAssistant } from "../ha";
import { probeOfEntity, probesFor, type Probe } from "../sous-chef";
import { featureStyles } from "./styles";

export class SousChefFeature extends LitElement {
  static override properties = {
    hass: { attribute: false },
    context: { attribute: false },
    _config: { state: true },
  };

  static override styles: CSSResultGroup = featureStyles;

  // Its element's name, and its name in Home Assistant's feature picker
  static tag = "";
  static pickerName = "";

  hass?: HomeAssistant;
  context?: FeatureContext;
  protected _config?: Config;

  static getStubConfig(): Config {
    return { type: `custom:${this.tag}` };
  }

  setConfig(config: Config): void {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
  }

  /** The entities the feature shows: it draws again only when one of them changes. */
  protected watched(): string[] {
    return [];
  }

  /** The probe of a one-probe feature: the card's entity's, or the first probe chosen. */
  protected get probe(): Probe | undefined {
    if (!this.hass) return undefined;
    return probeOfEntity(this.hass, this.context?.entity_id) ?? probesFor(this.hass, this._config?.probes)[0];
  }

  /** The tile card's Time format, for Done at. */
  protected get timeFormat(): string {
    const chosen = this._config?.time_format;
    return TIME_FORMATS.includes(chosen) ? chosen : DEFAULT_TIME_FORMAT;
  }

  protected override shouldUpdate(changed: PropertyValues): boolean {
    if (changed.size !== 1 || !changed.has("hass") || !this.hass) return true;
    const old = changed.get("hass") as HomeAssistant | undefined;
    if (!old || old.entities !== this.hass.entities || old.devices !== this.hass.devices) return true;
    return this.watched().some((id) => old.states[id] !== this.hass!.states[id]);
  }
}

/** Every entity of a probe the features show. */
export const probeEntities = (probe: Probe): string[] =>
  [...Object.values(probe.entities), ...probe.channels, ...(probe.internal ? [probe.internal] : [])].filter(
    (id): id is string => !!id,
  );
