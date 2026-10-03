"""Targeted structural inventory, never a claim of full legal coverage."""
import re

from .evidence import all_evidence
from .retrieval import source_units
from .store import digest

INVENTORY_VERSION = "source-units-v1"


def inventory_source(store, doc_id):
    sources = store.sources()
    if doc_id not in sources: raise KeyError(f"Unknown source {doc_id}")
    source, rules = sources[doc_id], list(store.rules().values())
    key = digest([doc_id, source.sha256, digest(source.text.encode("utf-8")), INVENTORY_VERSION, [r.model_dump(mode="json") for r in rules]])
    cached = store.read(f"source_inventory/{key}.json")
    if cached: return {**cached, "cache_mode": "replay"}
    rows = []
    for item in source_units(source):
        labels = []
        for kind, pattern in [("definition", r"\b(means|defined|definition)\b"), ("exception", r"\b(except|exempt|unless)\b"), ("date", r"\b(effective|January|February|March|April|May|June|July|August|September|October|November|December)\b")]:
            if re.search(pattern, item.text, re.I): labels.append(kind)
        if not labels: labels = ["provision_candidate"]
        mapped = []
        for rule in rules:
            for evidence in all_evidence(rule):
                if evidence.doc_id != doc_id: continue
                start = evidence.start if evidence.start is not None else source.text.find(evidence.quote)
                if start < item.end and start + len(evidence.quote) > item.start and start >= 0 and source.text[start:start+len(evidence.quote)] == evidence.quote:
                    mapped.append({"rule_id": rule.team_rule_id, "fields": evidence.supports, "predicate_ids": []})
        rows.append({"unit_id": f"{doc_id}:{source.sha256[:12]}:{item.start}-{item.end}", "span": item.model_dump(mode="json"), "candidate_kinds": labels, "status": "mapped_evidence" if mapped else "unresolved", "mapped": mapped, "reason": "Exact overlap with extracted supporting span; not proof of complete provision encoding" if mapped else "No extracted supporting span mapped; relevance/coverage requires review"})
    result = {"doc_id": doc_id, "source_hash": source.sha256, "version": INVENTORY_VERSION, "mode": "deterministic_structural_inventory", "cache_mode": "fresh", "human_reviewed": False, "complete_legal_coverage": False, "source_available": bool(source.text), "units": rows, "counts": {"units": len(rows), "mapped": sum(bool(r["mapped"]) for r in rows), "unresolved": sum(not r["mapped"] for r in rows)}, "limits": ["Section/definition/exception/date detection is heuristic; relevance and legal completeness are not certified", "Predicate-level evidence mapping requires Core trace support; field mappings are retained"]}
    store.write(f"source_inventory/{key}.json", result)
    return result
