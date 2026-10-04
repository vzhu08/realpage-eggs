"""Record replay data for the frontend's labeled synthetic demo mode.

Every response written here is produced by the backend's own code paths
(navigator.assist_service.assist — the function behind POST /lookup/assist — and
navigator.changes.compute_changes over evidence-prepared rules, as POST /changes does).
The frontend replays these responses verbatim; it never evaluates rules itself.

Two files are written:

- src/demo/recorded/synthetic-replay.json: the backend's own fictional Maple Harbor store
  (navigator.demo.build_demo). Nothing in it is authored by the frontend.
- src/demo/recorded/portfolio-dev-fixture.json: a UX DEVELOPMENT FIXTURE. The fictional
  sources and properties are authored in frontend/scripts/dev_portfolio.py so the portfolio
  view has several jurisdictions, categories and dates to lay out; the rules are created by
  the backend's extraction validation and every result is computed by the backend. Its
  `proposed_disagreements` entry is authored and labeled as a proposed shape (no contract yet).

Nothing here is legal evidence.

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

sys.path.insert(0, str(Path(__file__).resolve().parent))

from navigator.changes import compute_changes  # noqa: E402
from navigator.config import DISCLAIMER, VERSION  # noqa: E402
from navigator.demo import build_demo  # noqa: E402
from navigator.assist_service import assist  # noqa: E402
from navigator.evidence import EvidenceStoreView, prepare_rules  # noqa: E402
from navigator.models import AssistRequest, ChangeRequest, date_bounds  # noqa: E402
from navigator.store import Store, digest, read_json  # noqa: E402

from dev_portfolio import LABEL as DEV_LABEL, build_dev_portfolio  # noqa: E402

OUTPUT = ROOT / "frontend/src/demo/recorded/synthetic-replay.json"
DEV_OUTPUT = ROOT / "frontend/src/demo/recorded/portfolio-dev-fixture.json"

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


def changes_like_api(store, request):
    """POST /changes evaluates against evidence-prepared rules (navigator/api.py); do the same."""
    prepared, _ = prepare_rules(store)
    return compute_changes(EvidenceStoreView(store, prepared), request)


def intern(payload, minimum=160):
    """Store each repeated JSON subtree once.

    Recorded responses repeat the same evidence, rules and traces many times. Subtrees that
    occur more than once are moved to `pool` and replaced by {"$pool": index}; the frontend
    expands them back to the exact original responses (src/demo/pool.ts), and this function
    asserts that round trip before anything is written.
    """
    counts = {}

    def key(node):
        return json.dumps(node, sort_keys=True, ensure_ascii=False, separators=(",", ":"))

    def count(node):
        if isinstance(node, dict):
            for child in node.values(): count(child)
        elif isinstance(node, list):
            for child in node: count(child)
        else:
            return
        text = key(node)
        if len(text) >= minimum: counts[text] = counts.get(text, 0) + 1

    count(payload)
    pool, index = [], {}

    def pack(node, top=False):
        if not isinstance(node, (dict, list)): return node
        text = key(node)
        if not top and counts.get(text, 0) > 1:
            if text not in index:
                index[text] = len(pool)
                pool.append(None)
                pool[index[text]] = pack(node, top=True)
            return {"$pool": index[text]}
        if isinstance(node, dict): return {name: pack(child) for name, child in node.items()}
        return [pack(child) for child in node]

    packed = pack(payload, top=True)

    def expand(node):
        if isinstance(node, dict):
            if set(node) == {"$pool"}: return expand(pool[node["$pool"]])
            return {name: expand(child) for name, child in node.items()}
        if isinstance(node, list): return [expand(child) for child in node]
        return node

    if expand(packed) != payload: raise RuntimeError("Pooled recording does not expand to the original responses")
    return {"pool": pool, "data": packed}


def record_dev_portfolio(temporary: Path) -> dict:
    """Backend output for the fictional UX development portfolio (frontend/scripts/dev_portfolio.py)."""
    store = build_dev_portfolio(temporary / "ux-dev-portfolio")
    all_rules, all_sources = store.rules(), store.sources()
    _, reports = prepare_rules(store)

    # Days on which something a source states could change a result: each rule's status events and
    # effective/end dates. A date written as a month or year yields the first and last possible day.
    stated = sorted({value for rule in all_rules.values() for value in [rule.effective_date, rule.end_date, *[event.on for event in rule.status_events]] if value})
    comparisons = [("2026-10-01", "2027-01-15", "actual"), ("2026-10-01", "2027-01-15", "if_enacted"), ("2026-10-01", "2026-12-15", "actual")]
    for value in stated:
        low, high = date_bounds(value)
        before = date.fromordinal(low.toordinal() - 1).isoformat()
        for after in sorted({low.isoformat(), high.isoformat()}):
            pair = (before, after, "actual")
            if pair not in comparisons: comparisons.append(pair)

    changes = []
    for before, after, scenario in comparisons:
        request = ChangeRequest(before=date.fromisoformat(before), after=date.fromisoformat(after), scenario=scenario)
        changes.append({"store": "dev_portfolio", "request": {"before": before, "after": after, "scenario": scenario}, "response": changes_like_api(store, request).model_dump(mode="json")})

    lookup_dates = ["2026-10-01", "2026-12-15", "2027-01-15"]
    assists = []
    for ident in sorted(store.addresses()):
        for day in lookup_dates:
            response = assist(store, AssistRequest(address_id=ident, as_of=date.fromisoformat(day)))
            assists.append({"request": {"address_id": ident, "as_of": day}, "response": response.model_dump(mode="json")})

    resolutions = store.resolutions()
    addresses = [{"property": prop.model_dump(mode="json"), "resolution": resolutions[ident].model_dump(mode="json")} for ident, prop in sorted(store.addresses().items())]
    rules = {}
    for ident, rule in sorted(all_rules.items()):
        versions = [r for r in all_rules.values() if r.citation == rule.citation and r.jurisdiction == rule.jurisdiction and r.provision_key == rule.provision_key]
        rules[ident] = {"rule": rule.model_dump(mode="json"), "versions": [v.model_dump(mode="json") for v in versions], "disclaimer": DISCLAIMER}

    return {
        "manifest": {
            "fixture_mode": "synthetic",
            "label": DEV_LABEL,
            "fixture_kind": "ux_development_fixture",
            "generated_by": "frontend/scripts/record_demo.py (store built by frontend/scripts/dev_portfolio.py)",
            "backend_version": VERSION,
            "backend_commit": backend_commit(),
            "note": "Fictional law and properties authored by the UX lane for layout development. Every rule was created by the backend's ingest/extraction validation and every result was computed by the backend. Not Core A output, not a real snapshot, not legal evidence.",
            "lookup_dates": lookup_dates,
            "source_texts": {doc: digest((ROOT / f"frontend/scripts/dev_fixture/{doc}.txt").read_bytes()) for doc in sorted(all_sources)},
        },
        "addresses": addresses,
        "assists": assists,
        "rules": rules,
        "sources": {ident: source.model_dump(mode="json") for ident, source in sorted(all_sources.items())},
        "evidence_reports": {ident: report.model_dump(mode="json") for ident, report in sorted(reports.items())},
        "changes": changes,
        "proposed_disagreements": proposed_disagreements(all_rules, all_sources),
    }


def proposed_disagreements(rules, sources) -> list[dict]:
    """A PROPOSED shape for field-level source disagreements, pending PLAT-06 / CORE-06.

    No contract or endpoint exists for this yet. The entry below is authored by the UX lane so
    the disagreement view can be laid out; the backend did not produce or evaluate it. Offsets
    and hashes are read from the stored fixture sources, never typed by hand. It names no winner.
    """
    def span(doc_id, quote):
        text = sources[doc_id].text
        start = text.find(quote)
        if start < 0 or text.find(quote, start + 1) >= 0: raise RuntimeError(f"Fixture quote must occur exactly once in {doc_id}")
        return {"doc_id": doc_id, "source_hash": sources[doc_id].sha256, "start": start, "end": start + len(quote), "text": quote, "section": None}

    target = next(rule for rule in rules.values() if rule.citation == "Cedar Landing Ordinance DEV-07, section 3")
    return [{
        "disagreement_id": "ux-dev-effective-date-cedar-landing-s3",
        "contract_status": "ux_proposed_shape_awaiting_PLAT-06",
        "authored_by": "UX lane development fixture; not backend output",
        "field": "effective_date",
        "status": "unresolved",
        "affected_rule_ids": [target.team_rule_id],
        "claims": [
            {"claim_id": "adopted-text", "stated_value": "2026-11-01", "span": span("DEV-CL-ORD-07", "Beginning November 1, 2026, residential rental buildings containing at least five units must limit a security deposit to one month's rent."), "status_dates": [{"status": "enacted", "on": "2026-08-18"}]},
            {"claim_id": "clerk-notice", "stated_value": "2026-12-01", "span": span("DEV-CL-NOTICE-07", "The clerk's office advises that section 3 of Ordinance DEV-07, the security deposit limit, takes effect on December 1, 2026."), "status_dates": [{"status": "posted", "on": "2026-09-02"}]},
        ],
        "unresolved_reason": "Two captured sources state different effective dates for the same section, and no captured source establishes which date is operative.",
        "remedy_kind": "source_gap",
        "remedy": "Obtain the adopting record or an official correction for section 3 and review the authority of each source. A property fact cannot settle this.",
    }]


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
            result = changes_like_api(store, request)
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
            result = changes_like_api(empty, ChangeRequest(test_id=test["test_id"]))
            changes.append({"store": "no_extracted_rules", "request": {"test_id": test["test_id"]}, "response": result.model_dump(mode="json")})

        dev = record_dev_portfolio(Path(temporary))

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

    pooled = intern({name: value for name, value in dev.items() if name != "manifest"})
    DEV_OUTPUT.write_text(json.dumps({"manifest": dev["manifest"], **pooled}, indent=None, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {DEV_OUTPUT.relative_to(ROOT)}: {len(dev['addresses'])} properties, {len(dev['assists'])} assisted lookups, {len(dev['rules'])} rules, {len(dev['sources'])} sources, {len(dev['changes'])} change results, {len(pooled['pool'])} pooled subtrees")


if __name__ == "__main__":
    main()
