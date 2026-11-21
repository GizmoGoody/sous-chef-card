import { describe, expect, it } from "vitest";
import { tileConfig, stubConfig } from "../../src/options";
import type { HomeAssistant } from "../../src/ha";
import {
  ambients, ambientsFor, internalSensor, maxChannel, probeDevices, probeOf, probesFor, ringGradient, shortNames, statusOf, swatch,
} from "../../src/sous-chef";

// A kit as Sous Chef makes it: an RFX probe (channels 1 to 4, internal = the
// lowest), a one-sensor probe, and an ambient sensor on a gateway
function kit(states: Record<string, string> = {}): HomeAssistant {
  const entities: Record<string, any> = {};
  const all: Record<string, any> = {};
  const add = (entity_id: string, device_id: string, translation_key: string | null, platform = "sous_chef", attributes = {}) => {
    entities[entity_id] = { entity_id, device_id, platform, translation_key };
    all[entity_id] = { entity_id, state: states[entity_id] ?? "unknown", attributes };
  };
  const red = ["sensor.red_ch_1", "sensor.red_ch_2", "sensor.red_ch_3", "sensor.red_ch_4"];
  red.forEach((id) => add(id, "red", null, "thermoworks"));
  add("switch.red_active", "red", "active");
  add("select.red_food_type", "red", "food_type");
  add("number.red_target", "red", "target");
  add("sensor.red_progress", "red", "progress", "sous_chef", { internal: null, channels: red, colors: ["red", "black"] });
  add("binary_sensor.red_done", "red", "done");
  add("binary_sensor.red_stalled", "red", "stalled");
  add("binary_sensor.red_alarm", "red", "alarm");
  add("sensor.blue_temperature", "blue", null, "other");
  add("switch.blue_active", "blue", "active");
  add("sensor.blue_progress", "blue", "progress", "sous_chef", { internal: "sensor.blue_temperature", channels: [], colors: [] });
  add("sensor.grill_ambient", "gateway", null, "thermoworks");
  add("binary_sensor.grill_ambient_alarm", "gateway", "alarm", "sous_chef", { sensor: "sensor.grill_ambient" });
  return {
    states: all,
    entities,
    devices: { red: { id: "red", name: "RFX Probe Red" }, blue: { id: "blue", name: "RFX Probe Blue", name_by_user: null } },
    callService: () => undefined,
    formatEntityState: (s) => s.state,
  };
}

describe("finding the entities (registry: platform, device, translation key)", () => {
  it("lists the probes by their Active switch", () => expect(probeDevices(kit())).toEqual(["red", "blue"]));
  it("finds a probe's entities and what its Progress tells", () => {
    const red = probeOf(kit(), "red")!;
    expect(red.name).toBe("RFX Probe Red");
    expect(red.entities.active).toBe("switch.red_active");
    expect(red.entities.alarm).toBe("binary_sensor.red_alarm");
    expect(red.channels).toHaveLength(4);
    expect(red.internal).toBeNull();
    expect(red.colors).toEqual(["red", "black"]);
  });
  it("finds no probe on a device without Sous Chef", () => expect(probeOf(kit(), "gateway")).toBeUndefined());
  it("finds an ambient sensor through its Alarm's sensor attribute", () =>
    expect(ambients(kit())).toEqual([{ sensor: "sensor.grill_ambient", alarm: "binary_sensor.grill_ambient_alarm" }]));
  it("keeps the order chosen, and shows every one when none is chosen", () => {
    expect(probesFor(kit(), ["blue", "red"]).map((p) => p.device)).toEqual(["blue", "red"]);
    expect(probesFor(kit(), []).map((p) => p.device)).toEqual(["red", "blue"]);
    expect(ambientsFor(kit(), ["sensor.missing"])).toEqual([]);
  });
});

describe("a probe's readings", () => {
  const hass = kit({ "sensor.red_ch_1": "91", "sensor.red_ch_2": "88", "sensor.red_ch_3": "94", "sensor.red_ch_4": "103" });
  const red = probeOf(hass, "red")!;
  it("Max is the highest channel", () => expect(maxChannel(hass, red)).toBe("sensor.red_ch_4"));
  it("the internal temperature is the lowest channel without its own sensor", () =>
    expect(internalSensor(hass, red)).toBe("sensor.red_ch_2"));
  it("a one-sensor probe's internal temperature is that sensor", () =>
    expect(internalSensor(hass, probeOf(hass, "blue")!)).toBe("sensor.blue_temperature"));
});

describe("where a cook stands", () => {
  const status = (states: Record<string, string>) => statusOf(kit(states), probeOf(kit(states), "red")!);
  it("off while the switch is off", () => expect(status({ "switch.red_active": "off" })).toBe("off"));
  it("no reading while Progress has no value", () => expect(status({ "switch.red_active": "on" })).toBe("no_reading"));
  it("cooking with a value", () => expect(status({ "switch.red_active": "on", "sensor.red_progress": "62" })).toBe("cooking"));
  it("alarm before done before stalled", () => {
    const on = { "switch.red_active": "on", "sensor.red_progress": "99" };
    expect(status({ ...on, "binary_sensor.red_stalled": "on", "binary_sensor.red_done": "on", "binary_sensor.red_alarm": "on" })).toBe("alarm");
    expect(status({ ...on, "binary_sensor.red_stalled": "on", "binary_sensor.red_done": "on" })).toBe("done");
    expect(status({ ...on, "binary_sensor.red_stalled": "on" })).toBe("stalled");
  });
});

describe("colors", () => {
  it("a ring stripes the done part evenly in each color", () =>
    expect(ringGradient(["red", "black"], 50, "grey")).toBe("conic-gradient(red 0deg 90deg, black 90deg 180deg, grey 180deg 360deg)"));
  it("a swatch of one color is that color, of several even stripes", () => {
    expect(swatch(["red"])).toBe("red");
    expect(swatch(["red", "black"])).toBe("linear-gradient(90deg, red 0% 50%, black 50% 100%)");
  });
});

describe("names", () => {
  it("drops the words every probe starts with", () =>
    expect(shortNames(["RFX Probe Red", "RFX Probe Blue"])).toEqual(["Red", "Blue"]));
  it("always keeps at least one word", () =>
    expect(shortNames(["RFX Probe", "RFX Probe Blue"])).toEqual(["Probe", "Probe Blue"]));
});

describe("the card", () => {
  it("hands its probes and ambient sensors to its own features only", () => {
    const tile = tileConfig({
      type: "custom:sous-chef-card", entity: "sensor.grill_ambient", probes: ["red"], ambient: ["sensor.grill_ambient"],
      features: [{ type: "custom:sous-chef-probes" }, { type: "fan-speed" }],
    });
    expect(tile.type).toBe("tile");
    expect(tile.probes).toBeUndefined();
    expect(tile.features[0]).toEqual({ type: "custom:sous-chef-probes", probes: ["red"], ambient: ["sensor.grill_ambient"], time_format: "time" });
    expect(tile.features[1]).toEqual({ type: "fan-speed" });
  });
  it("a new card is a grill when there is an ambient sensor", () => {
    const stub = stubConfig(kit());
    expect(stub.entity).toBe("sensor.grill_ambient");
    expect(stub.features.map((f: any) => f.type)).toEqual(["custom:sous-chef-ambient", "custom:sous-chef-probes"]);
  });
});
