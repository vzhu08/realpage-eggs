"""Plan or run the pinned change-case extraction in a new private Store.

Dry-run is the default. Supplemental material remains research; extraction is not
an admission decision, a passing-case finding, or a submission/release operation.
"""
import argparse
from decimal import Decimal
import json
import os
from pathlib import Path
import shutil
import sys

os.environ["PYTHON_DOTENV_DISABLED"] = "1"
if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from dotenv import dotenv_values
from navigator.extraction import (CONTEXT_INSTRUCTIONS, DRAFT_INSTRUCTIONS, REVIEW_INSTRUCTIONS,
    OpenAIProvider, build_provider_request, chunks, extract, source_segment_payload)
from navigator.models import SourceDocument
from navigator.source_policy import evidence_source_allowed, source_use
from navigator.store import Store, digest, write_json
from scripts.extraction_batch import BudgetClient, RESERVATION
from scripts.extraction_pilot import MODEL, MAX_OUTPUT_TOKENS, MAX_REQUEST_BYTES, configure_credentials


MIN_REVIEW_HEADROOM_BYTES = 16384


def request_sizes(primary, support):
    """Use the actual provider serializer; do not instantiate a client or read keys."""
    draft_sizes, review_sizes = [], []
    context_instruction = CONTEXT_INSTRUCTIONS if support else ""
    for offset, segment in chunks(primary.text):
        payload = source_segment_payload(primary, offset, segment, support)
        for instruction, data, sizes in (
            (DRAFT_INSTRUCTIONS, payload, draft_sizes),
            (REVIEW_INSTRUCTIONS, {**payload, "draft": {}}, review_sizes),
        ):
            request = build_provider_request(MODEL, MAX_OUTPUT_TOKENS, context_instruction + instruction, data)
            request["service_tier"] = "default"
            sizes.append(len(json.dumps(request, ensure_ascii=False).encode("utf-8")))
    draft, review = max(draft_sizes), max(review_sizes)
    headroom = MAX_REQUEST_BYTES - review
    if draft > MAX_REQUEST_BYTES or headroom < MIN_REVIEW_HEADROOM_BYTES:
        raise ValueError(f"Source context leaves insufficient request/review space: {primary.doc_id}; "
                         "select a smaller explicit context before spending")
    return {"draft_max_json_bytes": draft, "review_base_max_json_bytes": review,
            "review_draft_headroom_bytes": headroom, "request_limit_bytes": MAX_REQUEST_BYTES,
            "minimum_review_headroom_bytes": MIN_REVIEW_HEADROOM_BYTES,
            "review_completion_guaranteed": False}


def _files(root):
    root = Path(root)
    if root.is_symlink() or not root.is_dir():
        raise ValueError("Inputs must be regular Store/bundle directories")
    files = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError("Symlinks are not permitted in extraction inputs")
        if path.is_file() and not path.name.startswith(".env"):
            files[path.relative_to(root).as_posix()] = digest(path.read_bytes())
    return files


def _load(path):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError(f"Duplicate JSON key: {key}")
            result[key] = value
        return result
    return json.loads(Path(path).read_text(encoding="utf-8"), object_pairs_hook=unique)


def plan(source_dir, source_bundle, output, doc_ids=None):
    source_dir, source_bundle = Path(source_dir).absolute(), Path(source_bundle).absolute()
    output = Path(output).absolute()
    hashes = {"base_store": _files(source_dir), "source_bundle": _files(source_bundle)}
    if output.exists() or output.is_symlink() or any(
        output.resolve().is_relative_to(p.resolve()) or p.resolve().is_relative_to(output.resolve())
        for p in (source_dir, source_bundle)
    ):
        raise ValueError("Output must be new and separate from both input directories")
    manifest = _load(source_bundle / "manifest.json")
    if (manifest.get("label") != "SOURCE_ONLY_RESEARCH_BUNDLE_NOT_A_SUBMISSION"
            or manifest.get("rules_created") != 0 or manifest.get("provider_calls") != 0
            or manifest.get("sources_json_sha256") != hashes["source_bundle"].get("sources.json")):
        raise ValueError("Invalid or changed source-only bundle manifest")
    # Validate JSON keys before Store model parsing so duplicate IDs cannot vanish.
    for name in ("sources.json", "rules.json"):
        _load(source_dir / name)
    _load(source_bundle / "sources.json")
    base = Store(source_dir)
    base.rules()
    original, supplied = base.sources(), Store(source_bundle).sources()
    if any(key != source.doc_id for collection in (original, supplied) for key, source in collection.items()):
        raise ValueError("Source map keys must match each source doc_id")
    records = manifest.get("documents", [])
    if len(records) != len(supplied) or {r["doc_id"] for r in records} != set(supplied):
        raise ValueError("Bundle source manifest does not match source IDs")
    for record in records:
        source = supplied[record["doc_id"]]
        if (not source.text or source.capture_status == "synthetic"
                or source.sha256 != digest(source.text.encode("utf-8"))
                or source.sha256 != record["text_sha256"]):
            raise ValueError(f"Bundle source identity mismatch: {source.doc_id}")
        declared = SourceDocument.model_validate({**record["original_source_metadata"], "text": source.text,
            "source_type": record["declaration"]["source_type"]})
        if declared != source:
            raise ValueError(f"Undeclared source metadata change: {source.doc_id}")
        if source.doc_id in original:
            prior = original[source.doc_id]
            if prior.sha256 != source.sha256 or prior.text != source.text or prior.url != source.url:
                raise ValueError(f"Existing source ID has different evidence: {source.doc_id}")
            recorded = record["provenance"].get("existing_store_metadata", record["original_source_metadata"])
            if SourceDocument.model_validate({**recorded, "text": prior.text}) != prior:
                raise ValueError(f"Existing source metadata differs from the recorded input: {source.doc_id}")
        for item in record["files"]:
            path = source_bundle / item["path"]
            if (not path.resolve().is_relative_to(source_bundle.resolve())
                    or hashes["source_bundle"].get(item["path"]) != item["sha256"]
                    or path.stat().st_size != item["bytes"]):
                raise ValueError(f"Bundle payload changed: {source.doc_id}")
    jobs, seen = [], set()
    for job in manifest.get("extraction_jobs", []):
        ident, support = job["doc_id"], job["supporting_doc_ids"]
        if (ident in seen or ident not in supplied or not isinstance(support, list)
                or any(not isinstance(x, str) for x in support)
                or len(set(support)) != len(support) or ident in support or set(support) - set(supplied)):
            raise ValueError("Invalid primary/supporting document selection")
        seen.add(ident)
        primary = supplied[ident]
        if source_use(primary).status != "eligible_primary":
            raise ValueError(f"Primary target must be official legal text: {ident}")
        if any(not evidence_source_allowed(supplied[x], temporal=True) for x in support):
            raise ValueError(f"Supporting documents must be official legal text/status records: {ident}")
        characters = sum(len(supplied[x].text) for x in support)
        if characters > 128000:
            raise ValueError(f"Supporting text exceeds the extractor limit: {ident}")
        jobs.append({**job, "source_sha256": primary.sha256, "chunks": len(list(chunks(primary.text))),
                     "support_characters": characters,
                     "support_sha256": {x: supplied[x].sha256 for x in support},
                     "request_sizes": request_sizes(primary, [supplied[x] for x in sorted(support)])})
    if not jobs:
        raise ValueError("Bundle has no extraction jobs")
    if doc_ids is not None:
        if not doc_ids or len(set(doc_ids)) != len(doc_ids) or set(doc_ids) - seen:
            raise ValueError("Choose unique primary IDs from the pinned extraction jobs")
        jobs = [job for job in jobs if job["doc_id"] in doc_ids]
    return {"label": "RESEARCH_EXTRACTION_CANDIDATES_NOT_A_RELEASE", "source_dir": str(source_dir),
            "source_bundle": str(source_bundle), "output": str(output), "model": MODEL,
            "jobs": jobs, "input_files_sha256": hashes, "provider_calls_started": 0,
            "max_requests_before_budget_limit": 3 * sum(job["chunks"] for job in jobs),
            "ready_for_submission": False,
            "limitations": ["Supplemental source admission remains unverified.",
                            "A successful extraction still requires evidence and T1–T5 readiness checks.",
                            "Existing base-store provenance gaps remain; this does not restore missing historic run files.",
                            "The reviewed transport model, request-size cap and local budget ledger still apply."]}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", required=True, type=Path)
    parser.add_argument("--source-bundle", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--doc-id", action="append", help="Optional primary subset; repeat for multiple jobs")
    parser.add_argument("--env-file", type=Path)
    parser.add_argument("--budget-usd", type=Decimal)
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args(argv)
    budget = args.budget_usd
    if budget is not None and (not budget.is_finite() or not RESERVATION <= budget <= 20):
        parser.error("--budget-usd must be finite and between 1.50 and 20")
    if args.execute and budget is None:
        parser.error("Execution requires an explicit --budget-usd allocation")
    details = plan(args.source_dir, args.source_bundle, args.output, args.doc_id)
    details["budget_usd"] = str(budget) if budget is not None else None
    print(json.dumps(details, indent=2), flush=True)
    if not args.execute:
        print("DRY RUN: no provider calls or Store writes.")
        return 0
    values = dotenv_values(args.env_file) if args.env_file else os.environ
    if values.get("OPENAI_MODEL") and values["OPENAI_MODEL"] != MODEL:
        raise ValueError("Configured OPENAI_MODEL differs from the reviewed budget transport model")
    configure_credentials(args.env_file)
    # Detect edits since planning before creating the execution copy.
    for label, root in (("base_store", args.source_dir), ("source_bundle", args.source_bundle)):
        if _files(root) != details["input_files_sha256"][label]:
            raise ValueError("Extraction input changed after planning")
    shutil.copytree(args.source_dir, args.output, ignore=shutil.ignore_patterns(".env", ".env.*"))
    args.output.chmod(0o700)
    if _files(args.output) != details["input_files_sha256"]["base_store"]:
        raise ValueError("Copied base Store differs from the planned inputs; no provider call sent")
    copied_bundle = args.output / "change_case_source_bundle"
    shutil.copytree(args.source_bundle, copied_bundle)
    if _files(copied_bundle) != details["input_files_sha256"]["source_bundle"]:
        raise ValueError("Copied source bundle differs from the planned inputs; no provider call sent")
    store = Store(args.output)
    sources = store.sources()
    sources.update(Store(copied_bundle).sources())
    store.save_collection("sources", sources)
    write_json(store.path("change_case_extraction_plan.json"), details)
    with httpx.Client(timeout=httpx.Timeout(120, read=600)) as transport:
        client = BudgetClient(transport, store.path("change_case_budget.json"), budget)
        client.save()
        for job in details["jobs"]:
            # Cached work costs nothing. The transport reserves allowance before
            # every actual POST, including cache misses inside an otherwise cached job.
            provider = OpenAIProvider(client=client)
            provider.max_output_tokens = MAX_OUTPUT_TOKENS
            result = extract(store, [job["doc_id"]], provider=provider, limit=1,
                             supporting_doc_ids=job["supporting_doc_ids"])
            result.config.update(transport_attempts=1, change_case_ledger="change_case_budget.json",
                                 source_bundle_manifest_sha256=details["input_files_sha256"]["source_bundle"]["manifest.json"])
            store.save_run(result)
            print(json.dumps({"doc_id": job["doc_id"], "outcome": result.outcome,
                              "counts": result.counts, "errors": result.errors}), flush=True)
            if result.outcome != "success":
                return 1
    print("Extraction completed; run check_change_cases.py against the new Store. No release or submission was made.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, TypeError) as exc:
        print(f"Cannot run change-case extraction: {exc}", file=sys.stderr)
        raise SystemExit(2)
