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
| C-2 | A tap on the grill shows or hides its features below the title and the probes, leaving the title row (with the feature beside the title), as in the Prusa Connect card; this browser remembers which, per grill. With Tap the card to show or hide the probes off, the probes always show and the grill's tap is the tile card's own | unit (grillConfig), real HA |
| C-3 | The editor's preview starts with the probes shown and changes only when tapped | real HA |
| C-4 | Every tile card option works on the grill: name, color, state content, actions, features, features position | real HA |
| C-5 | Wrong options are refused with a message (no grill, an unknown option of the card's own, an unknown value) | unit |
| C-6 | Options at their defaults are not saved | unit |
| C-7 | A new card: the first grill, State content state and cook, the Probes feature beside the title, then History and Ambient | unit |
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
| P-1 | Its entity is the probe's Food type, so the icon is the food's, in the probe's color; its name is the probe's short name (Red) | unit (probeConfig) |
| P-2 | State content `doneness` and `status`: Medium rare · Done at 6:42 PM; Done; Done, 8 °F over; Stalled; Above 150 °F; No reading; No target | unit |
| P-3 | Badge: alarm, done or stalled, as on the grill | real HA |
| P-4 | Its features two to a row with no lines between: progress and cook, then channels and timing; timing takes the whole row on a one-sensor probe | real HA |

## Features

The features are drawn as the Prusa Connect card's (its rows, keys, read-outs and fields): each item takes at least its minimum width (a key 36 px, a read-out or field 72 px), and a row leaves out the items that do not fit, except the probes and channels rows, which wrap so no probe or channel is left out. A value only shown (trend, rate, time left, channels) is a read-out, which does not press in under Console. A number field is typed in, or pressed and slid.

Each feature is offered only on a tile card for its kind of entity (a grill, or a probe), is 42 px tall, and never wraps or overflows; keys never narrower than 36 px. A feature with nothing to show takes no place. Unavailable controls are dimmed in place.

| ID | Behavior | Check |
| --- | --- | --- |
| F-1 | Sous Chef probes: a key for each probe beside the grill's name, the keys sharing the feature's width, its thermometer in the probe's color; pressed and solid while on, with its temperature (68°). A tap turns the probe's Active switch on or off. Editor: Show its temperature or the probe icon | real HA |
| F-2 | Sous Chef history: Home Assistant's history graph card of the last hour (Hours to show in the editor), the grill in orange, each probe that is on in its color and its target the same color dimmed (as the Prusa Connect card). The axis ends on a round step (5 to 100 degrees, about five lines), at least 20 degrees, so it never shows decimals or an odd end label. On a style, its screen, text and grid lines are in the finish's colors | unit (axisRange), real HA |
| F-3 | History projections: a key at the graph's top right; on, the hour ahead is drawn beside the graph on its own scale, dashed: each probe toward its target (reached at its Done at time), the grill level, with a line at now. The choice is remembered in this browser. Editor: Projections key on or off, and Home Assistant's history graph options (hours to show, expand legend, minimum and maximum Y axis, fit Y axis to the data); a Y axis set there replaces the round step | real HA |
| F-4 | Sous Chef ambient: the grill's trend (°/min over the last five minutes, with a trending icon), then its low and high alarms as icon and number fields, typed in place; empty is Off; a field turns red while the grill is past it. Editor: Controls (which, and their order) | unit (trendOf, editor), real HA |
| F-9 | Sous Chef progress (grill): a thin bar for each probe that is on, side by side, up to four to a row (five or more: two rows, spread evenly), its reading over it (68 → 130°), filled to its progress in its color, striped while stalled, a tap shows its progress. Nothing while no probe is on. Editor: Readings on or off | real HA |
| F-5 | Sous Chef progress: a bar filled to the cook's progress in the probe's color, 88 → 130 °F on it; striped while stalled; past the target, full with a mark at the goal | real HA |
| F-6 | Sous Chef cook: the food type key (its icon and an arrow; a tap lists the foods), the target (typed in with Custom, TARGET when empty; with a doneness, its temperature and an arrow, and a tap lists the levels), and the chart key, which opens the chart view. Editor: Controls | real HA |
| F-7 | Sous Chef channels: one key per channel from the tip, the tip's key pointed; the coldest the faintest and the hottest the strongest; each shows its value and its difference from the reference (the lowest); nothing under the reference, or a channel within 1 degree of it. Nothing on a one-sensor probe. Editor: Differences on or off | unit (channelReadings), real HA |
| F-8 | Sous Chef timing: the rate (+1.6°/min) and the time left (32 min, 1 h 10 min), or once done the rest the chart asks for (Rest 5 min). Editor: Controls | unit (rateText, durationText), real HA |

## Styles

| ID | Behavior | Check |
| --- | --- | --- |
| S-1 | Style: Stainless steel (brushed), Bull (warm satin stainless under a polished chrome band, as its hood), Black porcelain, Traeger bronze, Big Green Egg (pebbled glaze), Kamado Joe (smooth glaze), or None (the theme); the finish covers the whole card, with its own text colors | real HA |
| S-2 | Features style (with a style): Match (the controls on the finish), Flat (each on a plain patch of it), Console (keys that press in) | real HA |

## Editor

| ID | Behavior | Check |
| --- | --- | --- |
| E-1 | The tile card's own editor for the grill: its entity picker offers only grills (with a helper), and Content, Interactions and Features are Home Assistant's, without Icon | real HA |
| E-2 | The Sous Chef section: Style, Icon, Features style (only with a style), Tap the card to show or hide the probes, and Manage Sous Chef (Sous Chef's page) | real HA |
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
