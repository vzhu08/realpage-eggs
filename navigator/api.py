from fastapi import FastAPI, HTTPException, Query, Response, Request
from fastapi.responses import StreamingResponse
import json
import time
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path

from .changes import compute_changes
from .config import DISCLAIMER, VERSION, data_dir
from .models import LookupRequest, LookupResponse, ChangeRequest, ChangeResult, SourceDocument, HealthResponse, AddressPage, RuleDetail
from .service import DatasetUnavailable, lookup
from .store import Store, cached_changes
from .assist_service import assist, CoreUnavailable, CoreContractError
from .evidence import prepare_rules, EvidenceStoreView
from .fact_inputs import FACT_DEFINITIONS
from .models import AssistRequest, AssistResponse, EvidenceReport, FactDefinition, SourceContext
from .retrieval import ContextRetriever, span
from .models import EvidencePackageRequest, EvidencePackage
from .evidence_package import build_evidence_package
from .models import SourceComparisonsResponse, ChangeSummary
from .service import source_comparisons, change_summary
from .assist_cache import AssistCache, Artifact, CacheBusy, identity
from .assist_wire import MEDIA_TYPE, pack
from .store import digest


def create_app(root=None, core_services=None, frontend_dist=None, assist_cache_dir=None):
    store = Store(root or data_dir())
    cache_path = assist_cache_dir or os.getenv("NAVIGATOR_ASSIST_CACHE_DIR")
    cache = AssistCache(cache_path) if cache_path else None
    app = FastAPI(title="Rental Housing Law Navigator", version=VERSION, description=DISCLAIMER, responses={404: {"description": "Unknown ID"}, 422: {"description": "Invalid request"}, 503: {"description": "Dataset or extracted rules unavailable"}})
    app.add_middleware(CORSMiddleware, allow_origins=[x.strip() for x in os.getenv("NAVIGATOR_CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",") if x.strip()], allow_methods=["GET", "POST"], allow_headers=["Content-Type"], expose_headers=["Content-Disposition", "X-Assist-Cache", "X-Assist-Identity", "Server-Timing"])
    # Repeated evidence in assist responses can be large. Compress transport only;
    # preserve every result, quote and trace and use a low CPU compression level.
    app.add_middleware(GZipMiddleware, minimum_size=1000, compresslevel=1)

    def call(fn, *args):
        try: return fn(*args)
        except CoreContractError as exc: raise HTTPException(502, detail={"code": "core_contract_error", "message": str(exc)}) from None
        except CoreUnavailable as exc: raise HTTPException(503, detail={"code": "core_unavailable", "message": str(exc)}) from None
        except CacheBusy as exc: raise HTTPException(503, detail={"code": "analysis_busy", "message": str(exc)}, headers={"Retry-After": "2"}) from None
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
    def assisted_lookup(request: AssistRequest, http_request: Request):
        started = time.perf_counter()
        stamp = digest(identity(store))
        representation = "dag" if MEDIA_TYPE in http_request.headers.get("accept", "") else "canonical"
        result = call(lambda: cache.resolve(store, request, representation, core_services=core_services)) if cache else call(assist, store, request, core_services)
        if digest(identity(store)) != stamp:
            if isinstance(result, Artifact):
                result.stream.close()
            raise HTTPException(503, detail={"code": "snapshot_changed", "message": "Serving inputs changed during analysis; retry against the frozen snapshot"})
        headers = {"Cache-Control": "no-store", "Vary": "Accept, Accept-Encoding",
                   "X-Assist-Identity": stamp,
                   "Server-Timing": f'assist;dur={(time.perf_counter()-started)*1000:.2f}'}
        media = MEDIA_TYPE if representation == "dag" else "application/json"
        if isinstance(result, Artifact):
            headers["X-Assist-Cache"] = "hit" if result.hit else "miss"
            # Honor q=0; identity encoding remains available for canonical clients.
            compressed = False
            for token in http_request.headers.get("accept-encoding", "").lower().split(","):
                coding, *parameters = token.strip().split(";")
                if coding != "gzip":
                    continue
                try:
                    quality = next((float(p.split("=", 1)[1]) for p in parameters if p.strip().startswith("q=")), 1.0)
                    compressed = 0 < quality <= 1
                except ValueError:
                    compressed = False
            if compressed:
                headers.update({"Content-Encoding": "gzip", "Content-Length": str(result.size)})
            else:
                # Prevent the general GZipMiddleware from treating gzip;q=0 as
                # permission to compress this explicitly negotiated response.
                headers["Content-Encoding"] = "identity"
            return StreamingResponse(result.chunks(compressed), media_type=media, headers=headers)
        headers["X-Assist-Cache"] = "bypass"
        body = result.model_dump_json()
        if representation == "dag":
            body = json.dumps(pack(json.loads(body)), ensure_ascii=False, separators=(",", ":"))
        return Response(content=body, media_type=media, headers=headers)

    @app.get("/api/v1/assist-cache/identity", include_in_schema=False)
    def assist_identity():
        return Response(content=json.dumps({"identity": digest(identity(store))}), media_type="application/json", headers={"Cache-Control": "no-store"})

    @app.get("/api/v1/demo-requests", include_in_schema=False)
    def demo_requests():
        from scripts.prime_assist import load_manifest
        from .config import ROOT
        manifest = load_manifest(Path(os.getenv("NAVIGATOR_DEMO_MANIFEST", str(ROOT / "config/demo_requests.json"))))
        return {"identity": digest(identity(store)), "steps": manifest["steps"], "label": manifest["label"]}

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
        return call(cached_changes, EvidenceStoreView(store, prepared), request)

    @app.post("/api/v1/changes/summary", response_model=ChangeSummary)
    def summarized_changes(request: ChangeRequest):
        return call(change_summary, store, request)

    @app.get("/api/v1/source-comparisons", response_model=SourceComparisonsResponse)
    def compared_sources():
        return call(source_comparisons, store)

    frontend_dist = frontend_dist or os.getenv("NAVIGATOR_FRONTEND_DIST")
    if frontend_dist:
        public = Path(frontend_dist).resolve()
        if not (public / "index.html").is_file():
            raise RuntimeError("NAVIGATOR_FRONTEND_DIST must contain a built index.html")

        # Reserve the API namespace even when a static build contains an api/ directory.
        @app.api_route("/api", methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], include_in_schema=False)
        @app.api_route("/api/{path:path}", methods=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], include_in_schema=False)
        def unknown_api(path: str = ""):
            raise HTTPException(404, detail="Not Found")

        @app.get("/", include_in_schema=False)
        @app.get("/index.html", include_in_schema=False)
        def frontend_index():
            # A rollback must revalidate the entry point before loading its hashed assets.
            return FileResponse(public / "index.html", headers={"Cache-Control": "no-cache"})

        app.mount("/", StaticFiles(directory=public), name="frontend")

    return app


app = create_app()
