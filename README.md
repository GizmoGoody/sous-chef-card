# Grill

Meat probes on a Home Assistant dashboard, built first for ThermoWorks RFX probes on the ThermoWorks Cloud integration. This repository is one Home Assistant integration that also ships its own dashboard card.

- **The Grill integration** keeps each probe's cook as entities: cook type, doneness, target, progress, rate, done time, done and stalled. Every browser shows the same cook at once, a change made in one shows in all, and automations can use them. It replaces the helpers and the preset automation a grill setup used to need.
- **The Grill card** is Home Assistant's own **tile card**, wrapped. Everything a tile card does works the same way, with the same editor. The card adds:
  - **Grill progress**: progress to the target, the time left, and a stall.
  - **Grill cook**: the cook type and doneness, with built-in presets that set the target.
  - **Grill channels**: each sensor in the probe, in order from the tip.
  - **Grill probe**: one probe on a grill card, which opens to show its cook and channels.

> [!WARNING]
> **Alpha developmental software. Use with caution.** Do not rely on this card alone for food safety. Check the temperature with a second thermometer before serving.

> [!IMPORTANT]
> **Pre-release: expect changes.** While this is a pre-release, its entities, its configuration options and its editor can all change from one release to the next. An update may need you to set a grill or a card up again.

## Install

1. In HACS, add this repository as a custom repository of type **Integration**, then download **Grill**.
2. Restart Home Assistant.
3. Go to **Settings › Devices & services › Add integration** and add **Grill**. Give the grill a name.
4. On the grill, choose **Add probe** for each probe. For a ThermoWorks RFX MEAT, the reading is the probe's channel 0, the lowest of its four sensors; it is suggested for you. Choose the probe's colors and which channel is at its tip.

The card loads on every dashboard by itself. There is no dashboard resource to add.

## The card

Add a **Grill** card and choose what it shows:

- **A probe.** The tile is the probe: its reading, target and time left, in the probe's colors, with the cook type's icon. Add the features **Grill progress**, **Grill cook** and **Grill channels**, and Home Assistant's own **Trend graph** if you like. Tap the card to open or close it; a probe that is not in use stays closed unless **Always show** is on.
- **A grill.** The tile is a sensor for the grill, such as its ambient temperature. Add one **Grill probe** feature for each probe. Tap a probe to open its cook and channels.

You can use both on the same dashboard.

## The entities

Each probe's entities sit on the probe's own device, beside its ThermoWorks sensors:

| Entity | What it is |
| --- | --- |
| Cook type | Beef, Ground beef, Pork, Poultry, Seafood or Manual. Choosing one starts a new cook from the current reading. |
| Doneness | The cook type's presets, or Custom for any other target. Choosing one sets the target. |
| Target | The temperature the reading is cooking to. |
| Progress | How far the reading has come from the cook's start to the target. |
| Rate | Degrees per minute, over the last ten minutes. |
| Done at | When the reading will reach the target at its current rate. |
| Done | On once the reading reaches the target. |
| Stalled | On while the reading has stopped rising short of the target. |

### Presets (°F)

| Cook type | Doneness and target |
| --- | --- |
| Beef | Rare 125, Medium rare 135, Medium 145, Medium well 155, Well done 165 |
| Ground beef | Well done 160 |
| Pork | Medium 145, Well done 160 |
| Poultry | Done 165 |
| Seafood | Tuna 130, Salmon 145, Shrimp 145, Scallops 145, Lobster 145 |
| Manual | Any target you set |

## Development

- `custom_components/grill/`: the integration. `www/grill-card.js` is the card, one plain JavaScript file with no build step.
- `tests/`: the integration's tests, run in GitHub Actions with `pytest-homeassistant-custom-component`.
- `docs/index.html`: the design mockups.
- `reference/grill-card-v1.js`: the earlier card, kept for reference.

## License

MIT. See [LICENSE](LICENSE).
