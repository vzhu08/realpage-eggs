"""Core A producer regressions; the consumer's planner tests remain Core B-owned."""
from datetime import date

import pytest

from navigator.engine import evaluate_rule, rule_traces
from navigator.models import Expression, Interaction


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
