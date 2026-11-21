import { describe, expect, it } from "vitest";
import { labelOf, rowsOf, stepsFor, temperatureOf, timesOf, type ChartSource } from "../../src/chart/data";

const translations: Record<string, string> = {
  "component.sous_chef.entity.select.source.state.foodsafety_gov": "FoodSafety.gov (Safe Minimum Internal Temperatures)",
  "component.sous_chef.entity.select.source.state.mine": "Mine",
  "component.sous_chef.entity.select.food_type.state.beef": "Beef, veal and lamb",
  "component.sous_chef.entity.select.doneness.state.safe_minimum": "Safe minimum",
};
const localize = (key: string) => translations[key] ?? "";

const chart: ChartSource = {
  key: "foodsafety_gov", url: "https://www.foodsafety.gov/", government: true, countries: ["US"],
  foods: [
    { key: "beef", icon: "mdi:cow", levels: [{ key: "safe_minimum", f: 145, c: 63, rest_minutes: 3 }] },
    { key: "poultry", icon: "mdi:food-drumstick", levels: [{ key: "safe_minimum", f: 165, c: 74 }, { key: "dark_meat", f: 175, c: 79 }] },
  ],
};

describe("labels (the integration's entity translations)", () => {
  it("translates built-in keys", () => {
    expect(labelOf(localize, "source", "foodsafety_gov")).toBe("FoodSafety.gov (Safe Minimum Internal Temperatures)");
    expect(labelOf(localize, "food_type", "beef", "foodsafety_gov")).toBe("Beef, veal and lamb");
    expect(labelOf(localize, "doneness", "safe_minimum", "foodsafety_gov")).toBe("Safe minimum");
  });
  it("shows Mine's foods and levels by the user's own names, and Mine itself translated", () => {
    expect(labelOf(localize, "food_type", "beef", "mine")).toBe("beef");
    expect(labelOf(localize, "doneness", "Probe tender", "mine")).toBe("Probe tender");
    expect(labelOf(localize, "source", "mine")).toBe("Mine");
  });
  it("shows a key without a translation as it is", () => expect(labelOf(localize, "food_type", "game", "x")).toBe("game"));
});

describe("a level", () => {
  it("in the probe's unit, as the chart gives it", () => {
    expect(temperatureOf(chart.foods[0].levels[0], "°F")).toBe(145);
    expect(temperatureOf(chart.foods[0].levels[0], "°C")).toBe(63);
  });
  it("names its rest or hold time", () => {
    expect(timesOf(chart.foods[0].levels[0])).toBe("Rest 3 min");
    expect(timesOf({ key: "x", f: 158, c: 70, hold_minutes: 2 })).toBe("Hold 2 min");
    expect(timesOf(chart.foods[1].levels[0])).toBe("");
  });
});

describe("choosing a row", () => {
  it("rows follow the chart: each food's levels in order", () =>
    expect(rowsOf(chart).map((r) => `${r.food}/${r.level}`)).toEqual(["beef/safe_minimum", "poultry/safe_minimum", "poultry/dark_meat"]));
  it("sets Source, then Food type, then Doneness", () =>
    expect(stepsFor(rowsOf(chart)[2], { source: "select.s", food_type: "select.f", doneness: "select.d" })).toEqual([
      ["select.s", "foodsafety_gov"], ["select.f", "poultry"], ["select.d", "dark_meat"],
    ]));
  it("sets nothing when one of the three is missing", () =>
    expect(stepsFor(rowsOf(chart)[0], { source: "select.s", food_type: "select.f" })).toEqual([]));
});
