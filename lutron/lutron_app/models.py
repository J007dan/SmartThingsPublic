"""Data models shared by the bridge, the store, and the HTTP API."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field

# How a device is presented in the UI, collapsed down from the much larger set
# of LEAP device types.
DeviceKind = Literal["light", "switch", "shade", "fan"]

FAN_SPEEDS = ["Off", "Low", "Medium", "MediumHigh", "High"]


class Capabilities(BaseModel):
    dimmable: bool = False
    tilt: bool = False
    fan: bool = False
    warm_dim: bool = False


class Device(BaseModel):
    id: str
    name: str
    area_id: Optional[str] = None
    area_name: str = "Unassigned"
    kind: DeviceKind
    leap_type: str = ""
    model: str = ""
    capabilities: Capabilities = Field(default_factory=Capabilities)

    # Live state.
    level: int = 0
    tilt: Optional[int] = None
    fan_speed: Optional[str] = None

    @property
    def is_on(self) -> bool:
        return self.level > 0


class Area(BaseModel):
    id: str
    name: str
    parent_id: Optional[str] = None


class NativeScene(BaseModel):
    """A scene or phantom button that lives on the processor itself.

    These are created in Lutron Designer; the app can trigger them but cannot
    create or edit them, because LEAP exposes no write-configuration API.
    """

    id: str
    name: str


OCCUPIED = "Occupied"
UNOCCUPIED = "Unoccupied"
UNKNOWN = "Unknown"


class OccupancySensor(BaseModel):
    """An occupancy group.

    On RA3 these are per-area: every sensor in a room rolls up into one status
    for that room, which is what the processor reports over LEAP.
    """

    id: str
    name: str
    area_id: Optional[str] = None
    area_name: str = "Unassigned"
    status: str = UNKNOWN
    sensor_count: int = 1


class Inventory(BaseModel):
    areas: List[Area] = Field(default_factory=list)
    devices: List[Device] = Field(default_factory=list)
    native_scenes: List[NativeScene] = Field(default_factory=list)
    occupancy: List[OccupancySensor] = Field(default_factory=list)
    connected: bool = False
    demo: bool = False


# --------------------------------------------------------------------------
# App-side programming: scenes and schedules the app owns and executes.
# --------------------------------------------------------------------------

StepAction = Literal["level", "tilt", "fan", "raise", "lower", "stop"]


class SceneStep(BaseModel):
    device_id: str
    action: StepAction = "level"
    level: Optional[int] = Field(default=None, ge=0, le=100)
    tilt: Optional[int] = Field(default=None, ge=0, le=100)
    fan_speed: Optional[str] = None
    fade_seconds: float = Field(default=1.0, ge=0, le=3600)


class Scene(BaseModel):
    id: str = ""
    name: str
    icon: str = "✨"
    steps: List[SceneStep] = Field(default_factory=list)
    # Optionally fire a processor-native scene/phantom button as well.
    native_scene_id: Optional[str] = None
    favorite: bool = False


TriggerType = Literal["time", "sunrise", "sunset"]


class Trigger(BaseModel):
    type: TriggerType = "time"
    # Wall-clock time, only used when type == "time".
    time: str = "18:00"
    # Minutes before (negative) or after (positive) the solar event.
    offset_minutes: int = Field(default=0, ge=-720, le=720)


class Schedule(BaseModel):
    id: str = ""
    name: str
    enabled: bool = True
    trigger: Trigger = Field(default_factory=Trigger)
    # ISO weekdays, 0 = Monday .. 6 = Sunday. Empty means every day.
    days: List[int] = Field(default_factory=list)
    scene_id: Optional[str] = None
    last_fired: Optional[str] = None


class Automation(BaseModel):
    """Fire a scene when a room becomes occupied or vacant.

    This runs in the app, alongside whatever the processor already does with
    the same sensor. It does not replace or edit the sensor's own programming.
    """

    id: str = ""
    name: str
    enabled: bool = True
    sensor_id: str
    occupied_scene_id: Optional[str] = None
    vacant_scene_id: Optional[str] = None
    # "always", or "dark" to run only between sunset and sunrise.
    when: Literal["always", "dark"] = "always"
    last_triggered: Optional[str] = None


class Layout(BaseModel):
    """User customisation of the control interface."""

    area_order: List[str] = Field(default_factory=list)
    hidden_devices: List[str] = Field(default_factory=list)
    favorite_devices: List[str] = Field(default_factory=list)
    display_names: Dict[str, str] = Field(default_factory=dict)
    # The level a light goes to when tapped on in this app. Overrides the
    # processor's programmed default, which LEAP cannot change.
    default_levels: Dict[str, int] = Field(default_factory=dict)
