// A number typed in place, as the Prusa Connect card's fields: the value in
// the field, set when the field is left or Enter is pressed. An empty field
// shows its placeholder (TARGET, OFF).
import { html, nothing, type TemplateResult } from "lit";
import { known, type HomeAssistant } from "../ha";

export interface FieldOptions {
  icon?: string;
  placeholder: string;
  title: string;
  // An empty field sets this (0 for an alarm: no limit); without it, emptying changes nothing
  empty?: number;
  alarm?: boolean;
  // Extra classes and style
  cls?: string;
  style?: string;
}

/** The field's value as text: whole degrees, or empty without one (or at 0 for an alarm). */
export function fieldValue(hass: HomeAssistant, entityId: string | undefined, zeroIsEmpty: boolean): string {
  const stateObj = entityId ? hass.states[entityId] : undefined;
  if (!known(stateObj)) return "";
  const value = Number(stateObj.state);
  if (!Number.isFinite(value) || (zeroIsEmpty && value === 0)) return "";
  return String(Math.round(value));
}

/** Set a number entity from a field, within its range. */
function setFrom(hass: HomeAssistant, entityId: string, input: HTMLInputElement, empty?: number): void {
  const text = input.value.trim();
  const stateObj = hass.states[entityId];
  if (!text) {
    if (empty !== undefined) hass.callService("number", "set_value", { entity_id: entityId, value: empty });
    return;
  }
  const value = Number(text);
  if (!Number.isFinite(value)) return;
  const { min = -Infinity, max = Infinity } = stateObj?.attributes ?? {};
  hass.callService("number", "set_value", { entity_id: entityId, value: Math.min(max, Math.max(min, value)) });
}

export function numberField(hass: HomeAssistant, entityId: string | undefined, o: FieldOptions): TemplateResult | typeof nothing {
  if (!entityId || !hass.states[entityId]) return nothing;
  const value = fieldValue(hass, entityId, o.empty === 0);
  const disabled = hass.states[entityId].state === "unavailable";
  return html`<label class="field ${o.alarm ? "alarm" : ""} ${o.cls ?? ""}" title=${o.title} style=${o.style ?? ""}>
    ${o.icon ? html`<ha-icon .icon=${o.icon}></ha-icon>` : nothing}
    <input type="number" inputmode="numeric" .value=${value} placeholder=${o.placeholder} aria-label=${o.title} ?disabled=${disabled}
      @keydown=${(ev: KeyboardEvent) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
      @change=${(ev: Event) => setFrom(hass, entityId, ev.target as HTMLInputElement, o.empty)}
    />${value ? html`<span class="unit">°</span>` : nothing}
  </label>`;
}
