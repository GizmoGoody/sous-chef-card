// The card's styles, and the sheets it adds to Home Assistant's elements.
// Every corner, color and size comes from the theme, or from the style's finish.
import { css } from "lit";

export const cardStyles = css`
  :host { display: block; }
  .panel {
    position: relative; isolation: isolate; box-sizing: border-box; overflow: hidden;
    border-radius: var(--ha-card-border-radius, var(--ha-border-radius-lg, 12px));
    background: var(--ha-card-background, var(--card-background-color, #fff));
    -webkit-backdrop-filter: var(--ha-card-backdrop-filter, none); backdrop-filter: var(--ha-card-backdrop-filter, none);
    border: var(--ha-card-border-width, 1px) solid var(--ha-card-border-color, var(--divider-color, #e0e0e0));
    box-shadow: var(--ha-card-box-shadow, none);
    color: var(--primary-text-color);
  }
  .finished { background: var(--sc-surface); border-color: var(--sc-border); -webkit-backdrop-filter: none; backdrop-filter: none; }
  .finished::after {
    content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, .16), inset 0 -1px 0 rgba(0, 0, 0, .4);
  }
  /* The tiles are parts of one surface: no card of their own */
  .panel > * {
    --ha-card-background: transparent; --card-background-color: transparent; --ha-card-box-shadow: none;
    --ha-card-border-color: transparent; --ha-card-border-width: 0; --ha-card-backdrop-filter: none;
    --ha-card-feature-divider: none;
  }
  /* On a finish, its own text colors, and the controls on it */
  .dark {
    --primary-text-color: rgba(255, 255, 255, .95); --secondary-text-color: rgba(235, 235, 240, .7);
    --disabled-text-color: rgba(255, 255, 255, .38);
    --sc-text: rgba(255, 255, 255, .95); --sc-scrim: rgba(0, 0, 0, .3); --sc-screen: rgba(10, 10, 14, .82);
  }
  .light {
    --primary-text-color: rgba(0, 0, 0, .85); --secondary-text-color: rgba(40, 40, 48, .7);
    --disabled-text-color: rgba(0, 0, 0, .38);
    --sc-text: rgba(0, 0, 0, .85); --sc-scrim: rgba(255, 255, 255, .5); --sc-screen: rgba(10, 10, 14, .82);
  }
  /* The history is a dark screen on any finish */
  .finished { --sc-screen-text: rgba(255, 255, 255, .9); }
  /* Flat and Console: each control on a plain patch of the finish */
  .solid { --sc-backing: var(--sc-base); }
  .probes { display: grid; }
  .panel:not(.open) .probes { display: none; }
`;

export const tileStyles = css`
  :host { display: block; position: relative; }
  hui-tile-card { display: block; }
  .badge {
    position: absolute; z-index: 3; width: 18px; height: 18px; margin: -9px 0 0 -9px; box-sizing: border-box;
    display: none; place-items: center; border-radius: 50%; pointer-events: none; color: #fff;
    border: 2px solid var(--sc-badge-ring, var(--ha-card-background, var(--card-background-color, #fff)));
  }
  .badge.on { display: grid; }
  .badge ha-icon { --mdc-icon-size: 12px; display: flex; }
`;

/**
 * Inside the tile card: no hover highlight of its own (the panel is one
 * surface; a tap still shows), and the icon in the color the card gives it.
 * If Home Assistant renames these parts, they keep their usual look.
 */
export const TILE_SHEET = `
  ha-tile-container { --ha-ripple-hover-opacity: 0; }
  :host([sc-icon-color]) ha-tile-icon { --tile-icon-color: var(--sc-icon-color) !important; }
  :host([sc-brand]) ha-tile-icon { --tile-icon-border-radius: 0; width: auto; max-width: 126px; }`;

/** A brand's mark in place of the icon: as wide as the mark, not a circle. */
export const ICON_SHEET = `
  :host { width: auto !important; max-width: 126px; }
  .container { width: auto !important; max-width: 126px; border-radius: 0 !important; background: none !important; overflow: visible !important; }
  .container::before { display: none !important; }
  img { width: auto !important; max-width: 126px; height: var(--sc-brand-height, 28px) !important; object-fit: contain !important;
    border-radius: var(--sc-brand-radius, 0) !important; padding: var(--sc-brand-padding, 0); box-sizing: content-box;
    background: var(--sc-brand-backing, none); }`;

/** No divider between features, as in the Prusa Connect card. */
export const PLAIN_SHEET = `
  .divided { border-inline-start: none !important; margin-inline-start: 0 !important; padding-inline-start: 0 !important; }
  :host([slot="features-inline"]) { --feature-height: var(--ha-space-9, 36px) !important; }`;
