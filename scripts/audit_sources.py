"""Read-only source inventory audit; no retrieval, provider calls, or legal acceptance.

Read three JSON files from a Store directory or the root of a ZIP checkpoint.
Report source identity, recorded roles, extraction progress and source-policy gates.
The candidate queue is for review/extraction planning, never a list of accepted laws.
"""
from argparse import ArgumentParser
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path
import sys
from zipfile import BadZipFile, ZipFile

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from navigator.models import Rule, SourceDocument
from navigator.source_policy import POLICY_VERSION, source_counts, source_use


FORMAT_VERSION = "source-data-audit-v1"
INPUT_FILES = ("sources.json", "rules.json", "extraction_index.json")
COMPLETE_STATUSES = {"complete", "review"}


def _pairs(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON key: {key}")
        result[key] = value
    return result


def _load(raw, name):
    value = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=_pairs)
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be a JSON object")
    return value


def _inputs(*, store=None, archive=None):
    if (store is None) == (archive is None):
        raise ValueError("Choose exactly one input Store directory or ZIP archive")
    blobs = {}
    if store is not None:
        root = Path(store).resolve()
        if not root.is_dir():
            raise ValueError("Store directory does not exist")
        for name in INPUT_FILES:
            path = root / name
            if path.exists():
                if path.is_symlink():
                    raise ValueError(f"Input must be a regular file, not a symlink: {name}")
                blobs[name] = path.read_bytes()
        identity = {"kind": "store", "name": root.name}
    else:
        path = Path(archive).resolve()
        with ZipFile(path) as bundle:
            for name in INPUT_FILES:
                matches = [info for info in bundle.infolist() if info.filename == name]
                if len(matches) > 1:
                    raise ValueError(f"Duplicate archive member: {name}")
                if matches:
                    blobs[name] = bundle.read(matches[0])
        identity = {"kind": "archive", "name": path.name,
                    "sha256": sha256(path.read_bytes()).hexdigest()}
    for name in INPUT_FILES[:2]:
        if name not in blobs:
            raise ValueError(f"Missing required input: {name}")
    identity["files_sha256"] = {name: sha256(raw).hexdigest() for name, raw in sorted(blobs.items())}
    return {name: _load(raw, name) for name, raw in blobs.items()}, identity


def _models(raw, model, identity_field):
    result = {}
    for key, row in raw.items():
        value = model.model_validate(row)
        if key != getattr(value, identity_field):
            raise ValueError(f"Collection key differs from {identity_field}: {key}")
        result[key] = value
    return result


def _counts(values):
    return dict(sorted(Counter(values).items()))


def audit(*, store=None, archive=None):
    data, identity = _inputs(store=store, archive=archive)
    sources = _models(data["sources.json"], SourceDocument, "doc_id")
    rules = _models(data["rules.json"], Rule, "team_rule_id")
    index = data.get("extraction_index.json")
    if index is not None and any(not isinstance(row, dict) for row in index.values()):
        raise ValueError("Extraction index entries must be JSON objects")
    per_source = Counter(rule.source_doc_id for rule in rules.values())
    rows, candidates = [], []
    for doc_id, source in sorted(sources.items()):
        use = source_use(source)
        actual_hash = sha256(source.text.encode("utf-8")).hexdigest()
        hash_matches = actual_hash == source.sha256
        process = index.get(doc_id, {}) if index is not None else {}
        process_status = process.get("status", "unprocessed" if index is not None else "not_recorded")
        row = {
            "doc_id": doc_id, "url": source.url, "authority": source.authority,
            "source_type": source.source_type, "capture_status": source.capture_status,
            "captured": bool(source.text), "text_characters": len(source.text),
            "capture_sha256": source.sha256, "actual_text_sha256": actual_hash,
            "capture_hash_matches": hash_matches, "rule_count": per_source[doc_id],
            "disposition": use.status, "reason": use.reason,
            "extraction_allowed": use.extraction_allowed and hash_matches,
            "operative_allowed": use.operative_allowed and hash_matches,
            "processing_status": process_status,
            "processing_source_hash_matches": process.get("sha256") == source.sha256 if process else None,
        }
        if not hash_matches:
            row["disposition"] = "invalid_capture"
            row["reason"] = "Stored source hash does not match its text; do not extract or promote this capture"
        rows.append(row)
        # Recorded roles select the queue; neither URL patterns nor text keywords
        # establish legal status. Human document-review priorities are in the note.
        if (row["extraction_allowed"] and source.authority == "official"
                and source.capture_status != "synthetic" and process_status not in COMPLETE_STATUSES):
            candidates.append({
                "doc_id": doc_id, "priority": 1 if use.status == "eligible_primary" else 2,
                "source_type": source.source_type, "capture_sha256": source.sha256,
                "processing_status": process_status,
                "reason": ("Recorded official legal-text candidate; review provision, version and dates before use"
                           if use.status == "eligible_primary" else
                           "Captured official material is unprocessed or incomplete; classify the actual document before treating it as legal authority"),
                "legal_status": "not_determined", "accepted_for_release": False,
            })
    missing_rule_sources = sorted(set(per_source) - set(sources))
    source_role_rules = Counter()
    authority_rules = Counter()
    for rule in rules.values():
        source = sources.get(rule.source_doc_id)
        source_role_rules[source.source_type if source else "missing_source"] += 1
        authority_rules[source.authority if source else "missing_source"] += 1
    captured = [row for row in rows if row["captured"]]
    counts = {
        "sources": len(sources), "rules": len(rules), **source_counts(sources, rules),
        "captured_hash_mismatches": sum(not row["capture_hash_matches"] for row in captured),
        "rules_needing_existing_review": sum(bool(rule.review_issues) or rule.semantic_verification == "needs_review" for rule in rules.values()),
        "processed_captured_sources": sum(row["processing_status"] in COMPLETE_STATUSES for row in captured),
        "unprocessed_captured_sources": (sum(row["processing_status"] not in COMPLETE_STATUSES for row in captured)
                                         if index is not None else None),
        "secondary_sources": sum(source.authority.strip().casefold().startswith("secondary") for source in sources.values()),
        "secondary_source_rules": sum(count for authority, count in authority_rules.items() if authority.strip().casefold().startswith("secondary")),
    }
    return {
        "format_version": FORMAT_VERSION, "policy_version": POLICY_VERSION,
        "input": identity, "extraction_index_available": index is not None,
        "counts": counts,
        "sources_by_authority": _counts(source.authority for source in sources.values()),
        "captured_sources_by_authority": _counts(source.authority for source in sources.values() if source.text),
        "sources_by_type": _counts(source.source_type for source in sources.values()),
        "sources_by_capture_status": _counts(source.capture_status for source in sources.values()),
        "sources_by_disposition": _counts(row["disposition"] for row in rows),
        "captured_sources_by_processing_status": _counts(row["processing_status"] for row in captured),
        "rules_by_source_authority": dict(sorted(authority_rules.items())),
        "rules_by_source_type": dict(sorted(source_role_rules.items())),
        "rules_by_source_doc_id": dict(sorted(per_source.items())),
        "missing_rule_source_ids": missing_rule_sources,
        "sources": rows,
        "extraction_review_queue": sorted(candidates, key=lambda row: (row["priority"], row["doc_id"])),
        "limits": [
            "This is a source inventory and policy audit, not independent legal review or proof of complete coverage.",
            "Authority and source_type are recorded metadata; URLs, government hosting and supplied-corpus membership do not prove operative legal status.",
            "Primary-source counts are candidate counts, not accepted laws; dates, scope, exact evidence and source access still require review.",
            "No API endpoint, live provider, organizer pack eligibility, or currently hosted release is verified by this offline audit.",
            "The input Store/archive is never modified; no extraction, source retrieval or provider call is performed.",
        ],
    }


def _check_output(path, *, store=None, archive=None):
    target = Path(path).resolve()
    if target.exists() and target.stat().st_nlink > 1:
        raise ValueError("Output must not overwrite a hardlinked file")
    if store is not None:
        root = Path(store).resolve()
        if target == root or target.is_relative_to(root):
            raise ValueError("Output must be outside the input Store")
        if target.exists() and any(target.samefile(root / name) for name in INPUT_FILES if (root / name).exists()):
            raise ValueError("Output must not overwrite an input file")
    if archive is not None:
        source = Path(archive).resolve()
        if target == source or (target.exists() and target.samefile(source)):
            raise ValueError("Output must not overwrite the input archive")
    return target


def main(argv=None):
    parser = ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--store", type=Path)
    group.add_argument("--archive", type=Path)
    parser.add_argument("--output", type=Path, help="Optional JSON destination outside the input Store; defaults to stdout")
    args = parser.parse_args(argv)
    try:
        output = _check_output(args.output, store=args.store, archive=args.archive) if args.output else None
        report = audit(store=args.store, archive=args.archive)
        rendered = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
        if output:
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text(rendered, encoding="utf-8")
        else:
            print(rendered, end="")
    except (OSError, ValueError, BadZipFile) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
