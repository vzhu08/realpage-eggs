"""Reuse the immutable PLAT-11 capture implementation in this separate follow-up directory."""
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "2026-10-04"))
import capture

capture.ROOT = ROOT
if __name__ == "__main__":
    capture.main()
