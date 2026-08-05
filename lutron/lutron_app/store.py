"""JSON-backed persistence for the things the app owns: scenes, schedules, layout.

Deliberately a flat file rather than a database. The whole point of this layer
is that it should be trivial to back up, diff, and hand-edit.
"""

from __future__ import annotations

import json
import threading
import uuid
from pathlib import Path
from typing import Dict, List, Optional

from .models import Layout, Scene, Schedule


class Store:
    def __init__(self, path: Path):
        self.path = path
        self._lock = threading.Lock()
        self.scenes: Dict[str, Scene] = {}
        self.schedules: Dict[str, Schedule] = {}
        self.layout = Layout()
        self.load()

    # -- persistence -------------------------------------------------------
    def load(self) -> None:
        if not self.path.exists():
            return
        try:
            raw = json.loads(self.path.read_text())
        except json.JSONDecodeError:
            return
        self.scenes = {s["id"]: Scene(**s) for s in raw.get("scenes", [])}
        self.schedules = {s["id"]: Schedule(**s) for s in raw.get("schedules", [])}
        self.layout = Layout(**raw.get("layout", {}))

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "scenes": [s.model_dump() for s in self.scenes.values()],
            "schedules": [s.model_dump() for s in self.schedules.values()],
            "layout": self.layout.model_dump(),
        }
        # Write via a temp file so a crash mid-write cannot truncate the config.
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(payload, indent=2) + "\n")
        tmp.replace(self.path)

    # -- scenes ------------------------------------------------------------
    def list_scenes(self) -> List[Scene]:
        return sorted(self.scenes.values(), key=lambda s: s.name.lower())

    def upsert_scene(self, scene: Scene) -> Scene:
        with self._lock:
            if not scene.id:
                scene.id = uuid.uuid4().hex[:12]
            self.scenes[scene.id] = scene
            self.save()
        return scene

    def delete_scene(self, scene_id: str) -> bool:
        with self._lock:
            if self.scenes.pop(scene_id, None) is None:
                return False
            # Drop schedules that pointed at the deleted scene so the runner
            # never fires a dangling reference.
            for sched in list(self.schedules.values()):
                if sched.scene_id == scene_id:
                    self.schedules.pop(sched.id, None)
            self.save()
        return True

    # -- schedules ---------------------------------------------------------
    def list_schedules(self) -> List[Schedule]:
        return sorted(self.schedules.values(), key=lambda s: s.name.lower())

    def upsert_schedule(self, schedule: Schedule) -> Schedule:
        with self._lock:
            if not schedule.id:
                schedule.id = uuid.uuid4().hex[:12]
            self.schedules[schedule.id] = schedule
            self.save()
        return schedule

    def delete_schedule(self, schedule_id: str) -> bool:
        with self._lock:
            if self.schedules.pop(schedule_id, None) is None:
                return False
            self.save()
        return True

    def mark_fired(self, schedule_id: str, stamp: str) -> None:
        with self._lock:
            schedule = self.schedules.get(schedule_id)
            if schedule is not None:
                schedule.last_fired = stamp
                self.save()

    # -- layout ------------------------------------------------------------
    def set_layout(self, layout: Layout) -> Layout:
        with self._lock:
            self.layout = layout
            self.save()
        return layout

    def display_name(self, device_id: str, fallback: str) -> str:
        return self.layout.display_names.get(device_id) or fallback
