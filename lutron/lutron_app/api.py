"""HTTP + WebSocket API and static file serving."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .bridge import Bridge, create_bridge
from .config import Settings, load_settings
from .engine import ScheduleRunner, SceneRunner
from .models import Device, Layout, Scene, SceneStep, Schedule
from .store import Store

_LOG = logging.getLogger(__name__)

STATIC_DIR = Path(__file__).parent / "static"


# -- request bodies --------------------------------------------------------
class LevelBody(BaseModel):
    level: int = Field(ge=0, le=100)
    fade_seconds: float = Field(default=1.0, ge=0, le=3600)


class TiltBody(BaseModel):
    tilt: int = Field(ge=0, le=100)


class FanBody(BaseModel):
    speed: str


class CoverBody(BaseModel):
    action: str


class Broadcaster:
    """Fans device changes out to every connected browser."""

    def __init__(self) -> None:
        self._clients: List[WebSocket] = []
        self._queue: asyncio.Queue = asyncio.Queue(maxsize=1000)
        self._task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._drain())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    def add(self, websocket: WebSocket) -> None:
        self._clients.append(websocket)

    def remove(self, websocket: WebSocket) -> None:
        if websocket in self._clients:
            self._clients.remove(websocket)

    def publish(self, device: Device) -> None:
        """Called synchronously from the bridge's change callbacks."""
        try:
            self._queue.put_nowait({"type": "device", "device": device.model_dump()})
        except asyncio.QueueFull:
            _LOG.warning("broadcast queue full, dropping a device update")

    async def _drain(self) -> None:
        while True:
            message = await self._queue.get()
            for client in list(self._clients):
                try:
                    await client.send_json(message)
                except Exception:
                    self.remove(client)


def create_app(settings: Optional[Settings] = None, bridge: Optional[Bridge] = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.settings = settings
        settings.data_dir.mkdir(parents=True, exist_ok=True)
        app.state.store = Store(settings.data_dir / "programming.json")
        app.state.bridge = bridge or await create_bridge(settings)
        app.state.scenes = SceneRunner(app.state.bridge)
        app.state.schedules = ScheduleRunner(
            app.state.store,
            app.state.scenes,
            settings.latitude,
            settings.longitude,
            settings.timezone,
        )
        app.state.broadcaster = Broadcaster()
        app.state.broadcaster.start()
        app.state.unsubscribe = app.state.bridge.subscribe(app.state.broadcaster.publish)
        app.state.schedules.start()
        try:
            yield
        finally:
            app.state.unsubscribe()
            await app.state.schedules.stop()
            await app.state.broadcaster.stop()
            await app.state.bridge.stop()

    app = FastAPI(title="Lutron RA3 Control", lifespan=lifespan)

    def get_bridge() -> Bridge:
        return app.state.bridge

    def get_store() -> Store:
        return app.state.store

    # -- state ------------------------------------------------------------
    @app.get("/api/state")
    async def get_state():
        store = get_store()
        return {
            "inventory": get_bridge().inventory().model_dump(),
            "scenes": [s.model_dump() for s in store.list_scenes()],
            "schedules": [s.model_dump() for s in store.list_schedules()],
            "layout": store.layout.model_dump(),
            "upcoming": app.state.schedules.upcoming(),
            "settings": {
                "host": app.state.settings.host,
                "paired": app.state.settings.paired,
                "timezone": app.state.settings.timezone,
            },
        }

    # -- device control ---------------------------------------------------
    def _require_device(device_id: str) -> Device:
        device = get_bridge().devices.get(device_id)
        if device is None:
            raise HTTPException(status_code=404, detail=f"unknown device {device_id}")
        return device

    @app.post("/api/devices/{device_id}/level")
    async def set_level(device_id: str, body: LevelBody):
        _require_device(device_id)
        await get_bridge().set_level(device_id, body.level, body.fade_seconds)
        return {"ok": True}

    @app.post("/api/devices/{device_id}/tilt")
    async def set_tilt(device_id: str, body: TiltBody):
        device = _require_device(device_id)
        if not device.capabilities.tilt:
            raise HTTPException(status_code=400, detail=f"{device.name} does not support tilt")
        await get_bridge().set_tilt(device_id, body.tilt)
        return {"ok": True}

    @app.post("/api/devices/{device_id}/fan")
    async def set_fan(device_id: str, body: FanBody):
        device = _require_device(device_id)
        if not device.capabilities.fan:
            raise HTTPException(status_code=400, detail=f"{device.name} is not a fan")
        await get_bridge().set_fan(device_id, body.speed)
        return {"ok": True}

    @app.post("/api/devices/{device_id}/cover")
    async def cover(device_id: str, body: CoverBody):
        device = _require_device(device_id)
        if device.kind != "shade":
            raise HTTPException(status_code=400, detail=f"{device.name} is not a shade")
        try:
            await get_bridge().cover_command(device_id, body.action)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        return {"ok": True}

    @app.post("/api/areas/{area_id}/level")
    async def set_area_level(area_id: str, body: LevelBody):
        """Set every light and switch in an area at once."""
        bridge = get_bridge()
        targets = [
            d for d in bridge.devices.values()
            if d.area_id == area_id and d.kind in ("light", "switch")
        ]
        if not targets:
            raise HTTPException(status_code=404, detail="no controllable loads in that area")
        await asyncio.gather(
            *(bridge.set_level(d.id, body.level, body.fade_seconds) for d in targets),
            return_exceptions=True,
        )
        return {"ok": True, "count": len(targets)}

    # -- scenes -----------------------------------------------------------
    @app.get("/api/scenes")
    async def list_scenes():
        return [s.model_dump() for s in get_store().list_scenes()]

    @app.post("/api/scenes")
    async def save_scene(scene: Scene):
        return get_store().upsert_scene(scene).model_dump()

    @app.delete("/api/scenes/{scene_id}")
    async def delete_scene(scene_id: str):
        if not get_store().delete_scene(scene_id):
            raise HTTPException(status_code=404, detail="unknown scene")
        return {"ok": True}

    @app.post("/api/scenes/{scene_id}/activate")
    async def activate_scene(scene_id: str):
        scene = get_store().scenes.get(scene_id)
        if scene is None:
            raise HTTPException(status_code=404, detail="unknown scene")
        errors = await app.state.scenes.apply(scene)
        return {"ok": not errors, "errors": errors}

    @app.post("/api/scenes/capture")
    async def capture_scene(scene: Scene):
        """Snapshot the current level of every device in the given areas.

        The body's ``steps`` may be empty; any device ids listed in
        ``steps`` are used as the capture set, otherwise the whole house.
        """
        bridge = get_bridge()
        wanted = {s.device_id for s in scene.steps}
        devices = [
            d for d in bridge.devices.values()
            if (not wanted or d.id in wanted) and d.kind != "fan"
        ]
        scene.steps = [
            SceneStep(device_id=d.id, action="level", level=d.level, fade_seconds=1.0)
            for d in devices
        ]
        return get_store().upsert_scene(scene).model_dump()

    @app.post("/api/native-scenes/{scene_id}/activate")
    async def activate_native(scene_id: str):
        bridge = get_bridge()
        if scene_id not in bridge.native_scenes:
            raise HTTPException(status_code=404, detail="unknown processor scene")
        await bridge.activate_native_scene(scene_id)
        return {"ok": True}

    # -- schedules --------------------------------------------------------
    @app.get("/api/schedules")
    async def list_schedules():
        return [s.model_dump() for s in get_store().list_schedules()]

    @app.post("/api/schedules")
    async def save_schedule(schedule: Schedule):
        if schedule.scene_id and schedule.scene_id not in get_store().scenes:
            raise HTTPException(status_code=400, detail="schedule references an unknown scene")
        return get_store().upsert_schedule(schedule).model_dump()

    @app.delete("/api/schedules/{schedule_id}")
    async def delete_schedule(schedule_id: str):
        if not get_store().delete_schedule(schedule_id):
            raise HTTPException(status_code=404, detail="unknown schedule")
        return {"ok": True}

    # -- layout -----------------------------------------------------------
    @app.put("/api/layout")
    async def set_layout(layout: Layout):
        return get_store().set_layout(layout).model_dump()

    # -- live updates -----------------------------------------------------
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        await websocket.accept()
        app.state.broadcaster.add(websocket)
        try:
            # Prime the client with a full snapshot so it never starts blank.
            await websocket.send_json(
                {"type": "snapshot", "inventory": get_bridge().inventory().model_dump()}
            )
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            pass
        except Exception:
            _LOG.debug("websocket closed", exc_info=True)
        finally:
            app.state.broadcaster.remove(websocket)

    @app.exception_handler(KeyError)
    async def key_error_handler(_request, exc: KeyError):
        return JSONResponse(status_code=404, content={"detail": str(exc)})

    if STATIC_DIR.exists():
        app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")

    return app
