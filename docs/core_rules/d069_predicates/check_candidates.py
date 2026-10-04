"""Labeled synthetic facts exercising review Drafts through the one evaluator."""
import argparse
import json
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT))
from docs.core_rules.d069_predicates.build_candidates import load_candidates, read
from navigator.engine import evaluate_rules, rule_traces
from navigator.models import JurisdictionResolution, PropertyFacts, Rule
from datetime import date


def trace_nodes(rows):
    for row in rows:
        yield row
        yield from trace_nodes(row.children)


def run_case(case):
    draft = load_candidates()[case["candidate_id"]]
    rule = Rule(**draft.model_dump(), team_rule_id="synthetic-d069-" + case["name"],
                evidence_mode="synthetic", extraction_run_id="offline-synthetic-boundary-probe",
                semantic_verification="needs_review")
    before = rule.model_dump()
    prop = PropertyFacts(address_id="SYNTHETIC-D069", normalized_address="Synthetic D069 activity",
                         raw_address={"street_address": "Synthetic probe", "postal_city": "Synthetic", "state": "NJ"},
                         facts=case["facts"], provenance={key: "synthetic activity fixture" for key in case["facts"]})
    resolution = JurisdictionResolution(address_id=prop.address_id, state="NJ")
    day = date.fromisoformat(case.get("as_of", "2027-07-01"))
    result = evaluate_rules([rule], prop, resolution, day)[0]
    traces = rule_traces(rule, prop, resolution, day)
    assert rule.model_dump() == before, "Probe changed a candidate"
    observed = {"result": result.result, "coverage": result.coverage.value,
                "temporal_status": result.temporal_status, "missing_facts": result.missing_facts}
    for field, expected in case["expected"].items():
        assert observed[field] == expected, (case["name"], field, observed[field], expected)
    nodes = {row.path: row for row in trace_nodes(traces)}
    for check in case.get("trace_checks", []):
        node = nodes[check["path"]]
        for field in ("result", "relevant"):
            if field in check:
                assert getattr(node, field) == check[field], (case["name"], check)
        assert node.source_refs, (case["name"], "Edited trace has no evidence", node.path)
    assert result.result not in {"applies", "superseded"}, "A review candidate was silently accepted"
    selected = {"coverage_conditions", "exemption_conditions"} | {row["path"] for row in case.get("trace_checks", [])}
    return {"name": case["name"], "label": "SYNTHETIC_ACTIVITY_FACTS_NOT_REAL_PROPERTY_FINDINGS",
            **observed, "uncertainty_reasons": result.uncertainty_reasons,
            "trace_checks": [{"path": path, "result": nodes[path].result, "relevant": nodes[path].relevant,
                              "source_spans": sorted({(ref.doc_id, ref.start, ref.end) for ref in nodes[path].source_refs})}
                             for path in sorted(selected)]}


def main(check=False):
    result = {"label": "FOCUSED_SYNTHETIC_CANDIDATE_PROBES",
              "provider_calls": 0, "store_writes": 0,
              "results": [run_case(case) for case in read(HERE / "cases.json")["cases"]]}
    output = (json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    if check:
        assert (HERE / "checks.json").read_bytes() == output, "Stale probe results"
    else:
        (HERE / "checks.json").write_bytes(output)
    print(json.dumps({"candidate_cases_passed": len(result["results"]), "provider_calls": 0, "store_writes": 0}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    main(parser.parse_args().check)
