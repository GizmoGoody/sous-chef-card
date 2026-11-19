"""How a probe's cook is coming along: progress, rate and when it is done."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, SensorStateClass
from homeassistant.const import PERCENTAGE
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback

from . import GrillConfigEntry
from .entity import ProbeEntity
from .probe import channels_of


async def async_setup_entry(
    hass: HomeAssistant, entry: GrillConfigEntry, async_add_entities: AddConfigEntryEntitiesCallback
) -> None:
    for subentry_id, probe in entry.runtime_data.items():
        subentry = entry.subentries[subentry_id]
        async_add_entities(
            [
                ProgressSensor(hass, subentry, probe, "progress"),
                RateSensor(hass, subentry, probe, "rate"),
                DoneAtSensor(hass, subentry, probe, "done_at"),
            ],
            config_subentry_id=subentry_id,
        )


class ProgressSensor(ProbeEntity, SensorEntity):
    """How far the reading has come from the cook's start to the target.

    Its attributes tell the Grill card which probe this is: the reading, the
    probe's own sensors in channel order, its colors and which channel is at
    the tip.
    """

    _attr_native_unit_of_measurement = PERCENTAGE
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 0
    # They describe the probe, not the cook, so the recorder leaves them out
    _unrecorded_attributes = frozenset({"reading", "channels", "tip_channel", "colors", "start"})

    @property
    def native_value(self) -> float | None:
        return self.probe.progress

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        return {
            "reading": self.probe.reading_entity,
            "channels": channels_of(self.hass, self.probe.reading_entity),
            "tip_channel": self.probe.tip_channel,
            "colors": self.probe.colors,
            "start": self.probe.start,
        }


class RateSensor(ProbeEntity, SensorEntity):
    """How fast the reading is rising, in degrees per minute."""

    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_suggested_display_precision = 1

    @property
    def native_unit_of_measurement(self) -> str:
        return f"{self.probe.unit}/min"

    @property
    def native_value(self) -> float | None:
        return None if (rate := self.probe.rate) is None else round(rate, 2)


class DoneAtSensor(ProbeEntity, SensorEntity):
    """When the reading will reach the target at its current rate."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP

    @property
    def native_value(self) -> datetime | None:
        return self.probe.done_at
