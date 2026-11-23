// A feature's editor form, as the Prusa Connect card's: its controls, chosen
// and ordered in a list, then its options. Kept apart from the features so
// it is tested without a browser.
import type { Config } from "../ha";

/** One of a feature's options in its editor: a Home Assistant selector, and its default. */
export interface FeatureOption {
  name: string;
  label: string;
  helper?: string;
  selector: Record<string, unknown>;
  default: unknown;
}

/** The form, and the values it shows for a configuration. */
export interface FeatureForm {
  schema: Config[];
  data(config: Config): Config;
}

/** The controls chosen in a configuration, in order: those offered; all of them without a choice. */
export function chosenOf(controls: [string, string][], config: Config): string[] {
  const ids = controls.map(([id]) => id);
  return Array.isArray(config.controls) ? config.controls.filter((id: string) => ids.includes(id)) : ids;
}

export function featureForm(controls: [string, string][], options: FeatureOption[]): FeatureForm {
  return {
    schema: [
      ...(controls.length ? [{
        name: "controls", label: "Controls",
        selector: { select: { multiple: true, reorder: true, mode: "dropdown", options: controls.map(([value, label]) => ({ value, label })) } },
      }] : []),
      ...options.map((o) => ({ name: o.name, label: o.label, ...(o.helper ? { helper: o.helper } : {}), selector: o.selector })),
    ],
    data: (c) => ({
      ...(controls.length ? { controls: chosenOf(controls, c) } : {}),
      ...Object.fromEntries(options.map((o) => [o.name, c[o.name] ?? o.default])),
    }),
  };
}
