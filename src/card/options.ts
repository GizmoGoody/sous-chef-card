// The card's own options: their checks, the configuration as the editor
// saves it, and the tile cards' options as the card passes them on (the
// grill's, and each probe's). Pure, so the unit tests can check them.
import { FEATURES, FEATURES_STYLES, GRILL_FEATURES, ICONS, PROBE_FEATURES, STYLES } from "../const";
import type { Config, HomeAssistant } from "../ha";
import { ambients, tileColorOf, type Probe } from "../sous-chef";

// Options this card adds to the tile card's
export const OWN_KEYS = ["style", "grill_icon", "features_style", "probes_toggle"];
export const DEFAULTS: Config = { style: "none", grill_icon: "grill", features_style: "match", probes_toggle: true };

// Option names in this card's own namespace: one that is not a current
// option is a mistake (a typo, or an option that was renamed), so the card says so
const OWN_PREFIXES = ["style", "grill", "features_style", "probe"];

const LISTS: Record<string, [string, string][]> = { style: STYLES, grill_icon: ICONS, features_style: FEATURES_STYLES };

/** Check the card's options; a wrong one throws, with what is wrong. */
export function checkConfig(config: Config): void {
  if (!config) throw new Error("Invalid configuration");
  if (!config.entity) throw new Error("Choose a grill: a Sous Chef ambient sensor");
  const unknown = Object.keys(config).filter((k) => OWN_PREFIXES.some((p) => k.startsWith(p)) && !OWN_KEYS.includes(k));
  if (unknown.length) throw new Error(`Unknown option${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`);
  for (const [key, list] of Object.entries(LISTS)) {
    if (config[key] !== undefined && !list.some(([id]) => id === config[key])) throw new Error(`Unknown ${key}: ${config[key]}`);
  }
  if (config.probes_toggle !== undefined && typeof config.probes_toggle !== "boolean") throw new Error("probes_toggle must be true or false");
}

/** The configuration as the editor saves it: options at their defaults are left out. */
export function minimal(config: Config): Config {
  const c: Config = { ...config };
  for (const key of OWN_KEYS) if (c[key] === DEFAULTS[key] || c[key] === undefined) delete c[key];
  return c;
}

/** An option's value: as set, or its default. */
export const optionOf = (config: Config | undefined, key: string): any => config?.[key] ?? DEFAULTS[key];

/** The tile card's own options (as its editor shows them): the card's left out. */
export function tileConfig(config: Config): Config {
  const tile: Config = { ...config, type: "tile" };
  for (const key of OWN_KEYS) delete tile[key];
  return tile;
}

/** The default features of a probe's tile: progress, cook, channels and timing. */
export const defaultProbeFeatures = (): Config[] => PROBE_FEATURES.map((type) => ({ type: `custom:${type}` }));

/** The features a probe's tile shows: as chosen in the Sous Chef probes feature, or the defaults. */
export const probeFeaturesOf = (feature?: Config): Config[] =>
  Array.isArray(feature?.features) ? feature!.features : defaultProbeFeatures();

/** Whether a grill feature is Sous Chef probes (the probes' tiles). */
export const isProbeTiles = (feature: Config): boolean => feature?.type === `custom:${FEATURES.probeTiles}`;

/** The card's Sous Chef probes feature: without one, the card shows no probe tiles. */
export const probeTilesOf = (config?: Config): Config | undefined =>
  (Array.isArray(config?.features) ? config!.features : []).find(isProbeTiles);

// A tap on the grill shows or hides the probes (see the card's ll-custom handler)
export const TOGGLE_ACTION = { action: "fire-dom-event", sous_chef_card: "toggle" };

/** The grill's tile card: its options, its icon a brand's mark when chosen, and a tap that shows or hides the probes. */
export function grillConfig(config: Config, open = true): Config {
  const tile = tileConfig(config);
  // Sous Chef probes is drawn by the card, below the grill: not among the grill's own features
  const features = (Array.isArray(config.features) ? config.features : []).filter((f: Config) => !isProbeTiles(f));
  if (Array.isArray(config.features)) tile.features = features;
  // Closed: only the title row (with the feature beside the title), as the Prusa Connect card
  if (!open) tile.features = tile.features_position === "inline" ? features.slice(0, 1) : [];
  delete tile.show_entity_picture;
  if (optionOf(config, "grill_icon") !== "grill") tile.show_entity_picture = true;
  if (optionOf(config, "probes_toggle") !== false) tile.tap_action = TOGGLE_ACTION;
  return tile;
}

/**
 * A probe's tile card: its food type (whose icon is the food's), in the
 * probe's color, with the food, its doneness and status as the state, and the probe
 * features below, two to a row.
 */
export function probeConfig(probe: Probe, name: string, features: Config[] = defaultProbeFeatures()): Config {
  return {
    type: "tile",
    entity: probe.entities.food_type ?? probe.entities.active,
    name,
    color: tileColorOf(probe),
    state_content: ["state", "doneness", "status"],
    features,
    features_position: "bottom",
    // A tap on the icon lists the foods (the card's own list over it, see tile.ts); elsewhere, nothing
    tap_action: { action: "none" },
    icon_tap_action: { action: "none" },
  };
}

/** A new card: the first grill (ambient sensor), with the probes beside its name, its history and its alarms. */
export function stubConfig(hass: HomeAssistant): Config {
  const entity = ambients(hass)[0]?.sensor ?? "";
  return {
    entity,
    state_content: ["state", "cook"],
    features: GRILL_FEATURES.map((type) => ({ type: `custom:${type}` })),
    features_position: "inline",
  };
}
