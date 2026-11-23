// The card's names, the integration's, and the option lists the card and
// its editor share.

declare const __VERSION__: string;
// Set from package.json (or the release workflow) when the card is built
export const VERSION: string = __VERSION__;

export const DOMAIN = "sous_chef";
export const CARD_TYPE = "sous-chef-card";
export const EDITOR_TYPE = "sous-chef-card-editor";
export const TILE_TYPE = "sous-chef-tile";
export const TILE_EDITOR_TYPE = "sous-chef-tile-card-editor";
export const FEATURE_EDITOR_TYPE = "sous-chef-feature-editor";
// The Sous Chef integration's page, where probes and ambient sensors are added
export const MANAGE_PATH = `/config/integrations/integration/${DOMAIN}`;

// The features, each a tile card feature (custom:<type>)
export const FEATURES = {
  probes: "sous-chef-probes",
  history: "sous-chef-history",
  ambient: "sous-chef-ambient",
  progress: "sous-chef-progress",
  cook: "sous-chef-cook",
  channels: "sous-chef-channels",
  timing: "sous-chef-timing",
  bars: "sous-chef-progress-bars",
} as const;
export const FEATURE_TAGS: string[] = Object.values(FEATURES);

// A new card's grill features (Probes beside the title), and every probe's
export const GRILL_FEATURES = [FEATURES.probes, FEATURES.history, FEATURES.ambient];
export const PROBE_FEATURES = [FEATURES.progress, FEATURES.cook, FEATURES.channels, FEATURES.timing];

// Styles: each a grill's finish (see grill/finishes.ts)
export const STYLES: [string, string][] = [
  ["none", "None (theme)"],
  ["stainless", "Stainless steel"],
  ["black", "Black porcelain"],
  ["bronze", "Bronze"],
  ["green", "Green ceramic"],
  ["red", "Red ceramic"],
];
// The same keys and values as the xTool, Prusa and SVS Subwoofer cards
export const FEATURES_STYLES: [string, string][] = [["match", "Match style"], ["flat", "Flat"], ["console", "Console"]];
// The grill's icon: the grill, or a brand's mark (see grill/brand-images.ts)
export const ICONS: [string, string][] = [
  ["grill", "Grill"],
  ["bull", "Bull"],
  ["weber", "Weber"],
  ["traeger", "Traeger"],
  ["big_green_egg", "Big Green Egg"],
  ["kamado_joe", "Kamado Joe"],
];

// The badges on a tile's icon, by what they say
export const BADGES = {
  alarm: { icon: "mdi:exclamation-thick", color: "var(--error-color, #db4437)" },
  done: { icon: "mdi:check-bold", color: "var(--success-color, #43a047)" },
  stalled: { icon: "mdi:pause", color: "var(--warning-color, #ffa600)" },
} as const;

// The grill's color, in the history and on its keys and fields
export const GRILL_COLOR = "orange";
