"""A probe's target temperature."""

from __future__ import annotations

from homeassistant.components.number import NumberDeviceClass, NumberEntity, NumberMode
from homeassistant.const import UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import GrillConfigEntry
from .entity import ProbeEntity


async def async_setup_entry(
    hass: HomeAssistant, entry: GrillConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    for subentry_id, probe in entry.runtime_data.items():
        async_add_entities(
            [TargetNumber(hass, entry.subentries[subentry_id], probe, "target")], config_subentry_id=subentry_id
        )


class TargetNumber(ProbeEntity, NumberEntity):
    """The temperature the probe's reading is cooking to.

    Choosing a doneness sets it; setting it to any other value makes the
    doneness Custom.
    """

    _attr_device_class = NumberDeviceClass.TEMPERATURE
    _attr_mode = NumberMode.BOX

    @property
    def native_unit_of_measurement(self) -> str:
        return self.probe.unit

    @property
    def native_min_value(self) -> float:
        return 32 if self.probe.unit == UnitOfTemperature.FAHRENHEIT else 0

    @property
    def native_max_value(self) -> float:
        return 250 if self.probe.unit == UnitOfTemperature.FAHRENHEIT else 120

    @property
    def native_step(self) -> float:
        return 1

    @property
    def native_value(self) -> float | None:
        return self.probe.target

    async def async_set_native_value(self, value: float) -> None:
        self.probe.set_target(value)
