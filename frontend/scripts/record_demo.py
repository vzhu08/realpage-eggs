"""Record replay data for the frontend's labeled synthetic demo mode.

Every payload written here is produced by the backend's own code paths
(navigator.demo.build_demo, navigator.assist_service.assist — the function behind
POST /lookup/assist — and navigator.changes.compute_changes) against the fictional
Maple Harbor store. Nothing is authored by hand and nothing
here is legal evidence. The frontend replays these responses verbatim; it never
evaluates rules itself.

Run from the repository root with the project interpreter:

    .venv/bin/python frontend/scripts/record_demo.py          (macOS/Linux)
    .\\.venv\\Scripts\\python.exe frontend\\scripts\\record_demo.py   (PowerShell)

Re-run after the backend's models, evaluator or synthetic fixture change, then
run `npm run test:unit` in frontend/ (it validates every payload against contracts/).
"""
from __future__ import annotations

import json
import subprocess
import sys
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from navigator.changes import compute_changes  # noqa: E402
from navigator.config import DISCLAIMER, VERSION  # noqa: E402
from navigator.demo import build_demo  # noqa: E402
from navigator.assist_service import assist  # noqa: E402
from navigator.models import AssistRequest, ChangeRequest  # noqa: E402
from navigator.store import Store, read_json  # noqa: E402

OUTPUT = ROOT / "frontend/src/demo/recorded/synthetic-replay.json"

# Dates either side of each boundary in the synthetic ordinance (enactment event and
# effective day), plus the contract's default query date. Chosen to exercise
# not-yet-effective, in-force and pre-enactment states; outcomes come from the evaluator.
LOOKUP_DATES = ["2026-08-31", "2026-10-01", "2026-11-14", "2026-11-15"]
DATE_COMPARISONS = [
    ("2026-10-01", "2026-11-15", "actual"),
    ("2026-11-14", "2026-11-15", "actual"),
    ("2026-11-15", "2026-11-15", "actual"),
    ("2026-10-01", "2026-11-15", "if_enacted"),
]


def backend_commit() -> str | None:
    """The last commit that changed the backend code these payloads were produced by."""
    try:
        return subprocess.run(["git", "-C", str(ROOT), "log", "-1", "--format=%H", "--", "navigator", "fixtures", "config"], capture_output=True, text=True, check=True).stdout.strip() or None
    except Exception:
        return None


def main() -> None:
    assists, rules, sources, changes = [], {}, {}, []
    with TemporaryDirectory() as temporary:
        store = build_demo(Path(temporary) / "synthetic")
        for ident in sorted(store.addresses()):
            for day in LOOKUP_DATES:
                # The same call the API makes for POST /lookup/assist with no answers.
                response = assist(store, AssistRequest(address_id=ident, as_of=date.fromisoformat(day)))
                assists.append({"request": {"address_id": ident, "as_of": day}, "response": response.model_dump(mode="json")})
        all_rules = store.rules()
        for ident, rule in sorted(all_rules.items()):
            # Same selection as GET /api/v1/rules/{id} in navigator/api.py.
            versions = [r for r in all_rules.values() if r.citation == rule.citation and r.jurisdiction == rule.jurisdiction and r.provision_key == rule.provision_key]
            rules[ident] = {"rule": rule.model_dump(mode="json"), "versions": [v.model_dump(mode="json") for v in versions], "disclaimer": DISCLAIMER}
        for ident, source in sorted(store.sources().items()):
            sources[ident] = source.model_dump(mode="json")
        for before, after, scenario in DATE_COMPARISONS:
            request = ChangeRequest(before=date.fromisoformat(before), after=date.fromisoformat(after), scenario=scenario)
            result = compute_changes(store, request)
            changes.append({"store": "synthetic", "request": {"before": before, "after": after, "scenario": scenario}, "response": result.model_dump(mode="json")})

        # Published change scenarios against a store that has properties but no extracted
        # rules — the state of the real dataset before a provider is configured. The backend
        # reports these as blocked; the recording keeps that outcome honest in the demo.
        empty = Store(Path(temporary) / "no-extracted-rules")
        empty.save_collection("addresses", store.addresses())
        empty.save_collection("resolutions", store.resolutions())
        tests = read_json(ROOT / "tests/fixtures/change_tests.json")
        empty.write("change_tests.json", tests)
        for test in tests:
            result = compute_changes(empty, ChangeRequest(test_id=test["test_id"]))
            changes.append({"store": "no_extracted_rules", "request": {"test_id": test["test_id"]}, "response": result.model_dump(mode="json")})

    payload = {
        "manifest": {
            "fixture_mode": "synthetic",
            "label": "SYNTHETIC_NOT_ACTUAL_LAW",
            "generated_by": "frontend/scripts/record_demo.py",
            "backend_version": VERSION,
            "backend_commit": backend_commit(),
            "note": "Verbatim backend output for the fictional Maple Harbor store. Not legal evidence; not a live service.",
            "lookup_dates": LOOKUP_DATES,
        },
        "assists": assists,
        "rules": rules,
        "sources": sources,
        "changes": changes,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(assists)} assisted lookups, {len(rules)} rules, {len(sources)} sources, {len(changes)} change results")


if __name__ == "__main__":
    main()
