"""Deterministic display of an encoding, never a model paraphrase or legal review."""
import hashlib
import json

from .fact_inputs import FACT_DEFINITIONS
from .models import EncodedRuleRendering, Expression, Rule, date_bounds

RENDERER_VERSION = "encoded-rule-v1"


def _value(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _date(value):
    if value is None:
        return "unspecified (unresolved)"
    lo, hi = date_bounds(value)
    precision = {4: "year", 7: "month", 10: "day"}[len(value)]
    return f"{value} ({precision} precision; {lo.isoformat()} through {hi.isoformat()})"


def render_rule(rule: Rule) -> EncodedRuleRendering:
    unresolved = []
    def expression(expr: Expression, path: str, depth=0):
        if depth > 32:
            unresolved.append(path)
            return f"UNRESOLVED [{path}]: expression nesting exceeds evaluator limit"
        if expr.op in {"all", "any"}:
            separator = " AND " if expr.op == "all" else " OR "
            return "(" + separator.join(expression(child, f"{path}/args/{i}", depth + 1)
                                         for i, child in enumerate(expr.args)) + ")"
        if expr.op == "not":
            return "NOT (" + expression(expr.args[0], f"{path}/args/0", depth + 1) + ")"
        if expr.op == "literal":
            return "TRUE" if expr.value else "FALSE"
        if expr.op == "unsupported":
            unresolved.append(path)
            return f"UNSUPPORTED [{path}]: {expr.reason}"
        fact = FACT_DEFINITIONS.get(expr.fact)
        unit = f" [{fact.unit}]" if fact and fact.unit and fact.data_type != "date" else ""
        subject = f"{expr.fact}{unit}"
        if expr.op in {"date_before", "date_on_or_before"}:
            operator = "strictly before (<)" if expr.op == "date_before" else "on or before (<=)"
            return f"{subject} {operator} {_date(str(expr.value))}"
        if expr.op == "age_at_least":
            return f"{subject}: age >= {_value(expr.value)} whole calendar years on the query date (anniversary cutoff; February 29 clips to February 28 when needed)"
        if expr.op == "in":
            return f"{subject} IN {_value(expr.value)}"
        operators = {"eq": "==", "ne": "!=", "lt": "<", "lte": "<=", "gt": ">", "gte": ">="}
        return f"{subject} {operators[expr.op]} {_value(expr.value)}"

    coverage = expression(rule.coverage_conditions, "coverage_conditions")
    exemption = expression(rule.exemption_conditions, "exemption_conditions")
    lines = [f"Encoded rule: {rule.title}", f"Jurisdiction: {rule.jurisdiction} ({rule.level}); category: {rule.category}.",
             f"Requirement: {rule.requirement}", f"Key value: {rule.key_value if rule.key_value is not None else 'unspecified'}.",
             f"Coverage: {coverage}.", f"Exemption: {exemption}.",
             f"Combined property condition: ({coverage}) AND NOT ({exemption})."]
    if rule.exemptions is not None:
        lines.append(f"Recorded exemption description: {rule.exemptions}")
    lines.extend([f"Recorded lifecycle: {rule.lifecycle}; snapshot: {_date(rule.status_as_of)}.",
                  f"Effective boundary (inclusive): {_date(rule.effective_date)}.",
                  f"End boundary (exclusive): {_date(rule.end_date) if rule.end_date else 'none encoded'}."])
    if rule.lifecycle == "unknown": unresolved.append("lifecycle")
    if not rule.status_events and not rule.status_as_of: unresolved.append("status_as_of")
    if rule.lifecycle == "enacted" and not rule.effective_date and not rule.status_as_of:
        unresolved.append("effective_date")
    for i, event in enumerate(rule.status_events):
        lines.append(f"Status event {i + 1}: {event.status} on {_date(event.on)}.")
    for i, interaction in enumerate(rule.interactions):
        scope = expression(interaction.scope, f"interactions/{i}/scope")
        lines.append(f"Interaction {i + 1}: {interaction.kind} {interaction.target_citation} in {interaction.target_jurisdiction}, category {interaction.category}, only within scope {scope}. Note: {interaction.note}")
    if rule.penalties: lines.append(f"Recorded penalties: {rule.penalties}")
    if rule.conflict_flag:
        unresolved.append("conflict_flag")
        lines.append(f"Conflict flagged: {rule.conflict_note or 'authority needs review'}.")
    for i, issue in enumerate(rule.review_issues):
        unresolved.append(f"review_issues/{i}")
        lines.append(f"Unresolved review issue: {issue}")
    lines.append("This displays the encoded rule, not legal validation or a property-specific evaluation. Pending measures do not automatically enact; partial dates may leave uncertainty.")
    # Hash the operative encoding, not volatile IDs, evidence offsets or retrieval time.
    # Include temporal/interaction semantics so a boundary edit cannot hide in a diff.
    encoded = rule.model_dump(mode="json", include={"jurisdiction", "level", "category", "requirement", "key_value",
        "coverage_conditions", "exemption_conditions", "lifecycle", "effective_date", "end_date", "status_as_of"})
    encoded["status_events"] = [{"status": e.status, "on": e.on} for e in rule.status_events]
    encoded["interactions"] = [i.model_dump(mode="json", exclude={"evidence", "note"}) for i in rule.interactions]
    expression_hash = hashlib.sha256(json.dumps(encoded, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    return EncodedRuleRendering(rule_id=rule.team_rule_id, text="\n".join(lines), expression_hash=expression_hash,
        renderer_version=RENDERER_VERSION, unresolved_nodes=unresolved)
