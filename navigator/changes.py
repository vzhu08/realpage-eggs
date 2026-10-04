import re
from datetime import date

from .config import DISCLAIMER, ROOT
from .engine import evaluate_rules, temporal
from .models import ChangeRequest, ChangeResult
from .store import read_json


def map_references(rules, references):
    selectors = read_json(ROOT / "config/test_rule_selectors.json")
    mapping = {}
    for ref in references:
        selector = selectors.get(ref)
        if selector is None: raise ValueError(f"No documented selector for test reference {ref}")
        mapping[ref] = [r.team_rule_id for r in rules if r.jurisdiction == selector["jurisdiction"] and r.category == selector["category"] and re.search(selector.get("text_pattern", ".*"), f"{r.citation} {r.title} {r.requirement}", re.I)]
    return mapping


def signature(evaluation, rule):
    if evaluation.result in {"inapplicable", "failed"}: return None
    return (evaluation.result, rule.requirement, rule.key_value, evaluation.conflict_flag, tuple(sorted(evaluation.applied_interactions)))


def compute_changes(store, request: ChangeRequest):
    rules = list(store.rules().values())
    addresses, resolutions = store.addresses(), store.resolutions()
    notes, mapping = [], {}
    before, after, scenario = request.before, request.after, request.scenario
    kind = "as_of"
    test = None
    if request.test_id:
        test = next((t for t in store.read("change_tests.json", []) if t["test_id"] == request.test_id), None)
        if not test: raise KeyError(f"Unknown test ID {request.test_id}")
        mapping = map_references(rules, test["rule_ids"])
        before = date.fromisoformat(test.get("as_of_before", test.get("as_of")))
        after = date.fromisoformat(test.get("as_of_after", test.get("as_of")))
        kind = test["type"]
        scenario = "if_enacted" if kind == "pending" else "actual"
        selected = {ident for ids in mapping.values() for ident in ids}
        for ref, ids in mapping.items():
            if not ids: notes.append(f"Missing extracted legal evidence for {ref}; test cannot be established from its description")
        if test.get("conflict_with"):
            conflicts = map_references(rules, test["conflict_with"])
            mapping.update(conflicts)
            for ref, ids in conflicts.items():
                if not ids: notes.append(f"Missing local conflict evidence for {ref}")
            if not any(r.interactions for r in rules if r.team_rule_id in selected):
                notes.append("No evidence-backed state/local interaction extracted; expected conflict cannot be presumed from test text")
    else:
        selected = set(request.rule_ids) if request.rule_ids else {r.team_rule_id for r in rules}
        unknown = selected - {r.team_rule_id for r in rules}
        if unknown: raise KeyError(f"Unknown rule IDs: {', '.join(sorted(unknown))}")
    if not addresses: notes.append("Sample addresses unavailable")
    if not rules: notes.append("No extracted rules available")
    if scenario == "if_enacted": notes.append("Hypothetical only: selected pending rules are assumed enacted and effective on the comparison date; stored law is unchanged")
    if kind == "negative" and any(r.lifecycle != "failed" for r in rules if r.team_rule_id in selected):
        notes.append("Failed lifecycle is not established for all referenced proposal records")
    unresolved = sorted(r.team_rule_id for r in rules if r.team_rule_id in selected
                        and (r.review_issues or r.semantic_verification == "needs_review"))
    if unresolved:
        notes.append("Unresolved rule evidence: " + ", ".join(unresolved))
    affected, uncertain, conflicts, differences = [], [], [], {}
    by_id = {r.team_rule_id: r for r in rules}
    for ident, prop in sorted(addresses.items()):
        resolution = resolutions[ident]
        left = {e.team_rule_id: e for e in evaluate_rules(rules, prop, resolution, before)}
        right = {e.team_rule_id: e for e in evaluate_rules(rules, prop, resolution, after, selected if scenario == "if_enacted" else [])}
        deltas = []
        definite = possible = False
        for rid in sorted(selected):
            old, new = left[rid], right[rid]
            old_signature = None if kind in {"boundary", "negative"} else signature(old, by_id[rid])
            new_signature = signature(new, by_id[rid])
            if kind == "negative" and new.result == "pending": continue
            relevant = [new] if kind in {"boundary", "negative"} else [old, new]
            uncertain_delta = any(e.result == "unknown" or e.jurisdiction == "unknown" or e.coverage.value == "unknown" or e.uncertainty_reasons for e in relevant if e.result not in {"inapplicable", "failed"})
            # Equal unknown results cannot establish that nothing changed between
            # dates. Keep possible impacts separate, excluding known inactive rules.
            if old_signature == new_signature and not (before != after and uncertain_delta):
                continue
            if uncertain_delta: possible = True
            else: definite = True
            deltas.append({"team_rule_id": rid, "certainty": "uncertain" if uncertain_delta else "definite", "before": None if kind in {"boundary", "negative"} else old.model_dump(mode="json"), "after": new.model_dump(mode="json")})
        if definite: affected.append(ident)
        if possible: uncertain.append(ident)
        if any(e.conflict_flag for rid, e in right.items() if rid in selected): conflicts.append(ident)
        if deltas: differences[ident] = deltas
    if uncertain: notes.append("Uncertain impacts are separate from definitely affected addresses")
    failed_at_query = selected and all(temporal(by_id[rid], after) == "failed" for rid in selected)
    if kind == "negative" and failed_at_query and not unresolved and not affected and not uncertain:
        notes.append("Extracted proposal history creates no operative obligation on the query date")
    status = "blocked" if not selected or not addresses else "partial" if notes and any(n.startswith(("Missing", "No evidence", "Failed lifecycle", "Unresolved rule evidence")) for n in notes) or uncertain else "complete"
    return ChangeResult(test_id=request.test_id, scenario=scenario, status=status, before=before, after=after, affected_address_ids=affected, uncertain_address_ids=uncertain, conflict_flag_address_ids=conflicts, differences=differences, mapped_rule_ids=mapping, notes=notes, disclaimer=DISCLAIMER)
