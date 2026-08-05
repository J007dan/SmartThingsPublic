"""The device layer.

Two interchangeable backends sit behind :class:`Bridge`:

``LeapBridge``
    Talks to a real RadioRA 3 processor over LEAP via ``pylutron_caseta``.

``DemoBridge``
    A simulated house. Lets the whole app -- UI, scenes, schedules -- run and
    be tested with no hardware present.

LEAP is a control-and-monitor protocol: it can read the configuration and drive
loads, but it exposes no way to write system programming. Nothing here creates
processor-side configuration, because nothing can.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from typing import Callable, Dict, List, Optional

from .config import Settings
from .models import (
    Area,
    Capabilities,
    Device,
    Inventory,
    NativeScene,
)

_LOG = logging.getLogger(__name__)

ChangeCallback = Callable[[Device], None]

# LEAP ControlType / DeviceType values that support slat tilt.
_TILT_TYPES = {"ShadeWithTilt", "Blind", "TiltOnlyBlind", "VenetianBlind"}


class Bridge:
    """Common interface implemented by both backends."""

    def __init__(self) -> None:
        self.devices: Dict[str, Device] = {}
        self.areas: Dict[str, Area] = {}
        self.native_scenes: Dict[str, NativeScene] = {}
        self.connected = False
        self._listeners: List[ChangeCallback] = []

    # -- change fan-out ----------------------------------------------------
    def subscribe(self, callback: ChangeCallback) -> Callable[[], None]:
        self._listeners.append(callback)

        def unsubscribe() -> None:
            if callback in self._listeners:
                self._listeners.remove(callback)

        return unsubscribe

    def _emit(self, device: Device) -> None:
        for callback in list(self._listeners):
            try:
                callback(device)
            except Exception:  # a bad listener must not break the bridge
                _LOG.exception("device change listener failed")

    # -- lifecycle ---------------------------------------------------------
    async def start(self) -> None:
        raise NotImplementedError

    async def stop(self) -> None:
        raise NotImplementedError

    # -- reads -------------------------------------------------------------
    @property
    def is_demo(self) -> bool:
        return False

    def inventory(self) -> Inventory:
        return Inventory(
            areas=sorted(self.areas.values(), key=lambda a: a.name.lower()),
            devices=sorted(
                self.devices.values(),
                key=lambda d: (d.area_name.lower(), d.name.lower()),
            ),
            native_scenes=sorted(
                self.native_scenes.values(), key=lambda s: s.name.lower()
            ),
            connected=self.connected,
            demo=self.is_demo,
        )

    # -- writes ------------------------------------------------------------
    async def set_level(self, device_id: str, level: int, fade_seconds: float = 1.0) -> None:
        raise NotImplementedError

    async def set_tilt(self, device_id: str, tilt: int) -> None:
        raise NotImplementedError

    async def set_fan(self, device_id: str, speed: str) -> None:
        raise NotImplementedError

    async def cover_command(self, device_id: str, action: str) -> None:
        raise NotImplementedError

    async def activate_native_scene(self, scene_id: str) -> None:
        raise NotImplementedError


def _classify(leap_type: str, domain: str) -> tuple[str, Capabilities]:
    """Collapse a LEAP device/control type into a UI kind plus capabilities."""
    if domain == "cover":
        return "shade", Capabilities(dimmable=True, tilt=leap_type in _TILT_TYPES)
    if domain == "fan":
        return "fan", Capabilities(fan=True)
    if domain == "switch":
        return "switch", Capabilities()
    return "light", Capabilities(dimmable=True)


class LeapBridge(Bridge):
    """Live connection to an RA3 processor."""

    def __init__(self, settings: Settings) -> None:
        super().__init__()
        self.settings = settings
        self._bridge = None  # pylutron_caseta Smartbridge

    async def start(self) -> None:
        from pylutron_caseta.smartbridge import Smartbridge

        self._bridge = Smartbridge.create_tls(
            hostname=self.settings.host,
            keyfile=str(self.settings.keyfile),
            certfile=str(self.settings.certfile),
            ca_certs=str(self.settings.ca_certs),
            port=self.settings.port,
        )
        await self._bridge.connect()
        self.connected = True
        self._build_inventory()
        self._wire_subscriptions()
        _LOG.info(
            "connected to %s: %d devices across %d areas",
            self.settings.host,
            len(self.devices),
            len(self.areas),
        )

    async def stop(self) -> None:
        if self._bridge is not None:
            await self._bridge.close()
        self.connected = False

    # -- inventory ---------------------------------------------------------
    def _build_inventory(self) -> None:
        bridge = self._bridge
        assert bridge is not None

        self.areas = {
            area_id: Area(
                id=area_id, name=area["name"], parent_id=area.get("parent_id")
            )
            for area_id, area in bridge.areas.items()
        }

        # Map each device id to its domain so classification is driven by
        # pylutron-caseta's own type tables rather than a guess.
        domain_of: Dict[str, str] = {}
        for domain in ("light", "switch", "cover", "fan"):
            for device in bridge.get_devices_by_domain(domain):
                domain_of[device["device_id"]] = domain

        self.devices = {}
        for device_id, raw in bridge.devices.items():
            domain = domain_of.get(device_id)
            if domain is None:
                continue  # sensors, keypads, the processor itself
            self.devices[device_id] = self._to_device(raw, domain)

        self.native_scenes = {
            scene_id: NativeScene(id=scene_id, name=scene["name"])
            for scene_id, scene in bridge.scenes.items()
        }

    def _to_device(self, raw: dict, domain: str) -> Device:
        leap_type = raw.get("type", "")
        kind, capabilities = _classify(leap_type, domain)
        area_id = raw.get("area")
        area = self.areas.get(area_id) if area_id else None
        area_name = area.name if area else "Unassigned"

        # "device_name" is the bare load name. "name" is the area-qualified
        # form ("Kitchen_Cans"), so it only gets used as a fallback and needs
        # the area prefix stripped back off for display.
        name = raw.get("device_name")
        if not name:
            name = (raw.get("name") or device_id_fallback(raw)).replace("_", " ").strip()
            if area and name.lower().startswith(area.name.lower() + " "):
                name = name[len(area.name) + 1 :].strip() or area.name

        level = raw.get("current_state", 0)
        return Device(
            id=raw["device_id"],
            name=name,
            area_id=area_id,
            area_name=area_name,
            kind=kind,
            leap_type=leap_type,
            model=raw.get("model") or "",
            capabilities=capabilities,
            level=max(0, int(level)) if isinstance(level, (int, float)) else 0,
            tilt=raw.get("tilt"),
            fan_speed=raw.get("fan_speed"),
        )

    def _wire_subscriptions(self) -> None:
        bridge = self._bridge
        assert bridge is not None
        for device_id in self.devices:
            bridge.add_subscriber(device_id, self._make_handler(device_id))

    def _make_handler(self, device_id: str) -> Callable[[], None]:
        def handler() -> None:
            raw = self._bridge.devices.get(device_id) if self._bridge else None
            device = self.devices.get(device_id)
            if raw is None or device is None:
                return
            level = raw.get("current_state", device.level)
            if isinstance(level, (int, float)):
                device.level = max(0, int(level))
            device.tilt = raw.get("tilt")
            device.fan_speed = raw.get("fan_speed")
            self._emit(device)

        return handler

    # -- writes ------------------------------------------------------------
    async def set_level(self, device_id: str, level: int, fade_seconds: float = 1.0) -> None:
        assert self._bridge is not None
        await self._bridge.set_value(
            device_id,
            max(0, min(100, int(level))),
            fade_time=timedelta(seconds=fade_seconds),
        )

    async def set_tilt(self, device_id: str, tilt: int) -> None:
        assert self._bridge is not None
        await self._bridge.set_tilt(device_id, max(0, min(100, int(tilt))))

    async def set_fan(self, device_id: str, speed: str) -> None:
        assert self._bridge is not None
        await self._bridge.set_fan(device_id, speed)

    async def cover_command(self, device_id: str, action: str) -> None:
        assert self._bridge is not None
        if action == "raise":
            await self._bridge.raise_cover(device_id)
        elif action == "lower":
            await self._bridge.lower_cover(device_id)
        elif action == "stop":
            await self._bridge.stop_cover(device_id)
        else:
            raise ValueError(f"unknown cover action: {action}")

    async def activate_native_scene(self, scene_id: str) -> None:
        assert self._bridge is not None
        await self._bridge.activate_scene(scene_id)


def device_id_fallback(raw: dict) -> str:
    return f"Device {raw.get('device_id', '?')}"


# A plausible RA3 house, used when no processor is configured.
_DEMO_LAYOUT = [
    ("Kitchen", [("Cans", "light"), ("Island Pendants", "light"), ("Under Cabinet", "switch")]),
    ("Living Room", [("Cans", "light"), ("Sconces", "light"), ("Shades", "shade-tilt")]),
    ("Dining Room", [("Chandelier", "light"), ("Shades", "shade")]),
    ("Primary Bedroom", [("Cans", "light"), ("Bedside", "light"), ("Blackout Shades", "shade"), ("Ceiling Fan", "fan")]),
    ("Office", [("Cans", "light"), ("Desk", "switch"), ("Shades", "shade-tilt")]),
    ("Patio", [("String Lights", "light"), ("Flood", "switch")]),
]


class DemoBridge(Bridge):
    """Simulated house so the app is fully usable without a processor."""

    def __init__(self) -> None:
        super().__init__()
        self._build()

    @property
    def is_demo(self) -> bool:
        return True

    def _build(self) -> None:
        counter = 1
        for area_index, (area_name, loads) in enumerate(_DEMO_LAYOUT, start=1):
            area_id = str(area_index)
            self.areas[area_id] = Area(id=area_id, name=area_name)
            for load_name, spec in loads:
                device_id = str(counter)
                counter += 1
                if spec.startswith("shade"):
                    kind, caps = "shade", Capabilities(dimmable=True, tilt=spec.endswith("tilt"))
                    leap_type = "ShadeWithTilt" if caps.tilt else "Shade"
                elif spec == "fan":
                    kind, caps, leap_type = "fan", Capabilities(fan=True), "FanSpeed"
                elif spec == "switch":
                    kind, caps, leap_type = "switch", Capabilities(), "Switched"
                else:
                    kind, caps, leap_type = "light", Capabilities(dimmable=True), "Dimmed"
                self.devices[device_id] = Device(
                    id=device_id,
                    name=load_name,
                    area_id=area_id,
                    area_name=area_name,
                    kind=kind,
                    leap_type=leap_type,
                    model="DEMO",
                    capabilities=caps,
                    level=0,
                    tilt=50 if caps.tilt else None,
                    fan_speed="Off" if kind == "fan" else None,
                )

        for index, name in enumerate(["All Off", "Welcome", "Entertain"], start=1):
            scene_id = f"v{index}"
            self.native_scenes[scene_id] = NativeScene(id=scene_id, name=name)

        self.connected = True

    async def start(self) -> None:
        self.connected = True

    async def stop(self) -> None:
        self.connected = False

    def _touch(self, device_id: str) -> Optional[Device]:
        device = self.devices.get(device_id)
        if device is None:
            raise KeyError(device_id)
        return device

    async def set_level(self, device_id: str, level: int, fade_seconds: float = 1.0) -> None:
        device = self._touch(device_id)
        device.level = max(0, min(100, int(level)))
        if device.kind == "switch":
            device.level = 100 if device.level > 0 else 0
        self._emit(device)

    async def set_tilt(self, device_id: str, tilt: int) -> None:
        device = self._touch(device_id)
        device.tilt = max(0, min(100, int(tilt)))
        self._emit(device)

    async def set_fan(self, device_id: str, speed: str) -> None:
        device = self._touch(device_id)
        device.fan_speed = speed
        device.level = 0 if speed == "Off" else 100
        self._emit(device)

    async def cover_command(self, device_id: str, action: str) -> None:
        device = self._touch(device_id)
        if action == "raise":
            device.level = 100
        elif action == "lower":
            device.level = 0
        elif action == "stop":
            pass
        else:
            raise ValueError(f"unknown cover action: {action}")
        self._emit(device)

    async def activate_native_scene(self, scene_id: str) -> None:
        if scene_id not in self.native_scenes:
            raise KeyError(scene_id)
        # Approximate the processor's behaviour so the UI shows something.
        name = self.native_scenes[scene_id].name
        target = {"All Off": 0, "Welcome": 60, "Entertain": 35}.get(name, 50)
        for device in self.devices.values():
            if device.kind in ("light", "switch"):
                device.level = 100 if (device.kind == "switch" and target) else target
                self._emit(device)


async def create_bridge(settings: Settings) -> Bridge:
    """Build and start the appropriate backend, falling back to demo on failure."""
    if settings.use_demo_backend:
        reason = "demo mode requested" if settings.demo else "no paired processor configured"
        _LOG.warning("starting with the simulated house (%s)", reason)
        bridge: Bridge = DemoBridge()
        await bridge.start()
        return bridge

    bridge = LeapBridge(settings)
    try:
        await bridge.start()
    except Exception:
        _LOG.exception("could not reach the processor at %s, falling back to demo", settings.host)
        bridge = DemoBridge()
        await bridge.start()
    return bridge
