"""Runtime configuration.

Settings come from ``config.json`` in the data directory, with environment
variables taking precedence so a container deployment can stay stateless.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path


def _default_data_dir() -> Path:
    override = os.environ.get("LUTRON_DATA_DIR")
    if override:
        return Path(override).expanduser()
    return Path(os.environ.get("XDG_CONFIG_HOME", "~/.config")).expanduser() / "lutron_app"


@dataclass
class Settings:
    """Everything the app needs to know to reach the processor and run schedules."""

    # Hostname or IP of the RA3 processor. Empty means demo mode.
    host: str = ""
    port: int = 8081

    # Latitude/longitude drive sunrise/sunset schedule triggers.
    latitude: float = 40.0379
    longitude: float = -75.4855
    timezone: str = "America/New_York"

    # HTTP server bind address.
    bind_host: str = "0.0.0.0"
    bind_port: int = 8080

    # Force the simulated backend even when a host is configured. Useful for
    # working on the UI away from the house.
    demo: bool = False

    @property
    def data_dir(self) -> Path:
        return _default_data_dir()

    @property
    def cert_dir(self) -> Path:
        return self.data_dir / "certs"

    @property
    def keyfile(self) -> Path:
        return self.cert_dir / "caseta.key"

    @property
    def certfile(self) -> Path:
        return self.cert_dir / "caseta.crt"

    @property
    def ca_certs(self) -> Path:
        return self.cert_dir / "caseta-bridge.crt"

    @property
    def paired(self) -> bool:
        return all(p.exists() for p in (self.keyfile, self.certfile, self.ca_certs))

    @property
    def use_demo_backend(self) -> bool:
        return self.demo or not self.host or not self.paired


def _coerce(field_type, raw: str):
    if field_type is bool:
        return raw.strip().lower() in {"1", "true", "yes", "on"}
    return field_type(raw)


def load_settings() -> Settings:
    """Read config.json, then let LUTRON_* environment variables override it."""
    settings = Settings()
    config_path = _default_data_dir() / "config.json"
    if config_path.exists():
        try:
            stored = json.loads(config_path.read_text())
        except json.JSONDecodeError:
            stored = {}
        for key, value in stored.items():
            if hasattr(settings, key) and value is not None:
                setattr(settings, key, value)

    for key, field in Settings.__dataclass_fields__.items():
        env_value = os.environ.get(f"LUTRON_{key.upper()}")
        if env_value:
            setattr(settings, key, _coerce(field.type, env_value))

    return settings


def save_settings(settings: Settings) -> None:
    settings.data_dir.mkdir(parents=True, exist_ok=True)
    path = settings.data_dir / "config.json"
    path.write_text(json.dumps(asdict(settings), indent=2) + "\n")
