"""Core A producer regressions; the consumer's planner tests remain Core B-owned."""
from datetime import date

import pytest

from navigator.engine import evaluate_rule, rule_traces
from navigator.models import Bound, Evidence, Expression, Interaction
from navigator.predicates import evaluate_expression, evaluate_with_trace


DAY = date(2026, 11, 15)


def scope_rule(rule):
    evidence = rule.evidence[0].model_copy(update={"supports": ["interactions/0/scope"]}, deep=True)
    rule.interactions = [Interaction(
        kind="supersedes", target_citation="Synthetic target", target_jurisdiction="CA",
        category=rule.category, scope=Expression(op="all", args=[
            Expression(op="eq", fact="owner_occupied", value=True),
            Expression(op="literal", value=True),
        ]), evidence=[evidence], note="Synthetic producer-boundary regression",
    )]


@pytest.mark.parametrize("reason", [
    "jurisdiction", "failed", "pending", "future", "coverage_false", "exempt",
])
def test_inactive_source_cannot_expose_relevant_interaction_scope(rule, prop, resolution, reason):
    scope_rule(rule)
    if reason == "jurisdiction":
        resolution.state = "NY"
    elif reason in {"failed", "pending"}:
        rule.lifecycle, rule.status_as_of, rule.status_events = reason, "2026-01-01", []
    elif reason == "future":
        rule.effective_date = "2026-12-01"
    elif reason == "coverage_false":
        rule.coverage_conditions = Expression(op="literal", value=False)
    elif reason == "exempt":
        rule.exemption_conditions = Expression(op="literal", value=True)
    assert evaluate_rule(rule, prop, resolution, DAY).result in {
        "inapplicable", "failed", "pending", "not_yet_effective",
    }
    before = rule.model_dump()
    scope = rule_traces(rule, prop, resolution, DAY)[2]
    assert scope.result == "unknown"  # Original expression truth remains available for audit.
    assert scope.path == "interactions/0/scope" and scope.source_refs
    assert not scope.relevant and scope.residual is None
    assert all(not child.relevant and child.residual is None for child in scope.children)
    assert rule.model_dump() == before


def test_possible_source_retains_scope_uncertainty_and_stable_paths(rule, prop, resolution):
    scope_rule(rule)
    resolution.municipality, resolution.match_quality = None, "unresolved"
    unknown = rule_traces(rule, prop, resolution, DAY)[2]
    assert unknown.relevant and unknown.residual.args[0].fact == "owner_occupied"
    prop.facts["owner_occupied"] = True
    known = rule_traces(rule, prop, resolution, DAY)[2]
    assert known.result == "true" and known.residual is None
    assert [child.predicate_id for child in unknown.children] == [child.predicate_id for child in known.children]


@pytest.mark.parametrize("facts,bounds", [
    ({"units": 6, "owner_occupied": False, "first_occupancy_date": "1978-10-01"}, {}),
    ({"first_occupancy_date": "1978"}, {"units": Bound(lower=2, upper=8, provenance="Synthetic bound")}),
    ({"units": True, "first_occupancy_date": "invalid", "owner_occupied": None}, {}),
])
def test_result_only_matches_complete_traced_results_for_nested_precision_and_types(prop, facts, bounds):
    prop.facts, prop.bounds = facts, bounds
    leaves = [Expression(op=op, fact="units", value=6) for op in ("eq", "ne", "lt", "lte", "gt", "gte")]
    leaves += [Expression(op="in", fact="units", value=[2, 6]),
               Expression(op="in", fact="owner_type", value=[]),
               Expression(op="eq", fact="owner_occupied", value=True),
               Expression(op="unsupported", reason="Synthetic unresolved interpretation"),
               Expression(op="literal", value=True), Expression(op="literal", value=False)]
    leaves += [Expression(op=op, fact="first_occupancy_date", value="1978-10-01")
               for op in ("date_before", "date_on_or_before")]
    leaves += [Expression(op="age_at_least", fact="first_occupancy_date", value=age) for age in (10, 10.5)]
    for leaf in leaves:
        expressions = [leaf, Expression(op="not", args=[leaf])]
        expressions += [Expression(op=op, args=[leaf, Expression(op="eq", fact="absent", value=True)])
                        for op in ("all", "any")]
        for expr in expressions:
            expected, _ = evaluate_with_trace(expr, prop, DAY, "synthetic", "coverage_conditions")
            assert evaluate_expression(expr, prop, DAY).model_dump() == expected.model_dump()


@pytest.mark.parametrize("op,decisive", [("all", "false"), ("any", "true")])
def test_result_only_preserves_every_decisive_siblings_support(prop, op, decisive):
    prop.facts.update(units=6, owner_occupied=False)
    expr = Expression(op=op, args=[
        Expression(op="eq", fact="units", value=0 if op == "all" else 6),
        Expression(op="eq", fact="owner_occupied", value=op == "all"),
        Expression(op="eq", fact="absent", value=True),
    ])
    result = evaluate_expression(expr, prop, DAY)
    assert result.value == decisive and len(result.matched) == 2
    assert set(result.supporting_facts) == {"units", "owner_occupied"}
    assert not result.missing_facts and not result.unresolved


def test_result_only_keeps_depth_limit(prop):
    expr = Expression(op="literal", value=True)
    for _ in range(34):
        expr = Expression(op="not", args=[expr])
    result = evaluate_expression(expr, prop, DAY)
    expected, _ = evaluate_with_trace(expr, prop, DAY, "synthetic", "coverage_conditions")
    assert result == expected and result.value == "unknown"
    assert result.unresolved == ["unsupported_condition: expression nesting exceeds limit"]


def test_result_only_rule_and_interaction_evaluation_allocates_no_audit_tree(rule, prop, resolution, monkeypatch):
    from navigator import predicates
    from navigator.engine import evaluate_rules

    scope_rule(rule)
    expected = evaluate_rules([rule], prop, resolution, DAY)

    def discarded_audit(*args, **kwargs):
        pytest.fail("Result-only evaluation allocated a discarded audit model")

    monkeypatch.setattr(predicates, "PredicateTrace", discarded_audit)
    monkeypatch.setattr(Expression, "model_copy", discarded_audit)
    monkeypatch.setattr(Evidence, "model_copy", discarded_audit)
    assert evaluate_rules([rule], prop, resolution, DAY) == expected


def test_returned_trace_copies_remain_isolated_from_inputs_siblings_and_other_calls(rule, prop):
    expr = Expression(op="all", args=[
        Expression(op="eq", fact="missing_owner", value=True),
        Expression(op="unsupported", reason="Synthetic unresolved interpretation"),
    ])
    evidence = rule.evidence
    original = expr.model_dump(), [item.model_dump() for item in evidence], prop.model_dump()
    _, first = evaluate_with_trace(expr, prop, DAY, "synthetic", "coverage_conditions", evidence)
    _, second = evaluate_with_trace(expr, prop, DAY, "synthetic", "coverage_conditions", evidence)
    expected = second.model_dump()
    assert first.residual is not None and first.source_refs
    first.expression.args[0].value = False
    first.children[0].expression.fact = "changed_child"
    first.residual.args[0].fact = "changed_residual"
    first.source_refs[0].supports.append("changed_support")
    assert first.expression.args[0].fact == "missing_owner"
    assert second.model_dump() == expected
    assert original == (expr.model_dump(), [item.model_dump() for item in evidence], prop.model_dump())
    _, repeated = evaluate_with_trace(expr, prop, DAY, "synthetic", "coverage_conditions", evidence)
    assert repeated.model_dump() == expected
