# Sous Chef card: what it does

Every behavior has an ID. Each names the check that covers it:

- **unit**: `tests/unit/*.test.ts`, run by Vitest on CI.
- **real HA (by hand)**: what needs Home Assistant's own elements (the tile card, its editor, the history graph). Check these on a dashboard.

Browser checks on stand-ins, as the SVS Subwoofer and Prusa Connect cards have, are not written yet.

Sources: the approved mockup (https://claude.ai/artifact/B99qWiXfVKJG1A7KXJKKzD: A typical cook, Every state, Styles), the sibling cards' specs (xTool, Prusa Connect, SVS Subwoofer), and the owner's feedback.

## Card (`sous-chef-card`)

| ID | Behavior | Check |
| --- | --- | --- |
| C-1 | One card for the grill and every probe: the grill (a Sous Chef ambient sensor) is Home Assistant's tile card on top; below it, one tile card for each probe that is on. A probe that is off takes no place | real HA |
| C-2 | A tap on the grill shows or hides its features below the title and the probes, leaving the title row (with the feature beside the title), as in the Prusa Connect card; this browser remembers which, per grill. With Tap the card to show or hide features off, the probes always show and the grill's tap is the tile card's own | unit (grillConfig), real HA |
| C-3 | The editor's preview starts with the probes shown and changes only when tapped | real HA |
| C-4 | Every tile card option works on the grill: name, color, state content, actions, features, features position | real HA |
| C-5 | Wrong options are refused with a message (no grill, an unknown option of the card's own, an unknown value) | unit |
| C-6 | Options at their defaults are not saved | unit |
| C-7 | A new card: the first grill, State content state and cook, the switches beside the title, then History, Ambient and Sous Chef probes | unit |
| C-8 | The tiles are one surface: no card, border or hover of their own, and no lines between features | real HA |

## Grill tile

| ID | Behavior | Check |
| --- | --- | --- |
| G-1 | Icon: the grill icon, orange once the grill is lit (120 °F, 50 °C), grey while cold; a color chosen in the tile options wins | real HA |
| G-2 | Icon option: Grill, or a brand (Bull, Weber, Traeger, Big Green Egg, Kamado Joe): the brand's small mark without its name, in place of the icon (Big Green Egg has none without its name, so a green egg) | unit (grillConfig), real HA |
| G-3 | State content `cook`: the grill's alarm (Below 225 °F), else a probe that needs a look (Red alarm, Red is done, Blue stalled), else how many probes are on | unit |
| G-4 | Badge at the icon's top right, 18 px with a 12 px icon: alarm (red), done (green), stalled (amber) | unit (grillBadge), real HA |

## Probe tile

| ID | Behavior | Check |
| --- | --- | --- |
| P-1 | Its entity is the probe's Food type, so the icon is the food's, in the probe's color; its name is the probe's short name (Red); its state line starts with the food. A tap on the icon lists the foods (the browser's own list, over the icon); a tap elsewhere on the tile does nothing | unit (probeConfig) |
| P-2 | State content `state` (the food), `doneness` and `status`: Medium rare · Done at 6:42 PM; Done; Done, 8 °F over; Stalled; Above 150 °F; No reading; nothing without a target | unit |
| P-3 | Badge: alarm, done or stalled, as on the grill | real HA |
| P-4 | Its features two to a row with no lines between: progress and cook, then channels and timing; timing takes the whole row on a one-sensor probe | real HA |

## Features

The features are drawn as the Prusa Connect card's (its rows, keys, read-outs and fields): each item takes at least its minimum width (a key 36 px, a read-out or field 72 px), and a row leaves out the items that do not fit, except the probes and channels rows, which wrap so no probe or channel is left out. A value only shown (trend, rate, time left, channels) is a read-out, which does not press in under Console. A number field is typed in, or pressed and slid.

Each feature is offered only on a tile card for its kind of entity (a grill, or a probe), is 42 px tall, and never wraps or overflows; keys never narrower than 36 px. Every control's content is centered; a field's number and degree sign sit together. A switch key too narrow for its temperature drops the degree sign. Icons in a light probe color (green, yellow, white) are drawn darker. A feature with nothing to show takes no place. Unavailable controls are dimmed in place.

| ID | Behavior | Check |
| --- | --- | --- |
| F-1 | Sous Chef switches (custom:sous-chef-probes): a key for each probe beside the grill's name, the keys sharing the feature's width, its thermometer in the probe's color; pressed and solid while on, with its temperature (68°). A tap turns the probe's Active switch on or off. Editor: Show its temperature or the probe icon | real HA |
| F-2 | Sous Chef history: Home Assistant's history graph card of the last hour (Hours to show in the editor), the grill in orange, each probe that is on in its color and its target the same color dimmed (as the Prusa Connect card). The axis ends on a round step (5 to 100 degrees, about five lines), at least 20 degrees, so it never shows decimals or an odd end label. 240 px tall with one probe on, 24 px more for each probe after it, up to 360 px; the legend folded unless Expand legend is on. On a style, its screen, text and grid lines are in the finish's colors | unit (axisRange), real HA |
| F-3 | History projections: a key left of the legend's More. Each tap goes to the next span: until every probe that is on reaches its target (an hour without one), then half that and half again while longer than 15 minutes, then 15, 10 and 5 minutes, then the targets again; the step is remembered in this browser. Shown, the span ahead is drawn from the plot's right edge, with room at the card's edge, on the graph's own scale, dashed: each probe toward its target (reached at its Done at time), the grill level, with a line at now and the span under it (+2 h 30 min). The legend starts with every entry under More unless Expand legend is on. Editor: Projections key on or off, and Home Assistant's history graph options (hours to show, expand legend, minimum and maximum Y axis, fit Y axis to the data); a Y axis set there replaces the round step | unit (horizons, aheadText), real HA |
| F-4 | Sous Chef ambient: the grill's trend (°/min over the last five minutes, with a trending icon), then its low and high alarms as icon and number fields, typed in place; empty is Off; a field turns red while the grill is past it. Editor: Controls (which, and their order) | unit (trendOf, editor), real HA |
| F-10 | Sous Chef probes (custom:sous-chef-probe-tiles): with it among the grill's features, a tile for each probe that is on, below the grill (see Probe tile); without it, none. It takes no room among the grill's features. Its editor is Home Assistant's own features editor for a probe: each probe's features, their order, and the pencil opens each one's editor; at the defaults (progress, cook, channels, timing) nothing is saved. Without a probe, it says to add one in Sous Chef | unit (probeTilesOf, grillConfig), real HA |
| F-9 | Sous Chef progress (grill): a thin bar for each probe that is on, one above another, each across the card, filled to its progress in its color, striped while stalled; up to four fit in one row's height (more make it taller). Text: off, or each one's reading (68 → 130°) left or right of its bar. A tap shows its progress. Nothing while no probe is on. Editor: Text (Off, Left, Right) | real HA |
| F-5 | Sous Chef progress: a bar filled to the cook's progress in the probe's color (lighter, so its numbers read), 88 → 130 °F on it in the text color of the other controls; striped while stalled; past the target, full with a mark at the goal | real HA |
| F-6 | Sous Chef cook: the target and the chart key. A tap on the target lists the doneness levels; choosing Custom (also again) opens the keyboard for a temperature; at Custom a press and slide changes it; TARGET when empty. Without a doneness, the target is typed in. The chart key opens the chart view. Editor: Controls | real HA |
| F-7 | Sous Chef channels: one read-out in the shape of the probe, its sharp tip at the left, filling its place and in the read-outs' look (set in on Console); in it each channel's temperature from the tip, separated by dots, with its difference from the reference (the lowest) under it when more than 1 degree; a tap on one shows its history. The outline is filled in the probe's color, faintest at the coldest channel and strongest at the hottest (the tip's color from the point), blending smoothly between them. Nothing on a one-sensor probe. Editor: Differences on or off | unit (channelReadings), real HA |
| F-8 | Sous Chef timing: the rate (+1.6°/min) and the time left (32 min, 1 h 10 min), or once done the rest the chart asks for (Rest 5 min). Editor: Controls | unit (rateText, durationText), real HA |

## Styles

| ID | Behavior | Check |
| --- | --- | --- |
| S-1 | Style: Stainless steel (brushed), Bull (warm satin stainless), Black porcelain, Traeger bronze, Big Green Egg (pebbled glaze), Kamado Joe (smooth glaze), or None (the theme); the finish covers the whole card, with its own text colors | real HA |
| S-2 | Features style (with a style): Match (the controls on the finish), Flat (each on a plain patch of it), Console (keys that press in) | real HA |

## Editor

| ID | Behavior | Check |
| --- | --- | --- |
| E-1 | The tile card's own editor for the grill: its entity picker offers only grills (with a helper), and Content, Interactions and Features are Home Assistant's, without Icon | real HA |
| E-2 | The Sous Chef section: Style, Icon, Features style (only with a style), Tap the card to show or hide features, and Manage Sous Chef (Sous Chef's page) | real HA |
| E-3 | State content offers the grill's `cook` | real HA |
| E-4 | Each feature with choices has an editor, as the Prusa Connect card's: Controls (a list to choose and reorder) and its options; only what differs from the defaults is saved | unit (editor), real HA |

## Chart view

| ID | Behavior | Check |
| --- | --- | --- |
| V-1 | Home Assistant's dialog, titled with the probe's name and Choose a doneness; the source in Home Assistant's select, and Open the chart | real HA |
| V-2 | A section for each food, with its safe minimum on the right when Sous Chef gives one | real HA |
| V-3 | Choosing a row sets the probe's Source, Food type and Doneness, in that order | unit |

## Needs the Sous Chef integration

- Safe minimums per food (V-2), chef sources only, beef, veal and lamb apart, auto-off on the charger: in the integration's prompt.
- Ambient trend: the card works it out from the grill's history until Sous Chef gives a rate.
