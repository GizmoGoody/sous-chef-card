import { describe, expect, it } from "vitest";
import { featureForm } from "../../src/features/form";
import { checkConfig, grillConfig, minimal, probeConfig, probeFeaturesOf, probeLinesOf, probeTilesOf, stubConfig, tileConfig } from "../../src/card/options";
import type { HomeAssistant } from "../../src/ha";
import {
  aheadText, allProbes, ambients, axisRange, channelReadings, durationText, grillBadge, grillLine, internalSensor, probeDevices, probeLine, probeOf,
  horizons, rateText, shortNames, statusOf, statusText, trendOf,
} from "../../src/sous-chef";

// A kit as Sous Chef makes it: an RFX probe (channels 1 to 4, internal = the
// lowest), a one-sensor probe, and an ambient sensor on a gateway with its limits
function kit(states: Record<string, string> = {}, attributes: Record<string, Record<string, unknown>> = {}): HomeAssistant {
  const entities: Record<string, any> = {};
  const all: Record<string, any> = {};
  const add = (entity_id: string, device_id: string, translation_key: string | null, platform = "sous_chef", attrs = {}) => {
    entities[entity_id] = { entity_id, device_id, platform, translation_key };
    all[entity_id] = { entity_id, state: states[entity_id] ?? "unknown", attributes: { ...attrs, ...attributes[entity_id] } };
  };
  const red = ["sensor.red_ch_1", "sensor.red_ch_2", "sensor.red_ch_3", "sensor.red_ch_4"];
  red.forEach((id) => add(id, "red", null, "thermoworks", { unit_of_measurement: "°F" }));
  add("switch.red_active", "red", "active");
  add("select.red_food_type", "red", "food_type");
  add("select.red_doneness", "red", "doneness");
  add("number.red_target", "red", "target", "sous_chef", { unit_of_measurement: "°F" });
  add("number.red_alarm_high", "red", "alarm_high", "sous_chef", { unit_of_measurement: "°F" });
  add("sensor.red_progress", "red", "progress", "sous_chef", { internal: null, channels: red, colors: ["red", "black"], start: 60 });
  add("sensor.red_done_at", "red", "done_at");
  add("binary_sensor.red_done", "red", "done");
  add("binary_sensor.red_stalled", "red", "stalled");
  add("binary_sensor.red_alarm", "red", "alarm");
  add("sensor.blue_temperature", "blue", null, "other");
  add("switch.blue_active", "blue", "active");
  add("sensor.blue_progress", "blue", "progress", "sous_chef", { internal: "sensor.blue_temperature", channels: [], colors: ["blue"] });
  add("sensor.grill_ambient", "gateway", null, "thermoworks", { unit_of_measurement: "°F" });
  add("binary_sensor.grill_ambient_alarm", "gateway", "alarm", "sous_chef", { sensor: "sensor.grill_ambient" });
  add("number.grill_alarm_low", "gateway", "alarm_low", "sous_chef", { unit_of_measurement: "°F" });
  add("number.grill_alarm_high", "gateway", "alarm_high", "sous_chef", { unit_of_measurement: "°F" });
  return {
    states: all,
    entities,
    devices: { red: { id: "red", name: "RFX Probe Red" }, blue: { id: "blue", name: "RFX Probe Blue", name_by_user: null } },
    locale: { language: "en-US", time_format: "12" },
    callService: async () => undefined,
    callWS: async () => undefined as never,
    loadBackendTranslation: async () => (key: string) => key,
    formatEntityState: (s, state) => {
      const v = state ?? s.state;
      return s.attributes.unit_of_measurement ? `${v} ${s.attributes.unit_of_measurement}` : v === "medium_rare" ? "Medium rare" : v;
    },
  };
}

const RED_ON = {
  "switch.red_active": "on", "sensor.red_ch_1": "88", "sensor.red_ch_2": "93", "sensor.red_ch_3": "97", "sensor.red_ch_4": "104",
  "number.red_target": "130", "select.red_doneness": "medium_rare",
};

describe("finding the entities (registry: platform, device, translation key)", () => {
  it("lists the probes by their Active switch", () => expect(probeDevices(kit())).toEqual(["red", "blue"]));
  it("finds a probe's entities and what its Progress tells", () => {
    const red = probeOf(kit(), "red")!;
    expect(red.name).toBe("RFX Probe Red");
    expect(red.entities.alarm).toBe("binary_sensor.red_alarm");
    expect(red.entities.alarm_high).toBe("number.red_alarm_high");
    expect(red.channels).toHaveLength(4);
    expect(red.colors).toEqual(["red", "black"]);
    expect(red.start).toBe(60);
  });
  it("finds no probe on a device without Sous Chef", () => expect(probeOf(kit(), "gateway")).toBeUndefined());
  it("finds an ambient sensor through its Alarm, with the limits on its device", () =>
    expect(ambients(kit())).toEqual([{
      sensor: "sensor.grill_ambient", alarm: "binary_sensor.grill_ambient_alarm", low: "number.grill_alarm_low", high: "number.grill_alarm_high",
    }]));
});

describe("a probe's readings", () => {
  const hass = kit(RED_ON);
  it("the internal temperature is the lowest channel without its own sensor", () =>
    expect(internalSensor(hass, probeOf(hass, "red")!)).toBe("sensor.red_ch_1"));
  it("a one-sensor probe's internal temperature is that sensor", () =>
    expect(internalSensor(hass, probeOf(hass, "blue")!)).toBe("sensor.blue_temperature"));
  it("each channel against the reference: the coldest faintest, the hottest strongest", () => {
    const ch = channelReadings([88, 93, 97, 104], ["a", "b", "c", "d"]);
    expect(ch.map((c) => c.delta)).toEqual([undefined, 5, 9, 16]);
    expect(ch[0].reference && ch[0].tip).toBe(true);
    expect(ch.map((c) => c.heat)).toEqual([0, 5 / 16, 9 / 16, 1]);
  });
  it("channels a fraction of a degree apart look alike", () =>
    expect(channelReadings([68.1, 68.4], ["a", "b"])[1].heat).toBeCloseTo(0.03));
  it("the reference need not be the tip", () => {
    const ch = channelReadings([96, 91, 99], ["a", "b", "c"]);
    expect(ch.map((c) => c.reference)).toEqual([false, true, false]);
    expect(ch[0].delta).toBe(5);
  });
  it("no reading: no values, no reference", () =>
    expect(channelReadings([undefined, undefined], ["a", "b"]).every((c) => c.delta === undefined && !c.reference)).toBe(true));
});

describe("where a cook stands", () => {
  const status = (states: Record<string, string>) => statusOf(kit(states), probeOf(kit(states), "red")!);
  it("off while the switch is off", () => expect(status({ "switch.red_active": "off" })).toBe("off"));
  it("no reading without a value", () => expect(status({ "switch.red_active": "on" })).toBe("no_reading"));
  it("cooking with a value", () => expect(status(RED_ON)).toBe("cooking"));
  it("alarm before done before stalled", () => {
    expect(status({ ...RED_ON, "binary_sensor.red_stalled": "on", "binary_sensor.red_done": "on", "binary_sensor.red_alarm": "on" })).toBe("alarm");
    expect(status({ ...RED_ON, "binary_sensor.red_stalled": "on", "binary_sensor.red_done": "on" })).toBe("done");
    expect(status({ ...RED_ON, "binary_sensor.red_stalled": "on" })).toBe("stalled");
  });
});

describe("the state lines", () => {
  const now = Date.parse("2026-11-22T18:10:00");
  const line = (states: Record<string, string>) => {
    const hass = kit(states);
    return probeLine(hass, probeOf(hass, "red")!, now);
  };
  it("a probe: its doneness, then when it will be done", () =>
    expect(line({ ...RED_ON, "sensor.red_done_at": "2026-11-22T18:42:00" })).toEqual({ doneness: "Medium rare", status: "Done at 6:42 PM" }));
  it("no target: nothing (the target field says it)", () => expect(line({ ...RED_ON, "number.red_target": "unknown" })).toEqual({ doneness: undefined, status: "" }));
  it("done, and how far over", () => {
    expect(line({ ...RED_ON, "binary_sensor.red_done": "on", "sensor.red_ch_1": "131" }).status).toBe("Done");
    const over = { "sensor.red_ch_1": "138", "sensor.red_ch_2": "141", "sensor.red_ch_3": "144", "sensor.red_ch_4": "149" };
    expect(line({ ...RED_ON, ...over, "binary_sensor.red_done": "on" }).status).toBe("Done, 8 °F over");
  });
  it("an alarm says which limit", () => {
    const hass = kit({ ...RED_ON, "binary_sensor.red_alarm": "on", "number.red_alarm_high": "80" });
    expect(statusText(hass, probeOf(hass, "red")!, now)).toBe("Above 80 °F");
  });
  it("the grill: how many probes are on, then a probe that needs a look, then its own alarm", () => {
    const amb = (s: Record<string, string>) => {
      const hass = kit(s);
      return grillLine(hass, ambients(hass)[0], allProbes(hass));
    };
    expect(amb({})).toBe("No probes on");
    expect(amb(RED_ON)).toBe("1 probe on");
    expect(amb({ ...RED_ON, "switch.blue_active": "on" })).toBe("2 probes on");
    expect(amb({ ...RED_ON, "binary_sensor.red_done": "on" })).toBe("Red is done");
    expect(amb({ ...RED_ON, "binary_sensor.grill_ambient_alarm": "on", "sensor.grill_ambient": "198", "number.grill_alarm_low": "225" }))
      .toBe("Below 225 °F");
  });
  it("the grill's badge", () => {
    const hass = kit({ ...RED_ON, "binary_sensor.red_stalled": "on" });
    expect(grillBadge(hass, ambients(hass)[0], allProbes(hass))).toBe("stalled");
  });
});

describe("numbers as the card shows them", () => {
  it("a rate, signed, to one decimal", () => {
    expect(rateText(1.62)).toBe("+1.6°/min");
    expect(rateText(-2.4)).toBe("−2.4°/min");
    expect(rateText(0)).toBe("0.0°/min");
    expect(rateText(undefined)).toBe("");
  });
  it("a time left, short", () => {
    expect(durationText(32 * 60000)).toBe("32 min");
    expect(durationText(70 * 60000)).toBe("1 h 10 min");
    expect(durationText(120 * 60000)).toBe("2 h");
  });
  it("a trend: degrees a minute over the last five minutes", () => {
    const now = 10 * 60000;
    const samples: [number, number][] = [[now - 4 * 60000, 200], [now - 2 * 60000, 204], [now, 208]];
    expect(trendOf(samples, now)).toBeCloseTo(2);
    expect(trendOf([[now, 1]], now)).toBeUndefined();
  });
});

describe("names", () => {
  it("drops the words every probe starts with", () => expect(shortNames(["RFX Probe Red", "RFX Probe Blue"])).toEqual(["Red", "Blue"]));
  it("always keeps at least one word", () => expect(shortNames(["RFX Probe", "RFX Probe Blue"])).toEqual(["Probe", "Probe Blue"]));
});

describe("the card's options", () => {
  const card = { type: "custom:sous-chef-card", entity: "sensor.grill_ambient" };
  it("needs a grill", () => expect(() => checkConfig({ type: "custom:sous-chef-card" })).toThrow(/Choose a grill/));
  it("refuses an unknown option of its own, and an unknown value", () => {
    expect(() => checkConfig({ ...card, finish: "x", style_x: 1 })).toThrow(/Unknown option: style_x/);
    expect(() => checkConfig({ ...card, style: "chrome" })).toThrow(/Unknown style/);
    expect(() => checkConfig({ ...card, probe_list: [] })).toThrow(/Unknown option/);
  });
  it("leaves out options at their defaults", () =>
    expect(minimal({ ...card, style: "none", grill_icon: "bull", features_style: "match", probes_toggle: true })).toEqual({ ...card, grill_icon: "bull" }));
  it("hands the tile card only its own options", () => {
    const tile = tileConfig({ ...card, style: "black", features_style: "console" });
    expect(tile).toEqual({ type: "tile", entity: "sensor.grill_ambient" });
  });
  it("the grill: a tap shows or hides the probes, and a brand's mark is its picture", () => {
    expect(grillConfig(card).tap_action).toEqual({ action: "fire-dom-event", sous_chef_card: "toggle" });
    expect(grillConfig({ ...card, probes_toggle: false }).tap_action).toBeUndefined();
    expect(grillConfig({ ...card, grill_icon: "weber" }).show_entity_picture).toBe(true);
    expect(grillConfig(card).show_entity_picture).toBeUndefined();
  });
  it("a probe's tile: its food type in its color, with its features", () => {
    const tile = probeConfig(probeOf(kit(), "red")!, "Red");
    expect(tile.entity).toBe("select.red_food_type");
    expect(tile.color).toBe("red");
    expect(tile.state_content).toEqual(["state", "doneness", "status"]);
    expect(tile.tap_action).toEqual({ action: "none" });
    expect(tile.features.map((f: any) => f.type)).toEqual([
      "custom:sous-chef-progress", "custom:sous-chef-cook", "custom:sous-chef-channels", "custom:sous-chef-timing",
    ]);
  });
  it("a new card: the first grill, with the probes beside its name", () => {
    const stub = stubConfig(kit());
    expect(stub.entity).toBe("sensor.grill_ambient");
    expect(stub.features_position).toBe("inline");
    expect(stub.features[0].type).toBe("custom:sous-chef-probes");
  });
});

describe("the history's axis", () => {
  it("is on a round step around the readings, at least 20 degrees", () => {
    expect(axisRange([60.05, 60.45])).toEqual([55, 75]);
    expect(axisRange([60, 68, 72, 145])).toEqual([40, 160]);
    expect(axisRange([68, 225, 140])).toEqual([50, 250]);
    expect(axisRange([])).toBeUndefined();
  });
});

describe("the feature editors", () => {
  it("offer the controls in order, all by default, and the configuration's choice", () => {
    const form = featureForm([["trend", "Trend"], ["low", "Low alarm"], ["high", "High alarm"]], []);
    expect(form.schema[0].selector.select.reorder).toBe(true);
    expect(form.data({ type: "custom:sous-chef-ambient" }).controls).toEqual(["trend", "low", "high"]);
    expect(form.data({ type: "custom:sous-chef-ambient", controls: ["high", "nope"] }).controls).toEqual(["high"]);
  });
});

describe("the collapsed grill", () => {
  it("keeps only the feature beside the title", () => {
    const config = { type: "custom:sous-chef-card", entity: "sensor.grill_ambient", features_position: "inline",
      features: [{ type: "custom:sous-chef-probes" }, { type: "custom:sous-chef-history" }] };
    expect(grillConfig(config, false).features).toEqual([{ type: "custom:sous-chef-probes" }]);
    expect(grillConfig({ ...config, features_position: "bottom" }, false).features).toEqual([]);
    expect(grillConfig(config).features).toHaveLength(2);
  });
});

describe("Sous Chef probes", () => {
  const config = { type: "custom:sous-chef-card", entity: "sensor.grill_ambient", features_position: "inline",
    features: [{ type: "custom:sous-chef-probes" }, { type: "custom:sous-chef-probe-tiles", features: [{ type: "custom:sous-chef-cook" }] }] };
  it("is not among the grill's own features", () => {
    expect(grillConfig(config).features).toEqual([{ type: "custom:sous-chef-probes" }]);
    expect(grillConfig({ ...config, features: [config.features[1], config.features[0]] }, false).features).toEqual([{ type: "custom:sous-chef-probes" }]);
  });
  it("gives each probe its features, or the defaults", () => {
    expect(probeFeaturesOf(probeTilesOf(config))).toEqual([{ type: "custom:sous-chef-cook" }]);
    expect(probeFeaturesOf({ type: "custom:sous-chef-probe-tiles" })).toHaveLength(4);
    expect(probeTilesOf({ ...config, features: [] })).toBeUndefined();
  });
  it("gives each probe's tile its lines and name, or the defaults", () => {
    expect(probeLinesOf()).toEqual({ name: undefined, top: ["name"], bottom: ["state", "doneness", "status"] });
    const lines = probeLinesOf({ type: "custom:sous-chef-probe-tiles", name: " Brisket ", name_content: ["name", "state"], state_content: "status" });
    expect(lines).toEqual({ name: "Brisket", top: ["name", "state"], bottom: ["status"] });
    const tile = probeConfig(probeOf(kit(), "red")!, "Red", undefined, lines);
    expect([tile.name, tile.sc_primary, tile.state_content]).toEqual(["Brisket", ["name", "state"], ["status"]]);
  });
  it("is on a new card", () => expect(stubConfig(kit()).features.map((f: { type: string }) => f.type)).toContain("custom:sous-chef-probe-tiles"));
});

describe("the projections' spans", () => {
  it("go to the targets, then halve while past 15 minutes, then 15, 10 and 5", () => {
    expect(horizons(150)).toEqual([150, 75, 38, 19, 15, 10, 5]);
    expect(horizons(60)).toEqual([60, 30, 15, 10, 5]);
    expect(horizons(12)).toEqual([12, 10, 5]);
  });
  it("are said in hours and minutes", () => {
    expect(aheadText(150)).toBe("+2 h 30 min");
    expect(aheadText(60)).toBe("+1 h");
    expect(aheadText(15)).toBe("+15 min");
  });
});
