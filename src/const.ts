declare const __VERSION__: string;

export const VERSION = __VERSION__;
export const DOMAIN = "sous_chef";
export const CARD_TYPE = "sous-chef-card";
export const EDITOR_TYPE = "sous-chef-card-editor";
// The Sous Chef integration's page, where probes, ambient sensors and foods are added
export const MANAGE_PATH = `/config/integrations/integration/${DOMAIN}`;

// The card's features, each a tile card feature (custom:<type>)
export const FEATURES = {
  progress: "sous-chef-progress",
  preset: "sous-chef-preset",
  channels: "sous-chef-channels",
  ambient: "sous-chef-ambient",
  probes: "sous-chef-probes",
} as const;

// The features of one probe (the probe view), and of a grill (the grill view)
export const PROBE_FEATURES = [FEATURES.progress, FEATURES.preset, FEATURES.channels];
export const GRILL_FEATURES = [FEATURES.ambient, FEATURES.probes];

// The card's own options, which it hands to its features
export const OWN_KEYS = ["probes", "ambient"] as const;

// The tile card's Time format choices (its time_format option); Done at shows the time by default
export const TIME_FORMATS = ["relative", "total", "date", "time", "datetime"];
export const DEFAULT_TIME_FORMAT = "time";
