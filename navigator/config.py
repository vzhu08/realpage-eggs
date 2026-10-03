import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DATE = "2026-10-01"
VERSION = "0.1.0"
DISCLAIMER = "Not legal advice. Coverage is not a finding of compliance or a violation."


def data_dir() -> Path:
    return Path(os.getenv("NAVIGATOR_DATA_DIR", str(ROOT / "data")))


def pack_dir() -> Path:
    return Path(os.getenv("NAVIGATOR_PACK", str(ROOT / "MIT-hackathon-PARTICIPANT-PACK-CLEAN-NO-HOUR16" / "participant-final-no-hour16")))
