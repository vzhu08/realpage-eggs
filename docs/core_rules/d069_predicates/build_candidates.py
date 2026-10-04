"""Build review-only D069 Draft overlays; never mutate a Store or provider output."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
PILOT = ROOT / "docs/platform_pilots/2026-10-04-d069"
sys.path.insert(0, str(ROOT))
from navigator.models import Evidence, Expression, Rule, RuleDraft, SourceDocument


def read(path):
    return json.loads(path.read_bytes())


def canonical_hash(value):
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def walk(value, path=""):
    if isinstance(value, dict):
        yield path, value
        for key, child in value.items():
            yield from walk(child, f"{path}/{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, f"{path}/{index}")


def replace_expression(value, path, replacement, expected_hash):
    keys = path.split("/")
    parent = value
    for key in keys[:-1]:
        parent = parent[int(key)] if isinstance(parent, list) else parent[key]
    key = int(keys[-1]) if isinstance(parent, list) else keys[-1]
    before = parent[key]
    assert canonical_hash(before) == expected_hash, f"Original expression changed: {path}"
    parent[key] = Expression.model_validate(replacement).model_dump(mode="json")
    return before


def verify_anchor(item, source):
    assert item["doc_id"] == source.doc_id
    quote = item.get("text", item.get("quote"))
    start, end = item["start"], item["end"]
    assert isinstance(start, int) and isinstance(end, int) and 0 <= start < end <= len(source.text)
    assert source.text[start:end] == quote
    if "source_hash" in item:
        assert item["source_hash"] == source.sha256
    return start, end, quote


def build():
    manifest = read(PILOT / "manifest.json")
    for name, expected in manifest["files"].items():
        assert Path(name).name == name
        assert sha256((PILOT / name).read_bytes()).hexdigest() == expected
    source = SourceDocument.model_validate(read(PILOT / "sources.json")["D069"])
    assert sha256(source.text.encode("utf-8")).hexdigest() == source.sha256 == manifest["source_sha256"]
    originals = {key: Rule.model_validate(value) for key, value in read(PILOT / "rules.json").items()}
    plan = read(HERE / "edits.json")
    candidates, anchors = {}, set()
    for entry in plan["candidates"]:
        ident = entry["original_rule_id"]
        original = originals[ident]
        assert original.semantic_verification == "needs_review"
        assert original.extraction_run_id == manifest["run_id"]
        raw = original.model_dump(mode="json", include=set(RuleDraft.model_fields))
        changes = []
        for edit in entry["edits"]:
            before = replace_expression(raw, edit["path"], edit["expression"], edit["expected_original_sha256"])
            assert edit["evidence"], "Every edited expression needs exact source support"
            for evidence in edit["evidence"]:
                parsed = Evidence.model_validate(evidence)
                assert any(s == edit["path"] or s.startswith(edit["path"] + "/") for s in parsed.supports)
                anchors.add(verify_anchor(evidence, source))
                raw["evidence"].append(parsed.model_dump(mode="json"))
            changes.append({"path": edit["path"], "before": before,
                            "after": edit["expression"], "reason": edit["reason"]})
        raw["review_issues"] += entry["review_notes"]
        draft = RuleDraft.model_validate(raw)
        for _, item in walk(draft.model_dump(mode="json")):
            if {"doc_id", "quote", "start", "end"} <= item.keys():
                anchors.add(verify_anchor(item, source))
        candidates[ident] = {
            "authorship": "Core A offline agent-authored predicate overlay",
            "review_state": "needs_review", "eligible_for_direct_store_import": False,
            "basis": {"bundle": "docs/platform_pilots/2026-10-04-d069",
                      "original_rule_id": ident, "original_run_id": original.extraction_run_id,
                      "original_rule_sha256": canonical_hash(original.model_dump(mode="json")),
                      "source_sha256": source.sha256},
            "changes": changes, "candidate_sha256": canonical_hash(draft.model_dump(mode="json")),
            "rule_draft": draft.model_dump(mode="json"),
        }
    # Review documents are independently authored annotations, checked here for
    # exact source identity. Successful anchors do not certify interpretation.
    for path in sorted(HERE.glob("*.json")):
        if path.name in {"candidate_drafts.json", "verification.json", "checks.json"}:
            continue
        for _, item in walk(read(path)):
            if {"doc_id", "start", "end"} <= item.keys() and ("text" in item or "quote" in item):
                anchors.add(verify_anchor(item, source))
    before = [(ident, path) for ident, rule in originals.items()
              for path, node in walk(rule.model_dump(mode="json"))
              if node.get("op") == "unsupported"]
    matrix = read(HERE / "predicate_matrix.json")
    matrix_keys = [(row["rule_id"], row["pointer"]) for row in matrix["rows"]]
    assert len(matrix_keys) == len(set(matrix_keys)), "Duplicate predicate matrix row"
    assert set(matrix_keys) == set(before), "Predicate matrix does not cover every original gap"
    for row in matrix["rows"]:
        original_nodes = dict(walk(originals[row["rule_id"]].model_dump(mode="json")))
        assert row["original_node"] == original_nodes[row["pointer"]], "Matrix original node changed"
    after = [(ident, path, node["reason"]) for ident, row in candidates.items()
             for path, node in walk(row["rule_draft"]) if node.get("op") == "unsupported"]
    report = {
        "label": "REVIEW_CANDIDATES_NOT_PROVIDER_OUTPUT_OR_ACCEPTED_RELEASE",
        "base_commit": "fec517db973f102c7623a22947b57eb644b2aaa5",
        "provider_calls": 0, "store_writes": 0, "pilot_rule_count": len(originals),
        "candidate_rule_count": len(candidates), "unique_exact_anchors_checked": len(anchors),
        "pilot_unsupported_nodes": before, "candidate_remaining_unsupported_nodes": after,
        "interpretation": "Refined factual gates; residual legal issues remain. Node counts alone do not measure resolved scope.",
        "pilot_inputs_sha256": manifest["files"],
        "candidate_inputs_sha256": {path.name: sha256(path.read_bytes()).hexdigest()
                                   for path in sorted(HERE.iterdir()) if path.is_file()
                                   and path.name not in {"candidate_drafts.json", "verification.json", "checks.json", "README.md"}},
    }
    return candidates, report


def load_candidates():
    return {key: RuleDraft.model_validate(row["rule_draft"])
            for key, row in read(HERE / "candidate_drafts.json").items()}


def main(check=False):
    candidates, report = build()
    for name, value in (("candidate_drafts.json", candidates), ("verification.json", report)):
        output = (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        if check:
            assert (HERE / name).read_bytes() == output, f"Stale {name}"
        else:
            (HERE / name).write_bytes(output)
    print(json.dumps({key: report[key] for key in ("pilot_rule_count", "candidate_rule_count", "unique_exact_anchors_checked", "provider_calls", "store_writes")}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    main(parser.parse_args().check)
