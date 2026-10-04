"""Read-only verification of the committed D069 candidate subset; no provider calls."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parents[2]))

from navigator.models import ExtractionBundle, Rule, SourceDocument


def read(name):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


manifest = read("manifest.json")
for name, expected in manifest["files"].items():
    assert Path(name).name == name, "Manifest file must be in the bundle directory"
    assert hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, name
sources = {k: SourceDocument.model_validate(v) for k, v in read("sources.json").items()}
rules = {k: Rule.model_validate(v) for k, v in read("rules.json").items()}
assert set(sources) == {"D069"} and len(rules) == 7
source = sources["D069"]
assert hashlib.sha256(source.text.encode("utf-8")).hexdigest() == source.sha256
assert source.sha256 == manifest["source_sha256"]
run = read("run.json")
assert run["run_id"] == manifest["run_id"] and run["outcome"] == "success" and not run["errors"]
assert run["input_hashes"] == {"D069": source.sha256}
assert run["counts"]["processed"] == 1 and run["counts"]["rules"] == 147
review = ExtractionBundle.model_validate(read("provider_review.json"))
assert len(review.rules) == 7
quotes = set()
unsupported = 0
for rule_id, rule in rules.items():
    assert rule.team_rule_id == rule_id and rule.source_doc_id == "D069"
    assert rule.source_url == source.url and rule.quoted_span in source.text
    assert rule.extraction_run_id == run["run_id"] and rule.evidence_mode == "live"
    assert rule.semantic_verification == "needs_review"
    data = rule.model_dump(mode="json")
    unsupported += any(node.get("op") == "unsupported" for node in walk(data["coverage_conditions"]))
    for node in walk(data):
        if "quote" in node and "doc_id" in node:
            assert node["doc_id"] == "D069"
            start, end = node.get("start"), node.get("end")
            assert isinstance(start, int) and isinstance(end, int)
            assert source.text[start:end] == node["quote"]
            quotes.add((start, end, node["quote"]))
assert unsupported == 6 and len(quotes) == 25
ledger = read("pilot_budget.json")
assert len(ledger["requests"]) == 2 and ledger["reserved_usd"] == "3.00"
assert all(row["status"] == "response_received" and row["http_status"] == 200 for row in ledger["requests"])
usage = read("usage.json")
assert len(usage) == 2 and all(row["status"] == "completed" for row in usage)
assert sum(row["usage"]["input_tokens"] for row in usage) == 20043
assert sum(row["usage"]["output_tokens"] for row in usage) == 27279
print(json.dumps({"verified_files": len(manifest["files"]), "sources": 1, "rules": 7,
                  "exact_distinct_evidence_spans": len(quotes), "unsupported_coverage_rules": unsupported,
                  "all_rules_need_review": True, "provider_calls": 0, "store_writes": 0}))
