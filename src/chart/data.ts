// The preset charts, as Sous Chef gives them (the sous_chef/charts command):
// every source in the order its Source select lists them, each with its
// foods and their doneness levels in °F and °C.
import { DOMAIN } from "../const";

export const MINE = "mine";

export interface ChartLevel {
  key: string;
  f: number;
  c: number;
  rest_minutes?: number;
  hold_minutes?: number;
}

export interface ChartFood {
  key: string;
  icon?: string | null;
  levels: ChartLevel[];
  // The government's safe minimum for the food, for Home Assistant's country (when Sous Chef gives one)
  safe_minimum?: { f: number; c: number } | null;
}

export interface ChartSource {
  key: string;
  url: string | null;
  government: boolean;
  countries: string[];
  foods: ChartFood[];
}

export interface Charts {
  sources: ChartSource[];
}

export const CHARTS_COMMAND = { type: `${DOMAIN}/charts` };

type Localize = (key: string) => string;

/**
 * A key's label from the integration's own entity translations. Mine's foods
 * and levels are the user's own names, so they show as they are; a key
 * without a translation shows as it is.
 */
export function labelOf(localize: Localize | undefined, select: "source" | "food_type" | "doneness", key: string, source?: string): string {
  if (select !== "source" && source === MINE) return key;
  return localize?.(`component.${DOMAIN}.entity.select.${select}.state.${key}`) || key;
}

/** A level's temperature in the probe's unit (°F or °C), as the chart gives it. */
export const temperatureOf = (level: { f: number; c: number }, unit?: string): number => (unit === "°C" ? level.c : level.f);

/** The rest or hold time a level asks for, as text. */
export function timesOf(level: ChartLevel): string {
  return [
    level.rest_minutes ? `Rest ${level.rest_minutes} min` : "",
    level.hold_minutes ? `Hold ${level.hold_minutes} min` : "",
  ].filter(Boolean).join(" · ");
}

export interface Choice {
  source: string;
  food: string;
  level: string;
}

/** The select_option actions for a choice, in order: Source, then Food type, then Doneness. */
export function stepsFor(choice: Choice, entities: { source?: string; food_type?: string; doneness?: string }): [string, string][] {
  const steps: [string | undefined, string][] = [
    [entities.source, choice.source],
    [entities.food_type, choice.food],
    [entities.doneness, choice.level],
  ];
  if (steps.some(([entityId]) => !entityId)) return [];
  return steps as [string, string][];
}

/** The rows of a chart, in order, as the list's options are indexed. */
export const rowsOf = (source: ChartSource): Choice[] =>
  source.foods.flatMap((food) => food.levels.map((level) => ({ source: source.key, food: food.key, level: level.key })));
