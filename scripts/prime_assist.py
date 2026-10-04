"""Offline-only canonical result priming; no providers, source edits or deployment."""
import argparse
from hashlib import sha256
import gzip
import json
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from navigator.assist_cache import AssistCache, Artifact, identity
from navigator.assist_service import assist
from navigator.assist_wire import unpack
from navigator.models import AssistRequest
from navigator.store import Store, digest, write_json


def load_manifest(path):
    if path.stat().st_size > 64 * 1024:
        raise ValueError("Manifest exceeds 64 KiB")
    value = json.loads(path.read_text(encoding="utf-8"))
    if value.get("format") != "realpage-demo-requests-v1" or not isinstance(value.get("label"), str):
        raise ValueError("Invalid demo manifest")
    if not 1 <= len(value["steps"]) <= 8:
        raise ValueError("Demo must contain 1–8 requests")
    ids = set()
    for step in value["steps"]:
        if not isinstance(step["id"], str) or step["id"] in ids:
            raise ValueError("Step ids must be unique strings")
        ids.add(step["id"])
        step["request"] = AssistRequest.model_validate(step["request"]).model_dump(mode="json")
    return value


def prime(store_path, cache_path, manifest_path, report_path, verify=False):
    store = Store(store_path)
    if cache_path.resolve().is_relative_to(store.root.resolve()):
        raise ValueError("Cache must be outside the immutable snapshot")
    manifest = load_manifest(manifest_path)
    stamp = identity(store)
    cache = AssistCache(cache_path)
    report = {"label": "REAL_COMPUTED_RESULTS_RESEARCH_NOT_LEGAL_VALIDATION", "identity": stamp,
              "identity_sha256": digest(stamp), "manifest_sha256": digest(manifest),
              "command": sys.argv, "rules": len(store.rules()), "steps": []}
    for step in manifest["steps"]:
        request = AssistRequest.model_validate(step["request"])
        started = time.perf_counter()
        artifact = cache.resolve(store, request)
        if not isinstance(artifact, Artifact):
            raise RuntimeError("Result could not be cached within configured disk/result bounds")
        seconds = time.perf_counter() - started
        # Inspect the lossless shared graph, not a second expanded 250+ MB tree.
        canonical_size = artifact.decoded_size
        canonical_hash = sha256()
        for chunk in artifact.chunks(False):
            canonical_hash.update(chunk)
        wire = cache.get(artifact.key, "dag")
        if wire is None:
            raise RuntimeError("Missing compact representation")
        with gzip.GzipFile(fileobj=wire.stream, mode="rb") as source:
            value = unpack(json.load(source))
        wire.stream.close()
        verified = None
        if verify:
            expected = assist(store, request).model_dump_json()
            comparison = cache.get(artifact.key)
            verified = comparison is not None
            if comparison is not None:
                with gzip.GzipFile(fileobj=comparison.stream, mode="rb") as source:
                    for offset in range(0, len(expected), 64 * 1024):
                        chunk = expected[offset:offset + 64 * 1024].encode("utf-8")
                        verified = verified and source.read(len(chunk)) == chunk
                    verified = verified and source.read(1) == b""
                comparison.stream.close()
            if not verified:
                raise RuntimeError("Cached result differs from independently computed result")
            del expected
        row = {"id": step["id"], "key": artifact.key, "cache": "hit" if artifact.hit else "miss",
               "seconds": round(seconds, 4), "canonical_bytes": canonical_size, "canonical_gzip_bytes": artifact.size,
               "dag_bytes": wire.decoded_size, "dag_gzip_bytes": wire.size,
               "canonical_sha256": canonical_hash.hexdigest(), "uncached_equivalent": verified,
               "plan": {k: value["question_plan"][k] for k in ("status", "evaluations_used", "limits_hit")},
               "question_fields": [q["fact"]["field"] for q in value["question_plan"]["questions"]],
               "evaluation_counts": {status: sum(e["result"] == status for e in value["lookup"]["evaluations"])
                                     for status in {e["result"] for e in value["lookup"]["evaluations"]}}}
        report["steps"].append(row)
        print(json.dumps(row), flush=True)
        del value
        write_json(report_path, report)
    if identity(store) != stamp:
        raise RuntimeError("Input snapshot/code changed while priming; discard this receipt and re-prime")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--store", type=Path, required=True)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=ROOT / "config/demo_requests.json")
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--verify", action="store_true", help="Independently compute and compare each complete canonical result")
    args = parser.parse_args()
    prime(args.store, args.cache, args.manifest, args.report, args.verify)


if __name__ == "__main__":
    main()
