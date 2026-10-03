from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import os

from .changes import compute_changes
from .config import DISCLAIMER, VERSION, data_dir
from .models import LookupRequest, LookupResponse, ChangeRequest, ChangeResult, SourceDocument, HealthResponse, AddressPage, RuleDetail
from .service import DatasetUnavailable, lookup
from .store import Store


def create_app(root=None):
    store = Store(root or data_dir())
    app = FastAPI(title="Rental Housing Law Navigator", version=VERSION, description=DISCLAIMER, responses={404: {"description": "Unknown ID"}, 422: {"description": "Invalid request"}, 503: {"description": "Dataset or extracted rules unavailable"}})
    app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in os.getenv("NAVIGATOR_CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",") if x.strip()], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])

    def call(fn, *args):
        try: return fn(*args)
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
        return call(compute_changes, store, request)

    return app


app = create_app()
