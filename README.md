# Sous Chef Card

Sous Chef on a Home Assistant dashboard: for the grill, the smoker and the kitchen.

One card for the grill and every probe. The grill is Home Assistant's own tile card, so everything a tile card does works the same way: name, color, state content, actions and features. Below it, each probe that is on gets a tile of its own. A tap on the grill folds the card to its title row, and opens it again. It needs the [Sous Chef](https://github.com/GizmoGoody/sous-chef) integration.

## Installation

1. Go to **Settings → Marketplace**.
2. Open **⋮ → Add from link**, enter `GizmoGoody/sous-chef-card`, and choose the type **Dashboard**.
3. Install **Sous Chef Card**. For a pre-release, turn on the repository's **Pre-release** switch (**Settings → Devices & services → Marketplace →** the repository's device), or use **⋮ → Install another version**.

## Configuration

Add the **Sous Chef** card to a dashboard. In its editor:

- The tile card's own editor, for the grill: pick a grill (a Sous Chef ambient sensor), then Content, Interactions and Features.
- **Sous Chef**:
  - **Style**: a grill's finish behind the whole card. Stainless steel (Bull, Napoleon, Lynx, Blaze, Recteq), Black porcelain (Weber kettles, Traeger Ironwood and Timberline), Bronze (Traeger Pro), Green ceramic (Big Green Egg), Red ceramic (Kamado Joe), or None (your theme).
  - **Icon**: Grill, or Bull, Weber, Traeger, Big Green Egg or Kamado Joe: the brand's small mark, without its name. Big Green Egg has no mark without its name, so it is a green egg.
  - **Features style** (with a style): Match (the controls sit on the finish), Flat (on a plain patch of it) or Console (keys that press in).
  - **Tap the card to show or hide the probes**: on by default. Folded, the card keeps only its title row (with the feature beside the title). This browser remembers which.
  - **Manage Sous Chef**: opens the Sous Chef page, where probes, ambient sensors and foods are added.

### The grill

The grill's icon turns orange once it is lit, and wears a badge when it needs a look: an alarm (red), a probe done (green) or stalled (amber). Its State content can show **cook**: the grill's alarm, a probe that needs a look (Red is done), or how many probes are on.

### The probes

A probe appears once it is on: taken off its charger, its key tapped, or its Active switch turned on (an automation can too). Its tile shows the food's icon in the probe's color, and its state: the doneness and where the cook stands (Medium rare · Done at 6:42 PM).

### Features

On the grill:

- **Sous Chef probes**: a key for each probe beside the grill's name, pressed while it is on, with its temperature. Tap one to turn the probe on or off. Options: show the temperature or the probe icon.
- **Sous Chef history**: Home Assistant's history graph of the last hour: the grill in orange, each probe that is on in its color, and its target the same color dimmed. The key at the top right shows projected temperatures for the hour ahead. The axis is in whole degrees, and on a style the graph takes the finish's colors. Options: hours to show, and the projections key.
- **Sous Chef ambient**: the grill's trend in degrees a minute, and its low and high alarms. Type a limit in place; empty is off. Options: which controls, in which order.

On each probe:

- **Sous Chef progress**: the cook's bar in the probe's color, internal → target.
- **Sous Chef cook**: the food type, the target (typed in with Custom, or the doneness's temperature; tap to choose another level), and the chart: every food, doneness and temperature of a source, with each food's safe minimum. Choose a row to set the probe's Source, Food type and Doneness. Options: which controls, in which order.
- **Sous Chef channels**: one key for each channel from the tip (pointed), tinted by its heat, with its difference from the reference (the lowest, REF). Options: the differences on or off.
- **Sous Chef timing**: the rate, and the time left; once done, the rest the chart asks for. Options: which controls, in which order.

Each feature's options are in its editor (the pencil beside it in Features). The features also work in any tile card for a Sous Chef ambient sensor or probe.

### YAML

```yaml
type: custom:sous-chef-card
entity: sensor.grill_ambient
name: Grill
state_content:
  - state
  - cook
features:
  - type: custom:sous-chef-probes
  - type: custom:sous-chef-history
  - type: custom:sous-chef-ambient
features_position: inline
style: stainless
grill_icon: bull
features_style: match
```

| Option | Values | Default |
| --- | --- | --- |
| `style` | `none`, `stainless`, `black`, `bronze`, `green`, `red` | `none` |
| `grill_icon` | `grill`, `bull`, `weber`, `traeger`, `big_green_egg`, `kamado_joe` | `grill` |
| `features_style` | `match`, `flat`, `console` | `match` |
| `probes_toggle` | `true`, `false` | `true` |

Brand names and marks belong to their owners; they are shown only to match a grill.

## Development

Lit and TypeScript, built with Rollup into `dist/sous-chef-card.js`. GitHub Actions runs the typecheck, lint, unit tests and build on every push. The brand marks are in `assets/brands`; after changing one, run `node scripts/brands.mjs`. A `v*` tag publishes a release with the built card; a tag with a hyphen (`v0.2.0-alpha.1`) publishes a pre-release.
