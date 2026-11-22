// sous-chef-tile: Home Assistant's tile card, wrapped, for the grill or one
// probe inside the card. The tile card still draws the name, state, icon,
// actions and features, so every tile card option works the same way. It adds:
// - the grill's icon (the grill, or a brand's mark), in orange once lit;
// - the state line's parts as attributes for State content: the grill's
//   cook ("1 probe on", "Red is done"), and a probe's doneness and status;
// - a badge on the icon: alarm, done or stalled;
// - a probe's features two to a row, the last alone across both.
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import { BADGES, FEATURE_TAGS, GRILL_COLOR } from "../const";
import { adopt, cssColor, findAllDeep, sheetOf, StatesProvider, statesWith, type Config, type HassEntity, type HomeAssistant } from "../ha";
import { BRAND_IMAGES } from "../grill/brand-images";
import {
  allProbes, ambientOf, badgeOf, grillBadge, grillLine, probeLine, probeOfEntity, statusOf, valueOf,
} from "../sous-chef";
import { ICON_SHEET, PLAIN_SHEET, TILE_SHEET, tileStyles } from "./styles";

type Tile = HTMLElement & {
  setConfig(config: Config): void; hass?: HomeAssistant; preview?: boolean; layout?: string;
  updateComplete?: Promise<unknown>; getCardSize?(): number; getGridOptions?(): Config;
};

// Each brand's mark: its height in the title row, and a backing where the mark needs one to read
const BRAND_LOOK: Record<string, Record<string, string>> = {
  bull: { "--sc-brand-height": "22px" },
  weber: { "--sc-brand-height": "36px" },
  traeger: { "--sc-brand-height": "34px" },
  big_green_egg: { "--sc-brand-height": "18px", "--sc-brand-padding": "6px 8px", "--sc-brand-backing": "rgba(255,255,255,.9)", "--sc-brand-radius": "18px" },
  kamado_joe: { "--sc-brand-height": "28px", "--sc-brand-padding": "4px", "--sc-brand-backing": "rgba(255,255,255,.92)", "--sc-brand-radius": "50%" },
};

// The grill is lit (its icon orange) from this temperature, in °F or °C
const LIT: Record<string, number> = { "°F": 120, "°C": 50 };
// Where the badge sits, as a share of the icon's radius (the xTool card's spacing)
const BADGE_RING = 16.7 / 20;

let tileSheet: CSSStyleSheet | undefined, plainSheet: CSSStyleSheet | undefined, iconSheet: CSSStyleSheet | undefined;

export class SousChefTile extends LitElement {
  static override styles = tileStyles;

  /** What the tile is for: the grill (its entity an ambient sensor) or a probe (its entity the probe's food type). */
  kind: "grill" | "probe" = "grill";
  /** The grill's icon: grill, or a brand. */
  grillIcon = "grill";

  private _config?: Config;
  private _hass?: HomeAssistant;
  private _tile?: Tile;
  private _preview?: boolean;
  private _statesProvider = new StatesProvider(this);
  private _resize = new ResizeObserver(() => this._arrange());
  private _mutations?: MutationObserver;
  private _observed = new WeakSet<Node>();
  private _arrangeTimer?: ReturnType<typeof setTimeout>;
  private _placedKey?: string;
  // The tile card's hass (see _innerHass)
  private _inner?: HomeAssistant;
  private _innerState?: HassEntity;
  private _innerKey?: string;
  private _sourceState?: HassEntity;
  private _outerHass?: HomeAssistant;

  setConfig(config: Config): void {
    this._config = config;
    if (this._tile) this._tile.setConfig(config);
    else if (customElements.get("hui-tile-card")) this._createTile(config);
    else {
      // The tile card is loaded on demand; the card helpers load it
      window.loadCardHelpers?.().then(async (helpers) => {
        helpers.createCardElement({ type: "tile", entity: config.entity });
        await customElements.whenDefined("hui-tile-card");
        if (!this._tile && this._config) this._createTile(this._config);
      });
    }
    this._placedKey = undefined;
    this._sync();
    this.requestUpdate();
  }

  private _createTile(config: Config): void {
    const tile = document.createElement("hui-tile-card") as Tile;
    tile.setConfig(config);
    if (this._preview !== undefined) tile.preview = this._preview;
    this._tile = tile;
    this._sync();
    Promise.resolve(tile.updateComplete).then(() => this._arrange());
    this.requestUpdate();
  }

  set hass(hass: HomeAssistant) {
    this._hass = hass;
    this._sync();
    this.requestUpdate();
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

  getCardSize(): number {
    return this._tile?.getCardSize?.() ?? 1 + (this._config?.features?.length ?? 0);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this._resize.observe(this);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._resize.disconnect();
    this._mutations?.disconnect();
    this._mutations = undefined;
    this._observed = new WeakSet();
  }

  /** What the card adds to its entity's state object: the icon, and the parts of the state line. */
  private _extra(hass: HomeAssistant): Record<string, unknown> {
    const entity: string = this._config!.entity;
    if (this.kind === "probe") {
      const probe = probeOfEntity(hass, entity);
      if (!probe) return {};
      const line = probeLine(hass, probe);
      return { doneness: line.doneness ?? "", status: line.status };
    }
    const extra: Record<string, unknown> = { cook: grillLine(hass, ambientOf(hass, entity), allProbes(hass)) };
    const brand = BRAND_IMAGES[this.grillIcon];
    if (brand) extra.entity_picture = brand;
    else extra.icon = "mdi:grill";
    return extra;
  }

  /**
   * The Home Assistant object the tile card sees: the same, except that the
   * card's entity has the card's attributes. The changed state object is
   * reused until any of it changes.
   */
  private _innerHass(hass: HomeAssistant): HomeAssistant {
    const entity: string = this._config!.entity;
    const stateObj = hass.states[entity];
    if (!stateObj) return hass;
    const extra = this._extra(hass);
    const key = JSON.stringify(extra);
    if (this._sourceState !== stateObj || this._innerKey !== key) {
      this._sourceState = stateObj;
      this._innerKey = key;
      this._innerState = { ...stateObj, attributes: { ...stateObj.attributes, ...extra } };
      this._inner = undefined;
    }
    if (this._outerHass === hass && this._inner) return this._inner;
    this._outerHass = hass;
    this._inner = { ...hass, states: statesWith(hass.states, entity, this._innerState!) };
    return this._inner;
  }

  private _sync(): void {
    if (!this._tile || !this._hass || !this._config) return;
    const inner = this._innerHass(this._hass);
    this._statesProvider.states = inner.states;
    this._tile.hass = inner;
    this._styleIcon();
  }

  /** The grill's icon: orange once lit, grey while cold; a color chosen in the tile options wins. */
  private _styleIcon(): void {
    const tile = this._tile!, c = this._config!;
    const own = c.color && c.color !== "state";
    const brand = this.kind === "grill" && !!BRAND_IMAGES[this.grillIcon];
    tile.toggleAttribute("sc-brand", brand);
    if (this.kind === "grill" && !own) {
      const stateObj = this._hass!.states[c.entity];
      const lit = (valueOf(this._hass!, c.entity) ?? -Infinity) >= (LIT[stateObj?.attributes.unit_of_measurement] ?? 120);
      tile.setAttribute("sc-icon-color", "");
      tile.style.setProperty("--sc-icon-color", cssColor(lit ? GRILL_COLOR : "grey"));
    } else {
      tile.removeAttribute("sc-icon-color");
    }
    for (const [prop, value] of Object.entries(BRAND_LOOK[this.grillIcon] ?? {})) tile.style.setProperty(prop, brand ? value : "");
  }

  /** The badge: the grill's (its alarm, or a probe's), or the probe's own. */
  private _badge(): "alarm" | "done" | "stalled" | undefined {
    const hass = this._hass, c = this._config;
    if (!hass || !c) return undefined;
    if (this.kind === "grill") return grillBadge(hass, ambientOf(hass, c.entity), allProbes(hass));
    const probe = probeOfEntity(hass, c.entity);
    return probe ? badgeOf(statusOf(hass, probe)) : undefined;
  }

  protected override render(): TemplateResult {
    const badge = this._badge();
    const look = badge ? BADGES[badge] : undefined;
    return html`${this._tile ?? nothing}<span class=${classMap({ badge: true, on: !!look })} role="img" aria-label=${badge ?? nothing}
      title=${badge ? badge[0].toUpperCase() + badge.slice(1) : ""} style=${styleMap({ background: look?.color })}>
      ${look ? html`<ha-icon .icon=${look.icon}></ha-icon>` : nothing}</span>`;
  }

  protected override updated(): void {
    this._arrange();
  }

  // Arrange again when elements are added in the tile card (features render late)
  private _watch(root?: Node | null): void {
    if (!root || this._observed.has(root)) return;
    this._observed.add(root);
    this._mutations ??= new MutationObserver(() => {
      clearTimeout(this._arrangeTimer);
      this._arrangeTimer = setTimeout(() => this._arrange(), 0);
    });
    this._mutations.observe(root, { childList: true, subtree: true });
  }

  /** Everything placed by reaching into the tile card: its sheets, the features' style, the probe's columns, the badge. */
  private _arrange(): void {
    const root = this._tile?.shadowRoot;
    if (!root) return;
    this._watch(root);
    if (!adopt(root, (tileSheet ??= sheetOf(TILE_SHEET)))) console.warn("Sous Chef card: could not style the tile card");
    for (const group of findAllDeep(root, "hui-card-features")) {
      this._watch(group.shadowRoot);
      if (group.shadowRoot) adopt(group.shadowRoot, (plainSheet ??= sheetOf(PLAIN_SHEET)));
    }
    const icon = root.querySelector("ha-tile-icon") ?? findAllDeep(root, "ha-tile-icon")[0];
    if (icon?.shadowRoot && this._tile!.hasAttribute("sc-brand")) adopt(icon.shadowRoot, (iconSheet ??= sheetOf(ICON_SHEET)));
    this._styleFeatures();
    if (this.kind === "probe") this._placeFeatures();
    this._placeBadge(icon);
  }

  /** The features style on this card's features: Console makes their keys press in. */
  private _styleFeatures(): void {
    const style = getComputedStyle(this).getPropertyValue("--sc-features-style").trim();
    for (const el of findAllDeep(this._tile?.shadowRoot, FEATURE_TAGS.join(", "))) {
      this._watch(el.shadowRoot);
      el.toggleAttribute("sc-console", style === "console");
    }
  }

  /**
   * A probe's features two to a row in the tile card's feature grid, in
   * order; one left alone in the last row takes both columns. A feature
   * with nothing to show (a one-sensor probe's channels) takes no place.
   */
  private _placeFeatures(): void {
    const group = findAllDeep(this._tile?.shadowRoot, "hui-card-features")[0] as HTMLElement | undefined;
    const all = [...(group?.shadowRoot?.querySelectorAll<HTMLElement>("hui-card-feature") ?? [])];
    const items = all.filter((item) => item.style.display !== "none");
    const key = JSON.stringify(all.map((item) => items.indexOf(item)));
    if (!group || key === this._placedKey) return;
    this._placedKey = key;
    group.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    all.forEach((item) => {
      const i = items.indexOf(item);
      item.style.gridColumn = i < 0 ? "" : i === items.length - 1 && i % 2 === 0 ? "1 / -1" : `${(i % 2) + 1}`;
      item.style.alignSelf = "start";
    });
  }

  /** The badge on the icon's edge, up and to the right (at the top right of a brand's mark). */
  private _placeBadge(icon?: Element | null): void {
    const badge = this.renderRoot.querySelector<HTMLElement>(".badge.on");
    if (!badge || !icon) return;
    const outer = this.getBoundingClientRect(), box = icon.getBoundingClientRect();
    if (!box.width || !this.offsetWidth) return;
    const scale = outer.width / this.offsetWidth || 1;
    const h = box.height / scale, w = box.width / scale;
    const left = (box.left - outer.left) / scale, top = (box.top - outer.top) / scale;
    if (this._tile?.hasAttribute("sc-brand")) {
      badge.style.left = `${left + w - 2}px`;
      badge.style.top = `${top + 2}px`;
      return;
    }
    const r = h / 2, ring = r * BADGE_RING * 0.7071;
    badge.style.left = `${left + r + ring}px`;
    badge.style.top = `${top + r - ring}px`;
  }
}
