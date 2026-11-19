"""A probe's cook type and doneness."""

from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import GrillConfigEntry
from .const import PRESETS
from .entity import ProbeEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: GrillConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    for subentry_id, probe in entry.runtime_data.items():
        subentry = entry.subentries[subentry_id]
        async_add_entities(
            [CookTypeSelect(hass, subentry, probe, "cook_type"), DonenessSelect(hass, subentry, probe, "doneness")],
            config_subentry_id=subentry_id,
        )


class CookTypeSelect(ProbeEntity, SelectEntity):
    """What is cooking: a preset's type, or Manual."""

    _attr_options = list(PRESETS)

    @property
    def current_option(self) -> str:
        return self.probe.cook_type

    async def async_select_option(self, option: str) -> None:
        self.probe.set_cook_type(option)


class DonenessSelect(ProbeEntity, SelectEntity):
    """How done: one of the cook type's presets, or Custom for any other target."""

    @property
    def options(self) -> list[str]:
        return self.probe.doneness_options

    @property
    def current_option(self) -> str:
        return self.probe.doneness

    async def async_select_option(self, option: str) -> None:
        self.probe.set_doneness(option)
