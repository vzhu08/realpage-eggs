"""Safe, three-valued evaluation. No executable model-generated code."""
import calendar
from datetime import date
from math import inf

from .models import Evidence, Expression, PredicateResult, PredicateTrace, PropertyFacts, date_bounds


def combine(op: str, results: list[PredicateResult]) -> PredicateResult:
    values = [r.value for r in results]
    decisive = "false" if op == "all" else "true"
    opposite = "true" if op == "all" else "false"
    value = decisive if decisive in values else "unknown" if "unknown" in values else opposite
    # Unknown branches cannot change a decisive result; do not ask for irrelevant facts.
    relevant = [r for r in results if r.value == decisive] if decisive in values else results
    return PredicateResult(value=value, matched=sorted({m for r in relevant for m in r.matched}),
                           unresolved=sorted({m for r in relevant for m in r.unresolved}) if value == "unknown" else [],
                           missing_facts=sorted({m for r in relevant for m in r.missing_facts}) if value == "unknown" else [],
                           supporting_facts={k: v for r in relevant for k, v in r.supporting_facts.items()})


def compare_interval(low, high, op, threshold):
    if op == "lt": return "true" if high < threshold else "false" if low >= threshold else "unknown"
    if op == "lte": return "true" if high <= threshold else "false" if low > threshold else "unknown"
    if op == "gt": return "true" if low > threshold else "false" if high <= threshold else "unknown"
    if op == "gte": return "true" if low >= threshold else "false" if high < threshold else "unknown"
    if op == "eq": return "true" if low == high == threshold else "false" if threshold < low or threshold > high else "unknown"
    if op == "ne":
        return {"true": "false", "false": "true", "unknown": "unknown"}[compare_interval(low, high, "eq", threshold)]
    return "unknown"


def mark_irrelevant(trace: PredicateTrace) -> None:
    """Keep the audit tree, but remove uncertainty that cannot affect its parent."""
    trace.relevant = False
    trace.residual = None
    for child in trace.children:
        mark_irrelevant(child)


def evaluate_with_trace(expr: Expression, prop: PropertyFacts, as_of: date,
                        rule_id: str, path: str, evidence: list[Evidence] = (), depth=0):
    """One semantic traversal for both the public result and the canonical trace."""
    children = []
    if depth > 32:
        result = PredicateResult(value="unknown", unresolved=["unsupported_condition: expression nesting exceeds limit"])
    elif expr.op in {"all", "any", "not"}:
        evaluated = [evaluate_with_trace(a, prop, as_of, rule_id, f"{path}/args/{i}", evidence, depth + 1)
                     for i, a in enumerate(expr.args)]
        results, children = [r for r, _ in evaluated], [t for _, t in evaluated]
        if expr.op == "not":
            result = results[0].model_copy(deep=True)
            result.value = {"true": "false", "false": "true", "unknown": "unknown"}[result.value]
        else:
            result = combine(expr.op, results)
            decisive = "false" if expr.op == "all" else "true"
            if result.value == decisive:
                for child in children:
                    if child.result != decisive:
                        mark_irrelevant(child)
    else:
        result = _evaluate_leaf(expr, prop, as_of)
    residual = None
    if result.value == "unknown":
        if children:
            residual = Expression(op=expr.op, args=[c.residual.model_copy(deep=True)
                                                   for c in children if c.residual is not None])
        else:
            residual = expr.model_copy(deep=True)
    refs = [e.model_copy(deep=True) for e in evidence if any(
        path == support or path.startswith(support + "/") or support.startswith(path + "/")
        for support in e.supports)]
    trace = PredicateTrace(predicate_id=f"{rule_id}:{path}", rule_id=rule_id, path=path,
                           expression=expr.model_copy(deep=True), result=result.value, field=expr.fact,
                           residual=residual, source_refs=refs, children=children)
    return result, trace


def evaluate_expression(expr: Expression, prop: PropertyFacts, as_of: date, depth=0) -> PredicateResult:
    return evaluate_with_trace(expr, prop, as_of, "", "expression", depth=depth)[0]


def _evaluate_leaf(expr: Expression, prop: PropertyFacts, as_of: date) -> PredicateResult:
    if expr.op == "literal":
        return PredicateResult(value="true" if expr.value else "false", matched=[f"literal {expr.value}"])
    if expr.op == "unsupported":
        return PredicateResult(value="unknown", unresolved=[f"unsupported_condition: {expr.reason}"])
    if expr.op == "in" and not expr.value:
        return PredicateResult(value="false", matched=["Membership set is empty"])
    fact = expr.fact
    value = prop.facts.get(fact)
    bound = prop.bounds.get(fact)
    provenance = prop.provenance.get(fact, "not supplied")
    # Construction year is a distinct fact, never evidence of actual occupancy.
    if value is None and bound is None:
        return PredicateResult(value="unknown", unresolved=[f"missing_property_fact: {fact}"], missing_facts=[fact])
    support = {fact: {"value": value, "bound": bound.model_dump() if bound else None, "provenance": bound.provenance if bound else provenance}}
    try:
        if expr.op in {"date_before", "date_on_or_before", "age_at_least"}:
            low, high = date_bounds(str(value))
            if expr.op == "age_at_least":
                if int(expr.value) != expr.value:
                    raise ValueError("fractional years are unsupported")
                target_year = as_of.year - int(expr.value)
                cutoff = date(target_year, as_of.month, min(as_of.day, calendar.monthrange(target_year, as_of.month)[1]))
                result = compare_interval(low, high, "lte", cutoff)
            else:
                c_low, c_high = date_bounds(str(expr.value))
                op = "lt" if expr.op == "date_before" else "lte"
                left = compare_interval(low, high, op, c_low)
                right = compare_interval(low, high, op, c_high)
                result = left if left == right else "unknown"
        elif expr.op == "in":
            if bound and value is None:
                results = [compare_interval(bound.lower if bound.lower is not None else -inf, bound.upper if bound.upper is not None else inf, "eq", v) for v in expr.value]
                result = "true" if "true" in results else "unknown" if "unknown" in results else "false"
            else:
                result = "true" if any(type(value) is type(v) and value == v for v in expr.value) else "false"
        elif bound and value is None:
            if type(expr.value) not in (int, float):
                raise TypeError("Numeric bounds require a numeric comparison value")
            result = compare_interval(bound.lower if bound.lower is not None else -inf, bound.upper if bound.upper is not None else inf, expr.op, expr.value)
        else:
            # Python would equate True with 1. Legal facts must not do so accidentally.
            if isinstance(value, bool) != isinstance(expr.value, bool):
                raise TypeError("incompatible fact type")
            result = compare_interval(value, value, expr.op, expr.value)
    except (ValueError, TypeError, OverflowError):
        return PredicateResult(value="unknown", unresolved=[f"unsupported_or_invalid_fact: {fact}"], missing_facts=[fact], supporting_facts=support)
    label = f"{fact} {expr.op} {expr.value}: {result}"
    return PredicateResult(value=result, matched=[label] if result != "unknown" else [], unresolved=[f"insufficient_fact_precision: {label}"] if result == "unknown" else [], missing_facts=[fact] if result == "unknown" else [], supporting_facts=support)
