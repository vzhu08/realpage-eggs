from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
import os

from .changes import compute_changes
from .config import DISCLAIMER, VERSION, data_dir
from .models import LookupRequest, LookupResponse, ChangeRequest, ChangeResult, SourceDocument, HealthResponse, AddressPage, RuleDetail
from .service import DatasetUnavailable, lookup
from .store import Store
from .assist_service import assist, CoreUnavailable, CoreContractError
from .evidence import prepare_rules, EvidenceStoreView
from .fact_inputs import FACT_DEFINITIONS
from .models import AssistRequest, AssistResponse, EvidenceReport, FactDefinition, SourceContext
from .retrieval import ContextRetriever, span
from .models import EvidencePackageRequest, EvidencePackage
from .evidence_package import build_evidence_package


def create_app(root=None, core_services=None):
    store = Store(root or data_dir())
    app = FastAPI(title="Rental Housing Law Navigator", version=VERSION, description=DISCLAIMER, responses={404: {"description": "Unknown ID"}, 422: {"description": "Invalid request"}, 503: {"description": "Dataset or extracted rules unavailable"}})
    app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in os.getenv("NAVIGATOR_CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",") if x.strip()], allow_methods=["GET", "POST"], allow_headers=["Content-Type"], expose_headers=["Content-Disposition"])

    def call(fn, *args):
        try: return fn(*args)
        except CoreContractError as exc: raise HTTPException(502, detail={"code": "core_contract_error", "message": str(exc)}) from None
        except CoreUnavailable as exc: raise HTTPException(503, detail={"code": "core_unavailable", "message": str(exc)}) from None
        except DatasetUnavailable as exc: raise HTTPException(503, detail={"code": "dataset_unavailable", "message": str(exc)}) from None
        except KeyError as exc: raise HTTPException(404, detail={"code": "unknown_id", "message": str(exc).strip("'")}) from None
        except ValueError as exc: raise HTTPException(422, detail={"code": "invalid_input", "message": str(exc)}) from None

    @app.get("/api/v1/health", response_model=HealthResponse)
    def health():
        sources, rules, addresses = store.sources(), store.rules(), store.addresses()
        resolved = sum(r.match_quality == "resolved" for r in store.resolutions().values())
        return {"status": "ok", "version": VERSION, "dataset_readiness": "absent" if not addresses else "partial" if not rules or resolved < len(addresses) or any(not s.text for s in sources.values()) else "available", "sources": len(sources), "rules": len(rules), "addresses": len(addresses), "resolved_municipalities": resolved, "last_extraction_outcome": store.read("latest_extract.json", {}).get("outcome"), "disclaimer": DISCLAIMER}

    @app.get("/api/v1/addresses", response_model=AddressPage)
    def addresses(q: str = Query(default="", max_length=200), offset: int = Query(default=0, ge=0), limit: int = Query(default=25, ge=1, le=100)):
        if not store.path("addresses.json").exists(): raise HTTPException(503, detail={"code": "dataset_unavailable", "message": "Run navigator ingest"})
        props = [p for p in store.addresses().values() if q.casefold() in (p.address_id + " " + p.normalized_address).casefold()]
        resolutions = store.resolutions()
        return {"total": len(props), "offset": offset, "limit": limit, "items": [{"property": p.model_dump(mode="json"), "resolution": resolutions[p.address_id].model_dump(mode="json")} for p in sorted(props, key=lambda p: p.address_id)[offset:offset+limit]], "disclaimer": DISCLAIMER}

    @app.post("/api/v1/lookup", response_model=LookupResponse)
    def address_lookup(request: LookupRequest): return call(lookup, store, request)

    @app.post("/api/v1/lookup/assist", response_model=AssistResponse, responses={502: {"description": "Core output violated the shared contract"}})
    def assisted_lookup(request: AssistRequest): return call(assist, store, request, core_services)

    @app.post("/api/v1/lookup/evidence-package", response_model=EvidencePackage, responses={502: {"description": "Core output violated the shared contract"}})
    def evidence_package(request: EvidencePackageRequest, response: Response):
        package = call(build_evidence_package, store, request, core_services)
        response.headers["Content-Disposition"] = f'attachment; filename="evidence-package-{package.package_sha256[:12]}.json"'
        response.headers["Cache-Control"] = "no-store"
        return package

    @app.get("/api/v1/facts", response_model=dict[str, FactDefinition])
    def fact_definitions(): return FACT_DEFINITIONS

    @app.get("/api/v1/rules/{rule_id}/evidence", response_model=EvidenceReport)
    def rule_evidence(rule_id: str):
        _, reports = prepare_rules(store)
        if rule_id not in reports: raise HTTPException(404, detail={"code": "unknown_id", "message": "Unknown rule ID"})
        return reports[rule_id]

    @app.get("/api/v1/sources/{doc_id}/context", response_model=SourceContext)
    def source_context(doc_id: str, start: int = Query(default=0, ge=0), end: int | None = Query(default=None, ge=1), max_depth: int = Query(default=2, ge=0, le=4), max_chars: int = Query(default=24000, ge=100, le=48000), max_spans: int = Query(default=12, ge=1, le=24)):
        sources = store.sources()
        if doc_id not in sources: raise HTTPException(404, detail={"code": "unknown_id", "message": "Unknown document ID"})
        source = sources[doc_id]
        if not source.text: return SourceContext(spans=[], dependencies=[], status="missing", limits={"max_depth": max_depth, "max_chars": max_chars, "max_spans": max_spans}, limits_hit=["missing_source_text"])
        stop = min(start+1, len(source.text)) if end is None else end
        if not 0 <= start < stop <= len(source.text): raise HTTPException(422, detail={"code": "invalid_input", "message": "Offsets must select an original source span"})
        return ContextRetriever(sources).context([span(source, start, stop)], max_depth=max_depth, max_chars=max_chars, max_spans=max_spans)

    @app.get("/api/v1/rules/{rule_id}", response_model=RuleDetail)
    def rule_detail(rule_id: str):
        rules = store.rules()
        if rule_id not in rules: raise HTTPException(404, detail={"code": "unknown_id", "message": "Unknown rule ID"})
        rule = rules[rule_id]
        return {"rule": rule, "versions": [r for r in rules.values() if r.citation == rule.citation and r.jurisdiction == rule.jurisdiction and r.provision_key == rule.provision_key], "disclaimer": DISCLAIMER}

    @app.get("/api/v1/sources/{doc_id}", response_model=SourceDocument)
    def source_detail(doc_id: str):
        sources = store.sources()
        if doc_id not in sources: raise HTTPException(404, detail={"code": "unknown_id", "message": "Unknown document ID"})
        return sources[doc_id]

    @app.post("/api/v1/changes", response_model=ChangeResult)
    def changes(request: ChangeRequest):
        if not store.addresses(): raise HTTPException(503, detail={"code": "dataset_unavailable", "message": "Run navigator ingest"})
        prepared, _ = prepare_rules(store)
        return call(compute_changes, EvidenceStoreView(store, prepared), request)

    return app


app = create_app()
