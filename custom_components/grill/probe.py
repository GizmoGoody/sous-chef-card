"""A probe's cook: its preset, its target and how it is coming along.

Each probe follows one temperature sensor, its reading. For a ThermoWorks
RFX MEAT that is channel 0, the lowest of the probe's four sensors, which
the ThermoWorks app shows by default. The cook (type, doneness, target and
the temperature the cook started at) is kept in Home Assistant's storage, so
every browser shows the same cook and it lasts across restarts.
"""

from __future__ import annotations

from collections import deque
from collections.abc import Callable
from datetime import datetime, timedelta
import re
from typing import Any

from homeassistant.const import STATE_UNAVAILABLE, STATE_UNKNOWN, UnitOfTemperature
from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_state_change_event, async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util
from homeassistant.util.unit_conversion import TemperatureConverter

from .const import CUSTOM, MANUAL, PRESETS, RATE_MIN_SPAN_S, RATE_WINDOW_S, STALL_RATE, THERMOWORKS

SAMPLE_INTERVAL = timedelta(seconds=60)


class CookStore:
    """Every probe's cook in one grill, saved together."""

    def __init__(self, hass: HomeAssistant, entry_id: str) -> None:
        self._store: Store[dict[str, dict[str, Any]]] = Store(hass, 1, f"grill.{entry_id}")
        self.data: dict[str, dict[str, Any]] = {}

    async def async_load(self) -> None:
        self.data = await self._store.async_load() or {}

    @callback
    def save(self, probe_id: str, cook: dict[str, Any]) -> None:
        self.data[probe_id] = cook
        self._store.async_delay_save(lambda: self.data, 2)

    @callback
    def forget(self, keep: set[str]) -> None:
        """Drop the cooks of probes that were removed."""
        for probe_id in set(self.data) - keep:
            del self.data[probe_id]
        self._store.async_delay_save(lambda: self.data, 2)


def channels_of(hass: HomeAssistant, reading: str) -> list[str]:
    """The probe's own sensors, in channel order.

    A ThermoWorks probe's sensors share a unique ID that ends in the channel
    number (thermoworks_cloud-<serial>-<channel>), and channel 0 is the
    reading. Any other probe: the other temperature sensors on its device.
    """
    registry = er.async_get(hass)
    entry = registry.async_get(reading)
    if entry is None or entry.device_id is None:
        return []
    siblings = [
        e for e in er.async_entries_for_device(registry, entry.device_id)
        if e.domain == "sensor" and e.entity_id != reading
    ]
    if entry.platform == THERMOWORKS and (match := re.fullmatch(r"(.+)-(\d+)", entry.unique_id)):
        prefix = re.escape(match.group(1))
        found: dict[int, str] = {}
        for sibling in siblings:
            if (own := re.fullmatch(rf"{prefix}-(\d+)", sibling.unique_id)) and own.group(1) != match.group(2):
                found[int(own.group(1))] = sibling.entity_id
        return [found[channel] for channel in sorted(found)]
    return sorted(
        e.entity_id for e in siblings if (e.device_class or e.original_device_class) == "temperature"
    )


class Probe:
    """One probe's cook, worked out from its reading."""

    def __init__(self, hass: HomeAssistant, store: CookStore, probe_id: str, data: dict[str, Any]) -> None:
        self.hass = hass
        self.id = probe_id
        self._store = store
        self.reading_entity: str = data["reading"]
        self.colors: list[str] = list(data.get("colors") or [])
        self.tip_channel: int = int(data.get("tip_channel", 1))
        saved = store.data.get(probe_id, {})
        self.cook_type: str = saved.get("cook_type", MANUAL)
        self.doneness: str = saved.get("doneness", CUSTOM)
        self.target: float | None = saved.get("target")
        self.start: float | None = saved.get("start")
        self._samples: deque[tuple[float, float]] = deque()
        self._listeners: list[CALLBACK_TYPE] = []
        self._unsubscribes: list[CALLBACK_TYPE] = []

    # -- Following the reading --------------------------------------------

    @callback
    def async_start(self) -> None:
        self._sample()
        if self.start is None and self.reading is not None:
            self.start = self.reading
            self._save()
        self._unsubscribes.append(
            async_track_state_change_event(self.hass, [self.reading_entity], self._reading_changed)
        )
        self._unsubscribes.append(async_track_time_interval(self.hass, self._tick, SAMPLE_INTERVAL))

    @callback
    def async_stop(self) -> None:
        while self._unsubscribes:
            self._unsubscribes.pop()()

    @callback
    def async_add_listener(self, update: CALLBACK_TYPE) -> Callable[[], None]:
        self._listeners.append(update)
        return lambda: self._listeners.remove(update)

    @callback
    def _changed(self) -> None:
        for update in list(self._listeners):
            update()

    @callback
    def _reading_changed(self, event: Event[EventStateChangedData]) -> None:
        old = event.data["old_state"]
        was_in_use = old is not None and _number(old.state) is not None
        self._sample()
        # A probe put back into use starts a new cook from where it is now
        if not was_in_use and self.reading is not None:
            self._samples.clear()
            self._sample()
            self.start = self.reading
            self._save()
        self._changed()

    @callback
    def _tick(self, _now: datetime) -> None:
        # A reading that does not change sends no state change; sampling it
        # anyway lets the rate fall to zero, which shows a stall
        self._sample()
        self._changed()

    def _sample(self) -> None:
        value = self.reading
        now = dt_util.utcnow().timestamp()
        if value is None:
            return
        self._samples.append((now, value))
        while self._samples and self._samples[0][0] < now - RATE_WINDOW_S:
            self._samples.popleft()

    # -- What the entities show -------------------------------------------

    @property
    def reading(self) -> float | None:
        state = self.hass.states.get(self.reading_entity)
        return _number(state.state) if state else None

    @property
    def unit(self) -> str:
        state = self.hass.states.get(self.reading_entity)
        return (state.attributes.get("unit_of_measurement") if state else None) or UnitOfTemperature.FAHRENHEIT

    @property
    def in_use(self) -> bool:
        return self.reading is not None

    @property
    def rate(self) -> float | None:
        """Degrees per minute: the slope of the readings over the last minutes."""
        if len(self._samples) < 2 or self._samples[-1][0] - self._samples[0][0] < RATE_MIN_SPAN_S:
            return None
        n = len(self._samples)
        mean_t = sum(t for t, _ in self._samples) / n
        mean_v = sum(v for _, v in self._samples) / n
        spread = sum((t - mean_t) ** 2 for t, _ in self._samples)
        if spread == 0:
            return None
        slope = sum((t - mean_t) * (v - mean_v) for t, v in self._samples) / spread
        return slope * 60

    @property
    def done(self) -> bool:
        return self.reading is not None and self.target is not None and self.reading >= self.target

    @property
    def stalled(self) -> bool:
        rate = self.rate
        return self.in_use and self.target is not None and not self.done and rate is not None and rate < STALL_RATE

    @property
    def done_at(self) -> datetime | None:
        rate, reading = self.rate, self.reading
        if self.target is None or reading is None or rate is None or rate < STALL_RATE or self.done:
            return None
        return dt_util.utcnow() + timedelta(minutes=(self.target - reading) / rate)

    @property
    def progress(self) -> float | None:
        reading, start, target = self.reading, self.start, self.target
        if reading is None or start is None or target is None or target <= start:
            return None
        return max(0.0, min(100.0, (reading - start) / (target - start) * 100))

    @property
    def doneness_options(self) -> list[str]:
        return [*PRESETS.get(self.cook_type, {}), CUSTOM]

    # -- Changing the cook ------------------------------------------------

    def preset_target(self, cook_type: str, doneness: str) -> float | None:
        """A preset's target in the reading's unit."""
        fahrenheit = PRESETS.get(cook_type, {}).get(doneness)
        if fahrenheit is None:
            return None
        if self.unit == UnitOfTemperature.FAHRENHEIT:
            return float(fahrenheit)
        return round(TemperatureConverter.convert(fahrenheit, UnitOfTemperature.FAHRENHEIT, self.unit))

    @callback
    def set_cook_type(self, cook_type: str) -> None:
        self.cook_type = cook_type
        presets = PRESETS.get(cook_type, {})
        if presets:
            self.set_doneness(next(iter(presets)), save=False)
        else:
            self.doneness = CUSTOM
        self._new_cook()

    @callback
    def set_doneness(self, doneness: str, save: bool = True) -> None:
        self.doneness = doneness
        if (target := self.preset_target(self.cook_type, doneness)) is not None:
            self.target = target
        if save:
            self._save()
            self._changed()

    @callback
    def set_target(self, target: float) -> None:
        self.target = target
        # A target of the cook type's own presets keeps its doneness name
        self.doneness = next(
            (d for d in PRESETS.get(self.cook_type, {}) if self.preset_target(self.cook_type, d) == target),
            CUSTOM,
        )
        self._save()
        self._changed()

    def _new_cook(self) -> None:
        """A new cook starts from the reading now."""
        self.start = self.reading
        self._save()
        self._changed()

    def _save(self) -> None:
        self._store.save(self.id, {
            "cook_type": self.cook_type, "doneness": self.doneness, "target": self.target, "start": self.start,
        })


def _number(state: str) -> float | None:
    if state in (STATE_UNAVAILABLE, STATE_UNKNOWN):
        return None
    try:
        return float(state)
    except ValueError:
        return None
