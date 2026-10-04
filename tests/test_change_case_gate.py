"""Readiness diagnostics use fictional fixtures, never expected legal outcomes."""
from hashlib import sha256
import json

import httpx
import pytest

from navigator.store import Store
from scripts import check_change_cases as gate
from scripts.check_change_cases import check_store, main


def fingerprint(root):
    return {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest()
            for path in root.rglob("*") if path.is_file()}


@pytest.fixture
def complete_case(demo, rule):
    # Reuse the real adapter selector with explicitly synthetic data and the
    # fictional source's actual dates. No real-law acceptance is asserted.
    rule.jurisdiction, rule.level = "CA", "state"
    rule.category = "algorithmic_rent_setting"
    rule.title = "Synthetic AB 325 selector fixture; not actual law"
    demo.save_collection("rules", {rule.team_rule_id: rule})
    demo.save_collection("addresses", {"SYNTH-001": demo.addresses()["SYNTH-001"]})
    demo.save_collection("resolutions", {"SYNTH-001": demo.resolutions()["SYNTH-001"]})
    demo.write("change_tests.json", [{"test_id": "T1", "type": "as_of", "rule_ids": ["CA-ALG-01"],
                                     "as_of_before": "2026-11-14", "as_of_after": "2026-11-15"}])
    return demo


def test_complete_synthetic_case_uses_evidence_path_and_never_mutates_inputs(complete_case, tmp_path, monkeypatch):
    before = fingerprint(complete_case.root)
    monkeypatch.setattr(Store, "write", lambda *args: pytest.fail("No Store writes allowed"))
    monkeypatch.setattr(httpx.Client, "send", lambda *args, **kwargs: pytest.fail("No HTTP/provider calls allowed"))
    output = tmp_path / "report.json"
    assert main(["--store", str(complete_case.root), "--report", str(output), "--require-ids", "T1"]) == 0
    report = json.loads(output.read_text())
    assert report["ready"] and report["dataset_mode"] == "synthetic"
    assert report["official_score"] is None and report["provider_calls"] == 0
    assert report["cases"][0]["status"] == "complete"
    assert report["cases"][0]["counts"] == {"affected": 1, "uncertain": 0, "conflict": 0, "mapped_rules": 1}
    assert report["input_unchanged"]
    assert fingerprint(complete_case.root) == before


def test_partial_case_fails_gate_without_hiding_uncertainty(complete_case, tmp_path):
    props = complete_case.addresses()
    props["SYNTH-001"].facts.pop("units")
    complete_case.save_collection("addresses", props)
    before = fingerprint(complete_case.root)
    output = tmp_path / "partial.json"
    assert main(["--store", str(complete_case.root), "--report", str(output), "--require-ids", "T1"]) == 1
    report = json.loads(output.read_text())
    assert not report["ready"]
    assert report["cases"][0]["status"] == "partial"
    assert report["cases"][0]["counts"]["uncertain"] == 1
    assert fingerprint(complete_case.root) == before


def test_missing_mapping_is_blocked_not_a_successful_empty_case(complete_case):
    complete_case.write("rules.json", {})
    report = check_store(complete_case.root, ["T1"])
    case = report["cases"][0]
    assert not report["ready"] and case["status"] == "blocked"
    assert case["missing_references"] == ["CA-ALG-01"]
    assert case["mapped_rule_ids"] == {"CA-ALG-01": []}
    assert any("Missing extracted legal evidence" in note for note in case["reasons"])


def test_default_gate_requires_all_five_cases_even_when_one_case_is_complete(complete_case, tmp_path):
    output = tmp_path / "default.json"
    assert main(["--store", str(complete_case.root), "--report", str(output)]) == 1
    report = json.loads(output.read_text())
    assert report["cases"][0]["status"] == "complete"
    assert report["missing_required_test_ids"] == ["T2", "T3", "T4", "T5"]
    assert not report["ready"]


def test_source_eligibility_is_preserved_by_prepared_evidence(complete_case):
    sources = complete_case.sources()
    source = next(iter(sources.values()))
    source.capture_status, source.authority, source.source_type = "supplied", "official", "agency_guidance"
    complete_case.save_collection("sources", sources)
    before = fingerprint(complete_case.root)
    report = check_store(complete_case.root, ["T1"])
    case = report["cases"][0]
    assert not report["ready"] and case["status"] == "partial"
    assert case["source_issues"] and case["evidence_blocking_issues"]
    assert any("source_eligibility" in issue for issues in case["source_issues"].values() for issue in issues)
    assert fingerprint(complete_case.root) == before


def test_complete_engine_result_cannot_hide_a_related_rule_evidence_blocker(complete_case, monkeypatch):
    rules = complete_case.rules()
    related = next(iter(rules.values())).model_copy(deep=True)
    related.team_rule_id = "synthetic-related-rule"
    related.jurisdiction, related.level = "Hoboken, NJ", "city"
    related.quoted_span = "This fabricated synthetic quote does not occur in the original source."
    rules[related.team_rule_id] = related
    complete_case.save_collection("rules", rules)
    before = fingerprint(complete_case.root)
    original = gate.cached_changes

    def complete_with_related_mapping(store, request):
        result = original(store, request)
        assert result.status == "complete"
        assert store.rules()[related.team_rule_id].review_issues  # Evidence was prepared first.
        return result.model_copy(update={"mapped_rule_ids": {
            **result.mapped_rule_ids, "HOB-ALG-01": [related.team_rule_id]}})

    monkeypatch.setattr(gate, "cached_changes", complete_with_related_mapping)
    report = check_store(complete_case.root, ["T1"])
    case = report["cases"][0]
    assert case["status"] == "complete" and case["source_issues"] == {}
    assert not case["ready"] and not report["ready"]
    assert "primary_quote_absent" in case["evidence_blocking_issues"][related.team_rule_id]
    assert fingerprint(complete_case.root) == before


@pytest.mark.parametrize("damage", ["missing_store", "missing_file", "malformed_json", "missing_date", "duplicate_case", "missing_resolution"])
def test_invalid_inputs_fail_cleanly_with_a_json_diagnostic(complete_case, tmp_path, damage):
    root = complete_case.root
    if damage == "missing_store":
        root = tmp_path / "absent"
    elif damage == "missing_file":
        complete_case.path("rules.json").unlink()
    elif damage == "malformed_json":
        complete_case.path("rules.json").write_text("{")
    elif damage == "missing_date":
        cases = complete_case.read("change_tests.json")
        del cases[0]["as_of_after"]
        complete_case.write("change_tests.json", cases)
    elif damage == "duplicate_case":
        cases = complete_case.read("change_tests.json")
        complete_case.write("change_tests.json", cases + cases)
    else:
        complete_case.write("resolutions.json", {})
    before = fingerprint(root) if root.exists() else None
    report_path = tmp_path / "invalid.json"
    assert main(["--store", str(root), "--report", str(report_path)]) == 2
    report = json.loads(report_path.read_text())
    assert not report["ready"] and report["status"] == "invalid_input" and report["errors"]
    assert (fingerprint(root) if root.exists() else None) == before


@pytest.mark.parametrize("destination", ["rules.json", "new-report.json", "nested/report.json", "hardlink"])
def test_report_cannot_overwrite_inputs(complete_case, tmp_path, destination):
    output = complete_case.root / destination
    if destination == "hardlink":
        output = tmp_path / "outside-report.json"
        output.hardlink_to(complete_case.path("dataset.json"))
    before = fingerprint(complete_case.root)
    with pytest.raises(SystemExit) as exc:
        main(["--store", str(complete_case.root), "--report", str(output)])
    assert exc.value.code == 2
    assert fingerprint(complete_case.root) == before
