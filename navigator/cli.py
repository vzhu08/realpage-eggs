import argparse
import json
import sys
from datetime import date
from pathlib import Path

from .changes import compute_changes
from .config import data_dir, pack_dir, DEFAULT_DATE, DISCLAIMER
from .engine import evaluate_rules
from .evidence import prepare_rules, EvidenceStoreView
from .export import export_all
from .extraction import extract, ProviderUnavailable, ProviderFailure
from .geocode import resolve_addresses
from .ingest import ingest_pack, ingest_document
from .models import ChangeRequest, LookupRequest, Model
from .service import lookup, DatasetUnavailable
from .store import Store, write_json, digest
from .validation import validate
from .assist_service import CoreUnavailable, CoreContractError


def batch_evaluate(store, as_of, output, allow_partial=False):
    prepared, _ = prepare_rules(store)
    store = EvidenceStoreView(store, prepared)
    rules = list(store.rules().values())
    if not rules and not allow_partial: raise ValueError("No extracted rules; use --allow-partial for an explicit incomplete batch")
    props, resolutions = store.addresses(), store.resolutions()
    if not props: raise ValueError("No address dataset")
    run = store.new_run("evaluate", input_hashes={"rules": digest(store.read("rules.json", {})), "addresses": digest(store.read("addresses.json", {})), "resolutions": digest(store.read("resolutions.json", {}))}, config={"as_of": str(as_of)})
    report = validate(store, as_of)
    rows = {k: [e.model_dump(mode="json") for e in evaluate_rules(rules, prop, resolutions[k], as_of)] for k, prop in sorted(props.items())}
    artifact = {"as_of": str(as_of), "run_id": run.run_id, "partial": not report["ready_for_submission"], "warnings": report["warnings"], "evaluations": rows, "disclaimer": DISCLAIMER}
    write_json(output, artifact)
    run.artifacts = [str(output.resolve())]
    return store.finish(run, "success" if report["ready_for_submission"] else "partial", addresses=len(rows), rules=len(rules))


def parser():
    p = argparse.ArgumentParser(description="Rental Housing Law Navigator. " + DISCLAIMER)
    p.add_argument("--data-dir", type=Path, default=data_dir())
    sub = p.add_subparsers(dest="command", required=True)
    cmd = sub.add_parser("ingest", help="Ingest the original participant pack")
    cmd.add_argument("--pack", type=Path, default=pack_dir())
    cmd = sub.add_parser("ingest-document", help="Add an original supplementary text snapshot")
    for key in ("file", "doc-id", "jurisdiction", "url", "retrieved-at"):
        cmd.add_argument("--" + key, required=True)
    cmd.add_argument("--authority", default="official", choices=["official", "secondary", "code publisher"])
    cmd = sub.add_parser("extract", help="Automated OpenAI extraction and verification")
    cmd.add_argument("--doc-id", action="append")
    cmd.add_argument("--limit", type=int)
    cmd = sub.add_parser("resolve", help="Resolve legal geography using Census")
    cmd.add_argument("--limit", type=int)
    cmd.add_argument("--workers", type=int, default=4)
    cmd.add_argument("--retry-unresolved", action="store_true")
    cmd = sub.add_parser("lookup")
    cmd.add_argument("address_id")
    cmd.add_argument("--as-of", type=date.fromisoformat, default=date.fromisoformat(DEFAULT_DATE))
    cmd = sub.add_parser("changes")
    cmd.add_argument("--test-id")
    cmd.add_argument("--before", type=date.fromisoformat)
    cmd.add_argument("--after", type=date.fromisoformat)
    cmd.add_argument("--rule-id", action="append", default=[])
    cmd.add_argument("--scenario", choices=["actual", "if_enacted"], default="actual")
    cmd.add_argument("--output", type=Path)
    for name in ("evaluate", "validate", "export"):
        cmd = sub.add_parser(name)
        cmd.add_argument("--as-of", type=date.fromisoformat, default=date.fromisoformat(DEFAULT_DATE))
        cmd.add_argument("--output", type=Path, default=Path("artifacts") / ("evaluations.json" if name == "evaluate" else "validation.json" if name == "validate" else "submission"))
        if name != "validate": cmd.add_argument("--allow-partial", action="store_true")
        if name == "export": cmd.add_argument("--synthetic", action="store_true")
    sub.add_parser("demo", help="Build a clearly labeled synthetic pipeline in a separate directory")
    sub.add_parser("contracts", help="Generate OpenAPI, schemas and synthetic response examples")
    cmd = sub.add_parser("source-inventory", help="Targeted structural source inventory; not legal completeness")
    cmd.add_argument("doc_id")
    cmd.add_argument("--output", type=Path)
    cmd = sub.add_parser("review-rule", help="Explicit bounded semantic review via configured OpenAI provider")
    cmd.add_argument("rule_id")
    cmd.add_argument("--refresh", action="store_true", help="Perform a new paid review instead of replaying cached output")
    cmd.add_argument("--output", type=Path)
    cmd = sub.add_parser("evidence-package", help="Save one property's facts, answers, evidence and offline replay inputs")
    cmd.add_argument("--request", type=Path, required=True, help="JSON EvidencePackageRequest, including a saved address_id")
    cmd.add_argument("--output", type=Path, required=True)
    cmd = sub.add_parser("replay-evidence-package", help="Verify hashes and reproduce a package offline with matching code")
    cmd.add_argument("file", type=Path)
    return p


def main(argv=None):
    args = parser().parse_args(argv)
    store = Store(args.data_dir)
    try:
        if args.command == "ingest": result = ingest_pack(store, args.pack)
        elif args.command == "ingest-document": result = ingest_document(store, args.file, args.doc_id, args.jurisdiction, args.url, args.retrieved_at, args.authority).model_dump(exclude={"text"})
        elif args.command == "extract": result = extract(store, args.doc_id, limit=args.limit)
        elif args.command == "resolve": result = resolve_addresses(store, args.limit, args.workers, args.retry_unresolved)
        elif args.command == "lookup": result = lookup(store, LookupRequest(address_id=args.address_id, as_of=args.as_of))
        elif args.command == "changes":
            prepared, _ = prepare_rules(store)
            result = compute_changes(EvidenceStoreView(store, prepared), ChangeRequest(test_id=args.test_id, before=args.before, after=args.after, rule_ids=args.rule_id, scenario=args.scenario))
            if args.output: write_json(args.output, result)
        elif args.command == "evaluate": result = batch_evaluate(store, args.as_of, args.output, args.allow_partial)
        elif args.command == "validate":
            prepared, _ = prepare_rules(store)
            result = validate(EvidenceStoreView(store, prepared), args.as_of)
            write_json(args.output, result)
        elif args.command == "export": result = export_all(store, args.output, args.as_of, args.allow_partial, args.synthetic)
        elif args.command == "demo":
            from .demo import build_demo
            result = build_demo(args.data_dir).read("latest_extract.json")
        elif args.command == "contracts":
            from .contracts import generate
            result = generate()
        elif args.command == "source-inventory":
            from .source_inventory import inventory_source
            result = inventory_source(store, args.doc_id)
            if args.output: write_json(args.output, result)
        elif args.command == "review-rule":
            from .semantic_review import review_rule
            result = review_rule(store, args.rule_id, refresh=args.refresh)
            if args.output: write_json(args.output, result)
        elif args.command == "evidence-package":
            from .evidence_package import write_evidence_package
            result = write_evidence_package(store, json.loads(args.request.read_text(encoding="utf-8")), args.output)
        elif args.command == "replay-evidence-package":
            from .evidence_package import replay_evidence_package
            result = replay_evidence_package(json.loads(args.file.read_text(encoding="utf-8")))
        if isinstance(result, Model): result = result.model_dump(mode="json")
        print(json.dumps(result, indent=2, ensure_ascii=False, default=str))
        return 1 if isinstance(result, dict) and (result.get("outcome") == "failed" or result.get("errors")) else 0
    except (ValueError, KeyError, DatasetUnavailable, ProviderUnavailable, ProviderFailure, CoreUnavailable, CoreContractError, FileNotFoundError) as exc:
        print(json.dumps({"error": type(exc).__name__, "message": str(exc), "disclaimer": DISCLAIMER}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
