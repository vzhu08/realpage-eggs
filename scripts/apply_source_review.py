"""Apply an explicitly authored, source-pinned review plan to a NEW offline Store.

No provider calls, fact inference, or automatic legal review occurs here. The
original extraction payload/cache remain available alongside separate corrections.
"""
import argparse
from copy import deepcopy
import json
from pathlib import Path
import shutil
import sys
from tempfile import TemporaryDirectory

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from navigator.models import Rule, SourceReview, SourceReviewRecord
from navigator.source_review import source_review_original
from navigator.store import Store, digest, now, write_json
from scripts.assemble_snapshot import (CORE_REQUIRED, CORE_OPTIONAL, CORE_DIRS,
                                       check_rule, check_sources, extraction_provenance,
                                       fingerprint, inventory, require)

# Competition export schemas are not consumed when checking or serving a rule.
REVIEW_REQUIRED = tuple(name for name in CORE_REQUIRED if name != "competition_schema.json")
REVIEW_OPTIONAL = (*CORE_OPTIONAL, "competition_schema.json")


def verify_base(store, hashes, reconstructed_input):
    if not reconstructed_input:
        extraction_provenance(store, store.sources(), store.rules(), hashes)
        return
    # Explicitly supported research input mode: retained API snapshots may have
    # lost historical provider artifacts. This verifies the bytes we DO possess;
    # it cannot certify their missing extraction lineage or pass strict assembly.
    sources = store.sources()
    check_sources(sources)
    for ident, rule in store.rules().items():
        require(ident == rule.team_rule_id, f"Rule key/ID mismatch: {ident}")
        check_rule(rule, sources)
        if rule.source_review:
            source_review_original(store, rule, sources)


def apply_plan(input_dir, output_dir, plan, *, reconstructed_input=False):
    source, output = Path(input_dir).resolve(), Path(output_dir).resolve()
    require(not output.exists() and not output.is_relative_to(source)
            and not source.is_relative_to(output), "Choose a new output outside the input Store")
    require(plan.get("version") == "source-review-plan-v1", "Unsupported source review plan")
    require(not (source / "source_review_inputs").exists() and not (source / "source_review_plan.json").exists(),
            "A previous source review snapshot exists; repeated batches require a versioned audit format")
    before = inventory(source, REVIEW_REQUIRED, REVIEW_OPTIONAL, CORE_DIRS + ("geocode_cache",))
    required = {"rules.json", "sources.json", "addresses.json", "resolutions.json", "extraction_index.json"}
    require(required <= plan.get("input_hashes", {}).keys(), "Plan must pin rules, sources, properties, resolutions and extraction index")
    for name, expected in plan["input_hashes"].items():
        require(before.get(name) == expected, f"Review plan input hash mismatch: {name}")
    core = Store(source)
    sources, original_raw = core.sources(), core.read("rules.json")
    verify_base(core, before, reconstructed_input)
    rules, records, seen = deepcopy(original_raw), {}, set()
    stamp = now()
    for entry in plan.get("reviews", []):
        ident = entry["rule_id"]
        require(ident in original_raw and ident not in seen, f"Missing or duplicate review rule: {ident}")
        seen.add(ident)
        raw = original_raw[ident]
        require(digest(raw) == entry["original_rule_sha256"], f"Review original hash mismatch: {ident}")
        original = Rule.model_validate(raw)
        require(original.source_review is None, "Review chaining is not supported")
        changes = entry["changes"]
        require(changes and "source_review" not in changes, "Expected explicit changed rule fields")
        after = original.model_dump(mode="json")
        after.update(changes)
        amended = Rule.model_validate(after)
        actual_changes = sorted(k for k in Rule.model_fields
                                if k != "source_review" and getattr(original, k) != getattr(amended, k))
        require(set(changes) == set(actual_changes), f"Plan has no-op or unsupported changes: {ident}")
        review_id = "review-" + digest([ident, entry])[:24]
        review_values = {key: entry[key] for key in (
            "source_hashes", "evidence", "notes", "review_scope", "reviewed_fields", "context_scope",
            "context_scope_note", "context_reference_decisions") if key in entry}
        if reconstructed_input:
            review_values["notes"] = [*review_values["notes"],
                "Original rule retained from a reconstructed API snapshot. Historical provider-run/cache lineage is unavailable or incomplete and has NOT been verified. This correction is a separate AI source review of the pinned retained text, not a reconstruction of provider output."]
        review = SourceReview(
            review_id=review_id, reviewer="Codex source review", reviewed_at=stamp,
            original_rule_sha256=digest(raw), original_extraction_run_id=original.extraction_run_id,
            changed_fields=actual_changes, **review_values,
        )
        amended = Rule.model_validate({**after, "source_review": review.model_dump(mode="json")})
        rules[ident] = amended.model_dump(mode="json")
        records[review_id] = SourceReviewRecord(rule_id=ident, original_rule=raw,
                                               amended_rule_sha256=digest(rules[ident]))
    require(seen, "Review plan contains no corrections")
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix=".source-review-", dir=output.parent) as temp:
        staged = Path(temp) / "data"
        staged.mkdir()
        for name in before:
            target = staged / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / name, target)
            require(fingerprint(target) == before[name], f"Copied input hash mismatch: {name}")
        store = Store(staged)
        for name in sorted(required):
            target = store.path(f"source_review_inputs/{name}")
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source / name, target)
            require(fingerprint(target) == before[name], f"Original snapshot hash mismatch: {name}")
        store.write("source_review_plan.json", plan)
        store.write("rules.json", rules)
        for review_id, record in records.items():
            store.write(f"source_reviews/{review_id}.json", record)
        for ident in seen:
            source_review_original(store, Rule.model_validate(rules[ident]), sources)
        dataset = store.read("dataset.json")
        dataset["label"] = "RESEARCH_SOURCE_REVIEWED_CORRECTIONS_NOT_LEGAL_VALIDATION"
        if reconstructed_input:
            dataset["label"] += "_HISTORICAL_EXTRACTION_LINEAGE_INCOMPLETE"
        store.write("dataset.json", dataset)
        run = store.new_run("source_review", input_hashes={**plan["input_hashes"], "review_plan": digest(plan)},
                            config={"provider_calls": 0, "reviewer": "Codex source review",
                                    "facts_inferred": 0, "original_payloads_retained": True,
                                    "historical_extraction_lineage": "unverified_reconstructed_input" if reconstructed_input else "verified_against_original_cache"})
        store.finish(run, "success", reviewed_rules=len(seen), provider_calls=0)
        staged_hashes = inventory(staged, REVIEW_REQUIRED, REVIEW_OPTIONAL, CORE_DIRS + ("geocode_cache",))
        verify_base(store, staged_hashes, reconstructed_input)
        require(inventory(source, REVIEW_REQUIRED, REVIEW_OPTIONAL, CORE_DIRS + ("geocode_cache",)) == before,
                "Original Store changed while applying reviews")
        require(not output.exists(), "Output was created while preparing review")
        staged.rename(output)
    receipt = {"output": str(output), "reviewed_rules": len(seen), "provider_calls": 0,
               "original_store_unchanged": True, "review_plan_sha256": digest(plan),
               "historical_extraction_lineage": "unverified_reconstructed_input" if reconstructed_input else "verified_against_original_cache"}
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--plan", type=Path, required=True)
    parser.add_argument("--reconstructed-input", action="store_true",
                        help="Explicit research-only mode for a retained API snapshot with unavailable historical provider lineage; never certifies that lineage")
    args = parser.parse_args()
    print(json.dumps(apply_plan(args.input, args.output, json.loads(args.plan.read_text()),
                               reconstructed_input=args.reconstructed_input), indent=2))


if __name__ == "__main__":
    main()
