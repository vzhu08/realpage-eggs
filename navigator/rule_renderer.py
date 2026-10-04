"""Deterministic display of an encoding, never a model paraphrase or legal review."""
import hashlib
import json

from .fact_inputs import FACT_DEFINITIONS
from .models import ChangeResult, EncodedRuleRendering, Evaluation, Expression, Rule, date_bounds

RENDERER_VERSION = "encoded-rule-v3"


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
            # Guard non-finite values even when ingress validation was bypassed.
            if not 0 <= expr.value <= 9998 or int(expr.value) != expr.value:
                unresolved.append(path)
                return f"UNSUPPORTED [{path}]: age_at_least {_value(expr.value)} cannot be evaluated as whole calendar years within supported dates"
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
    if rule.lifecycle == "enacted" and not rule.effective_date:
        unresolved.append("effective_date")
        lines.append("Next action — source review: establish the effective date from the authority; a lifecycle snapshot does not establish effectiveness.")
    lines.extend(_evidence_lines(rule.evidence, "Rule evidence"))
    for i, event in enumerate(rule.status_events):
        lines.append(f"Status event {i + 1}: {event.status} on {_date(event.on)}.")
        lines.extend(_evidence_lines(event.evidence, f"Status event {i + 1} evidence"))
    for i, interaction in enumerate(rule.interactions):
        scope = expression(interaction.scope, f"interactions/{i}/scope")
        lines.append(f"Interaction {i + 1}: {interaction.kind} {interaction.target_citation} in {interaction.target_jurisdiction}, category {interaction.category}, only within scope {scope}. Note: {interaction.note}")
        lines.extend(_evidence_lines(interaction.evidence, f"Interaction {i + 1} evidence"))
    if rule.penalties: lines.append(f"Recorded penalties: {rule.penalties}")
    if rule.conflict_flag:
        unresolved.append("conflict_flag")
        lines.append(f"Conflict flagged: {rule.conflict_note or 'authority needs review'}.")
        lines.append("Next action — interpretation review: compare the conflicting authorities and their dated evidence. Property answers and retrieval order cannot select a legal winner.")
    for i, issue in enumerate(rule.review_issues):
        unresolved.append(f"review_issues/{i}")
        lines.append(f"Unresolved review issue: {issue}")
    if rule.review_issues or rule.semantic_verification == "needs_review":
        lines.append("Next action — interpretation review: check unresolved conditions and lifecycle against the cited source spans before relying on this encoding.")
    lines.append("This displays the encoded rule, not legal validation or a property-specific evaluation. Pending measures do not automatically enact; partial dates may leave uncertainty.")
    expression_hash = encoding_hash(rule)
    lines.insert(1, f"Rule reference: {rule_reference(rule)}")
    return EncodedRuleRendering(rule_id=rule.team_rule_id, text="\n".join(lines), expression_hash=expression_hash,
        renderer_version=RENDERER_VERSION, unresolved_nodes=unresolved)


def encoding_hash(rule: Rule) -> str:
    # Hash the operative encoding, not volatile IDs, evidence offsets or retrieval time.
    # Include temporal/interaction semantics so a boundary edit cannot hide in a diff.
    encoded = rule.model_dump(mode="json", include={"jurisdiction", "level", "category", "requirement", "key_value",
        "coverage_conditions", "exemption_conditions", "lifecycle", "effective_date", "end_date", "status_as_of"})
    encoded["status_events"] = [{"status": e.status, "on": e.on} for e in rule.status_events]
    encoded["interactions"] = [i.model_dump(mode="json", exclude={"evidence", "note"}) for i in rule.interactions]
    expression_hash = hashlib.sha256(json.dumps(encoded, sort_keys=True, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    return expression_hash


def rule_reference(rule: Rule) -> str:
    """An encoding version is not a source snapshot hash or an enactment date."""
    return (f"{rule.title} [{rule.team_rule_id}; encoding {encoding_hash(rule)}]; "
            f"{rule.citation}; source {rule.source_doc_id}: {rule.source_url}")


def _evidence_lines(evidence, label):
    for item in evidence:
        location = (f"[{item.start}, {item.end})" if item.start is not None and item.end is not None
                    else "offsets unspecified")
        yield (f"{label}: {item.doc_id} {location}; recorded support: {', '.join(item.supports)}. "
               f"Exact recorded quote: {item.quote}")


def render_evaluation(evaluation: Evaluation, rule: Rule, as_of) -> str:
    """Present a Core-produced result without recomputing or modifying truth."""
    if evaluation.team_rule_id != rule.team_rule_id:
        raise ValueError("Evaluation and rule identifiers must match")
    lines = [f"As of {as_of}: {rule_reference(rule)}",
             f"Core result: {evaluation.result}; coverage: {evaluation.coverage.value}; "
             f"temporal status: {evaluation.temporal_status}.", evaluation.explanation]
    lines.extend(f"Remaining uncertainty: {reason}" for reason in evaluation.uncertainty_reasons)
    if evaluation.conflict_flag:
        lines.append("Next action — interpretation review: compare the cited competing authorities; this result does not establish precedence.")
    lines.extend(_evidence_lines(evaluation.evidence, "Evaluation evidence"))
    return "\n".join(lines)


def render_change(change: ChangeResult, rules: list[Rule]) -> str:
    """Render existing Core change outputs. Platform may wire this pure helper.

    The current differences payload is untyped: reject unfamiliar entries visibly,
    rather than deriving impacts or assuming an undocumented future contract.
    """
    by_id = {rule.team_rule_id: rule for rule in rules}
    lines = [f"Core comparison: {change.before} → {change.after}; {change.scenario}; {change.status}.",
             f"Reported properties: {len(change.affected_address_ids)} definitely affected; "
             f"{len(change.uncertain_address_ids)} uncertain; {len(change.conflict_flag_address_ids)} with conflicts. "
             "These lists can overlap."]
    if change.scenario == "if_enacted":
        lines.append("Hypothetical enactment only; stored law is unchanged.")
    if change.status != "complete":
        lines.append("Unresolved comparison: the reported counts do not establish zero impact outside the supplied evidence.")
    for address_id, deltas in sorted(change.differences.items()):
        lines.append(f"Property {address_id}:")
        if not isinstance(deltas, list):
            lines.append("Unresolved change detail: unsupported payload; request the shared Platform contract.")
            continue
        for delta in deltas:
            try:
                ident = delta["team_rule_id"]
                rule = by_id[ident]
                certainty = delta["certainty"]
                if certainty not in {"definite", "uncertain"}:
                    raise ValueError("Unsupported certainty")
                before = Evaluation.model_validate(delta["before"]) if delta["before"] is not None else None
                after = Evaluation.model_validate(delta["after"])
                if after.team_rule_id != ident or before is not None and before.team_rule_id != ident:
                    raise ValueError("Mismatched rule")
            except (KeyError, TypeError, ValueError):
                lines.append("Unresolved change detail: missing rule version or unsupported payload; request the matching Core result and Platform contract.")
                continue
            lines.append(f"Reported impact: {certainty}.")
            lines.append(render_evaluation(before, rule, change.before) if before else
                         "Before: no baseline evaluation supplied by Core for this comparison.")
            lines.append(render_evaluation(after, rule, change.after))
            lines.append(f"Encoded effective boundary (inclusive): {_date(rule.effective_date)}; "
                         f"end boundary (exclusive): {_date(rule.end_date) if rule.end_date else 'none encoded'}.")
    lines.extend(f"Core note: {note}" for note in change.notes)
    if change.status == "blocked":
        lines.append("Next action — source acquisition: resolve the Core notes and rerun the comparison on a recorded snapshot.")
    lines.append(change.disclaimer)
    return "\n".join(lines)
