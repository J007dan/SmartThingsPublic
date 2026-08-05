import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lutron_app.config import Settings  # noqa: E402


@pytest.fixture
def settings(tmp_path, monkeypatch):
    monkeypatch.setenv("LUTRON_DATA_DIR", str(tmp_path))
    s = Settings()
    s.demo = True
    s.latitude = 40.0379
    s.longitude = -75.4855
    s.timezone = "America/New_York"
    return s


@pytest.fixture
def client(settings):
    from fastapi.testclient import TestClient

    from lutron_app.api import create_app

    with TestClient(create_app(settings)) as c:
        yield c
