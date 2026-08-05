"""Tests for scene execution and schedule due-time logic."""

import asyncio
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from lutron_app.bridge import DemoBridge
from lutron_app.engine import (
    AutomationRunner,
    SceneRunner,
    ScheduleRunner,
    is_dark,
    is_due,
    next_fire_time,
)
from lutron_app.models import Automation, Scene, SceneStep, Schedule, Trigger
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


# ------------------------------------------------- occupancy automations
def test_is_dark_at_midnight_and_light_at_noon():
    assert is_dark(datetime(2026, 6, 21, 0, 30, tzinfo=TZ), LAT, LON, TZ)
    assert not is_dark(datetime(2026, 6, 21, 12, 0, tzinfo=TZ), LAT, LON, TZ)


def test_is_dark_after_sunset():
    # Midsummer: 9pm is past sunset in eastern Pennsylvania, 7pm is not.
    assert is_dark(datetime(2026, 6, 21, 21, 30, tzinfo=TZ), LAT, LON, TZ)
    assert not is_dark(datetime(2026, 6, 21, 19, 0, tzinfo=TZ), LAT, LON, TZ)


def automation_runner(store, bridge):
    return AutomationRunner(store, SceneRunner(bridge), LAT, LON, TZ)


def test_dark_only_rule_is_skipped_in_daylight(tmp_path, bridge):
    """The classic motion-light mistake: firing at noon."""
    store = Store(tmp_path / "p.json")
    light = first_of(bridge, "light")
    scene = store.upsert_scene(
        Scene(name="Night light", steps=[SceneStep(device_id=light.id, action="level", level=15)])
    )
    sensor = next(iter(bridge.occupancy.values()))
    store.upsert_automation(
        Automation(name="Motion", sensor_id=sensor.id, occupied_scene_id=scene.id, when="dark")
    )
    sensor.status = "Occupied"
    runner = automation_runner(store, bridge)

    noon = asyncio.run(runner.handle(sensor, datetime(2026, 6, 21, 12, 0, tzinfo=TZ)))
    assert noon == []
    assert bridge.devices[light.id].level == 0

    night = asyncio.run(runner.handle(sensor, datetime(2026, 6, 21, 23, 0, tzinfo=TZ)))
    assert len(night) == 1
    assert bridge.devices[light.id].level == 15


def test_always_rule_fires_regardless_of_time(tmp_path, bridge):
    store = Store(tmp_path / "p.json")
    light = first_of(bridge, "light")
    scene = store.upsert_scene(
        Scene(name="On", steps=[SceneStep(device_id=light.id, action="level", level=90)])
    )
    sensor = next(iter(bridge.occupancy.values()))
    store.upsert_automation(
        Automation(name="Motion", sensor_id=sensor.id, occupied_scene_id=scene.id, when="always")
    )
    sensor.status = "Occupied"

    fired = asyncio.run(
        automation_runner(store, bridge).handle(sensor, datetime(2026, 6, 21, 12, 0, tzinfo=TZ))
    )
    assert len(fired) == 1
    assert bridge.devices[light.id].level == 90


def test_automation_records_when_it_last_triggered(tmp_path, bridge):
    store = Store(tmp_path / "p.json")
    scene = store.upsert_scene(Scene(name="S", steps=[]))
    sensor = next(iter(bridge.occupancy.values()))
    automation = store.upsert_automation(
        Automation(name="Motion", sensor_id=sensor.id, occupied_scene_id=scene.id)
    )
    sensor.status = "Occupied"

    asyncio.run(automation_runner(store, bridge).handle(sensor, datetime(2026, 1, 5, 8, 0, tzinfo=TZ)))

    assert store.automations[automation.id].last_triggered.startswith("2026-01-05T08:00")


def test_unknown_occupancy_status_fires_nothing(tmp_path, bridge):
    store = Store(tmp_path / "p.json")
    scene = store.upsert_scene(Scene(name="S", steps=[]))
    sensor = next(iter(bridge.occupancy.values()))
    store.upsert_automation(
        Automation(name="Motion", sensor_id=sensor.id, occupied_scene_id=scene.id)
    )
    sensor.status = "Unknown"

    assert asyncio.run(automation_runner(store, bridge).handle(sensor)) == []


def test_demo_bridge_only_emits_on_transition(bridge):
    seen = []
    bridge.subscribe_occupancy(lambda s: seen.append(s.status))
    sensor_id = next(iter(bridge.occupancy))

    bridge.set_occupancy(sensor_id, "Occupied")
    bridge.set_occupancy(sensor_id, "Occupied")
    bridge.set_occupancy(sensor_id, "Unoccupied")

    assert seen == ["Occupied", "Unoccupied"]
