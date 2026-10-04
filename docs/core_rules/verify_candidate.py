"""Run the unchanged historical verifier, saving its report in Core A's lane."""
from pathlib import Path
import runpy
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
HISTORICAL_REPORT = ROOT / "docs/core/verification.json"
LANE_REPORT = ROOT / "docs/core_rules/verification.json"


def main():
    # The historical runner already isolates all generator-writing checks. Route
    # only its final report so neither that runner nor its historical evidence changes.
    original_write_text = Path.write_text

    def save_report(path, *args, **kwargs):
        target = LANE_REPORT if path == HISTORICAL_REPORT else path
        return original_write_text(target, *args, **kwargs)

    runner = runpy.run_path(str(ROOT / "docs/core/verify_candidate.py"))
    with patch.object(Path, "write_text", save_report):
        return runner["main"]()


if __name__ == "__main__":
    raise SystemExit(main())
