"""Serve the Grill card.

The card ships with the integration, so the card and the entities it shows
are always the same version. It is served from the integration's folder and
loaded on every dashboard with add_extra_js_url, Home Assistant's way for an
integration to add frontend code. Its address carries a hash of the file, so
browsers load a changed card at once instead of a cached copy.
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

CARD_URL = "/grill_static/grill-card.js"
CARD_FILE = Path(__file__).parent / "www" / "grill-card.js"


async def async_register_card(hass: HomeAssistant) -> None:
    if hass.http is None:
        return  # No web server, as in tests
    try:
        content = await hass.async_add_executor_job(CARD_FILE.read_bytes)
    except OSError:
        _LOGGER.error("The Grill card is missing from %s", CARD_FILE)
        return
    await hass.http.async_register_static_paths([StaticPathConfig(CARD_URL, str(CARD_FILE), cache_headers=True)])
    add_extra_js_url(hass, f"{CARD_URL}?v={hashlib.sha256(content).hexdigest()[:12]}")
