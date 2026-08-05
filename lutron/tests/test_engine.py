"""Tests for scene execution and schedule due-time logic."""

import asyncio
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from lutron_app.bridge import DemoBridge
from lutron_app.engine import SceneRunner, ScheduleRunner, is_due, next_fire_time
from lutron_app.models import Scene, SceneStep, Schedule, Trigger
from lutron_app.store import Store

TZ = ZoneInfo("America/New_York")
LAT, LON = 40.0379, -75.4855


@pytest.fixture
def bridge():
    return DemoBridge()


def first_of(bridge, kind):
    return next(d for d in bridge.devices.values() if d.kind == kind)


# --------------------------------------------------------------- scenes
def test_scene_applies_levels_to_multiple_devices(bridge):
    lights = [d for d in bridge.devices.values() if d.kind == "light"][:3]
    scene = Scene(
        name="Evening",
        steps=[SceneStep(device_id=d.id, action="level", level=40) for d in lights],
    )

    errors = asyncio.run(SceneRunner(bridge).apply(scene))

    assert errors == []
    assert all(bridge.devices[d.id].level == 40 for d in lights)


def test_scene_step_failure_does_not_abort_the_rest(bridge):
    good = first_of(bridge, "light")
    scene = Scene(
        name="Partly broken",
        steps=[
            SceneStep(device_id="does-not-exist", action="level", level=50),
            SceneStep(device_id=good.id, action="level", level=70),
        ],
    )

    errors = asyncio.run(SceneRunner(bridge).apply(scene))

    assert len(errors) == 1
    assert bridge.devices[good.id].level == 70


def test_scene_can_set_tilt_and_fan(bridge):
    shade = next(d for d in bridge.devices.values() if d.capabilities.tilt)
    fan = first_of(bridge, "fan")
    scene = Scene(
        name="Mixed",
        steps=[
            SceneStep(device_id=shade.id, action="tilt", tilt=25),
            SceneStep(device_id=fan.id, action="fan", fan_speed="Medium"),
        ],
    )

    assert asyncio.run(SceneRunner(bridge).apply(scene)) == []
    assert bridge.devices[shade.id].tilt == 25
    assert bridge.devices[fan.id].fan_speed == "Medium"


def test_cover_commands(bridge):
    shade = first_of(bridge, "shade")
    asyncio.run(bridge.cover_command(shade.id, "raise"))
    assert bridge.devices[shade.id].level == 100
    asyncio.run(bridge.cover_command(shade.id, "lower"))
    assert bridge.devices[shade.id].level == 0
    with pytest.raises(ValueError):
        asyncio.run(bridge.cover_command(shade.id, "wiggle"))


# ------------------------------------------------------------ fire times
def test_fixed_time_trigger():
    when = next_fire_time(Trigger(type="time", time="18:30"), date(2026, 1, 15), LAT, LON, TZ)
    assert (when.hour, when.minute) == (18, 30)


def test_sunset_trigger_lands_in_the_evening():
    when = next_fire_time(Trigger(type="sunset"), date(2026, 6, 21), LAT, LON, TZ)
    assert when is not None
    # Longest day of the year in eastern Pennsylvania: sunset is well after 8pm.
    assert 20 <= when.astimezone(TZ).hour <= 21


def test_sunset_offset_shifts_the_time():
    day = date(2026, 6, 21)
    base = next_fire_time(Trigger(type="sunset"), day, LAT, LON, TZ)
    early = next_fire_time(Trigger(type="sunset", offset_minutes=-30), day, LAT, LON, TZ)
    assert base - early == timedelta(minutes=30)


def test_sunrise_is_before_sunset():
    day = date(2026, 3, 10)
    sunrise = next_fire_time(Trigger(type="sunrise"), day, LAT, LON, TZ)
    sunset = next_fire_time(Trigger(type="sunset"), day, LAT, LON, TZ)
    assert sunrise < sunset


def test_invalid_time_string_is_handled():
    assert next_fire_time(Trigger(type="time", time="nope"), date(2026, 1, 1), LAT, LON, TZ) is None


# ---------------------------------------------------------------- is_due
def schedule(**kwargs):
    base = dict(id="s1", name="Test", scene_id="scene1", trigger=Trigger(type="time", time="18:00"))
    base.update(kwargs)
    return Schedule(**base)


def test_due_at_the_trigger_time():
    assert is_due(schedule(), datetime(2026, 1, 15, 18, 0, tzinfo=TZ), LAT, LON, TZ)


def test_not_due_before_the_trigger_time():
    assert not is_due(schedule(), datetime(2026, 1, 15, 17, 59, tzinfo=TZ), LAT, LON, TZ)


def test_still_due_inside_the_grace_window():
    """A brief stall must not cause a schedule to be skipped entirely."""
    assert is_due(schedule(), datetime(2026, 1, 15, 18, 4, tzinfo=TZ), LAT, LON, TZ)


def test_not_due_after_the_grace_window():
    assert not is_due(schedule(), datetime(2026, 1, 15, 18, 6, tzinfo=TZ), LAT, LON, TZ)


def test_disabled_schedule_never_fires():
    assert not is_due(schedule(enabled=False), datetime(2026, 1, 15, 18, 0, tzinfo=TZ), LAT, LON, TZ)


def test_does_not_fire_twice_in_one_day():
    already = schedule(last_fired="2026-01-15")
    assert not is_due(already, datetime(2026, 1, 15, 18, 0, tzinfo=TZ), LAT, LON, TZ)
    # ...but the next day is fair game.
    assert is_due(already, datetime(2026, 1, 16, 18, 0, tzinfo=TZ), LAT, LON, TZ)


def test_day_of_week_filter():
    # 15 Jan 2026 is a Thursday (weekday 3).
    thursday = datetime(2026, 1, 15, 18, 0, tzinfo=TZ)
    assert is_due(schedule(days=[3]), thursday, LAT, LON, TZ)
    assert not is_due(schedule(days=[0, 1]), thursday, LAT, LON, TZ)


def test_schedule_without_a_scene_never_fires():
    assert not is_due(schedule(scene_id=None), datetime(2026, 1, 15, 18, 0, tzinfo=TZ), LAT, LON, TZ)


# ----------------------------------------------------------- the runner
def test_runner_fires_due_schedule_and_marks_it(tmp_path, bridge):
    store = Store(tmp_path / "programming.json")
    light = first_of(bridge, "light")
    scene = store.upsert_scene(
        Scene(name="Evening", steps=[SceneStep(device_id=light.id, action="level", level=45)])
    )
    store.upsert_schedule(schedule(id="", scene_id=scene.id))

    runner = ScheduleRunner(store, SceneRunner(bridge), LAT, LON, "America/New_York")
    fired = asyncio.run(runner.tick(datetime(2026, 1, 15, 18, 0, tzinfo=TZ)))

    assert len(fired) == 1
    assert bridge.devices[light.id].level == 45
    assert store.schedules[fired[0]].last_fired == "2026-01-15"

    # A second tick in the same window must not re-fire.
    assert asyncio.run(runner.tick(datetime(2026, 1, 15, 18, 1, tzinfo=TZ))) == []


def test_runner_survives_a_dangling_scene_reference(tmp_path, bridge):
    store = Store(tmp_path / "programming.json")
    store.upsert_schedule(schedule(id="", scene_id="ghost"))
    runner = ScheduleRunner(store, SceneRunner(bridge), LAT, LON, "America/New_York")

    assert asyncio.run(runner.tick(datetime(2026, 1, 15, 18, 0, tzinfo=TZ))) == []


def test_unknown_timezone_falls_back_to_utc(tmp_path, bridge):
    runner = ScheduleRunner(Store(tmp_path / "p.json"), SceneRunner(bridge), LAT, LON, "Mars/Olympus")
    assert runner.tz == ZoneInfo("UTC")
