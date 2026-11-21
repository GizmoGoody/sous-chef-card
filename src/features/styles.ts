import { css } from "lit";

// The features' look: the spacing, radius and colors of Home Assistant's own
// tile features (--feature-height, --feature-border-radius, --feature-color)
export const featureStyles = css`
  :host {
    display: block;
    --sc-gap: 8px;
    --sc-surface: var(--secondary-background-color, rgba(127, 127, 127, 0.12));
    --sc-radius: var(--feature-border-radius, 12px);
  }
  button {
    font: inherit;
    color: inherit;
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-align: inherit;
  }
  button:focus-visible {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }
  .secondary {
    color: var(--secondary-text-color);
    font-size: 12px;
  }
  .num {
    font-variant-numeric: tabular-nums;
  }

  /* A progress ring: the probe's colors over the track, with the internal temperature inside */
  .ring {
    --size: 48px;
    position: relative;
    flex: none;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .ring::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: var(--ring);
    -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
    mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 4px));
  }
  .ring span {
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
  .ring.small {
    --size: 42px;
  }

  /* A status pill: Done, Stalled, Alarm, No reading or Off */
  .pill {
    display: inline-block;
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    padding: 0 8px;
    border-radius: 9px;
    white-space: nowrap;
    color: var(--pill);
    background: color-mix(in srgb, var(--pill) 18%, transparent);
  }
  .pill.done {
    --pill: var(--success-color, #43a047);
  }
  .pill.stalled {
    --pill: var(--warning-color, #ffa600);
  }
  .pill.alarm {
    --pill: var(--error-color, #db4437);
  }
  .pill.no_reading,
  .pill.off,
  .pill.cooking {
    --pill: var(--secondary-text-color);
  }

  /* A swatch of a probe's colors */
  .swatch {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--swatch);
    box-shadow: 0 0 0 1px var(--divider-color);
  }

  /* Channels: ch 1 to ch n, with Max outlined */
  .channels {
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(0, 1fr));
    gap: 6px;
  }
  .channels button {
    display: grid;
    justify-items: center;
    padding: 4px 0;
    border-radius: var(--sc-radius);
    background: var(--sc-surface);
    font-size: 11px;
    color: var(--secondary-text-color);
  }
  .channels button b {
    font-size: 14px;
    font-weight: 500;
    color: var(--primary-text-color);
    font-variant-numeric: tabular-nums;
  }
  .channels button.max {
    outline: 2px solid var(--feature-color, var(--primary-color));
    outline-offset: -2px;
  }

  /* A probe's preset: Food type and Doneness, Target, and the source */
  .preset {
    display: grid;
    gap: var(--sc-gap);
  }
  .pair {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--sc-gap);
  }
  /* Home Assistant's own features, embedded: without the tile card's padding around them */
  hui-card-features {
    padding: 0;
  }
  .source {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    align-items: center;
  }
  .source a {
    color: var(--primary-color);
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .source a:hover {
    text-decoration: underline;
  }
  .source ha-icon {
    --mdc-icon-size: 14px;
  }
`;
