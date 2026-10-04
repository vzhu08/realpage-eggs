"""Offline fictional corrections exercise runtime safeguards, not legal accuracy."""
from copy import deepcopy
from datetime import date

import httpx
import pytest

from navigator.engine import evaluate_rule
from navigator.evidence import prepare_rules
from navigator.evidence_package import build_evidence_package, replay_evidence_package
from navigator.models import Evidence, SourceReview, SourceReviewReferenceDecision, SourceReviewReferenceSpan
from navigator.retrieval import REFERENCES
from navigator.source_review import SourceReviewError, source_review_original
from navigator.store import Store, digest
from scripts.apply_source_review import apply_plan
from scripts.assemble_snapshot import SnapshotError


REQUEST = {"address_id": "SYNTH-001", "as_of": "2026-11-15"}


def file_hashes(root):
    return {p.relative_to(root).as_posix(): digest(p.read_bytes())
            for p in root.rglob("*") if p.is_file()}


def write_review(store, rule, original):
    store.save_collection("rules", {rule.team_rule_id: rule})
    store.write(f"source_reviews/{rule.source_review.review_id}.json", {
        "version": "rule-source-review-v1", "rule_id": rule.team_rule_id,
        "original_rule": original,
        "amended_rule_sha256": digest(rule.model_dump(mode="json")),
    })


@pytest.fixture
def corrected(demo):
    ident, original = next(iter(demo.read("rules.json").items()))
    rule = demo.rules()[ident]
    rule.title += " (fictional source review)"
    source = demo.sources()[rule.source_doc_id]
    evidence = rule.evidence[0].model_copy(deep=True)
    evidence.supports = ["title"]
    rule.source_review = SourceReview(
        review_id="runtime-review", reviewed_at="2026-10-04T12:00:00+00:00",
        original_rule_sha256=digest(original), original_extraction_run_id=rule.extraction_run_id,
        changed_fields=["title"], source_hashes={source.doc_id: source.sha256},
        evidence=[evidence], notes=["Fictional title correction; no new provider extraction."],
    )
    write_review(demo, rule, original)
    return demo


def add_scoped_reference(store, decision=None):
    """Retain the extracted primary bytes and add a labeled synthetic appendix."""
    rule = next(iter(store.rules().values()))
    original = store.read("source_reviews/runtime-review.json")["original_rule"]
    sources = store.sources()
    primary = sources[rule.source_doc_id]
    appendix = primary.model_copy(deep=True)
    appendix.doc_id = "SYNTHETIC-CONTEXT-7"
    appendix.url = "https://example.invalid/synthetic-context-7"
    appendix.text = "Fictional unrelated procedure. See section 7.\n"
    appendix.sha256 = digest(appendix.text.encode("utf-8"))
    sources[appendix.doc_id] = appendix
    store.save_collection("sources", sources)
    fields = ["requirement", "coverage_conditions", "exemption_conditions", "lifecycle",
              "key_value", "effective_date", "exemptions", "status_events"]
    proof = Evidence(doc_id=primary.doc_id, start=0, end=len(primary.text),
                     quote=primary.text, supports=["title", *fields])
    scope = Evidence(doc_id=appendix.doc_id, start=0, end=len(appendix.text),
                     quote=appendix.text, supports=["context_dependency"])
    review = rule.source_review
    review.review_scope = "complete_rule"
    review.reviewed_fields = fields
    review.evidence = [proof]
    review.context_scope = [proof.model_copy(deep=True), scope]
    review.context_scope_note = "Full fictional primary and separately reviewed procedural appendix retained."
    review.source_hashes[appendix.doc_id] = appendix.sha256
    if decision:
        match = next(REFERENCES.finditer(appendix.text))
        review.context_reference_decisions = [SourceReviewReferenceDecision(
            origin=SourceReviewReferenceSpan(doc_id=appendix.doc_id, start=match.start(),
                end=match.end(), quote=match.group()),
            status=decision,
            explanation="Fictional separate procedure does not qualify this deposit-cap proposition.",
        )]
    write_review(store, rule, original)
    return rule


def result(store, rule):
    return evaluate_rule(rule, store.addresses()[REQUEST["address_id"]],
                         store.resolutions()[REQUEST["address_id"]], date(2026, 11, 15)).result


def test_valid_scoped_review_does_not_silence_an_undecided_reference(corrected):
    stored = add_scoped_reference(corrected)
    # The audit record is valid; the missing decision must remain a runtime gap.
    source_review_original(corrected, stored, corrected.sources())
    before = file_hashes(corrected.root)
    prepared, reports = prepare_rules(corrected)
    report = reports[stored.team_rule_id]
    assert report.context.retrieval_method.startswith("pinned_AI_source_review_scope")
    assert report.context.status == "partial"
    dependency, = report.context.dependencies
    assert dependency.reference == "See section 7."
    assert dependency.status == "missing" and not dependency.spans
    assert report.blocking_issues == ["cross_reference:See section 7.:missing"]
    assert result(corrected, prepared[stored.team_rule_id]) == "unknown"
    assert file_hashes(corrected.root) == before


def test_exact_recorded_reference_decision_clears_only_that_context_gap(corrected):
    stored = add_scoped_reference(corrected, "not_applicable")
    before = file_hashes(corrected.root)
    prepared, reports = prepare_rules(corrected)
    report = reports[stored.team_rule_id]
    assert report.context.status == "available" and not report.blocking_issues
    assert report.context.dependencies[0].status == "not_applicable"
    assert "Recorded AI source review" in report.context.dependencies[0].explanation
    assert result(corrected, prepared[stored.team_rule_id]) == "applies"
    assert any(c.kind == "semantic_support" and c.status == "not_checked" for c in report.checks)
    # A context disposition cannot erase an independent semantic qualification.
    prepared[stored.team_rule_id].review_issues.append("Fictional unresolved substantive qualification.")
    prepared[stored.team_rule_id].semantic_verification = "needs_review"
    assert result(corrected, prepared[stored.team_rule_id]) == "unknown"
    assert file_hashes(corrected.root) == before


@pytest.mark.parametrize("damage", ["missing", "amended_hash", "original_payload"])
def test_invalid_or_missing_manifest_forces_unknown_without_mutating_stored_rule(corrected, damage):
    name = "source_reviews/runtime-review.json"
    if damage == "missing":
        corrected.path(name).unlink()
    else:
        manifest = corrected.read(name)
        if damage == "amended_hash":
            manifest["amended_rule_sha256"] = "0" * 64
        else:
            manifest["original_rule"]["requirement"] += " Unrecorded alteration."
        corrected.write(name, manifest)
    before = file_hashes(corrected.root)
    prepared, reports = prepare_rules(corrected)
    rule = next(iter(prepared.values()))
    assert "invalid_source_review" in reports[rule.team_rule_id].blocking_issues
    assert rule.semantic_verification == "needs_review"
    assert result(corrected, rule) == "unknown"
    assert not corrected.rules()[rule.team_rule_id].review_issues
    assert file_hashes(corrected.root) == before


@pytest.mark.parametrize("manifest_state", ["valid", "missing", "bad_hash"])
def test_capture_and_offline_replay_preserve_review_original_and_failure_state(corrected, monkeypatch, manifest_state):
    name = "source_reviews/runtime-review.json"
    expected = corrected.read(name)
    if manifest_state == "missing":
        corrected.path(name).unlink()
    elif manifest_state == "bad_hash":
        expected["amended_rule_sha256"] = "0" * 64
        corrected.write(name, expected)
    before = file_hashes(corrected.root)
    monkeypatch.setattr(httpx.Client, "send", lambda *a, **k: pytest.fail("No network permitted"))
    package = build_evidence_package(corrected, REQUEST)
    if manifest_state == "missing":
        assert package.inputs.source_reviews == {}
    else:
        captured = package.inputs.source_reviews["runtime-review"].model_dump(mode="json")
        assert captured == expected
        assert captured["original_rule"]["title"] != next(iter(package.inputs.rules.values())).title
    assert package.response.lookup.evaluations[0].result == ("applies" if manifest_state == "valid" else "unknown")
    if manifest_state != "valid":
        assert "invalid_source_review" in package.response.evidence_reports[0].blocking_issues
    assert file_hashes(corrected.root) == before
    monkeypatch.setattr(Store, "read", lambda *a, **k: pytest.fail("Replay must use captured inputs only"))
    assert replay_evidence_package(package.model_dump(mode="json")).status == "reproduced"


def correction_plan(store):
    ident, raw = next(iter(store.read("rules.json").items()))
    rule = store.rules()[ident]
    source = store.sources()[rule.source_doc_id]
    evidence = rule.evidence[0].model_dump(mode="json")
    evidence["supports"] = ["title"]
    hashes = file_hashes(store.root)
    return {"version": "source-review-plan-v1", "input_hashes": {
        name: hashes[name] for name in ("rules.json", "sources.json", "addresses.json",
                                      "resolutions.json", "extraction_index.json")},
        "reviews": [{"rule_id": ident, "original_rule_sha256": digest(raw),
            "changes": {"title": rule.title + " (fictional source review)"},
            "source_hashes": {source.doc_id: source.sha256}, "evidence": [evidence],
            "notes": ["Fictional correction; original extraction remains unchanged."]}]}


def test_apply_plan_publishes_new_store_with_original_extraction_and_source_bytes(demo, tmp_path, monkeypatch):
    plan = correction_plan(demo)
    before = file_hashes(demo.root)
    originals = deepcopy(demo.read("rules.json"))
    monkeypatch.setattr(httpx.Client, "send", lambda *a, **k: pytest.fail("No network permitted"))
    output = tmp_path / "reviewed-output"
    receipt = apply_plan(demo.root, output, plan)
    assert receipt["original_store_unchanged"] and receipt["provider_calls"] == 0
    assert receipt["reviewed_rules"] == 1 and receipt["review_plan_sha256"] == digest(plan)
    assert file_hashes(demo.root) == before
    reviewed = Store(output)
    ident, rule = next(iter(reviewed.rules().items()))
    record = reviewed.read(f"source_reviews/{rule.source_review.review_id}.json")
    assert record["original_rule"] == originals[ident]
    assert record["amended_rule_sha256"] == digest(rule.model_dump(mode="json"))
    assert source_review_original(reviewed, rule, reviewed.sources()).extraction_run_id == rule.extraction_run_id
    for name, checksum in before.items():
        if name == "sources.json" or name.startswith(("extraction_cache/", "provider_outputs/", "runs/")):
            assert digest((output / name).read_bytes()) == checksum
    assert "NOT_LEGAL_VALIDATION" in reviewed.read("dataset.json")["label"]


@pytest.mark.parametrize("damage,match", [
    ("input_source", "input hash mismatch: sources.json"),
    ("source_pin", "source hash mismatch"),
    ("rule_pin", "original hash mismatch"),
    ("evidence_offset", "offsets/quote mismatch"),
])
def test_stale_or_unpinned_plan_leaves_no_partial_output_or_input_mutation(demo, tmp_path, damage, match):
    plan = correction_plan(demo)
    entry = plan["reviews"][0]
    if damage == "input_source":
        plan["input_hashes"]["sources.json"] = "0" * 64
    elif damage == "source_pin":
        entry["source_hashes"] = {ident: "0" * 64 for ident in entry["source_hashes"]}
    elif damage == "rule_pin":
        entry["original_rule_sha256"] = "0" * 64
    else:
        entry["evidence"][0]["start"] += 1
        entry["evidence"][0]["end"] += 1
    before = file_hashes(demo.root)
    output = tmp_path / "must-not-exist"
    with pytest.raises((SnapshotError, SourceReviewError), match=match):
        apply_plan(demo.root, output, plan)
    assert not output.exists()
    assert not list(tmp_path.glob(".source-review-*"))
    assert file_hashes(demo.root) == before


def test_apply_plan_refuses_existing_or_nested_output_without_overwriting(demo, tmp_path):
    plan = correction_plan(demo)
    existing = tmp_path / "existing"
    existing.mkdir()
    marker = existing / "keep.txt"
    marker.write_text("Existing user work", encoding="utf-8")
    before = file_hashes(demo.root)
    for output in (existing, demo.root / "nested"):
        with pytest.raises(SnapshotError, match="new output outside"):
            apply_plan(demo.root, output, plan)
    assert marker.read_text(encoding="utf-8") == "Existing user work"
    assert not (demo.root / "nested").exists()
    assert file_hashes(demo.root) == before
