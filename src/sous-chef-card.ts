// Sous Chef Card: Home Assistant's tile card for the Sous Chef integration
// (domain sous_chef), with its features:
// - custom:sous-chef-progress  a probe's ring, Internal → Target, Done at and Rate
// - custom:sous-chef-preset    Food type, Doneness, Target, and the source with its chart link
// - custom:sous-chef-channels  ch 1 to ch n, with Max outlined
// - custom:sous-chef-ambient   the ambient sensors and their alarms
// - custom:sous-chef-probes    an Active switch per probe, and a ring and a row for each probe that is on
// The features also work in any tile card for a Sous Chef probe or ambient sensor.
import { printBadge } from "@gizmogoody/card-badge";
import { CARD_TYPE, EDITOR_TYPE, VERSION } from "./const";
import { define, type FeatureContext, type HomeAssistant } from "./ha";
import { SousChefCard } from "./card";
import { SousChefCardEditor } from "./editor";
import { SousChefAmbient, SousChefProbes } from "./features/grill";
import { SousChefChannels, SousChefPreset, SousChefProgress } from "./features/probe";
import { ambients, probeOfEntity } from "./sous-chef";

const PROBE = [SousChefProgress, SousChefPreset, SousChefChannels];
const GRILL = [SousChefAmbient, SousChefProbes];

/** Whether a tile card is for Sous Chef: its entity is on a probe, or is an ambient sensor. */
function forSousChef(hass?: HomeAssistant, context?: FeatureContext): boolean {
  const entityId = context?.entity_id;
  if (!hass || !entityId) return false;
  return !!probeOfEntity(hass, entityId) || ambients(hass).some((a) => a.sensor === entityId);
}

if (!customElements.get(CARD_TYPE)) {
  for (const feature of [...PROBE, ...GRILL]) define(feature.tag, feature);
  define(CARD_TYPE, SousChefCard);
  define(EDITOR_TYPE, SousChefCardEditor);

  window.customCardFeatures = window.customCardFeatures || [];
  window.customCardFeatures.push(...[...PROBE, ...GRILL].map((feature) => ({
    type: feature.tag,
    name: feature.pickerName,
    isSupported: forSousChef,
    configurable: false,
  })));

  window.customCards = window.customCards || [];
  window.customCards.push({
    type: CARD_TYPE,
    name: "Sous Chef",
    description: "A tile card for Sous Chef: probes with progress, Done at and presets, and ambient sensors with their alarms.",
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
