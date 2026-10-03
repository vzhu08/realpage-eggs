"""Read-only structural/source audit of an explicitly supplied live Core store.

This checks original text integrity and quotation anchoring, not legal accuracy.
Run after extraction finishes to obtain a consistent final snapshot.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path


def evidence_spans(value):
    if isinstance(value, dict):
        if {"doc_id", "quote", "start", "end"} <= value.keys():
            yield value
        else:
            for child in value.values():
                yield from evidence_spans(child)
    elif isinstance(value, list):
        for child in value:
            yield from evidence_spans(child)


def predicates(value):
    if isinstance(value, dict):
        if "op" in value:
            yield value
        for child in value.values():
            yield from predicates(child)
    elif isinstance(value, list):
        for child in value:
            yield from predicates(child)


def observed_usage(root):
    """Usage returned by the provider; timeouts/interruption may hide billed usage."""
    runs, responses = [], {}
    for path in sorted((root / "runs").glob("*.json")):
        run = json.loads(path.read_text())
        if run.get("operation") != "extract" or run.get("mode") != "live":
            continue
        usage_path = root / "provider_outputs" / run["run_id"] / "usage.json"
        usage = json.loads(usage_path.read_text()) if usage_path.exists() else []
        runs.append({key: run.get(key) for key in (
            "run_id", "started_at", "finished_at", "elapsed_seconds", "outcome", "config", "counts", "errors"
        )} | {"observed_responses": usage, "usage_file_present": usage_path.exists()})
        for response in usage:
            if response.get("response_id"):
                responses[response["response_id"]] = response
    return {
        "complete_billing_total": False,
        "limitation": "Only returned response usage is observable; historical timed-out/interrupted requests may also have been billed.",
        "deduplicated_response_count": len(responses),
        "response_statuses": dict(Counter(r.get("status") for r in responses.values())),
        "observed_token_totals": {
            key: sum(r.get("usage", {}).get(key, 0) for r in responses.values())
            for key in ("input_tokens", "output_tokens", "total_tokens")
        },
        "runs": sorted(runs, key=lambda r: r["started_at"]),
    }


def invalid_spans(spans, sources):
    invalid = []
    for span in spans:
        text = sources.get(span["doc_id"], {}).get("text") or ""
        start, end = span["start"], span["end"]
        if not (isinstance(start, int) and isinstance(end, int) and start >= 0
                and end == start + len(span["quote"]) and text[start:end] == span["quote"]):
            invalid.append(span)
    return invalid


def audit(root, original_text_dir):
    read = lambda name: json.loads((root / name).read_text())
    sources, rules = read("sources.json"), read("rules.json")
    index, addresses = read("extraction_index.json"), read("addresses.json")
    resolutions = read("resolutions.json")
    negatives = read("negative_findings.json")
    text_checks, doc_checks = {}, {}
    for doc_id, source in sources.items():
        if not source.get("text"):
            continue
        original = (original_text_dir / f"{doc_id}.txt").read_text(encoding="utf-8-sig")
        text_checks[doc_id] = {
            "original_matches_stored": original == source["text"],
            "actual_sha256_matches_stored": hashlib.sha256(original.encode()).hexdigest() == source["sha256"],
        }
        doc_rules = [r for r in rules.values() if r["source_doc_id"] == doc_id]
        spans = list(evidence_spans(doc_rules))
        doc_checks[doc_id] = {
            "index": index.get(doc_id), "rules": len(doc_rules),
            "lifecycle": dict(Counter(r["lifecycle"] for r in doc_rules)),
            "semantic_verification": dict(Counter(r["semantic_verification"] for r in doc_rules)),
            "evidence_instances": len(spans),
            "distinct_spans": len({(s["doc_id"], s["start"], s["end"]) for s in spans}),
            "invalid_evidence": invalid_spans(spans, sources),
            "non_verbatim_primary_quotes": [r["team_rule_id"] for r in doc_rules if r["quoted_span"] not in original],
            "construction_or_occupancy_predicates": [
                {"rule_id": r["team_rule_id"], "predicate": p}
                for r in doc_rules for p in predicates(r)
                if p.get("fact") in {"year_built", "certificate_of_occupancy", "first_occupancy_date"}
            ],
            "unsupported_predicates": sum(p.get("op") == "unsupported" for r in doc_rules for p in predicates(r)),
        }
    return {
        "evidence_kind": "automated structural/original-text audit; not semantic or human legal review",
        "store": str(root.resolve()), "original_text_dir": str(original_text_dir.resolve()),
        "counts": {"sources": len(sources), "captured_texts": len(text_checks), "rules": len(rules),
                   "addresses": len(addresses), "resolutions": len(resolutions),
                   "index_statuses": dict(Counter(v["status"] for v in index.values())),
                   "lifecycle": dict(Counter(r["lifecycle"] for r in rules.values())),
                   "evidence_modes": dict(Counter(r["evidence_mode"] for r in rules.values()))},
        "all_original_texts_and_hashes_match": all(all(v.values()) for v in text_checks.values()),
        "source_checks": text_checks,
        "missing_text_ids": sorted(k for k, s in sources.items() if not s.get("text")),
        "unattempted_text_ids": sorted(set(text_checks) - set(index)),
        "resolution_statuses": dict(Counter(v["match_quality"] for v in resolutions.values())),
        "negative_findings": negatives,
        "negative_evidence_instances": len(list(evidence_spans(negatives))),
        "invalid_negative_evidence": invalid_spans(evidence_spans(negatives), sources),
        "provider_usage": observed_usage(root),
        "documents": doc_checks,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--original-text-dir", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(audit(args.data_dir, args.original_text_dir), indent=2))
