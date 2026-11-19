"""Constants for the Grill integration."""

from __future__ import annotations

from homeassistant.const import Platform

DOMAIN = "grill"

PLATFORMS = [Platform.BINARY_SENSOR, Platform.NUMBER, Platform.SELECT, Platform.SENSOR]

# A probe is a config subentry of a grill
SUBENTRY_PROBE = "probe"
CONF_READING = "reading"
CONF_COLORS = "colors"
CONF_TIP_CHANNEL = "tip_channel"

THERMOWORKS = "thermoworks_cloud"

# Doneness for a target that matches no preset of the cook type
CUSTOM = "custom"
MANUAL = "manual"

# Built-in cook presets, in °F: cook type -> doneness -> target
PRESETS: dict[str, dict[str, int]] = {
    "beef": {"rare": 125, "medium_rare": 135, "medium": 145, "medium_well": 155, "well_done": 165},
    "ground_beef": {"well_done": 160},
    "pork": {"medium": 145, "well_done": 160},
    "poultry": {"done": 165},
    "seafood": {"tuna": 130, "salmon": 145, "shrimp": 145, "scallops": 145, "lobster": 145},
    MANUAL: {},
}

# The colors a probe can be marked with (Home Assistant's named colors)
COLORS = [
    "red", "pink", "purple", "deep-purple", "indigo", "blue", "light-blue", "cyan", "teal", "green",
    "light-green", "lime", "yellow", "amber", "orange", "deep-orange", "brown", "grey", "black", "white",
]

# How far back the rate looks, and the least time it needs to work one out
RATE_WINDOW_S = 600
RATE_MIN_SPAN_S = 120
# Below this rate (degrees per minute) a probe short of its target is stalled
STALL_RATE = 0.05
