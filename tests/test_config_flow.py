"""Adding a grill, then a probe to it."""

from homeassistant import config_entries
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType, InvalidData
import pytest

from custom_components.grill.const import DOMAIN


async def test_add_grill_and_probe(hass: HomeAssistant) -> None:
    hass.states.async_set("sensor.probe_reading", "70", {"unit_of_measurement": "°F", "device_class": "temperature"})
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {"name": "Terrace grill"})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    entry = result["result"]

    result = await hass.config_entries.subentries.async_init((entry.entry_id, "probe"), context={"source": "user"})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.subentries.async_configure(
        result["flow_id"], {"reading": "sensor.probe_reading", "colors": ["green"], "tip_channel": "4"}
    )
    assert result["type"] is FlowResultType.CREATE_ENTRY
    (subentry,) = entry.subentries.values()
    assert subentry.data == {"reading": "sensor.probe_reading", "colors": ["green"], "tip_channel": 4}

    # The same reading cannot be a second probe: the picker leaves it out
    result = await hass.config_entries.subentries.async_init((entry.entry_id, "probe"), context={"source": "user"})
    with pytest.raises(InvalidData):
        await hass.config_entries.subentries.async_configure(
            result["flow_id"], {"reading": "sensor.probe_reading", "tip_channel": "1"}
        )
