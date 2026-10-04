"""Bounded factual sensitivity analysis using only the production evaluator.

Partitions describe feasible values of ONE fact, never independent predicate truth
assignments. Exhaustive means the supported property domains were fully explored;
it never certifies source coverage or legal correctness. Rank = relevant predicate
count / answer effort (a heuristic, not a probability).
"""
from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import date
from itertools import combinations, product
import json
import math

from . import engine
from .fact_inputs import FACT_DEFINITIONS
from .models import (AlternativeOutcome, AssistContext, Expression, FactDefinition,
                     FactQuestion, QuestionPlan, Uncertainty, date_bounds)

ALGORITHM_VERSION = "correlated-partitions-v1"
PROBE_PROVENANCE = "Hypothetical planner probe; not a known property fact"


def _walk(trace):
    yield trace
    for child in trace.children:
        yield from _walk(child)


@dataclass(frozen=True)
class Cell:
    value: object
    label: str
    interval: dict | None = None


def _domain(definition: FactDefinition, expressions: list[Expression], prop, as_of):
    """Disjoint threshold cells; unsupported domains are explicitly incomplete."""
    kind, field = definition.data_type, definition.field
    if kind == "boolean":
        supported = all(e.op in {"eq", "ne", "in"} and
                        all(type(v) is bool for v in (e.value if e.op == "in" else [e.value]))
                        for e in expressions)
        return [Cell(False, "No (false)"), Cell(True, "Yes (true)")], supported
    if kind == "enum":
        supported = all(e.op in {"eq", "ne", "in"} for e in expressions)
        values = list(dict.fromkeys(definition.allowed_values))
        if len(values) > 16:
            return [], False
        return [Cell(v, v) for v in values], supported and bool(values)
    if kind == "number" and any(e.op == "in" for e in expressions):
        # Membership is type-sensitive (1 versus 1.0) in the shared evaluator.
        return [], False
    if kind not in {"integer", "number", "date"}:
        return [], False
    is_date = kind == "date"
    discrete = kind in {"integer", "date"}
    low = date.min.toordinal() if is_date else definition.minimum
    high = date.max.toordinal() if is_date else definition.maximum
    bound = prop.bounds.get(field)
    if bound and not is_date:
        if bound.lower is not None: low = max(low, bound.lower) if low is not None else bound.lower
        if bound.upper is not None: high = min(high, bound.upper) if high is not None else bound.upper
    if is_date and prop.facts.get(field) is not None:
        try:
            first, last = date_bounds(str(prop.facts[field]))
            low, high = first.toordinal(), last.toordinal()
        except ValueError:
            return [], False
    points, supported = set(), True
    for expr in expressions:
        values = expr.value if expr.op == "in" else [expr.value]
        try:
            if is_date:
                if expr.op == "age_at_least":
                    if type(expr.value) not in (float, int) or int(expr.value) != expr.value:
                        raise ValueError("Unsupported fractional years")
                    year = as_of.year - int(expr.value)
                    points.add(date(year, as_of.month, min(as_of.day, calendar.monthrange(year, as_of.month)[1])).toordinal())
                elif expr.op in {"date_before", "date_on_or_before"}:
                    first, last = date_bounds(str(expr.value))
                    points.update((first.toordinal(), last.toordinal()))
                else:
                    # Generic eq/in compares date strings lexically in the shared evaluator;
                    # do not pretend day partitions cover partial-string equality semantics.
                    supported = False
            elif expr.op in {"lt", "lte", "gt", "gte", "eq", "ne", "in"}:
                if any(type(v) not in (int, float) or not math.isfinite(v) for v in values):
                    raise ValueError("Non-numeric threshold")
                points.update(values)
            else:
                supported = False
        except (ValueError, TypeError, OverflowError):
            supported = False
    if not supported:
        return [], False
    if discrete:
        if low is not None: low = math.ceil(low)
        if high is not None: high = math.floor(high)
    if low is not None and high is not None and low > high:
        return [], False
    points = sorted(p for p in points if (low is None or p >= low) and (high is None or p <= high))
    ranges = []
    previous = low
    left_closed = True
    for point in points:
        ranges.append((previous, point, left_closed, False))
        ranges.append((point, point, True, True))
        previous, left_closed = point, False
    ranges.append((previous, high, left_closed, True))
    cells = []
    for lo, hi, lc, hc in ranges:
        if discrete:
            lo = (math.ceil(lo) if lc else math.floor(lo) + 1) if lo is not None else None
            hi = (math.floor(hi) if hc else math.ceil(hi) - 1) if hi is not None else None
            lc, hc = lo is not None, hi is not None
        if lo is not None and hi is not None and (lo > hi or lo == hi and not (lc and hc)):
            continue
        if lo is not None and lc:
            value = lo
        elif hi is not None and hc:
            value = hi
        elif lo is not None and hi is not None:
            value = lo / 2 + hi / 2
            if not lo < value < hi:
                value = math.nextafter(lo, hi)
                if not lo < value < hi:
                    continue  # No representable float between adjacent endpoints.
        elif lo is not None:
            value = lo + 1 if discrete else math.nextafter(lo, math.inf)
        elif hi is not None:
            value = hi - 1 if discrete else math.nextafter(hi, -math.inf)
        else:
            value = 0
        if not math.isfinite(value):
            return cells, False
        if discrete: value = int(value)
        def shown(v):
            return date.fromordinal(int(v)).isoformat() if is_date and v is not None else v
        interval = {"lower": shown(lo), "upper": shown(hi), "lower_inclusive": lc,
                    "upper_inclusive": hc, "unit": definition.unit,
                    "representative_only": True}
        lower_text = str(shown(lo)) if lo is not None else "unbounded"
        upper_text = str(shown(hi)) if hi is not None else "unbounded"
        label = f"{'[' if lc else '('}{lower_text}, {upper_text}{']' if hc else ')'}"
        cells.append(Cell(shown(value), label, interval))
    return cells, bool(cells)


def _signature(evaluations):
    return tuple((e.team_rule_id, e.result, e.coverage.value, e.conflict_flag,
                  tuple(e.applied_interactions)) for e in evaluations
                 if e.jurisdiction != "false" and e.temporal_status not in {"inapplicable", "failed", "pending", "not_yet_effective"})


def _needs_fact(node, prop):
    if not node.field or node.expression.op == "unsupported":
        return False
    value = prop.facts.get(node.field)
    if value is None:
        return True
    if node.expression.op in {"date_before", "date_on_or_before", "age_at_least"}:
        try:
            lo, hi = date_bounds(str(value))
            return lo != hi
        except ValueError:
            return True
    # A precise supplied fact cannot settle an unsupported comparison by repetition.
    return False


def _uncertainty(context, evaluations, traces, prop=None):
    prop = prop if prop is not None else context.property
    items = []
    def add(kind, message, remedy, rule_ids=(), predicate_ids=(), field=None, source_refs=()):
        items.append(Uncertainty(kind=kind, message=message, remedy=remedy,
            rule_ids=list(rule_ids), predicate_ids=list(predicate_ids), field=field,
            source_refs=list(source_refs)))
    for trace in traces:
        for node in _walk(trace):
            if node.relevant and node.result == "unknown" and not node.children:
                if _needs_fact(node, prop):
                    add("property_fact", f"The factual value or precision of {node.field} remains unresolved",
                        "Supply the documented property fact; partial dates can remain uncertain",
                        [node.rule_id], [node.predicate_id], node.field)
                else:
                    add("interpretation", node.expression.reason or "Encoded comparison or legal threshold precision remains unresolved despite the supplied fact",
                        "Core/legal reviewer must resolve the encoding against source evidence",
                        [node.rule_id], [node.predicate_id])
    # Source/lifecycle limitations belong to the rule, even when a factual answer
    # rules this property out. They must not disappear with a single probe.
    if context.jurisdiction.match_quality != "resolved":
        add("jurisdiction", "Legal location/boundary resolution remains incomplete",
            "Platform must verify location and legal boundaries")
    for rule in context.rules:
        if engine.jurisdiction_match(rule, context.jurisdiction) == "false": continue
        for interaction in rule.interactions:
            if not any(target.team_rule_id != rule.team_rule_id
                       and target.citation.casefold() == interaction.target_citation.casefold()
                       and target.jurisdiction.casefold() == interaction.target_jurisdiction.casefold()
                       and target.category == interaction.category for target in context.rules):
                add("cross_reference", f"Interaction target is not supplied: {interaction.target_citation} in {interaction.target_jurisdiction}",
                    "Platform/Core must retrieve and encode the referenced authority", [rule.team_rule_id])
        for issue in rule.review_issues:
            add("interpretation", f"unresolved_extraction: {issue}",
                "Review the encoded condition, dates or lifecycle against source evidence", [rule.team_rule_id])
        if rule.semantic_verification == "needs_review":
            add("interpretation", "unresolved_extraction: semantic support needs review",
                "Review the encoded condition, dates or lifecycle against source evidence", [rule.team_rule_id])
        if engine.temporal(rule, context.as_of) == "unknown":
            add("interpretation", "temporal_uncertainty: date precision or lifecycle history insufficient",
                "Review the encoded condition, dates or lifecycle against source evidence", [rule.team_rule_id])
        if rule.conflict_flag:
            add("conflict", rule.conflict_note or "Authority conflict remains unresolved",
                "Review source authority; factual answers do not resolve legal conflicts", [rule.team_rule_id])
    for ev in evaluations:
        if ev.result in {"inapplicable", "failed"}: continue
        if ev.jurisdiction == "unknown":
            add("jurisdiction", "Legal jurisdiction is unresolved", "Platform must verify location and legal boundaries", [ev.team_rule_id])
        if ev.conflict_flag:
            add("conflict", "Authority or interaction remains in conflict", "Review authority and interaction evidence; do not ask the user to decide law", [ev.team_rule_id])
        for reason in ev.uncertainty_reasons:
            if reason.startswith(("missing_property_fact:", "insufficient_fact_precision:", "jurisdiction_uncertainty:", "possible_interaction:", "cyclic_interaction:", "conflicting_legal_evidence:")):
                continue
            add("interpretation", reason, "Review the encoded condition, dates or lifecycle against source evidence", [ev.team_rule_id])
    for report in context.evidence_reports:
        for check in report.checks:
            if check.status in {"pass", "supported"}: continue
            kind = ("source_gap" if check.kind in {"source_availability", "source_identity", "quote_presence", "citation_anchor"}
                    else "cross_reference" if check.kind == "dependencies" else "interpretation")
            add(kind, check.message, "Platform/Core must retrieve and verify supporting source evidence", [report.rule_id], source_refs=check.spans)
        if report.context.status != "available":
            add("source_gap", f"Source context is {report.context.status}", "Retrieve missing source context", [report.rule_id])
        for dep in report.context.dependencies:
            if dep.status != "resolved":
                add("cross_reference", f"{dep.reference}: {dep.explanation}", "Resolve the cited source dependency", [report.rule_id], source_refs=[dep.origin])
        if report.semantic_review:
            for decision in report.semantic_review.decisions:
                if decision.status != "supported":
                    add("interpretation", decision.explanation, "Review semantic support against cited source evidence",
                        [report.rule_id], source_refs=decision.spans)
        for issue in report.blocking_issues:
            add("interpretation", issue, "Resolve this evidence review issue before relying on the encoding", [report.rule_id])
    # AssistContext carries rule reports, not a complete jurisdiction/category inventory.
    add("source_gap", "Question analysis does not establish complete source coverage; only supplied rules and evidence reports were considered",
        "Platform must verify the separate source inventory, including missing rules and references")
    unique = {u.model_dump_json(): u for u in items}
    return list(unique.values())


def _traces(context, prop, evaluations):
    results = {e.team_rule_id: e for e in evaluations}
    traces = []
    for rule in sorted(context.rules, key=lambda r: r.team_rule_id):
        current = engine.rule_traces(rule, prop, context.jurisdiction, context.as_of)
        ev = results[rule.team_rule_id]
        for trace in current:
            if trace.path.startswith("interactions/"):
                index = int(trace.path.split('/')[1])
                interaction = rule.interactions[index]
                targets = [r for r in context.rules if r.team_rule_id != rule.team_rule_id and
                           r.citation.casefold() == interaction.target_citation.casefold() and
                           r.jurisdiction.casefold() == interaction.target_jurisdiction.casefold() and
                           r.category == interaction.category]
                if ev.result in {"inapplicable", "failed", "pending", "not_yet_effective"} or not any(
                        results[r.team_rule_id].result not in {"inapplicable", "failed", "pending", "not_yet_effective"} for r in targets):
                    from .predicates import mark_irrelevant
                    mark_irrelevant(trace)
        traces.extend(current)
    return traces


def plan_questions(context: AssistContext) -> QuestionPlan:
    # All objects used by probes, including rules/geography/provenance, are request-local.
    context = context.model_copy(deep=True)
    limits = context.limits
    definitions = {**FACT_DEFINITIONS, **context.fact_definitions}
    actual = engine.evaluate_rules(context.rules, context.property, context.jurisdiction, context.as_of)
    used = 1
    traces = _traces(context, context.property, actual)
    remaining = _uncertainty(context, actual, traces)
    nodes = {}
    for trace in traces:
        for node in _walk(trace):
            if node.relevant and node.result == "unknown" and not node.children and _needs_fact(node, context.property):
                nodes.setdefault(node.field, []).append(node)
    limits_hit = []
    supported = not any(u.kind == "interpretation" for u in remaining)
    def score(field):
        return len(nodes[field]) / definitions[field].answer_effort if field in definitions else 0
    fields = sorted(nodes, key=lambda field: (-score(field), field))
    if len(fields) > limits.max_fields:
        limits_hit.append("max_fields")
        fields = fields[:limits.max_fields]
    domains = {}
    for field in fields:
        expressions = [node.expression for trace in traces for node in _walk(trace)
                       if node.relevant and node.field == field]
        cells, complete = _domain(definitions[field], expressions, context.property, context.as_of) if field in definitions else ([], False)
        if not complete:
            supported = False
            remaining.append(Uncertainty(kind="interpretation", field=field,
                message=f"No exhaustive supported partition for {field}",
                remedy="Platform/Core must supply a supported fact definition or encoded comparison",
                rule_ids=sorted({n.rule_id for n in nodes[field]}), predicate_ids=[n.predicate_id for n in nodes[field]]))
        if cells: domains[field] = cells
    fields = [f for f in fields if f in domains]
    cache = {}
    def probe(values):
        nonlocal used
        key = json.dumps(values, sort_keys=True, separators=(',', ':'))
        if key in cache: return cache[key]
        if used >= limits.max_evaluations:
            if "max_evaluations" not in limits_hit: limits_hit.append("max_evaluations")
            return None
        prop = context.property.model_copy(deep=True)
        for field, value in values.items():
            prop.facts[field] = value
            prop.provenance[field] = PROBE_PROVENANCE
            prop.missing_facts = [f for f in prop.missing_facts if f != field]
        evaluations = engine.evaluate_rules(context.rules, prop, context.jurisdiction, context.as_of)
        used += 1
        cache[key] = (dict(values), evaluations, prop)
        return cache[key]
    singles = {f: [] for f in fields}
    for field in fields:
        for cell in domains[field]:
            result = probe({field: cell.value})
            if result is None: break
            singles[field].append((cell, result))
    if len(fields) > limits.max_joint_fields:
        limits_hit.append("max_joint_fields")
    full_complete = not fields
    for size in range(2, min(len(fields), limits.max_joint_fields) + 1):
        for subset in combinations(fields, size):
            complete = True
            for cells in product(*(domains[f] for f in subset)):
                row = probe({f: c.value for f, c in zip(subset, cells)})
                if row is None:
                    complete = False
                    break
            if size == len(fields):
                full_complete = complete
            if not complete: break
        if "max_evaluations" in limits_hit: break
    if len(fields) == 1:
        full_complete = len(singles[fields[0]]) == len(domains[fields[0]])
    exhaustive = supported and full_complete and not limits_hit
    # Conditional sensitivity: hold every OTHER fact fixed. Never compare unrelated
    # completions as proof that a field matters. Only exhaustive analysis can omit it.
    material = set()
    for field in fields:
        grouped = {}
        for values, evaluations, _ in cache.values():
            if field not in values: continue
            others = json.dumps({f: v for f, v in values.items() if f != field}, sort_keys=True)
            grouped.setdefault(others, set()).add(_signature(evaluations))
        if any(len(signatures) > 1 for signatures in grouped.values()): material.add(field)
    if exhaustive:
        for uncertainty in remaining:
            if uncertainty.kind == "property_fact" and uncertainty.field in fields and uncertainty.field not in material:
                uncertainty.kind = "interpretation"
                uncertainty.message = f"All explored completions of {uncertainty.field} leave the same encoded outcome; evaluator uncertainty remains"
                uncertainty.remedy = "Review the residual encoding or legal threshold; supplying this fact would not change the analyzed outcome"
    questions = []
    for field in fields:
        if exhaustive and field not in material: continue
        references = nodes[field]
        evidence = {e.model_dump_json(): e for n in references for e in n.source_refs}
        alternatives = []
        for index, (cell, (_, evaluations, prop)) in enumerate(singles[field]):
            alternatives.append(AlternativeOutcome(alternative_id=f"q:{field}:alternative:{index}",
                label=f"If {field} is in {cell.label}" if cell.interval else f"If {field}: {cell.label}",
                probe_facts={field: cell.value}, interval=cell.interval, evaluations=evaluations,
                remaining_uncertainty=_uncertainty(context, evaluations, _traces(context, prop, evaluations), prop)))
        fact = definitions[field]
        form = {"boolean": "Answer true or false.", "enum": "Allowed values: " + ", ".join(fact.allowed_values),
                "date": "Answer YYYY-MM-DD" + (", YYYY-MM, or YYYY; partial dates may leave uncertainty." if fact.allow_partial_date else ".")}.get(fact.data_type, f"Answer a {fact.data_type}" + (f" in {fact.unit}." if fact.unit else "."))
        questions.append(FactQuestion(question_id=f"q:{field}", fact=fact,
            prompt=f"{fact.meaning}? {form}",
            why=("Feasible evaluator probes show this fact can change a result or unresolved coverage." if field in material else
                 "This fact remains in a relevant unresolved predicate; bounded exploration has not established whether it changes the outcome.") +
                " Other exemptions, geography or evidence gaps may remain after answering.",
            rule_ids=sorted({n.rule_id for n in references}), predicate_ids=sorted({n.predicate_id for n in references}),
            evidence=list(evidence.values()), alternatives=alternatives, rank_score=score(field),
            ranking_rationale=f"{len(references)} relevant unresolved predicates / answer-effort {fact.answer_effort}; heuristic, not probability"))
    if len(questions) > limits.max_questions:
        questions = questions[:limits.max_questions]
        limits_hit.append("max_questions")
        exhaustive = False
    for limit in limits_hit:
        remaining.append(Uncertainty(kind="analysis_limit", message=f"Analysis reached {limit}",
            remedy="Increase the explicit limit or retain the unexamined uncertainty"))
    if not exhaustive and not limits_hit and not supported:
        remaining.append(Uncertainty(kind="analysis_limit", message="Unsupported analysis prevents exhaustive coverage",
            remedy="Review the unsupported domain or expression"))
    return QuestionPlan(status="complete" if exhaustive else "partial", questions=questions,
        remaining_uncertainty=remaining, traces=traces, limits=limits, evaluations_used=used,
        limits_hit=limits_hit, algorithm_version=ALGORITHM_VERSION, exhaustive=exhaustive)
