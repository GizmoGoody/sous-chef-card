"""Set up a grill, and add its probes."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    ConfigSubentryFlow,
    SubentryFlowResult,
)
from homeassistant.const import CONF_NAME
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import device_registry as dr, entity_registry as er
from homeassistant.helpers.selector import (
    EntitySelector,
    EntitySelectorConfig,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
)

from .const import COLORS, CONF_COLORS, CONF_READING, CONF_TIP_CHANNEL, DOMAIN, SUBENTRY_PROBE, THERMOWORKS


class GrillConfigFlow(ConfigFlow, domain=DOMAIN):
    """A grill: a name, then probes added to it."""

    VERSION = 1

    @classmethod
    @callback
    def async_get_supported_subentry_types(cls, config_entry: ConfigEntry) -> dict[str, type[ConfigSubentryFlow]]:
        return {SUBENTRY_PROBE: ProbeSubentryFlow}

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        if user_input is not None:
            return self.async_create_entry(title=user_input[CONF_NAME], data={})
        return self.async_show_form(
            step_id="user", data_schema=vol.Schema({vol.Required(CONF_NAME, default="Grill"): str})
        )


def _thermoworks_readings(hass: HomeAssistant) -> list[str]:
    """Every ThermoWorks probe's reading: its channel 0, the lowest of its sensors."""
    return sorted(
        e.entity_id for e in er.async_get(hass).entities.values()
        if e.platform == THERMOWORKS and e.domain == "sensor" and e.unique_id.endswith("-0") and not e.disabled_by
    )


def _title(hass: HomeAssistant, reading: str) -> str:
    """The probe's name: its device's, else the reading's."""
    entry = er.async_get(hass).async_get(reading)
    if entry and entry.device_id and (device := dr.async_get(hass).async_get(entry.device_id)):
        return device.name_by_user or device.name or reading
    state = hass.states.get(reading)
    return state.name if state else reading


def _probe_schema(reading_selector: EntitySelector | None) -> vol.Schema:
    fields: dict[Any, Any] = {}
    if reading_selector:
        fields[vol.Required(CONF_READING)] = reading_selector
    fields[vol.Optional(CONF_COLORS, default=[])] = SelectSelector(
        SelectSelectorConfig(options=COLORS, multiple=True, translation_key="color", mode=SelectSelectorMode.DROPDOWN)
    )
    fields[vol.Required(CONF_TIP_CHANNEL, default="1")] = SelectSelector(
        SelectSelectorConfig(options=["1", "4"], translation_key="tip_channel", mode=SelectSelectorMode.LIST)
    )
    return vol.Schema(fields)


def _probe_data(user_input: dict[str, Any], reading: str) -> dict[str, Any]:
    return {
        CONF_READING: reading,
        CONF_COLORS: list(user_input.get(CONF_COLORS) or []),
        CONF_TIP_CHANNEL: int(user_input.get(CONF_TIP_CHANNEL, 1)),
    }


class ProbeSubentryFlow(ConfigSubentryFlow):
    """A probe: the temperature sensor it reads, its colors and which channel is at its tip."""

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        taken = {s.data.get(CONF_READING) for s in self._get_entry().subentries.values()}
        errors: dict[str, str] = {}
        if user_input is not None:
            reading = user_input[CONF_READING]
            if reading in taken:
                errors[CONF_READING] = "already_added"
            else:
                return self.async_create_entry(title=_title(self.hass, reading), data=_probe_data(user_input, reading))
        suggested = next((r for r in _thermoworks_readings(self.hass) if r not in taken), None)
        schema = _probe_schema(
            EntitySelector(EntitySelectorConfig(domain="sensor", device_class="temperature", exclude_entities=[t for t in taken if t]))
        )
        if suggested and user_input is None:
            schema = self.add_suggested_values_to_schema(schema, {CONF_READING: suggested})
        return self.async_show_form(step_id="user", data_schema=schema, errors=errors)

    async def async_step_reconfigure(self, user_input: dict[str, Any] | None = None) -> SubentryFlowResult:
        subentry = self._get_reconfigure_subentry()
        reading = subentry.data[CONF_READING]
        if user_input is not None:
            return self.async_update_and_abort(self._get_entry(), subentry, data=_probe_data(user_input, reading))
        schema = self.add_suggested_values_to_schema(
            _probe_schema(None),
            {CONF_COLORS: subentry.data.get(CONF_COLORS, []), CONF_TIP_CHANNEL: str(subentry.data.get(CONF_TIP_CHANNEL, 1))},
        )
        return self.async_show_form(step_id="reconfigure", data_schema=schema)
