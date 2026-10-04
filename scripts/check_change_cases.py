"""Read-only data-readiness gate, not software CI or an official competition score.

By default T1–T5 must exist. --require-ids replaces that required ID list for a
focused or synthetic dataset; every stored case is still checked. Exit 0 means
all stored cases are complete and required cases are present, 1 means incomplete
data/evidence, and 2 means invalid input or report destination. No provider runs.
"""
from argparse import ArgumentParser
from collections import Counter
from datetime import date
from hashlib import sha256
import json
from pathlib import Path
import sys

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navigator.evidence import EvidenceStoreView, prepare_rules
from navigator.models import ChangeRequest
from navigator.source_policy import POLICY_VERSION, rule_source_issues
from navigator.store import Store, cached_changes
from scripts.audit_sources import _check_output


DEFAULT_REQUIRED_IDS = ("T1", "T2", "T3", "T4", "T5")
REQUIRED_FILES = ("dataset.json", "sources.json", "rules.json", "addresses.json",
                  "resolutions.json", "change_tests.json")


def _unique_pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


class ReadOnlyStore(Store):
    """Pin files on first read and forbid writes even if a helper changes later."""
    def __init__(self, root):
        super().__init__(root)
        self.pinned = {}
        self.file_hashes = {}

    def read(self, name, default=None):
        if name not in self.pinned:
            path = self.path(name)
            if not path.exists():
                self.pinned[name] = None
                self.file_hashes[name] = None
            else:
                if not path.is_file() or path.is_symlink():
                    raise ValueError(f"Input must be a regular file: {name}")
                raw = path.read_bytes()
                self.file_hashes[name] = sha256(raw).hexdigest()
                self.pinned[name] = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=_unique_pairs)
        value = self.pinned[name]
        return default if value is None else value

    def write(self, name, value):
        raise RuntimeError("The change-case gate cannot write to its input Store")

    def verify_unchanged(self):
        for name, expected in self.file_hashes.items():
            path = self.path(name)
            actual = sha256(path.read_bytes()).hexdigest() if path.is_file() else None
            if expected != actual:
                raise ValueError(f"Input changed during verification: {name}")


def _validate_inputs(store):
    if not store.root.is_dir():
        raise ValueError("Input Store directory does not exist")
    for name in REQUIRED_FILES:
        if not store.path(name).is_file():
            raise ValueError(f"Missing required Store file: {name}")
        value = store.read(name)
        expected = list if name == "change_tests.json" else dict
        if not isinstance(value, expected):
            raise ValueError(f"{name} must contain a JSON {expected.__name__}")
    for name, getter, field in (("sources", store.sources, "doc_id"), ("rules", store.rules, "team_rule_id"),
                                 ("addresses", store.addresses, "address_id"), ("resolutions", store.resolutions, "address_id")):
        try:
            values = getter()
        except ValueError:
            raise ValueError(f"Invalid model records in {name}.json") from None
        if any(key != getattr(value, field) for key, value in values.items()):
            raise ValueError(f"Collection keys differ from record IDs in {name}.json")
    if set(store.addresses()) - set(store.resolutions()):
        raise ValueError("Missing resolution records for stored addresses")
    cases = store.read("change_tests.json")
    seen = set()
    for case in cases:
        if not isinstance(case, dict) or not isinstance(case.get("test_id"), str) or not case["test_id"].strip():
            raise ValueError("Every change case needs a nonempty test_id")
        if case["test_id"] in seen:
            raise ValueError(f"Duplicate change case: {case['test_id']}")
        seen.add(case["test_id"])
        if case.get("type") not in {"as_of", "boundary", "pending", "negative"}:
            raise ValueError(f"Invalid change case type: {case['test_id']}")
        for field in ("rule_ids", "conflict_with"):
            refs = case.get(field, [])
            if not isinstance(refs, list) or any(not isinstance(ref, str) or not ref for ref in refs) or (field == "rule_ids" and not refs):
                raise ValueError(f"Invalid {field} in change case: {case['test_id']}")
        fields = ("as_of_before", "as_of_after") if case["type"] == "as_of" else ("as_of",)
        try:
            for field in fields:
                date.fromisoformat(case[field])
        except (KeyError, TypeError, ValueError):
            raise ValueError(f"Invalid or missing comparison date in change case: {case['test_id']}") from None
    return cases


def check_store(root, required_ids=DEFAULT_REQUIRED_IDS):
    required_ids = sorted(set(required_ids))
    if not required_ids or any(not isinstance(ident, str) or not ident.strip() for ident in required_ids):
        raise ValueError("At least one required case ID must be specified")
    store = ReadOnlyStore(Path(root).resolve())
    cases = _validate_inputs(store)
    prepared, evidence = prepare_rules(store)
    view = EvidenceStoreView(store, prepared)
    sources = store.sources()
    outcomes = []
    for case in sorted(cases, key=lambda row: row["test_id"]):
        ident = case["test_id"]
        try:
            result = cached_changes(view, ChangeRequest(test_id=ident))
        except (KeyError, TypeError, ValueError) as exc:
            outcomes.append({"test_id": ident, "status": "error", "ready": False,
                             "reasons": [str(exc)], "mapped_rule_ids": {}, "counts": {}, "source_issues": {}})
            continue
        related = {rule_id for ids in result.mapped_rule_ids.values() for rule_id in ids}
        source_issues = {rule_id: issues for rule_id in sorted(related)
                         if (issues := rule_source_issues(prepared[rule_id], sources))}
        blocking_issues = {rid: evidence[rid].blocking_issues for rid in sorted(related)
                           if evidence[rid].blocking_issues}
        missing_refs = sorted(ref for ref, ids in result.mapped_rule_ids.items() if not ids)
        outcomes.append({
            "test_id": ident, "status": result.status,
            "ready": result.status == "complete" and not missing_refs and not source_issues and not blocking_issues,
            "scenario": result.scenario, "before": result.before.isoformat(), "after": result.after.isoformat(),
            "mapped_rule_ids": result.mapped_rule_ids, "missing_references": missing_refs,
            "counts": {"affected": len(result.affected_address_ids), "uncertain": len(result.uncertain_address_ids),
                       "conflict": len(result.conflict_flag_address_ids), "mapped_rules": len(related)},
            "reasons": result.notes, "source_issues": source_issues,
            "evidence_blocking_issues": blocking_issues,
        })
    missing = sorted(set(required_ids) - {case["test_id"] for case in cases})
    store.verify_unchanged()
    return {
        "report_type": "change_case_readiness_not_official_scoring", "source_policy_version": POLICY_VERSION,
        "store": str(store.root), "dataset_mode": store.read("dataset.json").get("mode", "unknown"),
        "required_test_ids": required_ids, "missing_required_test_ids": missing,
        "ready": bool(outcomes) and not missing and all(row["ready"] for row in outcomes),
        "case_status_counts": dict(sorted(Counter(row["status"] for row in outcomes).items())),
        "cases": outcomes, "input_files_sha256": dict(sorted(store.file_hashes.items())),
        "input_unchanged": True, "provider_calls": 0, "official_score": None,
        "limits": ["This checks current engine/evidence readiness, not expected address sets or an official score.",
                   "A complete result is not independent legal validation, source-use permission or complete corpus coverage.",
                   "Synthetic data can verify software behavior only; it cannot establish real competition-case readiness.",
                   "All stored cases are checked; required IDs only specify which cases must additionally be present."],
    }


def main(argv=None):
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--store", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True, help="JSON output outside the input Store")
    parser.add_argument("--require-ids", nargs="+", default=DEFAULT_REQUIRED_IDS,
                        help="Required case IDs (default T1 T2 T3 T4 T5); all stored cases are checked")
    args = parser.parse_args(argv)
    try:
        report_path = _check_output(args.report, store=args.store)
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    try:
        report = check_store(args.store, args.require_ids)
        exit_code = 0 if report["ready"] else 1
    except (OSError, ValueError, TypeError, KeyError) as exc:
        report = {"report_type": "change_case_readiness_not_official_scoring", "ready": False,
                  "status": "invalid_input", "errors": [str(exc)], "provider_calls": 0, "official_score": None}
        exit_code = 2
    try:
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    except OSError as exc:
        parser.error(f"Cannot write report: {exc}")
    print(json.dumps({"ready": report["ready"], "report": str(report_path), "exit_code": exit_code}))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
