from datetime import date
from pathlib import Path

import pytest

from navigator.demo import build_demo
from navigator.models import Expression, JurisdictionResolution


@pytest.fixture
def demo(tmp_path):
    return build_demo(tmp_path / "synthetic")


@pytest.fixture
def rule(demo):
    return next(iter(demo.rules().values()))


@pytest.fixture
def prop(demo):
    return demo.addresses()["SYNTH-001"]


@pytest.fixture
def resolution(demo):
    return demo.resolutions()["SYNTH-001"]
