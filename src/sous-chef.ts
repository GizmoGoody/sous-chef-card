// The Sous Chef entities of a probe or an ambient sensor, found through the
// entity registry (platform sous_chef, the device, and the translation key),
// and what the card makes of them. Pure, so the unit tests can check them.
import { DOMAIN } from "./const";
import { cssColor, deviceName, domainOf, known, numberOf, type HassEntity, type HomeAssistant } from "./ha";

// A probe's entities the card uses, by translation key, with their domain
const PROBE_KEYS = {
  active: "switch",
  source: "select",
  food_type: "select",
  doneness: "select",
  target: "number",
  alarm_high: "number",
  alarm_low: "number",
  progress: "sensor",
  rate: "sensor",
  done_at: "sensor",
  max: "sensor",
  done: "binary_sensor",
  stalled: "binary_sensor",
  alarm: "binary_sensor",
} as const;
export type ProbeKey = keyof typeof PROBE_KEYS;

// The doneness that is no preset: any target
export const CUSTOM = "custom";

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
  // The internal temperature the cook started at
  start?: number;
}

export interface Ambient {
  // The ambient temperature sensor (the brand's), its Sous Chef Alarm, and its alarm limits
  sensor: string;
  alarm: string;
  low?: string;
  high?: string;
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
    start: typeof attributes.start === "number" ? attributes.start : undefined,
  };
}

/** The probe an entity belongs to: one of its Sous Chef entities, or one of its own sensors. */
export const probeOfEntity = (hass: HomeAssistant, entityId?: string): Probe | undefined =>
  entityId ? probeOf(hass, hass.entities?.[entityId]?.device_id) : undefined;

/** Every probe, in the order Sous Chef lists them. */
export const allProbes = (hass: HomeAssistant): Probe[] =>
  probeDevices(hass).map((device) => probeOf(hass, device)).filter((probe): probe is Probe => !!probe);

/** The Sous Chef ambient sensors: each Alarm names its sensor; its limits sit on the same device. */
export function ambients(hass: HomeAssistant): Ambient[] {
  const entries = sousChefEntries(hass);
  return entries
    .filter((entry) => entry.translation_key === "alarm" && domainOf(entry.entity_id) === "binary_sensor")
    .flatMap((entry) => {
      const sensor = hass.states[entry.entity_id]?.attributes.sensor;
      if (typeof sensor !== "string") return [];
      const limit = (key: string) => entries.find((e) => e.device_id === entry.device_id && e.translation_key === key
        && domainOf(e.entity_id) === "number")?.entity_id;
      return [{ sensor, alarm: entry.entity_id, low: limit("alarm_low"), high: limit("alarm_high") }];
    });
}

/** The ambient sensor an entity is, if it is one. */
export const ambientOf = (hass: HomeAssistant, entityId?: string): Ambient | undefined =>
  entityId ? ambients(hass).find((a) => a.sensor === entityId) : undefined;

const isOn = (hass: HomeAssistant, entityId?: string) => !!entityId && hass.states[entityId]?.state === "on";
const stateOf = (hass: HomeAssistant, entityId?: string): HassEntity | undefined => (entityId ? hass.states[entityId] : undefined);
export const valueOf = (hass: HomeAssistant, entityId?: string): number | undefined => numberOf(stateOf(hass, entityId));

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
  if (internalValue(hass, probe) === undefined) return "no_reading";
  return "cooking";
}

/** The sensor that holds the internal temperature now: its own, or the lowest channel (the reference on an RFX). */
export function internalSensor(hass: HomeAssistant, probe: Probe): string | undefined {
  if (probe.internal) return probe.internal;
  let best: string | undefined, least = Infinity;
  for (const id of probe.channels) {
    const value = valueOf(hass, id);
    if (value !== undefined && value < least) [best, least] = [id, value];
  }
  return best ?? probe.channels[0];
}

export const internalValue = (hass: HomeAssistant, probe: Probe): number | undefined => valueOf(hass, internalSensor(hass, probe));

/** A probe's progress, 0 to 100; 0 without a value. */
export function progressOf(hass: HomeAssistant, probe: Probe): number {
  const value = valueOf(hass, probe.entities.progress);
  return value === undefined ? 0 : Math.max(0, Math.min(100, value));
}

/** A probe's main color as CSS; the theme's primary color without any. */
export const colorOf = (probe: Probe): string => (probe.colors.length ? cssColor(probe.colors[0]) : "var(--primary-color)");
/** A probe's main color by name (for the tile card's color option). */
export const colorNameOf = (probe: Probe): string => probe.colors[0] ?? "primary";

// The light probe colors, darker for an icon on their own tint (a green icon on a green key)
const ICON_COLORS: Record<string, string> = { green: "#2e7d32", "light-green": "#558b2f", lime: "#827717", yellow: "#9a7b00", amber: "#a35f00", white: "#616161" };
/** A probe's icon color: its color, darker where its color is light. */
export const iconColorOf = (probe: Probe): string => ICON_COLORS[probe.colors[0] ?? ""] ?? colorOf(probe);
/** The color name or hex Home Assistant's tile card takes for a probe: darker where the probe's color is light. */
export const tileColorOf = (probe: Probe): string => ICON_COLORS[probe.colors[0] ?? ""] ?? colorNameOf(probe);

/** Short names for a set of probes: without the words they all start with (RFX Probe Red, Blue: Red, Blue). */
export function shortNames(names: string[]): string[] {
  if (names.length < 2) return names;
  const words = names.map((name) => name.split(/\s+/));
  let shared = 0;
  while (words.every((w) => w.length > shared + 1 && w[shared] === words[0][shared])) shared++;
  return words.map((w) => w.slice(shared).join(" "));
}

/** Each probe's short name, by device. */
export function probeNames(probes: Probe[]): Map<string, string> {
  const names = shortNames(probes.map((p) => p.name));
  return new Map(probes.map((p, i) => [p.device, names[i]]));
}

// ---------------------------------------------------------------------------
// What the card shows
// ---------------------------------------------------------------------------

/** A number as the card shows a temperature: whole degrees. */
export const whole = (value: number): string => String(Math.round(value));

/** A rate as the card shows it: a sign, one decimal, degrees a minute (+1.6°/min). */
export function rateText(rate?: number): string {
  if (rate === undefined || !Number.isFinite(rate)) return "";
  const r = Math.round(rate * 10) / 10;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}°/min`;
}

/** The trend icon for a rate: rising, falling, or level within the given band. */
export const rateIcon = (rate: number | undefined, band: number): string =>
  rate === undefined ? "mdi:trending-neutral" : rate > band ? "mdi:trending-up" : rate < -band ? "mdi:trending-down" : "mdi:trending-neutral";

/** A time span in whole minutes, short: 32 min, 1 h 10 min, 2 h. */
export function durationText(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** A clock time in the user's language and time format: 6:42 PM, or 18:42. */
export function clockText(date: Date, hass?: HomeAssistant): string {
  const format = hass?.locale?.time_format;
  const hour12 = format === "12" ? true : format === "24" ? false : undefined;
  // Some browsers put a narrow space before AM and PM: a plain one reads the same everywhere
  return date.toLocaleTimeString(hass?.locale?.language, { hour: "numeric", minute: "2-digit", hour12 }).replace(/\u202f/g, " ");
}

/** When a probe will be done (its Done at sensor), or undefined. */
export function doneAtOf(hass: HomeAssistant, probe: Probe): Date | undefined {
  const stateObj = stateOf(hass, probe.entities.done_at);
  if (!known(stateObj)) return undefined;
  const date = new Date(stateObj.state);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** The doneness as Home Assistant shows it (Medium rare, Custom), or undefined without a target. */
export function donenessText(hass: HomeAssistant, probe: Probe): string | undefined {
  if (valueOf(hass, probe.entities.target) === undefined) return undefined;
  const stateObj = stateOf(hass, probe.entities.doneness);
  return known(stateObj) ? hass.formatEntityState(stateObj) : undefined;
}

/** A temperature with its unit, as the target shows it (130 °F). */
function withUnit(hass: HomeAssistant, value: number, unitFrom?: string): string {
  const unit = stateOf(hass, unitFrom)?.attributes.unit_of_measurement;
  return unit ? `${whole(value)} ${unit}` : `${whole(value)}°`;
}

/** Where a probe's cook stands, in words: Done at 6:42 PM, Done, Stalled, Above 150 °F, No reading; nothing without a target. */
export function statusText(hass: HomeAssistant, probe: Probe, now = Date.now()): string {
  const e = probe.entities;
  const status = statusOf(hass, probe);
  const internal = internalValue(hass, probe), target = valueOf(hass, e.target);
  switch (status) {
    case "off": return "Off";
    case "no_reading": return "No reading";
    case "alarm": {
      const high = valueOf(hass, e.alarm_high), low = valueOf(hass, e.alarm_low);
      if (internal !== undefined && high && internal > high) return `Above ${withUnit(hass, high, e.alarm_high)}`;
      if (internal !== undefined && low && internal < low) return `Below ${withUnit(hass, low, e.alarm_low)}`;
      return "Alarm";
    }
    case "done": {
      const over = internal !== undefined && target !== undefined ? Math.round(internal - target) : 0;
      return over > 2 ? `Done, ${withUnit(hass, over, e.target)} over` : "Done";
    }
    case "stalled": return "Stalled";
    default: {
      if (target === undefined) return "";
      const at = doneAtOf(hass, probe);
      return at && at.getTime() > now ? `Done at ${clockText(at, hass)}` : "Cooking";
    }
  }
}

/** A probe's state line: the doneness, then where the cook stands (Medium rare · Done at 6:42 PM). */
export function probeLine(hass: HomeAssistant, probe: Probe, now = Date.now()): { doneness?: string; status: string } {
  const status = statusText(hass, probe, now);
  const target = valueOf(hass, probe.entities.target);
  return { doneness: target === undefined && status === "" ? undefined : donenessText(hass, probe), status };
}

/** The badge a probe's icon wears: alarm, done or stalled. */
export function badgeOf(status: Status): "alarm" | "done" | "stalled" | undefined {
  return status === "alarm" || status === "done" || status === "stalled" ? status : undefined;
}

export interface ChannelReading {
  id: string;
  value?: number;
  // 0 for the coldest channel, 1 for the hottest
  heat: number;
  // Degrees above the reference (the lowest), or undefined for the reference itself
  delta?: number;
  reference: boolean;
  tip: boolean;
}

/**
 * A probe's channels, from the tip: each one's heat between the coldest
 * and the hottest, and its difference from the reference (the lowest, the
 * internal temperature as Sous Chef reads an RFX probe).
 */
// The heat tint spans at least this many degrees, so channels a fraction apart look alike
export const HEAT_SPAN = 10;

export function channelReadings(values: (number | undefined)[], ids: string[]): ChannelReading[] {
  const shown = values.filter((v): v is number => v !== undefined);
  const lo = shown.length ? Math.min(...shown) : undefined, hi = shown.length ? Math.max(...shown) : undefined;
  const refAt = lo === undefined ? -1 : values.indexOf(lo);
  return ids.map((id, i) => {
    const value = values[i];
    const reference = i === refAt;
    return {
      id, value, reference, tip: i === 0,
      heat: value !== undefined && lo !== undefined && hi !== undefined ? (value - lo) / Math.max(hi - lo, HEAT_SPAN) : 0,
      delta: value !== undefined && lo !== undefined && !reference ? Math.round(value - lo) : undefined,
    };
  });
}

/**
 * The trend of readings in degrees a minute: the slope of the best line
 * through the samples of the last few minutes; undefined with too few.
 */
export function trendOf(samples: [number, number][], now = Date.now(), minutes = 5): number | undefined {
  const recent = samples.filter(([t]) => t >= now - minutes * 60000);
  if (recent.length < 2) return undefined;
  const n = recent.length;
  const mt = recent.reduce((s, [t]) => s + t, 0) / n, mv = recent.reduce((s, [, v]) => s + v, 0) / n;
  let num = 0, den = 0;
  for (const [t, v] of recent) {
    num += (t - mt) * (v - mv);
    den += (t - mt) ** 2;
  }
  return den ? (num / den) * 60000 : undefined;
}

/** The grill's state line after its temperature: an alarm, a probe that needs a look, or how many probes are on. */
export function grillLine(hass: HomeAssistant, ambient: Ambient | undefined, probes: Probe[]): string {
  if (ambient && isOn(hass, ambient.alarm)) {
    const value = valueOf(hass, ambient.sensor), high = valueOf(hass, ambient.high), low = valueOf(hass, ambient.low);
    if (value !== undefined && high && value > high) return `Above ${withUnit(hass, high, ambient.high)}`;
    if (value !== undefined && low && value < low) return `Below ${withUnit(hass, low, ambient.low)}`;
    return "Alarm";
  }
  const names = probeNames(probes);
  const on = probes.filter((p) => isActive(hass, p));
  const first = (status: Status) => on.find((p) => statusOf(hass, p) === status);
  const alarm = first("alarm"), done = first("done"), stalled = first("stalled");
  if (alarm) return `${names.get(alarm.device)} alarm`;
  if (done) return `${names.get(done.device)} is done`;
  if (stalled) return `${names.get(stalled.device)} stalled`;
  return on.length === 0 ? "No probes on" : on.length === 1 ? "1 probe on" : `${on.length} probes on`;
}

/** The grill's badge: its own alarm or a probe's, else a probe done, else one stalled. */
export function grillBadge(hass: HomeAssistant, ambient: Ambient | undefined, probes: Probe[]): "alarm" | "done" | "stalled" | undefined {
  if (ambient && isOn(hass, ambient.alarm)) return "alarm";
  const statuses = probes.filter((p) => isActive(hass, p)).map((p) => statusOf(hass, p));
  return (["alarm", "done", "stalled"] as const).find((s) => statuses.includes(s));
}

/**
 * The history graph's temperature range: around the readings, at least 20
 * degrees, its ends on a round step (5, 10, 20, 25, 50 or 100 degrees, for
 * about five lines), so the axis never shows decimals when the readings
 * hardly move, and no odd label at either end. Undefined without a reading.
 */
export function axisRange(values: number[]): [number, number] | undefined {
  const known = values.filter((v) => Number.isFinite(v));
  if (!known.length) return undefined;
  const min = Math.min(...known) - 5, max = Math.max(...known) + 5;
  const step = [5, 10, 20, 25, 50, 100].find((s) => s >= (max - min) / 5) ?? 100;
  const lo = Math.floor(min / step) * step;
  return [lo, Math.max(Math.ceil(max / step) * step, lo + 20)];
}

/** A cook's bar: its fill (0 to 100), the goal's place once past the target, whether it stalled, and its reading (68 → 130 °F). */
export interface CookBar {
  fill: number;
  goal?: number;
  stalled: boolean;
  label: string;
}

export function cookBar(hass: HomeAssistant, probe: Probe): CookBar {
  const e = probe.entities;
  const status = statusOf(hass, probe);
  const internal = internalValue(hass, probe), target = valueOf(hass, e.target);
  const reading = internal !== undefined && status !== "no_reading";
  const over = reading && target !== undefined && internal! > target;
  const start = probe.start ?? Math.min(internal ?? 0, target ?? 0);
  const unit = hass.states[e.target ?? ""]?.attributes.unit_of_measurement ?? "°";
  return {
    fill: over ? 100 : progressOf(hass, probe),
    goal: over && internal! > start ? ((target! - start) / (internal! - start)) * 100 : undefined,
    stalled: status === "stalled",
    label: !reading ? "" : target !== undefined ? `${whole(internal!)} → ${whole(target)} ${unit}` : `${whole(internal!)} ${unit}`,
  };
}

/**
 * How far the projections go, in minutes, tap by tap: until every probe
 * reaches its target, then half that and half again while longer than 15
 * minutes, then 15, 10 and 5 (and after them, off).
 */
export function horizons(untilDone: number): number[] {
  const all = Math.max(5, Math.ceil(untilDone));
  const out = [all];
  for (let h = all / 2; h > 15; h /= 2) out.push(Math.round(h));
  for (const m of [15, 10, 5]) if (m < out[out.length - 1]) out.push(m);
  return out;
}

/** A time ahead in words: +2 h 30 min, +1 h, +15 min. */
export function aheadText(minutes: number): string {
  const h = Math.floor(minutes / 60), m = Math.round(minutes % 60);
  return h ? `+${h} h${m ? ` ${m} min` : ""}` : `+${m} min`;
}
