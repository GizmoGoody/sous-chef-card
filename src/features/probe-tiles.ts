// Sous Chef probes: whether the card shows a tile for each probe that is on,
// and the features each of those tiles shows. Among the grill's features it
// takes no room: the card draws the probes' tiles below the grill, as
// before, so their layout is the card's own. Remove it, and the card shows
// no probe tiles. Its editor is Home Assistant's own features editor for a
// probe (see editor/probe-tiles-editor.ts).
import { nothing } from "lit";
import { FEATURES, PROBE_TILES_EDITOR_TYPE } from "../const";
import { SousChefFeature } from "./base";

export class SousChefProbeTiles extends SousChefFeature {
  static override tag = FEATURES.probeTiles;
  static override pickerName = "Sous Chef probes";
  static override forKind = "grill" as const;

  static override getConfigElement(): HTMLElement {
    return document.createElement(PROBE_TILES_EDITOR_TYPE);
  }

  static override get configurable(): boolean {
    return true;
  }

  // The tiles are the card's: here, nothing
  protected override render(): typeof nothing {
    this.showNothing(true);
    return nothing;
  }
}
