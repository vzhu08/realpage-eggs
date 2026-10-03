from datetime import date
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from .api import create_app
from .config import ROOT, pack_dir
from .demo import build_demo
from .models import Rule, SourceDocument, PropertyFacts, JurisdictionResolution, Evaluation, RunManifest, ExtractionBundle, LookupRequest
from .service import lookup
from .store import read_json, write_json
from .models import AssistContext, AssistRequest, AssistResponse, QuestionPlan, EvidenceReport, SemanticReview


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
    from .research_fixtures import generate_research_fixtures
    generate_research_fixtures()
    return {"generated": str(root), "examples": "synthetic; research examples are proposed Core output, not a live planner"}
