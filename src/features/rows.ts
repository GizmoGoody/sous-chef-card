// From the Prusa Connect card (its rows.ts), the same in every card.
// Rows of a feature's items: each item takes at least its minimum width, and
// a row that does not wrap leaves out the items that do not fit.
import { css, unsafeCSS } from "lit";

// The narrowest each kind of item in a row may be (px): a key as Home
// Assistant's tile icon; a field, read-out and slider need room for their numbers
export const ITEM_MIN = { key: 36, readout: 72, field: 72, slider: 72, wide: 120 };

/** An item's narrowest width (px). */
const itemMin = (el: Element): number => Number((el as HTMLElement).dataset.min) || ITEM_MIN.key;

/**
 * Fit a row's items into its width, in order: each takes at least its
 * minimum, and from the first that does not fit on, the items are left out
 * (data-dropped). A row that wraps leaves none out.
 *
 * Beside a feature of more lines (--sc-lines, set by the card), a
 * feature fills the same height: its one row of keys wraps onto as many
 * lines, and its rows grow to fill what is left (data-fill).
 */
export function fitRow(row: HTMLElement): void {
  const width = row.clientWidth;
  if (!width) return;
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  const beside = Number(getComputedStyle(row).getPropertyValue("--sc-lines")) || 0;
  const container = row.parentElement;
  const lone = !container || container.querySelectorAll(":scope > .row").length === 1;
  const shown = [...row.children].filter((item) => !(item as HTMLElement).hidden);
  const count = shown.length;
  container?.toggleAttribute("data-fill", beside > 0);
  // A row of keys or fields alone in its feature wraps to match; a slider stays on its line
  const wraps = row.classList.contains("wraps") || (beside > 1 && lone && count > 1 && !row.querySelector(":scope > .slide"));
  row.toggleAttribute("data-wraps", wraps);
  let natural = 1;
  if (wraps) {
    // As many to a row as fit, spread evenly over the rows; the last row's
    // cells widen to fill it, so no row has an empty end
    for (const item of row.children) item.removeAttribute("data-dropped");
    if (row.classList.contains("wraps")) {
      // The lines the items take at their narrowest, in order
      let used = 0;
      for (const item of shown) {
        const min = itemMin(item);
        if (used && used + gap + min > width + 0.5) {
          natural += 1;
          used = min;
        } else used += (used ? gap : 0) + min;
      }
    }
    const lines = Math.min(Math.max(natural, beside), Math.max(count, 1));
    row.style.setProperty("--columns", `${count ? Math.ceil(count / lines) : 1}`);
  } else {
    row.style.removeProperty("--columns");
    let used = 0, placed = 0, full = false;
    for (const item of shown) {
      const need = itemMin(item) + (placed ? gap : 0);
      full ||= used + need > width + 0.5;
      item.toggleAttribute("data-dropped", full);
      if (!full) {
        used += need;
        placed += 1;
      }
    }
  }
  if (row.dataset.lines !== `${natural}`) {
    row.dataset.lines = `${natural}`;
    // The card matches the features beside it (see linesOf)
    row.dispatchEvent(new Event("sc-lines", { bubbles: true, composed: true }));
  }
}

/** A feature's own lines (rows, each wrapped as it needs), not counting those it takes to match the feature beside it. */
export function linesOf(feature: ParentNode): number {
  return [...feature.querySelectorAll<HTMLElement>(".row")].reduce((sum, row) => sum + (Number(row.dataset.lines) || 1), 0);
}

/** Fits rows now and whenever their width changes. */
export class RowFitter {
  private _observer = new ResizeObserver((entries) => entries.forEach((entry) => fitRow(entry.target as HTMLElement)));
  private _rows = new WeakSet<Element>();

  fit(rows: Iterable<HTMLElement>): void {
    for (const row of rows) {
      if (!this._rows.has(row)) {
        this._rows.add(row);
        this._observer.observe(row);
      }
      fitRow(row);
    }
  }
}

// One line of items that fills the row (see fitRow), or (wraps) cells as
// many to a row as fit, spread evenly, the last row's widened to fill it
export const rowStyles = css`
  .rows { display: flex; flex-direction: column; gap: var(--ha-card-feature-gap, 12px); }
  .row { display: flex; flex-wrap: nowrap; align-items: center; column-gap: var(--feature-button-spacing, 12px); height: var(--feature-height, 42px); }
  .row.wraps, .row[data-wraps] {
    display: flex; flex-wrap: wrap; height: auto;
    gap: var(--ha-card-feature-gap, 12px) var(--feature-button-spacing, 12px);
  }
  .row.wraps > *, .row[data-wraps] > *, .row[data-wraps] > .key, .row[data-wraps] > .field, .row[data-wraps] > .slide,
  .row.wraps > .key, .row.wraps > .field, .row.wraps > .slide {
    height: var(--feature-height, 42px); min-width: 0; box-sizing: border-box;
    flex: 1 1 calc((100% - (var(--columns, 2) - 1) * var(--feature-button-spacing, 12px)) / var(--columns, 2));
  }
  /* Beside a feature of more lines: as tall as it, the rows and their items grown to fill */
  .rows[data-fill] {
    min-height: calc(var(--sc-lines, 1) * var(--feature-height, 42px) + (var(--sc-lines, 1) - 1) * var(--ha-card-feature-gap, 12px));
  }
  .rows[data-fill] > .row { flex: 1 1 auto; height: auto; min-height: var(--feature-height, 42px); align-items: stretch; align-content: stretch; }
  .rows[data-fill] > .row > * { height: auto; min-height: var(--feature-height, 42px); }
  .row [data-dropped] { display: none !important; }
  .row .key { flex: 1 1 0; min-width: ${unsafeCSS(ITEM_MIN.key)}px; }
  .row .slide { flex: 2 1 0; min-width: ${unsafeCSS(ITEM_MIN.slider)}px; }
  .row .field { flex: 1 1 0; min-width: ${unsafeCSS(ITEM_MIN.field)}px; }
  .row .field.readout.wide { flex: 2 1 0; min-width: ${unsafeCSS(ITEM_MIN.wide)}px; }
`;
