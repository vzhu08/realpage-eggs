"""Combine complete saved Core and geography stores without modifying either input.

No ingestion, provider calls, legal interpretation, or provenance reconstruction occurs here.
"""
import argparse
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import re
import shutil
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from navigator.evidence import all_evidence
from navigator.extraction import substantive, validate_bundle
from navigator.geocode import CensusGeocoder
from navigator.models import ExtractionBundle, NegativeFinding, RunManifest
from navigator.source_review import SourceReviewError, source_review_original
from navigator.store import Store, digest, write_json

VERSION = "snapshot-assembly-v1"
CORE_REQUIRED = ("addresses.json", "sources.json", "rules.json", "dataset.json",
                 "resolutions.json", "extraction_index.json", "latest_extract.json",
                 "change_tests.json", "competition_schema.json")
GEO_REQUIRED = ("addresses.json", "sources.json", "resolutions.json", "dataset.json")
CORE_OPTIONAL = ("negative_findings.json", "latest_ingest.json", "source_comparisons.json",
                 "latest_source_review.json", "source_review_plan.json")
CORE_DIRS = ("runs", "extraction_cache", "provider_outputs", "semantic_reviews", "source_reviews", "source_review_inputs")
GEO_DIRS = ("runs", "geocode_cache")


class SnapshotError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise SnapshotError(message)


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def read(path):
    return json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)


def fingerprint(path):
    return sha256(path.read_bytes()).hexdigest()


def linked(path):
    return path.is_symlink() or getattr(path, "is_junction", lambda: False)()


def inventory(root, required, optional, directories):
    missing = [name for name in required if not (root / name).is_file()]
    require(not missing, f"{root}: missing required files: {', '.join(missing)}")
    selected = {root / name for name in required + optional if (root / name).exists()}
    for name in directories:
        directory = root / name
        if directory.exists():
            require(not linked(directory), f"Linked input: {directory}")
            for path in directory.rglob("*"):
                require(not linked(path), f"Linked input: {path}")
                if path.is_file():
                    require(path.suffix == ".json", f"Unexpected file in provenance directory: {path}")
                    selected.add(path)
    hashes = {}
    for path in sorted(selected):
        require(not linked(path) and path.resolve().is_relative_to(root), f"Input escapes store: {path}")
        read(path)  # Reject malformed JSON and duplicate IDs before a Store can discard them.
        hashes[path.relative_to(root).as_posix()] = fingerprint(path)
    return hashes


def check_sources(sources):
    for key, source in sources.items():
        require(key == source.doc_id, f"Source key/ID mismatch: {key}")
        require(digest(source.text.encode("utf-8")) == source.sha256, f"Source text/hash mismatch: {key}")
        if source.duplicate_of:
            other = sources.get(source.duplicate_of)
            require(other is not None and other.sha256 == source.sha256, f"Invalid duplicate source: {key}")


def check_span(span, sources):
    source = sources.get(span.doc_id)
    require(source is not None and source.text, f"Evidence source missing: {span.doc_id}")
    require(span.start is not None and span.end == span.start + len(span.quote)
            and source.text[span.start:span.end] == span.quote, f"Evidence offsets/quote mismatch: {span.doc_id}")


def check_rule(rule, sources):
    source = sources.get(rule.source_doc_id)
    require(source is not None and source.text, f"Rule source missing: {rule.source_doc_id}")
    require(rule.source_url == source.url and rule.quoted_span in source.text,
            f"Primary rule quote/URL mismatch: {rule.source_doc_id}")
    for span in all_evidence(rule):
        check_span(span, sources)


def runs_for(store, hashes):
    runs = {}
    for name in hashes:
        if name.startswith("runs/"):
            run = RunManifest.model_validate(read(store.path(name)))
            require(name == f"runs/{run.run_id}.json", f"Run filename/ID mismatch: {name}")
            runs[run.run_id] = run
    return runs


def extraction_provenance(core, sources, rules, hashes):
    runs = runs_for(core, hashes)
    index = core.read("extraction_index.json")

    def origin(ident, doc_id):
        run = runs.get(ident)
        require(run is not None and run.operation == "extract" and run.finished_at is not None
                and run.outcome in {"success", "partial"}, f"Missing completed extraction run: {ident}")
        require(run.input_hashes.get(doc_id) == sources[doc_id].sha256, f"Extraction run/source mismatch: {doc_id}")
        return run

    counts = Counter(r.source_doc_id for r in rules.values())
    for doc_id, entry in index.items():
        require(doc_id in sources, f"Dangling extraction index: {doc_id}")
        require(entry.get("sha256") == sources[doc_id].sha256, f"Stale extraction index: {doc_id}")
        require(entry.get("status") in {"complete", "review", "failed"}, f"Invalid extraction index: {doc_id}")
        if entry["status"] in {"complete", "review"}:
            run = origin(entry.get("run_id"), doc_id)
            require(entry.get("mode") == run.mode and entry.get("rules") == counts[doc_id],
                    f"Extraction index count/mode mismatch: {doc_id}")
        else:
            require(entry.get("run_id") in runs, f"Missing failed extraction run: {doc_id}")
    for key, rule in rules.items():
        require(key == rule.team_rule_id, f"Rule key/ID mismatch: {key}")
        check_rule(rule, sources)
        require(index.get(rule.source_doc_id, {}).get("status") in {"complete", "review"}, f"Missing accepted extraction index: {key}")
        run = origin(rule.extraction_run_id, rule.source_doc_id)
        require((rule.evidence_mode == "synthetic" and run.mode == "synthetic")
                or (rule.evidence_mode in {"live", "replay"} and run.mode == "live"), f"Rule origin mode mismatch: {key}")

    cached_origins = set()
    cached_behaviors = set()
    for name in hashes:
        if name.startswith("extraction_cache/"):
            cached = read(core.path(name))
            require(re.fullmatch(r"extraction_cache/[0-9a-f]{64}\.json", name), f"Invalid cache filename: {name}")
            run = runs.get(cached.get("origin_run_id"))
            require(run is not None and run.operation == "extract" and cached.get("mode") == run.mode
                    and cached.get("model") == run.config.get("model"), f"Cache origin mismatch: {name}")
            bundle = ExtractionBundle.model_validate(cached["bundle"])
            for draft in bundle.rules:
                check_rule(draft, sources)
                origin(run.run_id, draft.source_doc_id)
                cached_origins.add((run.run_id, draft.source_doc_id))
            for negative in bundle.negative_findings:
                for span in negative.evidence:
                    check_span(span, sources)
                    origin(run.run_id, span.doc_id)
            # Replay Core's existing cache validation on in-memory copies. Older
            # caches can legitimately acquire explicit unsupported fact guards.
            for draft in validate_bundle(bundle, sources).rules:
                cached_behaviors.add((run.run_id, draft.source_doc_id, digest(substantive(draft))))
        elif name.startswith("provider_outputs/"):
            require(len(Path(name).parts) == 3 and Path(name).parts[1] in runs, f"Missing provider-output origin: {name}")
    for rule in rules.values():
        require((rule.extraction_run_id, rule.source_doc_id) in cached_origins, f"Missing reviewed cache provenance: {rule.team_rule_id}")
        try:
            original = source_review_original(core, rule, sources) if rule.source_review else rule
        except SourceReviewError as exc:
            raise SnapshotError(str(exc)) from exc
        require((original.extraction_run_id, original.source_doc_id, digest(substantive(original))) in cached_behaviors,
                f"Rule behavior differs from reviewed cache: {rule.team_rule_id}")
    for doc_id, findings in core.read("negative_findings.json", {}).items():
        require(doc_id in index, f"Unindexed negative finding: {doc_id}")
        for value in findings:
            for span in NegativeFinding.model_validate(value).evidence:
                check_span(span, sources)
    latest = RunManifest.model_validate(core.read("latest_extract.json"))
    require(latest.run_id in runs and latest == runs[latest.run_id] and latest.operation == "extract"
            and latest.finished_at is not None and latest.outcome != "running", "Latest extraction manifest mismatch or still running")


class CachedGeocoder(CensusGeocoder):
    """Use the existing geography parser with a strictly offline request boundary."""
    def __init__(self, store, resolution):
        self.store = store
        self.benchmark = resolution.benchmark
        self.vintage = resolution.vintage

    def request(self, raw, street, zip_code):
        params = {"street": street, "city": raw.postal_city, "state": raw.state, "zip": zip_code,
                  "benchmark": self.benchmark, "vintage": self.vintage,
                  "layers": "States,Counties,Incorporated Places,County Subdivisions", "format": "json"}
        key = digest(params)
        cached = self.store.read(f"geocode_cache/{key}.json")
        require(cached is not None and cached.get("params") == params, f"Missing geography cache: {key}")
        return cached["response"], cached["retrieved_at"], key


def geography_provenance(geo, props, resolutions, hashes, synthetic):
    runs = runs_for(geo, hashes)
    if "latest_geocode.json" in hashes:
        latest = RunManifest.model_validate(geo.read("latest_geocode.json"))
        require(latest.operation == "geocode" and latest.run_id in runs and latest == runs[latest.run_id]
                and latest.finished_at is not None and latest.outcome != "running", "Latest geography manifest mismatch or still running")
    for name in hashes:
        if name.startswith("geocode_cache/"):
            entry = read(geo.path(name))
            require(name == f"geocode_cache/{digest(entry['params'])}.json" and entry.get("retrieved_at")
                    and isinstance(entry.get("response"), dict), f"Geography cache identity mismatch: {name}")
    for ident, resolution in resolutions.items():
        require(resolution.address_id == ident and resolution.state == props[ident].raw_address.state,
                f"Resolution address/state mismatch: {ident}")
        for attempt in resolution.attempts:
            if attempt.get("cache_key"):
                cache = geo.read(f"geocode_cache/{attempt['cache_key']}.json")
                require(cache is not None, f"Missing geography attempt cache: {ident}")
                params = cache["params"]
                require(params.get("street") == attempt.get("street") and params.get("zip") == attempt.get("zip")
                        and params.get("state") == props[ident].raw_address.state
                        and params.get("city") == props[ident].raw_address.postal_city,
                        f"Geography attempt/address mismatch: {ident}")
                # Early records stored only the request key. Full replay below still checks
                # the resolution's response hash/date; never invent absent attempt metadata.
                require(("response_hash" not in attempt or digest(cache["response"]) == attempt["response_hash"])
                        and ("retrieved_at" not in attempt or cache["retrieved_at"] == attempt["retrieved_at"]),
                        f"Geography attempt/cache mismatch: {ident}")
        if resolution.match_quality != "resolved":
            continue
        if synthetic and resolution.method == "synthetic_fixture_not_geocoded":
            continue
        require(resolution.method.startswith("census_") and resolution.benchmark and resolution.vintage,
                f"Resolved geography lacks Census provenance: {ident}")
        replay = CachedGeocoder(geo, resolution).resolve(props[ident])
        require(replay.model_dump(exclude={"attempts"}) == resolution.model_dump(exclude={"attempts"}),
                f"Resolved geography does not reproduce from saved Census cache: {ident}")


def assemble(core_dir, geography_dir, output, *, code_revision, expected_addresses=500, synthetic=False):
    core_dir, geography_dir, output = (Path(p).resolve() for p in (core_dir, geography_dir, output))
    for left, right in ((core_dir, geography_dir), (core_dir, output), (geography_dir, output)):
        require(not left.is_relative_to(right) and not right.is_relative_to(left), "Inputs and output must be separate, non-nested trees")
    require(not output.exists(), "Output must be a new directory; existing snapshots are preserved")
    require(re.fullmatch(r"[0-9a-f]{40}", code_revision), "Supply the full reviewed code commit SHA")
    require(expected_addresses > 0, "Expected address count must be positive")
    core_hashes = inventory(core_dir, CORE_REQUIRED, CORE_OPTIONAL, CORE_DIRS)
    geo_hashes = inventory(geography_dir, GEO_REQUIRED, ("latest_geocode.json",), GEO_DIRS)
    core, geo = Store(core_dir), Store(geography_dir)
    props, other_props, rules, sources, other_sources = core.addresses(), geo.addresses(), core.rules(), core.sources(), geo.sources()
    resolutions = geo.resolutions()
    require(len(props) == expected_addresses and props.keys() == other_props.keys() == resolutions.keys()
            == core.resolutions().keys(), "Address/resolution ID sets or expected count differ")
    for ident, prop in props.items():
        require(ident == prop.address_id and prop == other_props[ident], f"Address/facts/provenance mismatch: {ident}")
        raw = prop.raw_address
        normalized = ", ".join([raw.street_address.strip().upper(), raw.postal_city.strip().upper(), raw.state, raw.zip])
        require(prop.normalized_address == normalized, f"Normalized address mismatch: {ident}")
    datasets = [store.read("dataset.json") for store in (core, geo)]
    mode = "synthetic" if synthetic else "real"
    require(all(d.get("mode") == mode for d in datasets), f"Both input datasets must be explicitly {mode}")
    if not synthetic:
        for field in ("addresses", "manifest"):
            values = [d.get("input_hashes", {}).get(field) for d in datasets]
            require(values[0] and values[0] == values[1], f"Original dataset {field} hash mismatch")
        require(all(s.capture_status != "synthetic" for s in sources.values())
                and all(r.evidence_mode != "synthetic" for r in rules.values()), "Synthetic content in real snapshot")
    check_sources(sources)
    check_sources(other_sources)
    require(sources.keys() == other_sources.keys(), "Source ID sets differ")
    # Extraction classifies source_type; it does not establish a new source identity.
    identity = ("text", "sha256", "url", "retrieved_at", "manifest_sha256", "authority", "capture_status", "jurisdictions")
    for ident, source in sources.items():
        require(all(getattr(source, field) == getattr(other_sources[ident], field) for field in identity),
                f"Source identity differs across stores: {ident}")
    extraction_provenance(core, sources, rules, core_hashes)
    geography_provenance(geo, props, resolutions, geo_hashes, synthetic)

    selections = {name: (core_dir, name) for name in core_hashes}
    selections["resolutions.json"] = (geography_dir, "resolutions.json")
    for name, value in geo_hashes.items():
        if name.startswith(("runs/", "geocode_cache/")) or name == "latest_geocode.json":
            require(name not in selections or core_hashes[name] == value, f"Conflicting provenance file: {name}")
            selections[name] = (geography_dir, name)
    # Keep the displaced records available without changing either input.
    selections["assembly_inputs/core_resolutions.json"] = (core_dir, "resolutions.json")
    selections["assembly_inputs/geography_dataset.json"] = (geography_dir, "dataset.json")
    selections["assembly_inputs/geography_sources.json"] = (geography_dir, "sources.json")
    output.mkdir(parents=True)
    marker = output / "ASSEMBLY_INCOMPLETE.json"
    write_json(marker, {"status": "incomplete", "do_not_serve": True})
    for name, (root, original) in selections.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(root / original, target)
        expected = (core_hashes if root == core_dir else geo_hashes)[original]
        require(fingerprint(target) == expected, f"Input changed while copying: {original}")
    require(inventory(core_dir, CORE_REQUIRED, CORE_OPTIONAL, CORE_DIRS) == core_hashes
            and inventory(geography_dir, GEO_REQUIRED, ("latest_geocode.json",), GEO_DIRS) == geo_hashes,
            "Inputs changed during assembly; incomplete output must not be served")
    output_hashes = {name: fingerprint(output / name) for name in sorted(selections)}
    manifest = {"version": VERSION, "status": "assembled", "code_revision": code_revision,
                "artifact_label": "SYNTHETIC_NOT_FOR_SUBMISSION" if synthetic else "PARTIAL_NOT_JUDGE_READY",
                "ready_for_submission": False, "inputs": {"core": {"path": str(core_dir), "files": core_hashes},
                "geography": {"path": str(geography_dir), "files": geo_hashes}}, "output_files": output_hashes,
                "snapshot_id": digest(output_hashes), "counts": {"addresses": len(props), "rules": len(rules),
                "sources": len(sources), "resolved_municipalities": sum(r.match_quality == "resolved" for r in resolutions.values())},
                "unresolved_address_ids": sorted(k for k, r in resolutions.items() if r.match_quality != "resolved"),
                "limitations": ["Structural provenance checks are not legal or semantic verification.",
                "Assembly preserves extraction gaps, rule reviews and unresolved geography.",
                "Evaluate, export and T1-T5 verification must use this snapshot in a separate working copy."]}
    write_json(output / "snapshot_manifest.json", manifest)
    marker.unlink()
    return manifest


def audit_geography(root, output, *, expected_addresses=500, synthetic=False):
    """Report every unsupported stored resolution; never repair or downgrade input."""
    root, output = Path(root).resolve(), Path(output).resolve()
    require(not root.is_relative_to(output) and not output.is_relative_to(root), "Audit output must be outside the input tree")
    require(not output.exists(), "Audit output must be a new directory")
    hashes = inventory(root, GEO_REQUIRED, ("latest_geocode.json",), GEO_DIRS)
    geo = Store(root)
    props, resolutions = geo.addresses(), geo.resolutions()
    require(len(props) == expected_addresses and props.keys() == resolutions.keys(), "Address/resolution ID sets or expected count differ")
    require(geo.read("dataset.json").get("mode") == ("synthetic" if synthetic else "real"), "Dataset mode does not match audit mode")
    # Validate the shared runs/caches once, then each resolution independently.
    geography_provenance(geo, props, {}, hashes, synthetic)
    issues = {}
    for ident, resolution in resolutions.items():
        try:
            geography_provenance(geo, {ident: props[ident]}, {ident: resolution}, {}, synthetic)
        except (ValueError, KeyError, TypeError) as exc:
            issues[ident] = str(exc)
    require(inventory(root, GEO_REQUIRED, ("latest_geocode.json",), GEO_DIRS) == hashes, "Geography inputs changed during audit")
    report = {"version": VERSION, "label": "STRUCTURAL_OFFLINE_CHECK_NOT_LEGAL_VALIDATION",
              "status": "blocked" if issues else "passed", "input_files": hashes,
              "counts": {"addresses": len(props), "stored_resolved": sum(r.match_quality == "resolved" for r in resolutions.values()),
                         "verified_resolved": sum(r.match_quality == "resolved" and k not in issues for k, r in resolutions.items()),
                         "rejected_records": len(issues)}, "rejections": issues,
              "stored_unresolved_address_ids": sorted(k for k, r in resolutions.items() if r.match_quality != "resolved"),
              "provider_calls": 0, "inputs_unchanged": True,
              "limitations": ["Missing retry caches do not establish geography; no external request was made.",
                              "Stored records are unchanged, including their original quality labels."]}
    output.mkdir(parents=True)
    write_json(output / "geography_audit.json", report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--core-data", type=Path)
    parser.add_argument("--geography-data", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--code-revision")
    parser.add_argument("--audit-geography-only", action="store_true", help="Audit every stored resolution without combining data")
    parser.add_argument("--expected-addresses", type=int, default=500)
    parser.add_argument("--synthetic", action="store_true", help="Explicitly labeled software fixtures only")
    args = parser.parse_args()
    if not args.audit_geography_only and (args.core_data is None or args.code_revision is None):
        parser.error("Assembly requires --core-data and --code-revision")
    try:
        if args.audit_geography_only:
            report = audit_geography(args.geography_data, args.output, expected_addresses=args.expected_addresses, synthetic=args.synthetic)
            print(json.dumps({"status": report["status"], "counts": report["counts"], "report": str(args.output / "geography_audit.json")}, indent=2))
            return 2 if report["rejections"] else 0
        manifest = assemble(args.core_data, args.geography_data, args.output, code_revision=args.code_revision,
                            expected_addresses=args.expected_addresses, synthetic=args.synthetic)
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({"status": "rejected", "error": str(exc)}), file=sys.stderr)
        return 2
    print(json.dumps({"status": "assembled", "snapshot_id": manifest["snapshot_id"],
                      "counts": manifest["counts"], "artifact_label": manifest["artifact_label"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
