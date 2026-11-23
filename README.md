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
  - **Style**: a grill's finish behind the whole card. Stainless steel (brushed: Napoleon, Lynx, Blaze, Recteq), Bull (its warm satin stainless), Black porcelain (Weber kettles, Traeger Ironwood and Timberline), Traeger bronze (Traeger Pro), Big Green Egg, Kamado Joe, or None (your theme).
  - **Icon**: Grill, or Bull, Weber, Traeger, Big Green Egg or Kamado Joe: the brand's small mark, without its name. Big Green Egg has no mark without its name, so it is a green egg.
  - **Features style** (with a style): Match (the controls sit on the finish), Flat (on a plain patch of it) or Console (keys that press in).
  - **Tap the card to show or hide features**: on by default. Folded, the card keeps only its title row (with the feature beside the title). This browser remembers which.
  - **Manage Sous Chef**: opens the Sous Chef page, where probes, ambient sensors and foods are added.

### The grill

The grill's icon turns orange once it is lit, and wears a badge when it needs a look: an alarm (red), a probe done (green) or stalled (amber). Its State content can show **cook**: the grill's alarm, a probe that needs a look (Red is done), or how many probes are on.

### The probes

A probe appears once it is on: taken off its charger, its key tapped, or its Active switch turned on (an automation can too). Its tile shows the food's icon in the probe's color, and its state: the doneness and where the cook stands (Medium rare · Done at 6:42 PM).

### Features

On the grill:

- **Sous Chef switches** (`custom:sous-chef-probes`): a key for each probe beside the grill's name, sharing its width, pressed while it is on, with its temperature. Tap one to turn the probe on or off. Options: show the temperature or the probe icon.
- **Sous Chef probes** (`custom:sous-chef-probe-tiles`): a tile for each probe that is on, below the grill. Its editor is Home Assistant's own features editor: choose each probe's features, their order, and each one's options. It also sets each tile's lines, as Home Assistant's State content does: the top line (Name by default) and the bottom line (food, doneness and status by default), with dots between values, and the Name shown (blank: the probe's). Remove it, and the card shows no probe tiles.
- **Sous Chef heat**: the grill's temperature on a heat map, one row: blue to red, the low and high alarms marked with their numbers, the range outside them shaded, and the target as a notch with its number. The reading rides on the bar with an arrow for its trend (doubled when it moves fast), red past an alarm. A tap shows the grill's history.
- **Sous Chef history**: Home Assistant's history graph of the last hour: the grill in orange and its target dimmed, each probe that is on in its color, and its target the same color dimmed. Its legend starts with every entry under More (unless Expand legend is on); left of More, the projections key draws where each temperature is headed beside the graph, on its scale. Each tap of the key goes to the next span: until every food reaches its target, then half that and half again while longer than 15 minutes, then 15, 10 and 5 minutes, then off. The time ahead is drawn on the history's own time scale, and the key and the legend are centered on the whole graph. The graph grows taller as more probes are on. The axis is in whole degrees, and on a style the graph takes the finish's colors. Options: the projections key, and Home Assistant's history graph options (hours to show, expand legend, Y axis).
- **Sous Chef progress**: a thin bar for each probe that is on, one above another, each across the card, filled to its progress in its color; up to four fit in one row's height. Options: Text (each probe's temperature and target beside its bar, left-justified so the temperatures line up): Off, Left or Right.
- **Sous Chef ambient**: the grill's trend in degrees a minute, its target, and its low and high alarms. A tap on the target lists the cook styles with their targets (Smoke · 225°); a style sets the target and both alarms, and Custom opens the keyboard for a target, which a press and slide then changes. A limit is typed in place, or pressed and slid; empty is off. Options: which controls, in which order.

On each probe:

- **Sous Chef progress**: the cook's bar in the probe's color, internal → target.
- **Sous Chef cook**: the target and the chart. A tap on the target lists the doneness levels; choosing Custom opens the keyboard for a temperature, and at Custom a press and slide changes it. The chart opens the chart view. The food type is the probe's icon: tap it to choose another.
- **Sous Chef channels**: one read-out shaped like the probe, in the look of the other read-outs, its tip at the left, holding each channel's temperature from the tip, separated by dots, with its difference from the reference (the lowest) under it when more than 1 degree. It is filled in the probe's color, faintest at the coldest channel and strongest at the hottest, blending between them. A tap on one shows its history. Options: the differences on or off.
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
  - type: custom:sous-chef-probe-tiles
features_position: inline
style: stainless
grill_icon: bull
features_style: match
```

| Option | Values | Default |
| --- | --- | --- |
| `style` | `none`, `stainless`, `bull`, `black`, `bronze`, `big_green_egg`, `kamado_joe` | `none` |
| `grill_icon` | `grill`, `bull`, `weber`, `traeger`, `big_green_egg`, `kamado_joe` | `grill` |
| `features_style` | `match`, `flat`, `console` | `match` |
| `probes_toggle` | `true`, `false` | `true` |

Brand names and marks belong to their owners; they are shown only to match a grill.

## Development

Lit and TypeScript, built with Rollup into `dist/sous-chef-card.js`. GitHub Actions runs the typecheck, lint, unit tests and build on every push. The brand marks are in `assets/brands`; after changing one, run `node scripts/brands.mjs`. A `v*` tag publishes a release with the built card; a tag with a hyphen (`v0.2.0-alpha.1`) publishes a pre-release.
