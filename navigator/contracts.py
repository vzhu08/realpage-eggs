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


def generate():
    root = ROOT / "contracts"
    write_json(root / "openapi.json", create_app().openapi())
    write_json(root / "domain.schema.json", {m.__name__: m.model_json_schema() for m in (Rule, SourceDocument, PropertyFacts, JurisdictionResolution, Evaluation, RunManifest, ExtractionBundle)})
    write_json(root / "research.schema.json", {m.__name__: m.model_json_schema() for m in (AssistContext, AssistRequest, AssistResponse, QuestionPlan, EvidenceReport, SemanticReview)})
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
            rule = next(iter(store.rules().values()))
            from .store import digest
            rendering = EncodedRuleRendering(rule_id=rule.team_rule_id, text="Authored expected rendering: from 2026-11-15 inclusive, residential = true AND units >= 8; exemption = false. Requirement: limit the security deposit to one month's rent. No end date is encoded.", expression_hash=digest([rule.coverage_conditions.model_dump(), rule.exemption_conditions.model_dump(), rule.effective_date, rule.end_date]), renderer_version="authored-fixture-not-Core-output")
            write_json(root / "evidence_examples/source_comparison.json", {"fixture_mode": "synthetic", "contract_status": "implemented_evidence_with_authored_renderer_expectation", "rule": rule.model_dump(mode="json"), "evidence": client.get(f"/api/v1/rules/{rule.team_rule_id}/evidence").json(), "encoded_rule": rendering.model_dump(mode="json")})
            sources = store.sources()
            for source in sources.values(): source.text, source.sha256 = "", digest(b"")
            store.save_collection("sources", sources)
            request["address_id"] = "SYNTH-001"
            write_json(root / "evidence_examples/missing_support.json", {"fixture_mode": "synthetic", "contract_status": "implemented_platform_api", "request": request, "response": client.post("/api/v1/lookup/assist", json=request).json()})
    from .research_fixtures import generate_research_fixtures
    generate_research_fixtures()
    return {"generated": str(root), "examples": "synthetic; research examples are proposed Core output, not a live planner"}
