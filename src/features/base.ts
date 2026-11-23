// What every Sous Chef feature has: Home Assistant, its context (the tile
// card's entity) and its configuration. A probe's features follow the
// probe of the card's entity; the grill's follow the ambient sensor.
import { LitElement, type CSSResultGroup, type PropertyValues } from "lit";
import { FEATURE_EDITOR_TYPE } from "../const";
import type { Config, FeatureContext, HomeAssistant } from "../ha";
import { chosenOf, featureForm, type FeatureForm, type FeatureOption } from "./form";
import { ambientOf, probeOfEntity, type Ambient, type Probe } from "../sous-chef";
import { featureStyles } from "./styles";

export class SousChefFeature extends LitElement {
  static override styles: CSSResultGroup = featureStyles;

  // Its element's name, and its name in Home Assistant's feature picker
  static tag = "";
  static pickerName = "";
  // What its tile card is for: a probe, or the grill (an ambient sensor)
  static forKind: "probe" | "grill" = "probe";

  // Its controls, in their default order, as [id, name]: the editor chooses and orders them (all shown by default)
  static controls: [string, string][] = [];
  // Its other options in the editor
  static options: FeatureOption[] = [];

  static getStubConfig(): Config {
    return { type: `custom:${this.tag}` };
  }

  static getConfigElement(): HTMLElement {
    return document.createElement(FEATURE_EDITOR_TYPE);
  }

  /** Whether it has an editor: controls to choose, or options. */
  static get configurable(): boolean {
    return this.controls.length > 0 || this.options.length > 0;
  }

  /** The feature's editor form: its controls (chosen and ordered), then its options. */
  static editor(): FeatureForm {
    return featureForm(this.controls, this.options);
  }

  /** Whether Home Assistant's feature picker offers it for a tile card's entity. */
  static supports(hass: HomeAssistant | undefined, context?: FeatureContext): boolean {
    if (!hass || !context?.entity_id) return false;
    return this.forKind === "grill" ? !!ambientOf(hass, context.entity_id) : !!probeOfEntity(hass, context.entity_id);
  }

  protected _config?: Config;
  protected _hass?: HomeAssistant;
  protected _context?: FeatureContext;

  constructor() {
    super();
    // Keep taps on a control from reaching the card around it (a tap on the grill shows or hides the probes)
    for (const type of ["click", "touchstart", "touchend", "mousedown", "mouseup"]) {
      this.addEventListener(type, (ev) => ev.stopPropagation());
    }
  }

  setConfig(config: Config): void {
    if (!config) throw new Error("Invalid configuration");
    this._config = config;
    this.requestUpdate();
  }

  set hass(hass: HomeAssistant) {
    const before = this._hass;
    this._hass = hass;
    if (before && before.entities === hass.entities && before.devices === hass.devices
      && !this.watched().some((id) => before.states[id] !== hass.states[id])) return;
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

  // The class's statics, from an instance
  private get _type(): typeof SousChefFeature {
    return this.constructor as typeof SousChefFeature;
  }

  /** The controls chosen, in order (all, by default). */
  protected chosen(): string[] {
    return chosenOf(this._type.controls, this._config ?? {});
  }

  /** An option's value: the configuration's, or its default. */
  protected option<T>(name: string): T {
    return (this._config?.[name] ?? this._type.options.find((o) => o.name === name)?.default) as T;
  }

  /** The entities the feature shows: it draws again only when one of them changes. */
  protected watched(): string[] {
    const probe = this.probe;
    if (probe) return [...Object.values(probe.entities), ...probe.channels, ...(probe.internal ? [probe.internal] : [])].filter((id): id is string => !!id);
    const ambient = this.ambient;
    return ambient ? [ambient.sensor, ambient.alarm, ambient.low, ambient.high].filter((id): id is string => !!id) : [];
  }

  /** The probe of the card's entity. */
  protected get probe(): Probe | undefined {
    return this._hass ? probeOfEntity(this._hass, this._context?.entity_id) : undefined;
  }

  /** The ambient sensor that is the card's entity. */
  protected get ambient(): Ambient | undefined {
    return this._hass ? ambientOf(this._hass, this._context?.entity_id) : undefined;
  }

  protected override shouldUpdate(_changed: PropertyValues): boolean {
    return !!(this._hass && this._config && this._context);
  }

  /**
   * A feature with nothing to show shows nothing at all: neither itself nor
   * its place among the card's features (as in the Prusa Connect card).
   */
  protected showNothing(empty: boolean): void {
    const display = empty ? "none" : "";
    if (this.style.display !== display) this.style.display = display;
    const host = (this.getRootNode() as ShadowRoot)?.host as HTMLElement | undefined;
    if (host?.localName === "hui-card-feature" && host.style.display !== display) host.style.display = display;
  }

  /** Call a service, without the card around it seeing the tap. */
  protected call(domain: string, service: string, data: Record<string, unknown>): void {
    this._hass?.callService(domain, service, data);
  }
}

