"""Fictional evidence exercises source roles without asserting any real law."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from navigator.api import create_app
from navigator.evidence import check_rule
from navigator.export import export_all
from navigator.models import Evidence, Expression, Interaction
from navigator.store import digest, read_json
from navigator.validation import inventory, validate


def set_primary_role(demo, *, authority="official", kind="legal_text", capture="supplied"):
    sources = demo.sources()
    source = next(iter(sources.values()))
    source.authority, source.source_type, source.capture_status = authority, kind, capture
    demo.save_collection("sources", sources)
    return source


def add_context_source(demo, *, captured=True):
    sources = demo.sources()
    primary = next(iter(sources.values()))
    article = primary.model_copy(deep=True)
    article.doc_id, article.authority, article.source_type = "CONTEXT-ARTICLE", "secondary", "secondary"
    article.capture_status = "supplied" if captured else "link_only"
    article.text = "Fictional newspaper background." if captured else ""
    article.sha256 = digest(article.text.encode("utf-8"))
    article.manifest_sha256 = None
    sources[article.doc_id] = article
    demo.save_collection("sources", sources)
    return article


@pytest.mark.parametrize("authority,kind", [("official", "agency_guidance"), ("official", "unclassified"),
                                            ("official", "status_record"), ("secondary", "secondary")])
def test_contextual_rule_stays_uncertain_consistently_without_mutating_snapshots(demo, authority, kind):
    source = set_primary_role(demo, authority=authority, kind=kind)
    rule = next(iter(demo.rules().values()))
    original_sources, original_rules = demo.path("sources.json").read_bytes(), demo.path("rules.json").read_bytes()
    with TestClient(create_app(demo.root)) as client:
        request = {"address_id": "SYNTH-001", "as_of": "2026-11-15"}
        lookup = client.post("/api/v1/lookup", json=request).json()
        assisted = client.post("/api/v1/lookup/assist", json=request).json()
        detail = client.get(f"/api/v1/rules/{rule.team_rule_id}").json()
        evidence = client.get(f"/api/v1/rules/{rule.team_rule_id}/evidence").json()
        assert lookup["evaluations"][0]["result"] == assisted["lookup"]["evaluations"][0]["result"] == "unknown"
        assert detail["rule"] == lookup["rules"][0]
        assert any(c["kind"] == "source_eligibility" and c["status"] == "insufficient" for c in evidence["checks"])
        assert any(issue.startswith("source_eligibility:") for issue in evidence["blocking_issues"])
        assert lookup["metadata"]["source_review_rule_ids"] == [rule.team_rule_id]
        assert lookup["metadata"]["source_eligibility"][source.doc_id]["operative_allowed"] is False
        assert client.get("/api/v1/health").json()["dataset_readiness"] == "partial"
        change = client.post("/api/v1/changes", json={"before": "2026-11-14", "after": "2026-11-15"}).json()
        assert not change["affected_address_ids"]
    assert demo.path("sources.json").read_bytes() == original_sources
    assert demo.path("rules.json").read_bytes() == original_rules


def test_secondary_support_does_not_replace_or_invalidate_eligible_primary_authority(demo):
    primary = set_primary_role(demo)
    article = add_context_source(demo)
    rule = next(iter(demo.rules().values()))
    rule.evidence.append(Evidence(doc_id=article.doc_id, quote=article.text, supports=["background"], start=0, end=len(article.text)))
    report = check_rule(rule, demo.sources())
    eligibility = [c for c in report.checks if c.kind == "source_eligibility"]
    assert len(eligibility) == 1 and eligibility[0].status == "pass"
    assert primary.doc_id in eligibility[0].message
    assert not any(issue.startswith("source_eligibility:") for issue in report.blocking_issues)


def test_context_links_are_inventory_not_missing_primary_evidence(demo):
    set_primary_role(demo)
    article = add_context_source(demo, captured=False)
    with TestClient(create_app(demo.root)) as client:
        health = client.get("/api/v1/health").json()
        assert health["sources"] == 2 and health["captured_sources"] == health["rule_sources"] == 1
        assert health["primary_source_rules"] == 1 and health["source_review_rules"] == 0
        assert health["context_only_sources"] == 1 and health["dataset_readiness"] == "available"
        lookup = client.post("/api/v1/lookup", json={"address_id": "SYNTH-001", "as_of": "2026-11-15"}).json()
        assert lookup["metadata"]["context_only_source_ids"] == [article.doc_id]
        assert lookup["metadata"]["missing_source_ids"] == lookup["metadata"]["unprocessed_source_ids"] == []
        assert lookup["evaluations"][0]["result"] == "applies"
        assert client.get(f"/api/v1/sources/{article.doc_id}").status_code == 200


def test_successful_transport_does_not_hide_partial_extraction(demo):
    set_primary_role(demo)
    latest = demo.read("latest_extract.json")
    latest["outcome"] = "partial"
    demo.write("latest_extract.json", latest)
    with TestClient(create_app(demo.root)) as client:
        assert client.get("/api/v1/health").json()["dataset_readiness"] == "partial"


@pytest.mark.parametrize("gap", ["terms_review", "unprocessed", "stale"])
def test_health_keeps_unavailable_primary_inputs_partial(demo, gap):
    primary = set_primary_role(demo, capture="terms_review" if gap == "terms_review" else "supplied")
    index = demo.read("extraction_index.json")
    if gap == "unprocessed":
        index.pop(primary.doc_id)
    elif gap == "stale":
        index[primary.doc_id]["sha256"] = "0" * 64
    demo.write("extraction_index.json", index)
    with TestClient(create_app(demo.root)) as client:
        assert client.get("/api/v1/health").json()["dataset_readiness"] == "partial"


@pytest.mark.parametrize("kind", ["secondary", "agency_guidance", "status_record", "unclassified"])
def test_partial_export_never_projects_contextual_candidates_as_law(demo, tmp_path, kind):
    set_primary_role(demo, kind=kind)
    rule = next(iter(demo.rules().values()))
    report = validate(demo, date(2026, 11, 15))
    assert report["exportable_rule_ids"] == []
    assert report["source_ineligible_rule_ids"] == [rule.team_rule_id]
    exported = export_all(demo, tmp_path / "out", date(2026, 11, 15), allow_partial=True, synthetic=True)
    assert exported["all_lookup_references_resolve"]
    assert read_json(tmp_path / "out/rules.json") == []
    assert all(not rows for rows in read_json(tmp_path / "out/lookups.json")["lookups"].values())


def test_negative_findings_require_their_actual_evidence_to_be_eligible(demo):
    primary = set_primary_role(demo)
    article = add_context_source(demo)
    finding = {"jurisdiction": "Maple Harbor, CA", "category": "security_deposits", "statement": "Fictional negative finding.",
               "evidence": [{"doc_id": article.doc_id, "quote": article.text, "supports": ["statement"]}]}
    # A primary-document bucket must not launder article evidence into absence of law.
    demo.save_collection("rules", {})
    demo.write("negative_findings.json", {primary.doc_id: [finding]})
    row = next(r for r in inventory(demo) if r["category"] == "security_deposits")
    assert row["state"] != "supported_negative_finding" and row["negative_findings"] == []
    finding["evidence"] = [{"doc_id": primary.doc_id, "quote": primary.text, "supports": ["statement"]}]
    demo.write("negative_findings.json", {article.doc_id: [finding]})
    row = next(r for r in inventory(demo) if r["category"] == "security_deposits")
    assert row["state"] == "supported_negative_finding"
    finding["evidence"][0]["quote"] = "This quote is absent."
    demo.write("negative_findings.json", {article.doc_id: [finding]})
    assert not next(r for r in inventory(demo) if r["category"] == "security_deposits")["negative_findings"]


def test_exported_overrides_never_reference_excluded_contextual_rules(demo, tmp_path):
    primary = set_primary_role(demo)
    sources = demo.sources()
    guidance = primary.model_copy(deep=True, update={"doc_id": "GUIDANCE", "source_type": "agency_guidance"})
    sources[guidance.doc_id] = guidance
    demo.save_collection("sources", sources)
    rule = next(iter(demo.rules().values()))
    candidate = rule.model_copy(deep=True, update={"team_rule_id": "CONTEXT-RULE", "source_doc_id": guidance.doc_id,
                                                 "citation": "Fictional contextual policy", "provision_key": "context"})
    for item in candidate.evidence:
        item.doc_id = guidance.doc_id
    rule.interactions.append(Interaction(kind="supersedes", target_citation=candidate.citation,
                                        target_jurisdiction=candidate.jurisdiction, category=candidate.category,
                                        scope=Expression(op="literal", value=True), evidence=[rule.evidence[0]], note="Fictional test interaction"))
    demo.save_collection("rules", {rule.team_rule_id: rule, candidate.team_rule_id: candidate})
    export_all(demo, tmp_path / "out", date(2026, 11, 15), allow_partial=True, synthetic=True)
    records = read_json(tmp_path / "out/rules.json")
    assert len(records) == 1 and records[0]["team_rule_id"] == rule.team_rule_id
    assert records[0]["overrides"] == []
