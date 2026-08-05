"""Scene execution and the schedule runner.

This is the "programming" half of the app. Scenes and schedules defined here
live in the app's own store and are executed by driving the processor over
LEAP. They are not written into the processor's configuration database -- LEAP
provides no API for that -- which means they can be created and edited freely,
but they do not change what a physical keypad button does.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta
from typing import List, Optional
from zoneinfo import ZoneInfo

from .bridge import Bridge
from .models import Scene, SceneStep, Schedule, Trigger
from .store import Store

_LOG = logging.getLogger(__name__)

# How long after a schedule's due time we will still fire it. Protects against
# a firing being missed because the process was briefly busy or asleep.
GRACE = timedelta(minutes=5)
TICK_SECONDS = 20


class SceneRunner:
    def __init__(self, bridge: Bridge):
        self.bridge = bridge

    async def apply_step(self, step: SceneStep) -> None:
        if step.action == "level":
            level = step.level if step.level is not None else 0
            await self.bridge.set_level(step.device_id, level, step.fade_seconds)
        elif step.action == "tilt":
            await self.bridge.set_tilt(step.device_id, step.tilt or 0)
        elif step.action == "fan":
            await self.bridge.set_fan(step.device_id, step.fan_speed or "Off")
        elif step.action in ("raise", "lower", "stop"):
            await self.bridge.cover_command(step.device_id, step.action)
        else:
            raise ValueError(f"unknown scene step action: {step.action}")

    async def apply(self, scene: Scene) -> List[str]:
        """Run every step. Returns a list of human-readable errors, if any.

        Steps run concurrently so a scene lands at once rather than rippling
        across the house, and one bad step does not abort the rest.
        """
        if scene.native_scene_id:
            try:
                await self.bridge.activate_native_scene(scene.native_scene_id)
            except Exception as exc:
                _LOG.warning("native scene %s failed: %s", scene.native_scene_id, exc)

        results = await asyncio.gather(
            *(self.apply_step(step) for step in scene.steps),
            return_exceptions=True,
        )
        errors = []
        for step, result in zip(scene.steps, results):
            if isinstance(result, Exception):
                _LOG.warning("scene %s step on %s failed: %s", scene.name, step.device_id, result)
                errors.append(f"{step.device_id}: {result}")
        return errors


def solar_times(day: date, latitude: float, longitude: float, tz: ZoneInfo) -> dict:
    """Sunrise/sunset for a given local date, as timezone-aware datetimes."""
    from astral import LocationInfo
    from astral.sun import sun

    location = LocationInfo(latitude=latitude, longitude=longitude)
    return sun(location.observer, date=day, tzinfo=tz)


def next_fire_time(
    trigger: Trigger,
    day: date,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
) -> Optional[datetime]:
    """The local datetime this trigger is due on ``day``."""
    if trigger.type == "time":
        try:
            hour, minute = (int(part) for part in trigger.time.split(":"))
        except ValueError:
            _LOG.warning("invalid schedule time %r", trigger.time)
            return None
        return datetime(day.year, day.month, day.day, hour, minute, tzinfo=tz)

    try:
        events = solar_times(day, latitude, longitude, tz)
    except Exception as exc:  # polar latitudes, bad coordinates
        _LOG.warning("could not compute solar times for %s: %s", day, exc)
        return None

    base = events.get(trigger.type)
    if base is None:
        return None
    return base + timedelta(minutes=trigger.offset_minutes)


def is_due(
    schedule: Schedule,
    now: datetime,
    latitude: float,
    longitude: float,
    tz: ZoneInfo,
) -> bool:
    """Should this schedule fire at ``now``?"""
    if not schedule.enabled or not schedule.scene_id:
        return False

    today = now.date()
    # Monday == 0, matching Schedule.days.
    if schedule.days and today.weekday() not in schedule.days:
        return False

    if schedule.last_fired == today.isoformat():
        return False

    due = next_fire_time(schedule.trigger, today, latitude, longitude, tz)
    if due is None:
        return False

    return due <= now < due + GRACE


class ScheduleRunner:
    """Background loop that fires schedules as they come due."""

    def __init__(
        self,
        store: Store,
        scenes: SceneRunner,
        latitude: float,
        longitude: float,
        timezone: str,
    ):
        self.store = store
        self.scenes = scenes
        self.latitude = latitude
        self.longitude = longitude
        try:
            self.tz = ZoneInfo(timezone)
        except Exception:
            _LOG.warning("unknown timezone %r, falling back to UTC", timezone)
            self.tz = ZoneInfo("UTC")
        self._task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self) -> None:
        while True:
            try:
                await self.tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                _LOG.exception("schedule tick failed")
            await asyncio.sleep(TICK_SECONDS)

    async def tick(self, now: Optional[datetime] = None) -> List[str]:
        """Fire anything due. Returns the ids of schedules that fired."""
        now = now or datetime.now(self.tz)
        fired = []
        for schedule in list(self.store.schedules.values()):
            if not is_due(schedule, now, self.latitude, self.longitude, self.tz):
                continue
            scene = self.store.scenes.get(schedule.scene_id or "")
            if scene is None:
                _LOG.warning("schedule %s points at a missing scene", schedule.name)
                continue
            _LOG.info("firing schedule %s -> scene %s", schedule.name, scene.name)
            await self.scenes.apply(scene)
            self.store.mark_fired(schedule.id, now.date().isoformat())
            fired.append(schedule.id)
        return fired

    def upcoming(self, limit_days: int = 2) -> List[dict]:
        """Next fire time per schedule, for display in the UI."""
        now = datetime.now(self.tz)
        results = []
        for schedule in self.store.list_schedules():
            if not schedule.enabled:
                results.append({"id": schedule.id, "next": None})
                continue
            when = None
            for offset in range(limit_days + 1):
                day = (now + timedelta(days=offset)).date()
                if schedule.days and day.weekday() not in schedule.days:
                    continue
                candidate = next_fire_time(
                    schedule.trigger, day, self.latitude, self.longitude, self.tz
                )
                if candidate is None:
                    continue
                already_fired_today = (
                    offset == 0 and schedule.last_fired == day.isoformat()
                )
                if candidate > now and not already_fired_today:
                    when = candidate
                    break
            results.append({"id": schedule.id, "next": when.isoformat() if when else None})
        return results
