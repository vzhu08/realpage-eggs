"""Reproduce review candidates from immutable sources, without a Store/provider job.

Run from any directory with the repository Python. --check compares generated
artifacts instead of writing them. These annotations are not production rules.
"""
import argparse
from collections import Counter
from datetime import date
from hashlib import sha256
import json
from pathlib import Path
import sys
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
sys.path.insert(0, str(ROOT))
from navigator.engine import evaluate_rules, temporal
from navigator.models import (
    JurisdictionResolution, PropertyFacts, Rule, RuleDraft, SourceDocument,
    SourceSpan,
)
from navigator.source_comparison import compare_claims, compare_rule_versions

BUNDLE = ROOT / "docs/platform_sources/2026-10-04"
FOLLOWUP = ROOT / "docs/platform_sources/2026-10-04-followup"
SNAPSHOT = ROOT / "docs/core_rules/snapshots/core-store.zip"
SNAPSHOT_HASH = "157581d64b1c19fdfcc0414d08bbd0ffeeeca60e3142bd621a7152fe5c6e44bc"


def digest(raw):
    return sha256(raw).hexdigest()


def read(path):
    return json.loads(path.read_bytes())


def located_objects(value, location=""):
    if isinstance(value, dict):
        yield location, value
        for key, child in value.items():
            yield from located_objects(child, f"{location}/{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from located_objects(child, f"{location}/{index}")


def objects(value):
    for _, item in located_objects(value):
        yield item


def check_anchor(item, sources):
    source = sources[item["doc_id"]]
    start, end = item["start"], item["end"]
    quote = item.get("quote", item.get("text"))
    assert isinstance(start, int) and isinstance(end, int)
    assert 0 <= start < end <= len(source.text)
    assert source.text[start:end] == quote, (source.doc_id, start, end)
    if "source_hash" in item:
        assert item["source_hash"] == source.sha256
    return (source.doc_id, start, end, quote)


def main(check=False):
    assert digest(SNAPSHOT.read_bytes()) == SNAPSHOT_HASH
    with zipfile.ZipFile(SNAPSHOT) as archive:
        saved_sources = json.loads(archive.read("sources.json"))
        saved_rules = json.loads(archive.read("rules.json"))
        addresses = json.loads(archive.read("addresses.json"))
        resolutions = json.loads(archive.read("resolutions.json"))
    delivered = read(BUNDLE / "sources.json")
    followup_sources = read(FOLLOWUP / "sources.json")
    assert not delivered.keys() & followup_sources.keys()
    delivered |= followup_sources
    assert not saved_sources.keys() & delivered.keys()
    sources = {key: SourceDocument.model_validate(value)
               for key, value in (saved_sources | delivered).items()}
    for key, source in sources.items():
        if source.text:
            assert source.doc_id == key and digest(source.text.encode("utf-8")) == source.sha256
    inputs = {"docs/core_rules/snapshots/core-store.zip": SNAPSHOT_HASH}
    for path in (BUNDLE / "manifest.json", BUNDLE / "sources.json",
                 FOLLOWUP / "manifest.json", FOLLOWUP / "sources.json", Path(__file__),
                 ROOT / "navigator/models.py", ROOT / "navigator/engine.py",
                 ROOT / "navigator/predicates.py", ROOT / "navigator/source_comparison.py"):
        inputs[path.relative_to(ROOT).as_posix()] = digest(path.read_bytes())
    raw_text_pairs = 0
    for bundle in (BUNDLE, FOLLOWUP):
        for record in read(bundle / "manifest.json")["records"]:
            if record["status"] == "failed":
                continue
            for kind in ("raw", "text"):
                path = bundle / record[f"{kind}_path"]
                assert path.resolve().is_relative_to(bundle)
                inputs[path.relative_to(ROOT).as_posix()] = digest(path.read_bytes())
                assert inputs[path.relative_to(ROOT).as_posix()] == record[f"{kind}_sha256"]
            raw_text_pairs += 1
            if record["doc_id"] in sources:
                assert (bundle / record["text_path"]).read_bytes().decode("utf-8") == sources[record["doc_id"]].text
            else:
                assert record["role"] == "access/provenance record, not target legal evidence"
    reviews = {}
    anchors = set()
    drafts = []
    for path in sorted((OUT / "annotations").glob("*.json")):
        reviews[path.stem] = read(path)
        inputs[path.relative_to(ROOT).as_posix()] = digest(path.read_bytes())
        for location, item in located_objects(reviews[path.stem]):
            if {"doc_id", "start", "end"} <= item.keys() and ("quote" in item or "text" in item):
                anchors.add(check_anchor(item, sources))
            if {"jurisdiction", "provision_key", "coverage_conditions", "source_doc_id", "evidence"} <= item.keys():
                draft = RuleDraft.model_validate(item)
                assert draft.review_issues, "Candidates must preserve review uncertainty"
                assert draft.source_url == sources[draft.source_doc_id].url
                assert draft.quoted_span in sources[draft.source_doc_id].text
                drafts.append((path.stem, location, draft))
    assert set(reviews) == {"california", "new_jersey", "massachusetts", "new_jersey_followup"}

    # Recompute authored claim comparisons; saved anchor-valid flags are not
    # trusted. Semantic support and precedence remain explicitly unresolved.
    nj = reviews["new_jersey"]
    for entry in nj["claim_comparisons"].values():
        saved = entry["comparison"]
        observed = compare_claims(
            saved["field"], saved["before"]["value"], saved["after"]["value"],
            [SourceSpan.model_validate(row["span"]) for row in saved["before"]["support"]],
            [SourceSpan.model_validate(row["span"]) for row in saved["after"]["support"]],
            sources, sources, rule_ids=saved["rule_ids"],
        )
        assert observed == saved
        assert observed["winner"] is None and observed["semantic_support"] == "not_checked"
    # These are synthetic property boundary probes with real source-backed
    # Draft inputs. Transient Rule envelopes are never saved or called replay.
    nj_probe_rules = [Rule(**row["rule_draft"], team_rule_id="review-" + row["candidate_id"],
                          evidence_mode="synthetic", extraction_run_id="synthetic-boundary-probe-no-provider",
                          semantic_verification="needs_review") for row in nj["candidate_rules"]]
    for probe in nj["evaluation_probes"]:
        name, city = probe["synthetic_property"], probe["known_municipality"]
        prop = PropertyFacts(address_id=name,
                             raw_address={"street_address": "Synthetic review probe", "postal_city": "Synthetic", "state": "NJ", "zip": "00000"},
                             normalized_address="Synthetic review probe, NJ", facts={"residential": probe["residential"]})
        resolution = JurisdictionResolution(address_id=name, state="NJ", municipality=city,
            match_quality="resolved" if city else "unresolved", unresolved=[] if city else ["Synthetic unknown municipality"])
        rows = evaluate_rules(nj_probe_rules, prop, resolution, date.fromisoformat(probe["as_of"]))
        observed = [{"rule_id": row.team_rule_id, "result": row.result, "temporal_status": row.temporal_status,
                     "coverage": row.coverage.value, "conflict_flag": row.conflict_flag} for row in rows]
        assert observed == probe["evaluations"]
        assert all(row["result"] not in {"applies", "superseded"} for row in observed)
    ma = reviews["massachusetts"]
    ma_drafts = {row["candidate_id"]: RuleDraft.model_validate(row["rule_draft"])
                 for row in ma["rule_drafts"] + ma["conditional_failed_rule_drafts"]}
    for probe in ma["temporal_probes"]:
        draft = ma_drafts[probe["candidate_id"]]
        for row in probe["actual"]:
            assert temporal(draft, date.fromisoformat(row["as_of"])) == row["temporal_status"]
        assert temporal(draft, date(2026, 10, 1), hypothetical=True) == probe["hypothetical_oct1"]

    # Review-only amendments to the two existing extracted AB325 rules. The
    # original provider output/run identity is never rewritten or re-attributed.
    proposals, comparisons, evaluator_probes = [], {}, []
    old_rules = {key: Rule.model_validate(row) for key, row in saved_rules.items()}
    for candidate in reviews["california"]["rule_patch_candidates"]:
        original = old_rules[candidate["existing_team_rule_id"]]
        assert original.source_doc_id == "D022"
        patch = candidate["proposed_patch"]
        assert set(patch) == {"effective_date", "semantic_verification", "coverage_conditions/args/0/reason", "status_events", "evidence_append", "review_issues"}
        assert patch["semantic_verification"] == "needs_review"
        raw = original.model_dump(mode="json", include=set(RuleDraft.model_fields))
        raw["effective_date"] = patch["effective_date"]
        raw["evidence"] += patch["evidence_append"]
        assert raw["coverage_conditions"]["args"][0]["op"] == "unsupported"
        raw["coverage_conditions"]["args"][0]["reason"] = patch["coverage_conditions/args/0/reason"]
        raw["status_events"] = patch["status_events"]
        superseded_notes = [issue for issue in raw["review_issues"] if issue not in patch["review_issues"]]
        raw["review_issues"] = patch["review_issues"]
        draft = RuleDraft.model_validate(raw)
        # Borrow only existing metadata to exercise the canonical evaluator on a
        # transient copy. Serialize a Draft so no new live/replay run is claimed.
        transient = Rule.model_validate(original.model_dump() | draft.model_dump())
        assert transient.semantic_verification == "needs_review"
        proposals.append({"existing_rule_id": original.team_rule_id,
                          "original_rule_sha256_sorted_json": digest(json.dumps(saved_rules[original.team_rule_id], sort_keys=True).encode()),
                          "authorship": "agent_review_annotation_no_provider_call",
                          "state": "needs_review_not_applied", "superseded_missing_source_notes": superseded_notes,
                          "draft": draft.model_dump(mode="json")})
        comparison = compare_rule_versions(original, transient, sources, sources)
        # The reusable helper accepts Rules and includes them in its result.
        # Do not publish borrowed run metadata as the provenance of a manual edit.
        comparison.pop("claims")
        comparison.pop("rule_hashes")
        comparison["interface"] = "review-only-observations-from-internal-core-comparison-v1"
        comparison["input_references"] = {
            "before": {"snapshot_rule_id": original.team_rule_id,
                       "snapshot_sha256": SNAPSHOT_HASH},
            "after": {"artifact": "t1_amendments.json", "existing_rule_id": original.team_rule_id,
                      "state": "agent_review_draft_not_a_provider_result",
                      "draft_sha256_sorted_json": digest(json.dumps(draft.model_dump(mode="json"), sort_keys=True).encode())},
        }
        comparisons[original.team_rule_id] = comparison
        boundary = {day: temporal(draft, date.fromisoformat(day))
                    for day in ("2025-12-31", "2026-01-01", "2026-01-02")}
        assert boundary == {"2025-12-31": "not_yet_effective", "2026-01-01": "in_force", "2026-01-02": "in_force"}
        samples = {}
        for state in ("CA", "NJ"):
            prop_id = next(key for key in sorted(addresses) if addresses[key]["raw_address"]["state"] == state)
            prop = PropertyFacts.model_validate(addresses[prop_id])
            resolution = JurisdictionResolution.model_validate(resolutions[prop_id])
            samples[state] = {day: evaluate_rules([transient], prop, resolution, date.fromisoformat(day))[0].model_dump(mode="json", include={"result", "temporal_status", "jurisdiction", "missing_facts", "uncertainty_reasons"}) for day in boundary}
        assert samples["CA"]["2025-12-31"]["result"] == "not_yet_effective"
        assert samples["CA"]["2026-01-01"]["result"] == "unknown"
        assert all(row["result"] == "inapplicable" for row in samples["NJ"].values())
        evaluator_probes.append({"existing_rule_id": original.team_rule_id, "boundary": boundary,
                                 "saved_fact_samples": samples,
                                 "limitation": "Review-only copy, representative saved facts; not a new 500-address T1 result."})
        for item in objects(draft.model_dump(mode="json")):
            if {"doc_id", "quote", "start", "end"} <= item.keys():
                anchors.add(check_anchor(item, sources))

    assert len(proposals) == 2
    draft_probes = [{"review": review, "annotation_path": location,
                     "conditional_variant": "conditional_failed_rule_drafts" in location,
                     "source_doc_id": draft.source_doc_id,
                     "provision_key": draft.provision_key, "lifecycle": draft.lifecycle,
                     "effective_date": draft.effective_date,
                     "actual_at_2026_10_01": temporal(draft, date(2026, 10, 1)),
                     "hypothetical_at_2026_10_01": temporal(draft, date(2026, 10, 1), hypothetical=True),
                     "limitation": "Temporal encoding probe only; conditional on annotation support and unresolved review issues. No applicability result."}
                    for review, location, draft in drafts]
    before_counts = Counter(temporal(rule, date(2026, 10, 1)) for rule in old_rules.values())
    # Integrity anchors establish exact identity, not semantic truth.
    report = {
        "label": "AGENT_SOURCE_REVIEW_NOT_ACCEPTED_RULES",
        "base_commit": "9ff4396de5b6bdc5d8daed159a0778f993dd49cc",
        "integrated_main": "3809c8a",
        "new_provider_calls": 0, "stored_rules_modified": 0, "human_review": "pending",
        "delivered_documents": len(delivered), "merged_in_memory_sources": len(sources),
        "raw_text_pairs_verified": raw_text_pairs,
        "original_rules": len(old_rules), "original_temporal_counts": dict(sorted(before_counts.items())),
        "unique_exact_anchors_checked": len(anchors), "canonical_new_draft_count": len(drafts),
        "conditional_variant_count": sum(row["conditional_variant"] for row in draft_probes),
        "nj_claim_comparisons_reproduced": len(nj["claim_comparisons"]),
        "nj_synthetic_property_probes_reproduced": len(nj["evaluation_probes"]),
        "ma_temporal_probe_groups_reproduced": len(ma["temporal_probes"]),
        "candidate_existing_rule_amendments": len(proposals),
        "temporal_corrections_applied_to_store": 0,
        "t1_candidate_probes": evaluator_probes, "new_draft_temporal_probes": draft_probes,
        "input_sha256": inputs,
    }
    artifacts = {"t1_amendments.json": proposals, "t1_version_comparisons.json": comparisons,
                 "verification.json": report}
    for name, value in artifacts.items():
        encoded = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        if check:
            assert (OUT / name).read_bytes() == encoded, f"Stale {name}; reproduce after review"
        else:
            (OUT / name).write_bytes(encoded)
    assert digest(SNAPSHOT.read_bytes()) == SNAPSHOT_HASH
    for name, expected in inputs.items():
        assert digest((ROOT / name).read_bytes()) == expected, f"Input changed: {name}"
    print(json.dumps({key: report[key] for key in ("delivered_documents", "unique_exact_anchors_checked", "canonical_new_draft_count", "candidate_existing_rule_amendments", "new_provider_calls", "stored_rules_modified")}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    raise SystemExit(main(parser.parse_args().check))
