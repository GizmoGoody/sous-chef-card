"""Whether a probe is done, or stalled."""

from __future__ import annotations

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import GrillConfigEntry
from .entity import ProbeEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: GrillConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    for subentry_id, probe in entry.runtime_data.items():
        subentry = entry.subentries[subentry_id]
        async_add_entities(
            [DoneBinarySensor(hass, subentry, probe, "done"), StalledBinarySensor(hass, subentry, probe, "stalled")],
            config_subentry_id=subentry_id,
        )


class DoneBinarySensor(ProbeEntity, BinarySensorEntity):
    """On once the reading reaches the target."""

    @property
    def available(self) -> bool:
        return self.probe.in_use and self.probe.target is not None

    @property
    def is_on(self) -> bool:
        return self.probe.done


class StalledBinarySensor(ProbeEntity, BinarySensorEntity):
    """On while the reading has stopped rising short of the target."""

    @property
    def available(self) -> bool:
        return self.probe.in_use and self.probe.target is not None

    @property
    def is_on(self) -> bool:
        return self.probe.stalled
