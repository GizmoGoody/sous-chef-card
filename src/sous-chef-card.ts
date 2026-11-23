// Sous Chef Card: the grill and its probes on one card, for the Sous Chef
// integration (domain sous_chef). The grill (an ambient sensor) is Home
// Assistant's tile card; below it, one tile card for each probe that is on.
//
// Tile features, which also work in any tile card for a grill or a probe:
// - custom:sous-chef-probes    a key for each probe beside the grill's name
// - custom:sous-chef-history   Home Assistant's history graph, with projections
// - custom:sous-chef-ambient   the grill's trend, and its low and high alarms
// - custom:sous-chef-progress  a probe's bar, internal → target
// - custom:sous-chef-cook      the food type, the target or doneness, and the chart view
// - custom:sous-chef-channels  each channel from the tip, against the reference
// - custom:sous-chef-timing    the rate, and the time left or the rest
import { printBadge } from "@gizmogoody/card-badge";
import { CARD_TYPE, EDITOR_TYPE, FEATURE_EDITOR_TYPE, TILE_TYPE, VERSION } from "./const";
import { define, type FeatureContext, type HomeAssistant } from "./ha";
import { SousChefCard } from "./card/card";
import { SousChefTile } from "./card/tile";
import { CHART_DIALOG, SousChefChartDialog } from "./chart/dialog";
import { SousChefCardEditor } from "./editor/card-editor";
import { SousChefFeatureEditor } from "./editor/feature-editor";
import type { SousChefFeature } from "./features/base";
import { SousChefAmbient, SousChefHistory, SousChefProbes } from "./features/grill";
import { SousChefChannels, SousChefCook, SousChefProgress, SousChefTiming } from "./features/probe";

// In the order Home Assistant's feature picker lists them
const FEATURES: (typeof SousChefFeature)[] = [SousChefProbes, SousChefHistory, SousChefAmbient, SousChefProgress, SousChefCook, SousChefChannels, SousChefTiming];

if (!customElements.get(CARD_TYPE)) {
  for (const feature of FEATURES) {
    define(feature.tag, feature);
    SousChefFeatureEditor.features.set(feature.tag, feature);
  }
  define(FEATURE_EDITOR_TYPE, SousChefFeatureEditor);
  define(TILE_TYPE, SousChefTile);
  define(CARD_TYPE, SousChefCard);
  define(EDITOR_TYPE, SousChefCardEditor);
  define(CHART_DIALOG, SousChefChartDialog);

  window.customCardFeatures = window.customCardFeatures || [];
  window.customCardFeatures.push(...FEATURES.map((feature) => ({
    type: feature.tag,
    name: feature.pickerName,
    isSupported: (hass?: HomeAssistant, context?: FeatureContext) => feature.supports(hass, context),
    configurable: feature.configurable,
  })));

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD_TYPE,
    name: "Sous Chef",
    description: "The grill and its probes: the grill's history and alarms, and a tile for each probe that is on.",
    preview: true,
    documentationURL: "https://github.com/GizmoGoody/sous-chef-card#configuration",
  });

  printBadge({
    icon: "🍖",
    name: "Sous Chef Card",
    version: VERSION,
    description: "Sous Chef on a dashboard: for the grill, the smoker and the kitchen.",
    repo: "sous-chef-card",
  });
}
