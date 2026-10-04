from datetime import date
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from .api import create_app
from .config import ROOT, pack_dir
from .demo import build_demo
from .models import Rule, SourceDocument, PropertyFacts, JurisdictionResolution, Evaluation, RunManifest, ExtractionBundle, LookupRequest
from .service import lookup
from .store import read_json, write_json
from .models import AssistContext, AssistRequest, AssistResponse, QuestionPlan, EvidenceReport, SemanticReview, EncodedRuleRendering
from .models import EvidencePackageRequest, EvidencePackage, EvidenceReplayResult
from .models import SourceComparisonsResponse, ChangeSummary


def generate():
    root = ROOT / "contracts"
    from .fact_inputs import FACT_DEFINITIONS
    write_json(root / "fact_definitions.json", {k: v.model_dump(mode="json") for k, v in FACT_DEFINITIONS.items()})
    write_json(root / "openapi.json", create_app().openapi())
    write_json(root / "domain.schema.json", {m.__name__: m.model_json_schema() for m in (Rule, SourceDocument, PropertyFacts, JurisdictionResolution, Evaluation, RunManifest, ExtractionBundle)})
    write_json(root / "research.schema.json", {m.__name__: m.model_json_schema() for m in (AssistContext, AssistRequest, AssistResponse, QuestionPlan, EvidenceReport, SemanticReview, EvidencePackageRequest, EvidencePackage, EvidenceReplayResult, SourceComparisonsResponse, ChangeSummary)})
    official = read_json(pack_dir() / "schema/rule_record.schema.json")
    if official: write_json(root / "competition_rule.schema.json", official)
    with TemporaryDirectory() as temporary:
        store = build_demo(temporary)
        for name, ident in [("normal", "SYNTH-001"), ("empty", "SYNTH-002"), ("unknown", "SYNTH-003")]:
            response = lookup(store, LookupRequest(address_id=ident, as_of=date(2026, 11, 15)))
            write_json(root / f"examples/{name}.json", {"fixture_mode": "synthetic", "request": {"address_id": ident, "as_of": "2026-11-15"}, "response": response.model_dump(mode="json")})
        with TestClient(create_app(store.root)) as client:
            write_json(root / "examples/errors.json", {"fixture_mode": "synthetic", "unknown_address": client.post("/api/v1/lookup", json={"address_id": "MISSING"}).json(), "invalid_input": client.post("/api/v1/lookup", json={}).json()})
            request = {"address_id": "SYNTH-003", "as_of": "2026-11-15"}
            write_json(root / "examples/assist.json", {"fixture_mode": "synthetic", "contract_status": "implemented_platform_api", "request": request, "response": client.post("/api/v1/lookup/assist", json=request).json()})
            package_request = {**request, "answers": [{"field": "units", "value": 8, "provenance": "demo"}]}
            write_json(root / "evidence_examples/property_package.json", {"fixture_mode": "synthetic", "contract_status": "implemented_platform_api", "request": package_request, "response": client.post("/api/v1/lookup/evidence-package", json=package_request).json()})
            change_request = {"before": "2026-11-14", "after": "2026-11-15"}
            write_json(root / "evidence_examples/change_summary.json", {"fixture_mode": "synthetic", "request": change_request, "response": client.post("/api/v1/changes/summary", json=change_request).json()})
            from .retrieval import span
            source = next(iter(store.sources().values()))
            support = [{"span": span(source, 0, min(100, len(source.text))).model_dump(mode="json")}]
            store.write("source_comparisons.json", {"applied_to_saved_sources": {"synthetic_missing_support": {"field": "effective_date", "rule_ids": list(store.rules()), "before": {"value": "2026-11-15", "support": support}, "after": {"value": "unestablished", "support": []}}}})
            write_json(root / "evidence_examples/claim_comparison.json", {"fixture_mode": "synthetic", "response": client.get("/api/v1/source-comparisons").json()})
            rule = next(iter(store.rules().values()))
            from .store import digest
            rendering = EncodedRuleRendering(rule_id=rule.team_rule_id, text="Authored expected rendering: from 2026-11-15 inclusive, residential = true AND units >= 8; exemption = false. Requirement: limit the security deposit to one month's rent. No end date is encoded.", expression_hash=digest([rule.coverage_conditions.model_dump(), rule.exemption_conditions.model_dump(), rule.effective_date, rule.end_date]), renderer_version="authored-fixture-not-Core-output")
            write_json(root / "evidence_examples/source_comparison.json", {"fixture_mode": "synthetic", "contract_status": "implemented_evidence_with_authored_renderer_expectation", "rule": rule.model_dump(mode="json"), "evidence": client.get(f"/api/v1/rules/{rule.team_rule_id}/evidence").json(), "encoded_rule": rendering.model_dump(mode="json")})
            sources = store.sources()
            for source in sources.values(): source.text, source.sha256 = "", digest(b"")
            store.save_collection("sources", sources)
            request["address_id"] = "SYNTH-001"
            write_json(root / "evidence_examples/missing_support.json", {"fixture_mode": "synthetic", "contract_status": "implemented_platform_api", "request": request, "response": client.post("/api/v1/lookup/assist", json=request).json()})
            write_json(root / "evidence_examples/package_missing_support.json", {"fixture_mode": "synthetic", "contract_status": "implemented_platform_api", "request": request, "response": client.post("/api/v1/lookup/evidence-package", json=request).json()})
    from .research_fixtures import generate_research_fixtures
    generate_research_fixtures()
    return {"generated": str(root), "examples": "synthetic; research examples are proposed Core output, not a live planner"}
