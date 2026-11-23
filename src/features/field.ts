// A number field (a probe's target, the grill's alarms), from the Prusa
// Connect card's field (its field.ts): a tap types in it, Enter or leaving
// sets it, Escape puts it back, and a press and slide changes it (set when
// the slide ends). The number is rounded to the entity's step and kept in
// its range. Sous Chef adds: an empty field shows its placeholder (TARGET,
// OFF), and for an alarm, empty is 0 (no limit).
import { html, LitElement, nothing, type TemplateResult } from "lit";
import { known, usable, type HassEntity, type HomeAssistant } from "../ha";
import { ITEM_MIN } from "./rows";

// Sliding a field: no change within this distance of the press (px), and a
// new value every tick (ms) while the pointer is held, faster the farther it
// is from where the press started
const SCRUB_DEAD_ZONE = 6;
const SCRUB_TICK = 50;
const SCRUB_SCALE = 60;
const SCRUB_POWER = 1.5;


/**
 * Press, then slide: while the pointer is held the value changes, faster
 * the farther the pointer is from where the press started; right or up
 * raises it. A tap is left to the field, to type in.
 */
function scrub(el: HTMLElement, handlers: () => { change: (steps: number) => void; done: () => void }): void {
  let start: { x: number; y: number } | undefined, at = { x: 0, y: 0 };
  let timer: ReturnType<typeof setInterval> | undefined;
  const begin = (ev: PointerEvent) => {
    try {
      el.setPointerCapture(ev.pointerId);
    } catch {
      // A pointer the browser no longer tracks: the slide follows the moves the element gets
    }
    el.classList.add("sliding");
    timer = setInterval(() => {
      const distance = (at.x - start!.x) - (at.y - start!.y);
      const beyond = Math.max(0, Math.abs(distance) - SCRUB_DEAD_ZONE);
      if (beyond) handlers().change(Math.sign(distance) * (beyond / SCRUB_SCALE) ** SCRUB_POWER);
    }, SCRUB_TICK);
  };
  const stop = (ev: PointerEvent) => {
    if (!start) return;
    const sliding = timer !== undefined;
    clearInterval(timer);
    timer = undefined;
    start = undefined;
    el.classList.remove("sliding");
    if (el.hasPointerCapture?.(ev.pointerId)) el.releasePointerCapture(ev.pointerId);
    if (sliding) handlers().done();
  };
  el.addEventListener("pointerdown", (ev) => {
    if (el.classList.contains("disabled") || ev.button !== 0) return;
    start = at = { x: ev.clientX, y: ev.clientY };
  });
  el.addEventListener("pointermove", (ev) => {
    if (!start) return;
    at = { x: ev.clientX, y: ev.clientY };
    if (timer === undefined && Math.hypot(at.x - start.x, at.y - start.y) > SCRUB_DEAD_ZONE) {
      el.querySelector("input")?.blur();
      begin(ev);
    }
  });
  el.addEventListener("pointerup", stop);
  el.addEventListener("pointercancel", stop);
  el.addEventListener("lostpointercapture", stop);
}

/** The decimals a number shows: as many as its step has (0.1: 1, 1: 0). */
function decimalsOf(stateObj?: HassEntity): number {
  const step = String(stateObj?.attributes.step ?? 1);
  return step.includes(".") ? step.split(".")[1].length : 0;
}

export class SousChefField extends LitElement {
  // The number entity the field sets
  entity?: string;
  hass?: HomeAssistant;
  icon?: string;
  placeholder = "";
  // Its name for hover and screen readers
  name = "";
  // An empty field sets this, and the field is empty at it (0 for an alarm: no limit); without it, emptying changes nothing
  empty?: number;
  // An alarm past its limit: the field turns red
  alarm = false;
  private _pending?: number;
  private _shown = "";

  static override properties = {
    entity: { attribute: false }, hass: { attribute: false }, icon: { attribute: false }, placeholder: { attribute: false },
    name: { attribute: false }, empty: { attribute: false }, alarm: { attribute: false },
  };

  constructor() {
    super();
    scrub(this, () => ({ change: (steps) => this._slide(steps), done: () => this._release() }));
  }

  // Drawn in the feature's own shadow root, in the feature's styles
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  private get _state(): HassEntity | undefined {
    return this.entity ? this.hass?.states[this.entity] : undefined;
  }

  private _value(): number {
    return known(this._state) ? Number(this._state!.state) : NaN;
  }

  private get _input(): HTMLInputElement | null {
    return this.querySelector("input");
  }

  private get _usable(): boolean {
    return !!this.hass && usable(this.hass, this.entity);
  }

  // Empty at the empty value (an alarm's 0), or without a number
  private _format(value?: number): string {
    if (value === undefined || !Number.isFinite(value) || (this.empty !== undefined && value === this.empty)) return "";
    return value.toFixed(decimalsOf(this._state));
  }

  protected override render() {
    if (!this.hass || !this.entity) return nothing;
    return html`${this.icon ? html`<ha-icon .icon=${this.icon}></ha-icon>` : nothing}<input type="text" inputmode="decimal"
      enterkeyhint="done" placeholder=${this.placeholder} aria-label=${this.name} ?disabled=${!this._usable}
      @keydown=${this._key} @input=${this._typing} @change=${this._typed} @click=${(ev: Event) => ev.stopPropagation()}><span class="unit">°</span>`;
  }

  protected override updated(): void {
    if (!this.hass) return;
    this._shown = this._format(this._value());
    this.classList.add("field", "drag");
    this.classList.toggle("disabled", !this._usable);
    this.classList.toggle("alarm", this.alarm);
    this.dataset.min = String(ITEM_MIN.field);
    const name = `${this.name}. Tap to type, or press and slide`;
    if (this.title !== name) this.title = name;
    // The number shown, unless it is being typed in
    const input = this._input;
    const focused = (this.getRootNode() as ShadowRoot | Document).activeElement === input;
    if (input && (this._pending !== undefined || !focused)) input.value = this._format(this._pending ?? this._value());
    this._typing();
  }

  // Empty: the placeholder alone, centered
  private _typing = () => {
    this.classList.toggle("unset", !this._input?.value);
  };

  private _key = (ev: KeyboardEvent) => {
    ev.stopPropagation();
    const input = this._input!;
    if (ev.key === "Enter") input.blur();
    if (ev.key === "Escape") {
      input.value = this._shown;
      this._typing();
      input.blur();
    }
  };

  private _slide(steps: number): void {
    const stateObj = this._state;
    const value = this._pending ?? (Number.isFinite(this._value()) ? this._value() : Number(stateObj?.attributes.min ?? 0));
    if (!stateObj || !Number.isFinite(value)) return;
    const { min = -Infinity, max = Infinity, step = 1 } = stateObj.attributes;
    this._pending = Math.min(max, Math.max(min, value + steps * Math.max(step, 10 ** -decimalsOf(stateObj))));
    this._input!.value = this._format(this._pending);
    this._typing();
  }

  private _release(): void {
    const pending = this._pending;
    this._pending = undefined;
    if (pending !== undefined) this._commit(pending);
  }

  private _typed = () => {
    const input = this._input!;
    const typed = input.value.trim();
    if (typed === "" && this.empty !== undefined) {
      this._commit(this.empty);
      return;
    }
    const value = Number(typed.replace(",", "."));
    if (typed === "" || !Number.isFinite(value)) {
      input.value = this._shown;
      this._typing();
      return;
    }
    this._commit(value);
  };

  /** Set the number, rounded to what it shows and kept within its range. */
  private _commit(value: number): void {
    const stateObj = this._state;
    if (!stateObj || !this.hass) return;
    const factor = 10 ** decimalsOf(stateObj);
    const { min = -Infinity, max = Infinity } = stateObj.attributes;
    const next = value === this.empty ? value : Math.min(max, Math.max(min, Math.round(value * factor) / factor));
    if (next !== this._value()) this.hass.callService("number", "set_value", { entity_id: this.entity, value: next });
    else if (this._input) {
      this._input.value = this._shown;
      this._typing();
    }
  }
}

export const FIELD_TAG = "sous-chef-field";

/** A field for a number entity, or nothing without one. */
export function numberField(hass: HomeAssistant, entityId: string | undefined,
  o: { icon?: string; placeholder: string; title: string; empty?: number; alarm?: boolean }): TemplateResult | typeof nothing {
  if (!entityId || !hass.states[entityId]) return nothing;
  return html`<sous-chef-field .hass=${hass} .entity=${entityId} .icon=${o.icon} .placeholder=${o.placeholder} .name=${o.title}
    .empty=${o.empty} .alarm=${!!o.alarm}></sous-chef-field>`;
}
