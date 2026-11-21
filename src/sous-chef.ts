// The Sous Chef entities of a probe or an ambient sensor, found through the
// entity registry: platform sous_chef, the device, and the translation key.
import { DOMAIN } from "./const";
import { cssColor, deviceName, domainOf, known, numberOf, type HomeAssistant } from "./ha";

// A probe's entities the card uses, by translation key, with their domain
const PROBE_KEYS = {
  active: "switch",
  source: "select",
  food_type: "select",
  doneness: "select",
  target: "number",
  progress: "sensor",
  rate: "sensor",
  done_at: "sensor",
  max: "sensor",
  done: "binary_sensor",
  stalled: "binary_sensor",
  alarm: "binary_sensor",
} as const;
export type ProbeKey = keyof typeof PROBE_KEYS;

export interface Probe {
  device: string;
  name: string;
  entities: Partial<Record<ProbeKey, string>>;
  // The internal temperature's sensor, or null for the lowest of the channels
  internal: string | null;
  // The channels in order from the tip; none on a one-sensor probe
  channels: string[];
  // Home Assistant's named colors; none for no colors
  colors: string[];
}

export interface Ambient {
  // The ambient temperature sensor (the brand's), and its Sous Chef Alarm
  sensor: string;
  alarm: string;
}

export type Status = "off" | "alarm" | "done" | "stalled" | "no_reading" | "cooking";

const sousChefEntries = (hass: HomeAssistant) =>
  Object.values(hass.entities ?? {}).filter((entry) => entry.platform === DOMAIN);

/** The devices that are Sous Chef probes: they have its Active switch. */
export function probeDevices(hass: HomeAssistant): string[] {
  const devices = sousChefEntries(hass)
    .filter((entry) => entry.translation_key === "active" && domainOf(entry.entity_id) === "switch" && entry.device_id)
    .map((entry) => entry.device_id!);
  return [...new Set(devices)];
}

/** A probe's Sous Chef entities and what its Progress sensor tells about it. */
export function probeOf(hass: HomeAssistant, device?: string | null): Probe | undefined {
  if (!device) return undefined;
  const entities: Probe["entities"] = {};
  for (const entry of sousChefEntries(hass)) {
    if (entry.device_id !== device || !entry.translation_key) continue;
    const key = entry.translation_key as ProbeKey;
    if (PROBE_KEYS[key] !== domainOf(entry.entity_id)) continue;
    // An ambient sensor on the same device has an Alarm too; it names its sensor
    if (key === "alarm" && hass.states[entry.entity_id]?.attributes.sensor) continue;
    entities[key] = entry.entity_id;
  }
  if (!entities.active) return undefined;
  const attributes = (entities.progress && hass.states[entities.progress]?.attributes) || {};
  return {
    device,
    name: deviceName(hass, device),
    entities,
    internal: typeof attributes.internal === "string" ? attributes.internal : null,
    channels: Array.isArray(attributes.channels) ? attributes.channels : [],
    colors: Array.isArray(attributes.colors) ? attributes.colors : [],
  };
}

/** The probe an entity belongs to: one of its Sous Chef entities, or one of its own sensors. */
export const probeOfEntity = (hass: HomeAssistant, entityId?: string): Probe | undefined =>
  entityId ? probeOf(hass, hass.entities?.[entityId]?.device_id) : undefined;

/** The Sous Chef ambient sensors: each Alarm names its sensor. */
export function ambients(hass: HomeAssistant): Ambient[] {
  return sousChefEntries(hass)
    .filter((entry) => entry.translation_key === "alarm" && domainOf(entry.entity_id) === "binary_sensor")
    .map((entry) => ({ sensor: hass.states[entry.entity_id]?.attributes.sensor, alarm: entry.entity_id }))
    .filter((ambient): ambient is Ambient => typeof ambient.sensor === "string");
}

/** The probes to show: those chosen, in their order, or every probe. */
export function probesFor(hass: HomeAssistant, chosen?: unknown): Probe[] {
  const devices = Array.isArray(chosen) && chosen.length ? chosen : probeDevices(hass);
  return devices.map((device) => probeOf(hass, device)).filter((probe): probe is Probe => !!probe);
}

/** The ambient sensors to show: those chosen, in their order, or every one. */
export function ambientsFor(hass: HomeAssistant, chosen?: unknown): Ambient[] {
  const all = ambients(hass);
  if (!Array.isArray(chosen) || !chosen.length) return all;
  return chosen.map((sensor) => all.find((ambient) => ambient.sensor === sensor)).filter((a): a is Ambient => !!a);
}

const isOn = (hass: HomeAssistant, entityId?: string) => !!entityId && hass.states[entityId]?.state === "on";

/** Whether a probe is on for a cook. */
export const isActive = (hass: HomeAssistant, probe: Probe): boolean => isOn(hass, probe.entities.active);

/**
 * Where a probe's cook stands. Progress has no value while the probe is not
 * reporting (Sous Chef knows when a reading is stale), which is No reading.
 */
export function statusOf(hass: HomeAssistant, probe: Probe): Status {
  const e = probe.entities;
  if (!isActive(hass, probe)) return "off";
  if (isOn(hass, e.alarm)) return "alarm";
  if (isOn(hass, e.done)) return "done";
  if (isOn(hass, e.stalled)) return "stalled";
  if (!known(e.progress ? hass.states[e.progress] : undefined)) return "no_reading";
  return "cooking";
}

export const STATUS_LABELS: Record<Status, string> = {
  off: "Off", alarm: "Alarm", done: "Done", stalled: "Stalled", no_reading: "No reading", cooking: "Cooking",
};

/** The channel with the highest temperature (Max); the first of them on a tie. */
export function maxChannel(hass: HomeAssistant, probe: Probe): string | undefined {
  let best: string | undefined, most = -Infinity;
  for (const id of probe.channels) {
    const value = numberOf(hass.states[id]);
    if (value !== undefined && value > most) [best, most] = [id, value];
  }
  return best;
}

/** The sensor that holds the internal temperature now: its own, or the lowest channel. */
export function internalSensor(hass: HomeAssistant, probe: Probe): string | undefined {
  if (probe.internal) return probe.internal;
  let best: string | undefined, least = Infinity;
  for (const id of probe.channels) {
    const value = numberOf(hass.states[id]);
    if (value !== undefined && value < least) [best, least] = [id, value];
  }
  return best;
}

/** A probe's progress, 0 to 100; 0 without a value. */
export function progressOf(hass: HomeAssistant, probe: Probe): number {
  const value = numberOf(probe.entities.progress ? hass.states[probe.entities.progress] : undefined);
  return value === undefined ? 0 : Math.max(0, Math.min(100, value));
}

/** A probe's colors as CSS; the theme's primary color without any. */
export const colorsOf = (probe: Probe): string[] => (probe.colors.length ? probe.colors.map(cssColor) : ["var(--primary-color)"]);

/** A swatch of colors: one color, or even stripes of each. */
export function swatch(colors: string[]): string {
  if (colors.length === 1) return colors[0];
  const share = 100 / colors.length;
  return `linear-gradient(90deg, ${colors.map((c, i) => `${c} ${i * share}% ${(i + 1) * share}%`).join(", ")})`;
}

/** A progress ring's stops: the done part in even stripes of the colors, then the track. */
export function ringGradient(colors: string[], progress: number, track = "var(--divider-color)"): string {
  const deg = (Math.max(0, Math.min(100, progress)) * 360) / 100;
  const stops = colors.map((c, i) => `${c} ${(deg * i) / colors.length}deg ${(deg * (i + 1)) / colors.length}deg`);
  return `conic-gradient(${[...stops, `${track} ${deg}deg 360deg`].join(", ")})`;
}

/** Short names for a set of probes: without the words they all start with (RFX Probe Red, Blue: Red, Blue). */
export function shortNames(names: string[]): string[] {
  if (names.length < 2) return names;
  const words = names.map((name) => name.split(/\s+/));
  let shared = 0;
  while (words.every((w) => w.length > shared + 1 && w[shared] === words[0][shared])) shared++;
  return words.map((w) => w.slice(shared).join(" "));
}
