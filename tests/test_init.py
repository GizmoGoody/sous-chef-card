"""A grill with one probe: its cook follows its presets and its reading."""

from homeassistant.config_entries import ConfigSubentryData
from homeassistant.core import HomeAssistant
from homeassistant.util.unit_system import US_CUSTOMARY_SYSTEM
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.grill.const import DOMAIN

READING = "sensor.probe_reading"


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    hass.config.units = US_CUSTOMARY_SYSTEM
    hass.states.async_set(READING, "100", {"unit_of_measurement": "°F", "device_class": "temperature"})
    entry = MockConfigEntry(
        domain=DOMAIN,
        title="Grill",
        data={},
        subentries_data=[
            ConfigSubentryData(
                data={"reading": READING, "colors": ["red", "blue"], "tip_channel": 1},
                subentry_type="probe",
                title="Probe",
                unique_id=None,
            )
        ],
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_preset_sets_target(hass: HomeAssistant) -> None:
    await _setup(hass)
    await hass.services.async_call(
        "select", "select_option", {"entity_id": "select.probe_cook_type", "option": "beef"}, blocking=True
    )
    # The first doneness of the type, and its target
    assert hass.states.get("select.probe_doneness").state == "rare"
    assert float(hass.states.get("number.probe_target").state) == 125
    await hass.services.async_call(
        "select", "select_option", {"entity_id": "select.probe_doneness", "option": "medium_rare"}, blocking=True
    )
    assert float(hass.states.get("number.probe_target").state) == 135


async def test_custom_target(hass: HomeAssistant) -> None:
    await _setup(hass)
    await hass.services.async_call(
        "select", "select_option", {"entity_id": "select.probe_cook_type", "option": "pork"}, blocking=True
    )
    await hass.services.async_call("number", "set_value", {"entity_id": "number.probe_target", "value": 150}, blocking=True)
    assert hass.states.get("select.probe_doneness").state == "custom"
    # A preset's own target names its doneness again
    await hass.services.async_call("number", "set_value", {"entity_id": "number.probe_target", "value": 160}, blocking=True)
    assert hass.states.get("select.probe_doneness").state == "well_done"


async def test_progress_and_done(hass: HomeAssistant) -> None:
    await _setup(hass)
    await hass.services.async_call(
        "select", "select_option", {"entity_id": "select.probe_cook_type", "option": "poultry"}, blocking=True
    )
    # The cook started at 100 °F; the target is 165 °F
    hass.states.async_set(READING, "132.5", {"unit_of_measurement": "°F", "device_class": "temperature"})
    await hass.async_block_till_done()
    assert round(float(hass.states.get("sensor.probe_progress").state)) == 50
    assert hass.states.get("binary_sensor.probe_done").state == "off"
    attributes = hass.states.get("sensor.probe_progress").attributes
    assert attributes["reading"] == READING
    assert attributes["colors"] == ["red", "blue"]
    hass.states.async_set(READING, "166", {"unit_of_measurement": "°F", "device_class": "temperature"})
    await hass.async_block_till_done()
    assert hass.states.get("binary_sensor.probe_done").state == "on"


async def test_cook_survives_reload(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    await hass.services.async_call(
        "select", "select_option", {"entity_id": "select.probe_cook_type", "option": "seafood"}, blocking=True
    )
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    assert hass.states.get("select.probe_cook_type").state == "seafood"
    assert hass.states.get("select.probe_doneness").state == "tuna"
