// The card's configuration: what it hands the tile card, and a new card's.
import { DEFAULT_TIME_FORMAT, FEATURES, GRILL_FEATURES, PROBE_FEATURES } from "./const";
import type { Config, HomeAssistant } from "./ha";
import { ambients, probeDevices, probeOf } from "./sous-chef";

const OURS = new Set(Object.values(FEATURES).map((type) => `custom:${type}`));

/** The tile card's configuration: the card's, with its probes and ambient sensors handed to its features. */
export function tileConfig(config: Config): Config {
  const { type: _type, probes, ambient, ...tile } = config;
  const own = { probes: probes ?? [], ambient: ambient ?? [], time_format: config.time_format ?? DEFAULT_TIME_FORMAT };
  const features = Array.isArray(config.features)
    ? config.features.map((f: Config) => (OURS.has(f?.type) ? { ...f, ...own } : f))
    : undefined;
  return { ...tile, type: "tile", ...(features ? { features } : {}) };
}

/** A new card: a grill with every ambient sensor and probe, or else the first probe. */
export function stubConfig(hass: HomeAssistant): Config {
  const sensors = ambients(hass).map((a) => a.sensor);
  const devices = probeDevices(hass);
  const features = (types: string[]) => types.map((type) => ({ type: `custom:${type}` }));
  if (sensors.length) {
    return { entity: sensors[0], probes: devices, ambient: sensors, features: features(GRILL_FEATURES) };
  }
  const probe = probeOf(hass, devices[0]);
  if (probe) return { entity: probe.entities.active, probes: [probe.device], features: features(PROBE_FEATURES) };
  return { entity: "" };
}
