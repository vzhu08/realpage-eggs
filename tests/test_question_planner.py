"""Core behavior tests; expectations are agent-authored synthetic cases."""
from datetime import date

import pytest

from navigator.engine import evaluate_coverage, evaluate_rule, rule_traces
from navigator.models import Expression
from navigator.predicates import evaluate_expression, evaluate_with_trace

DAY = date(2026, 11, 15)


def flatten(trace):
    yield trace
    for child in trace.children:
        yield from flatten(child)


@pytest.mark.parametrize('op,known', [('all', False), ('any', True)])
def test_trace_short_circuit_retains_tree_without_residual_questions(prop, op, known):
    expression = Expression(op=op, args=[Expression(op='literal', value=known),
        Expression(op='not', args=[Expression(op='eq', fact='owner_occupied', value=True)])])
    result, trace = evaluate_with_trace(expression, prop, DAY, 'r-test', 'coverage_conditions')
    assert result == evaluate_expression(expression, prop, DAY)
    assert trace.result == result.value and trace.residual is None
    assert trace.children[1].result == 'unknown'
    assert all(not t.relevant and t.residual is None for t in flatten(trace.children[1]))
    assert trace.children[1].children[0].predicate_id == 'r-test:coverage_conditions/args/1/args/0'


def test_trace_stable_paths_residual_and_evidence(rule, prop, resolution):
    prop.facts.pop('units')
    result, traces = evaluate_coverage(rule, prop, DAY)
    assert result == evaluate_rule(rule, prop, resolution, DAY).coverage
    included = traces[0]
    assert included.residual.op == 'all'
    assert [a.fact for a in included.residual.args] == ['units']
    assert included.children[1].source_refs
    prop.facts['units'] = 12
    later = rule_traces(rule, prop, resolution, DAY)[0]
    assert [t.predicate_id for t in flatten(included)] == [t.predicate_id for t in flatten(later)]
    assert later.result == 'true' and later.residual is None


def test_exemption_trace_keeps_original_truth_and_excludes_coverage(rule, prop):
    rule.coverage_conditions = Expression(op='eq', fact='owner_occupied', value=True)
    rule.exemption_conditions = Expression(op='literal', value=True)
    coverage, traces = evaluate_coverage(rule, prop, DAY)
    assert coverage.value == 'false' and coverage.missing_facts == []
    assert traces[1].result == 'true' and not traces[0].relevant


def test_unsupported_trace_stays_explicit(prop):
    expr = Expression(op='unsupported', reason='Unresolved legal definition')
    result, trace = evaluate_with_trace(expr, prop, DAY, 'r-test', 'coverage_conditions')
    assert result.value == 'unknown' and trace.residual == expr
