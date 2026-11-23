// The features' look, from the Prusa Connect card's (its styles.ts): keys,
// read-outs and fields as Home Assistant's own features draw them, in the
// theme's radius and spacing, each tinted in its color (--c). On a style,
// Flat sets each control on a plain patch of the finish (--sc-backing), and
// Console makes the keys press in. Sous Chef adds: a placeholder (.note)
// where a value is not known yet, a key's or field's list arrow, and a
// field that turns red while its alarm is past.
import { css, unsafeCSS } from "lit";
import { rowStyles } from "./rows";

const enabled = unsafeCSS("var(--feature-color, var(--state-icon-color, var(--primary-color)))");

// Console (the sc-console attribute): the keys press in; read-outs and fields are set into the surface
const consoleStyles = css`
  /* The shading lies over the key's color (its ::after), so a key that is on, filled, still shows it is pressed in */
  :host([sc-console]) .key { box-shadow: 0 2px 3px rgba(0,0,0,.5); transition: transform 120ms ease-in-out, box-shadow 120ms ease-in-out; }
  :host([sc-console]) .key::after {
    content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
    background-image: linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0) 45%, rgba(0,0,0,.18));
    box-shadow: inset 0 1px 0 rgba(255,255,255,.55), inset 0 -2px 2px rgba(0,0,0,.3);
  }
  :host([sc-console]) .key:not(:disabled):active,
  :host([sc-console]) .key:not(:disabled)[aria-pressed="true"] { transform: translateY(1px); box-shadow: none; }
  :host([sc-console]) .key:not(:disabled):active::after,
  :host([sc-console]) .key:not(:disabled)[aria-pressed="true"]::after {
    background-image: linear-gradient(180deg, rgba(0,0,0,.3), rgba(0,0,0,.08) 40%, rgba(255,255,255,.1));
    box-shadow: inset 0 3px 6px rgba(0,0,0,.6), inset 0 1px 2px rgba(0,0,0,.45), inset 0 -1px 0 rgba(255,255,255,.25);
  }
  :host([sc-console]) .key:disabled, :host([sc-console]) .key.disabled { box-shadow: none; transform: none; }
  :host([sc-console]) .key:disabled::after, :host([sc-console]) .key.disabled::after { display: none; }
  :host([sc-console]) .field { box-shadow: inset 0 2px 4px rgba(0,0,0,.45), inset 0 -1px 0 rgba(255,255,255,.18); }
`;

export const featureStyles = [rowStyles, css`
  :host { display: block; min-width: 0; max-width: 100%; }
  .field {
    position: relative; display: flex; align-items: center; justify-content: center; gap: 2px; height: 100%; box-sizing: border-box;
    padding: 0 6px; border-radius: var(--feature-border-radius, 12px); overflow: hidden; cursor: text;
    background: var(--sc-backing, var(--sc-scrim, transparent));
    color: var(--sc-text, var(--primary-text-color)); font-weight: var(--ha-font-weight-medium, 500);
  }
  .field::before { content: ""; position: absolute; inset: 0; background: var(--c, ${enabled}); opacity: .2; }
  .field > * { position: relative; }
  /* The number as wide as its digits (--len, set as it is typed), so it and its degree sign sit centered together */
  .field input {
    flex: 0 1 auto; width: calc(var(--len, 1) * 1ch); min-width: 0; margin: 0; padding: 0; border: 0; outline: none; background: transparent;
    font: inherit; color: inherit; text-align: center; font-variant-numeric: tabular-nums;
  }
  .field .unit { flex: none; white-space: nowrap; }
  .field ha-icon, .field ha-state-icon { flex: none; --mdc-icon-size: 22px; margin-right: 4px; color: var(--c-icon, var(--c, ${enabled})); }
  /* Empty: the placeholder alone, centered (TARGET, OFF) */
  .field.unset input { flex: 1 1 auto; width: 100%; }
  .field.unset .unit { display: none; }
  .field input::placeholder { color: var(--secondary-text-color); font-size: 10px; font-weight: 400; text-transform: uppercase; letter-spacing: .03em; opacity: 1; }
  .field.disabled { cursor: default; color: var(--disabled-text-color, #bdbdbd); }
  .field.disabled::before { background: var(--disabled-color, #bdbdbd); opacity: .2; }
  .field.drag { touch-action: none; cursor: ew-resize; }
  .field.sliding::before { opacity: .45; }
  /* An alarm past its limit */
  .field.alarm::before { background: var(--error-color, #db4437); opacity: .45; }
  .field.alarm ha-icon { color: #fff; }
  /* A read-out: a field that is only shown, its icon in its color; a tap opens it */
  .field.readout { cursor: pointer; gap: 6px; padding: 0 6px; font-size: var(--ha-font-size-s, 12px); min-width: 0; }
  .field.readout::before { background: var(--c, ${enabled}); opacity: var(--tint, .2); }
  .field.readout ha-state-icon, .field.readout ha-icon { margin-right: 0; }
  .field.readout span { font-variant-numeric: tabular-nums; }
  /* A field with a list (the doneness): the browser's own list, over the whole field */
  .field.menu { cursor: pointer; gap: 2px; }
  .note { font-size: 10px; font-weight: 400; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .03em; }
  .num { font-variant-numeric: tabular-nums; }
  .key {
    min-width: 0; height: 100%; padding: 0 4px; border: 0; cursor: pointer; box-sizing: border-box;
    position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; gap: 6px;
    border-radius: var(--feature-border-radius, 12px);
    background: var(--sc-backing, var(--sc-scrim, transparent));
    color: var(--sc-text, var(--primary-text-color)); font: inherit; font-size: var(--ha-font-size-s, 12px); font-weight: 500;
  }
  .key::before { content: ""; position: absolute; inset: 0; background: var(--c, ${enabled}); opacity: .2; transition: opacity 180ms ease-in-out; }
  .key[aria-pressed="false"]::before { background: var(--disabled-color, #bdbdbd); }
  .key:hover::before { opacity: .35; }
  .key[aria-pressed="true"]::before { opacity: 1; }
  .key[aria-pressed="true"] { color: var(--sc-on-color, #fff); }
  /* No ring around a control that is tapped or typed in */
  .key, .field, .field input, .field select, .key select { outline: none; }
  .key:disabled, .key.disabled { cursor: default; color: var(--disabled-text-color, #bdbdbd); }
  .key:disabled::before, .key:disabled:hover::before, .key.disabled::before { background: var(--disabled-color, #bdbdbd); opacity: .2; }
  .key > * { position: relative; }
  .key ha-icon, .key ha-state-icon { flex: none; --mdc-icon-size: 22px; color: var(--c-icon, var(--c, ${enabled})); }
  .key[aria-pressed="true"] ha-icon, .key[aria-pressed="true"] ha-state-icon { color: inherit; }
  /* A key or field that opens a list: the browser's own list, over the whole of it */
  .key select, .field select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; font: inherit; }
  .key select:disabled, .field select:disabled { cursor: default; }
  /* A field that slides: its list opened by a tap on the field, so a press and slide reaches the field */
  .field select.passive { pointer-events: none; }
  .field.drag.menu input { cursor: pointer; touch-action: none; }
  span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  @media (prefers-reduced-motion: reduce) { .key, .key::before { transition: none; } }
`, consoleStyles];
