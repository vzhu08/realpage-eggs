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
from .rule_renderer import rule_reference
from .models import (AlternativeOutcome, AssistContext, Expression, FactDefinition,
                     FactQuestion, QuestionPlan, Uncertainty, date_bounds)

ALGORITHM_VERSION = "correlated-partitions-v3"
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
    # Guard even objects constructed without shared ingress validation. Do not round them into
    # cells, ignore them while clipping, or claim a complete feasible domain.
    if not is_date and any(v is not None and not math.isfinite(v) for v in
            (low, high, bound.lower if bound else None, bound.upper if bound else None)):
        return [], False
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
            # JSON numbers include exact integers, even between adjacent floats.
            # Float-only midpoints can erase a feasible cell above 2**53.
            value = math.floor(lo) + 1
            if not lo < value < hi:
                value = lo / 2 + hi / 2
                if not lo < value < hi:
                    value = math.nextafter(lo, hi)
                    if not lo < value < hi:
                        continue  # Neither an integer nor a float fits this cell.
        elif lo is not None:
            value = math.floor(lo) + 1
        elif hi is not None:
            value = math.ceil(hi) - 1
        else:
            value = 0
        if not math.isfinite(value):
            return cells, False
        if discrete: value = int(value)
        lc, hc = lc and lo is not None, hc and hi is not None
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
    rules = {r.team_rule_id: r for r in context.rules}
    definitions = {**FACT_DEFINITIONS, **context.fact_definitions}
    references = {ident: rule_reference(rule) for ident, rule in rules.items()}
    items = []

    def add(kind, message, remedy, rule_ids=(), predicate_ids=(), field=None, source_refs=()):
        scope = "; ".join(references.get(ident, ident) for ident in rule_ids)
        message = f"As of {context.as_of}: {message}." + (f" Rule: {scope}" if scope else "")
        items.append(Uncertainty(kind=kind, message=message, remedy=remedy,
            rule_ids=list(rule_ids), predicate_ids=list(predicate_ids), field=field,
            source_refs=list(source_refs)))

    def trace_spans(node):
        # Evidence lacks source hashes. Reuse only existing report spans; never
        # manufacture a verified source identity from a quotation or offset.
        return list({span.model_dump_json(): span for report in context.evidence_reports
            if report.rule_id == node.rule_id for check in report.checks for span in check.spans
            if any(e.doc_id == span.doc_id and e.quote == span.text and
                   (e.start is None or e.start == span.start) for e in node.source_refs)}.values())

    for trace in traces:
        for node in _walk(trace):
            if node.relevant and node.result == "unknown" and not node.children:
                role = ("exemption" if node.path.startswith("exemption_conditions") else
                        "interaction scope" if node.path.startswith("interactions/") else "coverage condition")
                if _needs_fact(node, prop) and node.field in definitions:
                    definition = definitions.get(node.field)
                    meaning = definition.meaning if definition else node.field
                    existing = prop.facts.get(node.field)
                    precision = f"; supplied value {existing!r} does not settle this boundary" if existing is not None else ""
                    add("property_fact", f"Missing fact or precision: {meaning}{precision}. The {role} remains unresolved, so this branch cannot yet establish applicability",
                        f"Factual answer: supply documented {meaning} ({node.field})" +
                        (" with the recorded date precision; do not substitute construction year" if definition and definition.data_type == "date" else "") +
                        ". Answers apply to this request; other exemptions and source issues may remain",
                        [node.rule_id], [node.predicate_id], node.field, trace_spans(node))
                else:
                    reason = (f"No supported factual input is defined for {node.field}; it may require legal classification or a shared fact definition"
                              if node.field and node.field not in definitions else
                              node.expression.reason or "Encoded comparison or legal threshold precision remains unresolved despite the supplied fact")
                    add("interpretation", reason +
                        f"; the {role} cannot be decided from the available encoding",
                        "Interpretation review: resolve this condition against the cited authority; repeating a property answer cannot repair a legal definition",
                        [node.rule_id], [node.predicate_id], source_refs=trace_spans(node))
    if context.jurisdiction.match_quality != "resolved":
        add("jurisdiction", "Legal location/boundary resolution remains incomplete; local-rule applicability may change. " +
            "; ".join(context.jurisdiction.unresolved),
            "Geography evidence: verify the property's legal municipality and boundary with Platform; postal city is not sufficient")
    # Source/lifecycle gaps survive even a property answer that rules a branch out.
    for rule in context.rules:
        if engine.jurisdiction_match(rule, context.jurisdiction) == "false":
            continue
        for interaction in rule.interactions:
            if not any(target.team_rule_id != rule.team_rule_id
                       and target.citation.casefold() == interaction.target_citation.casefold()
                       and target.jurisdiction.casefold() == interaction.target_jurisdiction.casefold()
                       and target.category == interaction.category for target in context.rules):
                add("cross_reference", f"Interaction target is not supplied: {interaction.target_citation} in {interaction.target_jurisdiction}; priority or an exception may change the outcome",
                    "Source acquisition: retrieve and encode the referenced authority with Platform/Core A before deciding the interaction", [rule.team_rule_id])
        for issue in rule.review_issues:
            # Structured evidence checks below already carry the specific remedy.
            if issue.startswith("evidence_check:") and any(
                    r.rule_id == rule.team_rule_id and issue.removeprefix("evidence_check:") in r.blocking_issues
                    for r in context.evidence_reports):
                continue
            add("interpretation", f"unresolved_extraction: {issue}; the encoded result may lack legal support",
                "Interpretation review: check the encoded condition, dates or lifecycle against the cited source evidence", [rule.team_rule_id])
        if rule.semantic_verification == "needs_review":
            add("interpretation", "unresolved_extraction: semantic support needs review; quotation presence alone cannot validate this result",
                "Interpretation review: check the encoded meaning against the authority and record the reviewer and source version", [rule.team_rule_id])
        if engine.temporal(rule, context.as_of) == "unknown":
            add("interpretation", f"temporal_uncertainty: lifecycle/date evidence cannot establish operative status; effective={rule.effective_date or 'unspecified'}, end={rule.end_date or 'unspecified'}, snapshot={rule.status_as_of or 'unspecified'}",
                "Interpretation review: establish adoption, effectiveness and any repeal from dated source evidence; retain partial-date precision and do not use retrieval time as enactment", [rule.team_rule_id])
        if rule.conflict_flag:
            add("conflict", (rule.conflict_note or "Authority conflict remains unresolved") + "; the encoded result cannot establish which authority controls",
                "Interpretation review: compare both authorities and their dated support; factual answers do not resolve legal conflicts", [rule.team_rule_id])
    for ev in evaluations:
        if ev.result in {"inapplicable", "failed"}:
            continue
        if ev.jurisdiction == "unknown":
            add("jurisdiction", "Legal jurisdiction is unresolved; this rule's geographic applicability is unknown",
                "Geography evidence: verify location and legal boundaries with Platform", [ev.team_rule_id])
        if ev.conflict_flag:
            reasons = [r for r in ev.uncertainty_reasons if r.startswith(("conflicting_legal_evidence:", "cyclic_interaction:", "possible_interaction:"))]
            add("conflict", "; ".join(reasons) or "Core reports an authority or interaction conflict; precedence is unresolved",
                "Interpretation review: compare authority/version and interaction evidence; do not ask the user to decide law", [ev.team_rule_id])
        for reason in ev.uncertainty_reasons:
            if reason.startswith(("missing_property_fact:", "insufficient_fact_precision:", "jurisdiction_uncertainty:", "conflicting_legal_evidence:")):
                continue
            add("interpretation", reason + "; Core retains an unresolved result",
                "Interpretation review: resolve this Core reason against the encoded conditions and cited authority", [ev.team_rule_id])
    for report in context.evidence_reports:
        for check in report.checks:
            if check.status in {"pass", "supported"}:
                continue
            if check.kind in {"source_availability", "source_identity", "quote_presence", "citation_anchor"}:
                kind = "source_gap"
                remedy = "Source acquisition: retrieve or reconcile the original source version, URL and exact quotation anchors with Platform; property answers cannot repair source support"
            elif check.kind == "dependencies":
                kind = "cross_reference"
                remedy = "Source/context review: resolve the referenced authority or the reported context limits before relying on coverage"
            else:
                kind = "interpretation"
                remedy = "Interpretation review: compare the encoded field with the cited source version; quote matching alone does not establish semantic support"
            add(kind, f"{check.kind} ({check.status}): {check.message}; support for the encoded result is unresolved",
                remedy, [report.rule_id], field=check.field, source_refs=check.spans)
        if report.context.status != "available":
            bounded = bool(report.context.limits_hit)
            add("analysis_limit" if bounded else "source_gap",
                f"Source context is {report.context.status}; omitted text or references may affect this result",
                ("More analysis: increase the bounded source-context limits (" + ", ".join(report.context.limits_hit) + ") and recheck references" if bounded else
                 "Source acquisition: retrieve missing original context with Platform before relying on this result"), [report.rule_id])
        for dep in report.context.dependencies:
            if dep.status != "resolved":
                bounded = dep.status in {"depth_limit", "budget_limit"}
                add("analysis_limit" if bounded else "cross_reference",
                    f"{dep.reference} ({dep.status}): {dep.explanation}; the referenced condition or exception may change the outcome",
                    "More analysis: expand the source-context budget for this reference" if bounded else
                    "Source acquisition/review: resolve this cited dependency while preserving its original support", [report.rule_id], source_refs=[dep.origin])
        if report.semantic_review:
            for decision in report.semantic_review.decisions:
                if decision.status != "supported":
                    add("interpretation", f"{decision.field} ({decision.status}): {decision.explanation}; meaning remains disputed or unsupported",
                        "Interpretation review: resolve semantic support against the cited source evidence", [report.rule_id], field=decision.field, source_refs=decision.spans)
        for issue in report.blocking_issues:
            # Keep diagnostics, classified by their actual origin rather than
            # asking for another property fact to fix law or a context budget.
            bounded = issue.startswith("context_incomplete:")
            source = issue.startswith(("missing_source:", "source_identity_mismatch:", "primary_quote_absent", "supporting_quote_absent:", "no_supporting_evidence", "extraction_source_version_stale"))
            kind = "analysis_limit" if bounded else "source_gap" if source else "cross_reference" if issue.startswith("cross_reference:") else "interpretation"
            remedy = {"analysis_limit": "More analysis: expand bounded source context and recheck the result",
                      "source_gap": "Source acquisition: restore or reconcile the exact supporting source version and anchors",
                      "cross_reference": "Source acquisition/review: resolve the cited dependency",
                      "interpretation": "Interpretation review: resolve this evidence issue before relying on the encoding"}[kind]
            add(kind, f"{issue}; evidence support for this result remains unresolved", remedy, [report.rule_id])
    add("source_gap", "Question analysis does not establish complete source coverage; only supplied rules and evidence reports were considered, so omitted law may change the result",
        "Source acquisition/inventory review: Platform must verify the separate source inventory, including missing rules and references")
    return list({u.model_dump_json(): u for u in items}.values())


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
                message=f"As of {context.as_of}: no exhaustive supported partition for {field}; sensitivity to this fact is not established",
                remedy="More analysis/encoding review: Platform/Core must supply a supported fact definition or encoded comparison",
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
                uncertainty.message += f" All explored completions of {uncertainty.field} leave the same encoded outcome; evaluator uncertainty remains"
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
                f" As of {context.as_of}; affects " + "; ".join(rule_reference(r) for r in context.rules if r.team_rule_id in {n.rule_id for n in references}) +
                ". Other exemptions, geography or evidence gaps may remain after answering. Alternatives are hypothetical, not verified property facts.",
            rule_ids=sorted({n.rule_id for n in references}), predicate_ids=sorted({n.predicate_id for n in references}),
            evidence=list(evidence.values()), alternatives=alternatives, rank_score=score(field),
            ranking_rationale=f"{len(references)} relevant unresolved predicates / answer-effort {fact.answer_effort}; heuristic, not probability"))
    if len(questions) > limits.max_questions:
        questions = questions[:limits.max_questions]
        limits_hit.append("max_questions")
        exhaustive = False
    analysis_uncertainty = []
    for limit in limits_hit:
        analysis_uncertainty.append(Uncertainty(kind="analysis_limit", message=f"As of {context.as_of}: analysis reached {limit}={getattr(limits, limit)}; unexamined combinations or questions may change the result",
            remedy="More analysis: increase this explicit limit within the API ceiling, or narrow the analysis; retain unexamined uncertainty"))
    if not exhaustive and not limits_hit and not supported:
        analysis_uncertainty.append(Uncertainty(kind="analysis_limit", message=f"As of {context.as_of}: unsupported analysis prevents exhaustive coverage; unexamined values may change the result",
            remedy="More analysis/interpretation review: resolve the unsupported domain or expression"))
    remaining.extend(analysis_uncertainty)
    for question in questions:
        for alternative in question.alternatives:
            alternative.remaining_uncertainty.extend(u.model_copy(deep=True) for u in analysis_uncertainty)
    return QuestionPlan(status="complete" if exhaustive else "partial", questions=questions,
        remaining_uncertainty=remaining, traces=traces, limits=limits, evaluations_used=used,
        limits_hit=limits_hit, algorithm_version=ALGORITHM_VERSION, exhaustive=exhaustive)
