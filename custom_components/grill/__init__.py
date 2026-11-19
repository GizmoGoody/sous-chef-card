"""The Grill integration: the cook state of each meat probe on a grill.

A grill is a config entry and each of its probes a config subentry. The
integration keeps every probe's cook (type, doneness, target) as entities,
so every browser shows the same cook at once and automations can use it,
and it serves the Grill card that shows them.
"""

from __future__ import annotations

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import DOMAIN, PLATFORMS, SUBENTRY_PROBE
from .card import async_register_card
from .probe import CookStore, Probe

type GrillConfigEntry = ConfigEntry[dict[str, Probe]]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the Grill card."""
    await async_register_card(hass)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: GrillConfigEntry) -> bool:
    """Set up a grill and its probes."""
    store = CookStore(hass, entry.entry_id)
    await store.async_load()
    probes = {
        subentry_id: Probe(hass, store, subentry_id, dict(subentry.data))
        for subentry_id, subentry in entry.subentries.items()
        if subentry.subentry_type == SUBENTRY_PROBE
    }
    store.forget(set(probes))
    entry.runtime_data = probes
    for probe in probes.values():
        probe.async_start()
        entry.async_on_unload(probe.async_stop)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    # A probe added, changed or removed sets the grill up again
    entry.async_on_unload(entry.add_update_listener(_async_reload))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: GrillConfigEntry) -> bool:
    for store in {probe.store for probe in entry.runtime_data.values()}:
        await store.async_flush()
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def _async_reload(hass: HomeAssistant, entry: GrillConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)
