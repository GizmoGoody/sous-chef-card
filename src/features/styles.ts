// The features' look: keys, read-outs and fields as the Prusa Connect card
// draws them (Home Assistant's own feature spacing, height and radius), each
// tinted in its color (--c). On a style, Flat sets each control on a plain
// patch of the finish (--sc-backing), and Console makes the keys press in.
import { css, unsafeCSS } from "lit";

const ENABLED = unsafeCSS("var(--feature-color, var(--state-icon-color, var(--primary-color)))");

export const featureStyles = css`
  :host { display: block; min-width: 0; max-width: 100%; }
  .row { display: flex; flex-wrap: nowrap; align-items: center; column-gap: var(--feature-button-spacing, 12px); height: var(--feature-height, 42px); min-width: 0; }
  .row.tight { column-gap: 8px; }
  .key, .field {
    position: relative; flex: 1 1 0; min-width: 36px; height: 100%; box-sizing: border-box; overflow: hidden;
    display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 6px; border: 0; margin: 0;
    border-radius: var(--feature-border-radius, 12px);
    background: var(--sc-backing, var(--sc-scrim, transparent));
    color: var(--sc-text, var(--primary-text-color)); font: inherit; font-size: var(--ha-font-size-s, 12px); font-weight: 500;
  }
  .key { cursor: pointer; }
  .key::before, .field::before {
    content: ""; position: absolute; inset: 0; background: var(--c, ${ENABLED}); opacity: var(--tint, .2);
    transition: opacity 180ms ease-in-out;
  }
  .key > *, .field > * { position: relative; }
  .key:hover::before { opacity: calc(var(--tint, .2) + .15); }
  .key[aria-pressed="false"]::before { background: var(--disabled-color, #bdbdbd); }
  .key[aria-pressed="true"]::before { opacity: 1; }
  .key[aria-pressed="true"] { color: var(--sc-on-color, #fff); }
  .key:focus-visible, .field:focus-within { outline: 2px solid var(--c, ${ENABLED}); outline-offset: 2px; }
  .key:disabled { cursor: default; color: var(--disabled-text-color, #bdbdbd); }
  .key:disabled::before { background: var(--disabled-color, #bdbdbd); opacity: .2; }
  ha-icon, ha-state-icon { flex: none; --mdc-icon-size: 22px; color: var(--c, ${ENABLED}); }
  .key[aria-pressed="true"] ha-icon, .key[aria-pressed="true"] ha-state-icon { color: inherit; }
  .arrow { --mdc-icon-size: 18px; margin-left: -4px; color: var(--secondary-text-color); }
  .num { font-variant-numeric: tabular-nums; }
  span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  /* A placeholder, as the Prusa Connect card writes TARGET in an empty field */
  .note { font-size: 10px; font-weight: 400; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); }
  /* A number typed in place */
  .field input {
    flex: 0 1 auto; width: 4ch; min-width: 0; margin: 0; padding: 0; border: 0; outline: none; background: transparent;
    font: inherit; font-size: var(--ha-font-size-m, 14px); color: inherit; text-align: center; font-variant-numeric: tabular-nums;
  }
  .field input::placeholder { color: var(--secondary-text-color); font-size: 10px; text-transform: uppercase; letter-spacing: .04em; opacity: 1; }
  .field input::-webkit-outer-spin-button, .field input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .field input[type="number"] { -moz-appearance: textfield; appearance: textfield; }
  .field.alarm::before { background: var(--error-color, #db4437); opacity: .45; }
  .field.alarm ha-icon { color: #fff; }
  .field { font-size: var(--ha-font-size-m, 14px); cursor: text; }
  /* A key with a list: the browser's own list, over the whole key (as the Prusa Connect card's Presets key) */
  .key select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font: inherit; }
  /* Console: the keys press in */
  :host([sc-console]) .key {
    background-image: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0) 45%, rgba(0,0,0,.18));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 -2px 2px rgba(0,0,0,.3), 0 2px 3px rgba(0,0,0,.5);
    transition: transform 120ms ease-in-out, box-shadow 120ms ease-in-out;
  }
  :host([sc-console]) .key:not(:disabled):active,
  :host([sc-console]) .key:not(:disabled)[aria-pressed="true"] {
    transform: translateY(1px);
    background-image: linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.06) 40%, rgba(255,255,255,.1));
    box-shadow: inset 0 3px 6px rgba(0,0,0,.55), inset 0 1px 2px rgba(0,0,0,.4), inset 0 -1px 0 rgba(255,255,255,.25);
  }
  :host([sc-console]) .field { box-shadow: inset 0 2px 4px rgba(0,0,0,.45), inset 0 -1px 0 rgba(255,255,255,.18); }
  @media (prefers-reduced-motion: reduce) { .key, .key::before { transition: none; } }
`;
