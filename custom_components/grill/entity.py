"""The entities of a probe."""

from __future__ import annotations

from homeassistant.config_entries import ConfigSubentry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device import async_entity_id_to_device
from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.entity import Entity

from .const import DOMAIN
from .probe import Probe


class ProbeEntity(Entity):
    """An entity of a probe's cook.

    It sits on the probe's own device (the ThermoWorks probe, for example),
    as Home Assistant's helpers sit on their source's device, so the probe's
    readings and its cook are found together. A reading on no device gets a
    device of its own.
    """

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, subentry: ConfigSubentry, probe: Probe, key: str) -> None:
        self.probe = probe
        self._attr_translation_key = key
        self._attr_unique_id = f"{subentry.subentry_id}_{key}"
        self.device_entry = async_entity_id_to_device(hass, probe.reading_entity)
        if self.device_entry is None:
            self._attr_device_info = DeviceInfo(identifiers={(DOMAIN, subentry.subentry_id)}, name=subentry.title)

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(self.probe.async_add_listener(self.async_write_ha_state))
