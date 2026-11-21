# Sous Chef Card

Sous Chef on a Home Assistant dashboard: for the grill, the smoker and the kitchen.

The card is Home Assistant's own tile card, with Sous Chef features on top. Everything a tile card does works the same way: name, icon, color, state content, actions and the core features. It needs the [Sous Chef](https://github.com/GizmoGoody/sous-chef) integration.

## Installation

1. Go to **Settings → Marketplace**.
2. Open **⋮ → Add from link**, enter `GizmoGoody/sous-chef-card`, and choose the type **Dashboard**.
3. Install **Sous Chef Card**. For a pre-release, turn on the repository's **Pre-release** switch (**Settings → Devices & services → Marketplace →** the repository's device), or use **⋮ → Install another version**.

## Configuration

Add the **Sous Chef** card to a dashboard. In its editor:

- **Probes**: the probes to show, in order. Empty shows every probe.
- **Ambient sensors**: the grill, pit or oven sensors to show. Empty shows every one.
- **Manage**: opens the Sous Chef page, where probes, ambient sensors and foods are added.
- Below them is the tile card's own editor.

### Two views

| View | Tile entity | Features |
| --- | --- | --- |
| Probe | the probe's Active switch: tapping the icon starts or ends its cook | Sous Chef progress, Sous Chef preset, Sous Chef channels |
| Grill | the first ambient sensor | Sous Chef ambient, Sous Chef probes |

A new card is a grill view when Sous Chef has an ambient sensor, and otherwise a probe view for the first probe.

### Features

- **Sous Chef progress**: a ring in the probe's colors (striped for several), Internal → Target, Done at, and Rate. Done, Stalled, Alarm or No reading shows in place of Done at.
- **Sous Chef preset**: Food type and Doneness, Target, and the source with a link to its chart.
- **Sous Chef channels**: ch 1 to ch n from the tip, with the current Max outlined.
- **Sous Chef ambient**: the other ambient sensors, and an Alarm for any sensor that is out of range.
- **Sous Chef probes**: an Active switch for each probe, and a ring and a row for each probe that is on. Tap a row to open its preset and channels.

The features also work in any tile card whose entity is a Sous Chef probe's or an ambient sensor.

Done at follows the tile card's **Time format** and shows the time by default.

### YAML

```yaml
type: custom:sous-chef-card
entity: sensor.grill_ambient
name: Big Green Egg
probes:
  - 0123456789abcdef0123456789abcdef # device IDs
ambient:
  - sensor.grill_ambient
features:
  - type: custom:sous-chef-ambient
  - type: custom:sous-chef-probes
```

## Development

Lit and TypeScript, built with Rollup into `dist/sous-chef-card.js`. GitHub Actions runs the typecheck, lint, unit tests and build on every push. A `v*` tag publishes a release with the built card; a tag with a hyphen (`v0.2.0-alpha.1`) publishes a pre-release.
