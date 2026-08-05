"""API tests, run against the simulated house."""

import pytest


def a_device(client, kind="light"):
    devices = client.get("/api/state").json()["inventory"]["devices"]
    return next(d for d in devices if d["kind"] == kind)


# ---------------------------------------------------------------- state
def test_state_reports_the_simulated_house(client):
    state = client.get("/api/state").json()
    inventory = state["inventory"]
    assert inventory["demo"] is True
    assert inventory["connected"] is True
    assert len(inventory["areas"]) > 0
    assert len(inventory["devices"]) > 0
    assert {"scenes", "schedules", "layout", "upcoming", "settings"} <= state.keys()


def test_devices_carry_capabilities(client):
    devices = client.get("/api/state").json()["inventory"]["devices"]
    assert any(d["capabilities"]["tilt"] for d in devices if d["kind"] == "shade")
    assert any(d["capabilities"]["fan"] for d in devices if d["kind"] == "fan")
    assert all(d["area_name"] for d in devices)


# -------------------------------------------------------------- control
def test_set_level(client):
    device = a_device(client)
    assert client.post(f"/api/devices/{device['id']}/level", json={"level": 62}).status_code == 200
    assert a_device(client)["level"] == 62 or any(
        d["id"] == device["id"] and d["level"] == 62
        for d in client.get("/api/state").json()["inventory"]["devices"]
    )


def test_level_is_range_checked(client):
    device = a_device(client)
    assert client.post(f"/api/devices/{device['id']}/level", json={"level": 150}).status_code == 422
    assert client.post(f"/api/devices/{device['id']}/level", json={"level": -1}).status_code == 422


def test_unknown_device_is_a_404(client):
    assert client.post("/api/devices/nope/level", json={"level": 10}).status_code == 404


def test_tilt_rejected_on_a_device_without_tilt(client):
    light = a_device(client, "light")
    assert client.post(f"/api/devices/{light['id']}/tilt", json={"tilt": 40}).status_code == 400


def test_tilt_on_a_tilting_shade(client):
    devices = client.get("/api/state").json()["inventory"]["devices"]
    shade = next(d for d in devices if d["capabilities"]["tilt"])
    assert client.post(f"/api/devices/{shade['id']}/tilt", json={"tilt": 30}).status_code == 200
    after = next(
        d for d in client.get("/api/state").json()["inventory"]["devices"] if d["id"] == shade["id"]
    )
    assert after["tilt"] == 30


def test_fan_speed(client):
    fan = a_device(client, "fan")
    assert client.post(f"/api/devices/{fan['id']}/fan", json={"speed": "High"}).status_code == 200
    after = next(
        d for d in client.get("/api/state").json()["inventory"]["devices"] if d["id"] == fan["id"]
    )
    assert after["fan_speed"] == "High"


def test_fan_command_rejected_on_a_light(client):
    light = a_device(client, "light")
    assert client.post(f"/api/devices/{light['id']}/fan", json={"speed": "High"}).status_code == 400


def test_cover_commands(client):
    shade = a_device(client, "shade")
    assert client.post(f"/api/devices/{shade['id']}/cover", json={"action": "raise"}).status_code == 200
    after = next(
        d for d in client.get("/api/state").json()["inventory"]["devices"] if d["id"] == shade["id"]
    )
    assert after["level"] == 100
    bad = client.post(f"/api/devices/{shade['id']}/cover", json={"action": "twirl"})
    assert bad.status_code == 400


def test_area_level_sets_every_load_in_the_room(client):
    state = client.get("/api/state").json()
    area = state["inventory"]["areas"][0]
    response = client.post(f"/api/areas/{area['id']}/level", json={"level": 25})
    assert response.status_code == 200
    assert response.json()["count"] > 0
    devices = client.get("/api/state").json()["inventory"]["devices"]
    in_area = [d for d in devices if d["area_id"] == area["id"] and d["kind"] == "light"]
    assert all(d["level"] == 25 for d in in_area)


# --------------------------------------------------------------- scenes
def test_scene_lifecycle(client):
    device = a_device(client)
    created = client.post(
        "/api/scenes",
        json={
            "name": "Movie night",
            "icon": "🎬",
            "steps": [{"device_id": device["id"], "action": "level", "level": 12}],
        },
    ).json()
    assert created["id"]

    assert any(s["id"] == created["id"] for s in client.get("/api/scenes").json())

    assert client.post(f"/api/scenes/{created['id']}/activate").json()["ok"] is True
    after = next(
        d for d in client.get("/api/state").json()["inventory"]["devices"] if d["id"] == device["id"]
    )
    assert after["level"] == 12

    assert client.delete(f"/api/scenes/{created['id']}").status_code == 200
    assert client.get("/api/scenes").json() == []


def test_scene_edit_keeps_the_same_id(client):
    scene = client.post("/api/scenes", json={"name": "One", "steps": []}).json()
    edited = client.post("/api/scenes", json={**scene, "name": "Two"}).json()
    assert edited["id"] == scene["id"]
    assert len(client.get("/api/scenes").json()) == 1
    assert client.get("/api/scenes").json()[0]["name"] == "Two"


def test_activating_an_unknown_scene_is_a_404(client):
    assert client.post("/api/scenes/ghost/activate").status_code == 404


def test_capture_snapshots_current_levels(client):
    device = a_device(client)
    client.post(f"/api/devices/{device['id']}/level", json={"level": 77})

    captured = client.post("/api/scenes/capture", json={"name": "Snapshot", "steps": []}).json()

    step = next(s for s in captured["steps"] if s["device_id"] == device["id"])
    assert step["level"] == 77
    assert len(captured["steps"]) > 1


def test_native_scene_activation(client):
    native = client.get("/api/state").json()["inventory"]["native_scenes"]
    assert client.post(f"/api/native-scenes/{native[0]['id']}/activate").status_code == 200
    assert client.post("/api/native-scenes/ghost/activate").status_code == 404


# ------------------------------------------------------------ schedules
def test_schedule_lifecycle(client):
    scene = client.post("/api/scenes", json={"name": "Evening", "steps": []}).json()
    schedule = client.post(
        "/api/schedules",
        json={
            "name": "Sunset lights",
            "scene_id": scene["id"],
            "trigger": {"type": "sunset", "offset_minutes": -15},
            "days": [0, 1, 2, 3, 4],
        },
    ).json()
    assert schedule["id"]
    assert schedule["trigger"]["offset_minutes"] == -15

    upcoming = client.get("/api/state").json()["upcoming"]
    assert any(u["id"] == schedule["id"] for u in upcoming)

    assert client.delete(f"/api/schedules/{schedule['id']}").status_code == 200
    assert client.get("/api/schedules").json() == []


def test_schedule_must_reference_a_real_scene(client):
    response = client.post("/api/schedules", json={"name": "Bad", "scene_id": "ghost"})
    assert response.status_code == 400


def test_deleting_a_scene_removes_schedules_that_used_it(client):
    scene = client.post("/api/scenes", json={"name": "Evening", "steps": []}).json()
    client.post("/api/schedules", json={"name": "Nightly", "scene_id": scene["id"]})
    assert len(client.get("/api/schedules").json()) == 1

    client.delete(f"/api/scenes/{scene['id']}")

    assert client.get("/api/schedules").json() == []


def test_offset_bounds_are_enforced(client):
    scene = client.post("/api/scenes", json={"name": "S", "steps": []}).json()
    response = client.post(
        "/api/schedules",
        json={"name": "Way off", "scene_id": scene["id"], "trigger": {"type": "sunset", "offset_minutes": 5000}},
    )
    assert response.status_code == 422


# --------------------------------------------------------------- layout
def test_layout_round_trips(client):
    layout = {
        "area_order": ["2", "1"],
        "hidden_devices": ["5"],
        "favorite_devices": ["1"],
        "display_names": {"1": "Kitchen Cans"},
    }
    assert client.put("/api/layout", json=layout).status_code == 200
    assert client.get("/api/state").json()["layout"] == layout


# ------------------------------------------------------------ websocket
def test_websocket_sends_a_snapshot_then_live_updates(client):
    with client.websocket_connect("/ws") as socket:
        snapshot = socket.receive_json()
        assert snapshot["type"] == "snapshot"
        assert len(snapshot["inventory"]["devices"]) > 0

        device = snapshot["inventory"]["devices"][0]
        client.post(f"/api/devices/{device['id']}/level", json={"level": 33})

        message = socket.receive_json()
        assert message["type"] == "device"
        assert message["device"]["id"] == device["id"]
        assert message["device"]["level"] == 33


# ----------------------------------------------------------- static app
def test_the_ui_is_served(client):
    response = client.get("/")
    assert response.status_code == 200
    assert "<title>Home</title>" in response.text
    assert client.get("/app.js").status_code == 200
    assert client.get("/style.css").status_code == 200


# ------------------------------------------------------- persistence
def test_programming_survives_a_restart(settings):
    """Scenes and schedules must come back after the process is restarted."""
    from fastapi.testclient import TestClient

    from lutron_app.api import create_app

    with TestClient(create_app(settings)) as first:
        scene = first.post("/api/scenes", json={"name": "Persisted", "steps": []}).json()
        first.post("/api/schedules", json={"name": "Nightly", "scene_id": scene["id"]})

    with TestClient(create_app(settings)) as second:
        assert [s["name"] for s in second.get("/api/scenes").json()] == ["Persisted"]
        assert [s["name"] for s in second.get("/api/schedules").json()] == ["Nightly"]
