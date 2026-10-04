"""Core behavior tests; expectations are agent-authored synthetic cases."""
from datetime import date
import math

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

from pathlib import Path
import json

from navigator import engine
from navigator.core_assist import plan_questions
from navigator.fact_inputs import FACT_DEFINITIONS
from navigator.models import (AnalysisLimits, AssistContext, AssistResponse, Bound, EvidenceCheck,
                              EvidenceReport, FactDefinition, Interaction, SourceContext)
from navigator.question_planner import PROBE_PROVENANCE


def context_for(rule, prop, resolution, **limits):
    return AssistContext(property=prop, jurisdiction=resolution, as_of=DAY, rules=[rule],
        evaluations=[], evidence_reports=[], fact_definitions=FACT_DEFINITIONS,
        limits=AnalysisLimits(**limits))


def question(plan, field):
    return next(q for q in plan.questions if q.fact.field == field)


def test_decisive_fact_and_irrelevant_missing_fact(rule, prop, resolution):
    prop.facts.pop('units')
    ctx = context_for(rule, prop, resolution)
    plan = plan_questions(ctx)
    assert [q.fact.field for q in plan.questions] == ['units']
    assert plan.exhaustive and plan.status == 'complete'
    assert {a.evaluations[0].result for a in plan.questions[0].alternatives} == {'applies', 'inapplicable'}
    prop.facts['residential'] = False
    assert plan_questions(context_for(rule, prop, resolution)).questions == []


def test_occupancy_answer_does_not_settle_two_unknown_exemptions(rule, prop, resolution):
    rule.coverage_conditions = Expression(op='all', args=[Expression(op='gte', fact='units', value=4),
        Expression(op='date_on_or_before', fact='certificate_of_occupancy', value='2020-06-30')])
    rule.exemption_conditions = Expression(op='any', args=[Expression(op='eq', fact=f, value=True)
        for f in ('owner_occupied', 'exemption_filed')])
    prop.facts['year_built'] = 1900
    ctx = context_for(rule, prop, resolution)
    plan = plan_questions(ctx)
    assert {q.fact.field for q in plan.questions} == {'certificate_of_occupancy', 'owner_occupied', 'exemption_filed'}
    on_cutoff = next(a for a in question(plan, 'certificate_of_occupancy').alternatives if a.probe_facts['certificate_of_occupancy'] == '2020-06-30')
    assert on_cutoff.evaluations[0].result == 'unknown'
    assert {u.field for u in on_cutoff.remaining_uncertainty if u.kind == 'property_fact'} == {'owner_occupied', 'exemption_filed'}
    assert plan.exhaustive


def test_correlated_impossible_branch_is_not_a_question(rule, prop, resolution):
    prop.facts.pop('units')
    rule.coverage_conditions = Expression(op='all', args=[Expression(op='lt', fact='units', value=4), Expression(op='gte', fact='units', value=4)])
    plan = plan_questions(context_for(rule, prop, resolution))
    assert plan.questions == [] and plan.exhaustive
    # The actual three-valued evaluator still says unknown; analysis does not replace it.
    assert plan.traces[0].result == 'unknown'


def test_bound_and_fractional_integer_threshold_partition(rule, prop, resolution):
    prop.facts.pop('units')
    prop.bounds['units'] = Bound(lower=4, upper=8, provenance='Verified source bounds')
    rule.coverage_conditions = Expression(op='gt', fact='units', value=4.5)
    plan = plan_questions(context_for(rule, prop, resolution))
    alternatives = question(plan, 'units').alternatives
    assert {a.probe_facts['units'] for a in alternatives} == {4, 5}
    assert all(4 <= a.probe_facts['units'] <= 8 for a in alternatives)
    assert alternatives[0].evaluations[0].result == 'inapplicable'
    assert alternatives[1].evaluations[0].result == 'applies'


def test_partial_actual_date_and_partial_cutoff_preserve_unknown_region(rule, prop, resolution):
    field = 'certificate_of_occupancy'
    prop.facts[field] = '2020-06'
    rule.coverage_conditions = Expression(op='date_on_or_before', fact=field, value='2020-06')
    plan = plan_questions(context_for(rule, prop, resolution))
    alternatives = question(plan, field).alternatives
    assert all(a.probe_facts[field].startswith('2020-06-') for a in alternatives)
    assert {a.evaluations[0].result for a in alternatives} == {'applies', 'unknown'}
    assert any(u.kind == 'interpretation' for a in alternatives for u in a.remaining_uncertainty)


def test_all_alternatives_reproduce_and_context_is_immutable(rule, prop, resolution):
    prop.facts.pop('units')
    prop.bounds['units'] = Bound(lower=2, upper=12, provenance='Verified range')
    ctx = context_for(rule, prop, resolution)
    original = ctx.model_dump_json()
    plan = plan_questions(ctx)
    assert ctx.model_dump_json() == original
    for q in plan.questions:
        for alt in q.alternatives:
            changed = prop.model_copy(deep=True)
            changed.facts.update(alt.probe_facts)
            changed.provenance.update({f: PROBE_PROVENANCE for f in alt.probe_facts})
            changed.missing_facts = [f for f in changed.missing_facts if f not in alt.probe_facts]
            assert alt.evaluations == engine.evaluate_rules(ctx.rules, changed, resolution, DAY)
            assert alt.hypothetical and set(alt.probe_facts) == {q.fact.field}
            support = alt.evaluations[0].coverage.supporting_facts.get('units')
            # Numeric bounds remain evidence; exact probe must still be visibly hypothetical.
            assert support['value'] == alt.probe_facts['units']
            assert support['provenance'] == PROBE_PROVENANCE


def test_budget_one_counts_baseline_and_never_invents_an_alternative(rule, prop, resolution, monkeypatch):
    prop.facts.pop('units')
    real = engine.evaluate_rules
    calls = []
    def counted(*args, **kwargs):
        calls.append(1)
        return real(*args, **kwargs)
    monkeypatch.setattr(engine, 'evaluate_rules', counted)
    plan = plan_questions(context_for(rule, prop, resolution, max_evaluations=1))
    assert plan.evaluations_used == len(calls) == 1
    assert plan.status == 'partial' and not plan.exhaustive
    assert plan.limits_hit == ['max_evaluations']
    assert question(plan, 'units').alternatives == []
    assert any(u.kind == 'analysis_limit' for u in plan.remaining_uncertainty)


@pytest.mark.parametrize('limit', ['max_fields', 'max_joint_fields', 'max_questions'])
def test_each_limit_preserves_unexamined_uncertainty(rule, prop, resolution, limit):
    fields = ('owner_occupied', 'exemption_filed', 'subsidized', 'condominium')
    rule.coverage_conditions = Expression(op='all', args=[Expression(op='eq', fact=f, value=True) for f in fields])
    plan = plan_questions(context_for(rule, prop, resolution, **{limit: 1}))
    assert limit in plan.limits_hit and not plan.exhaustive and plan.status == 'partial'
    assert {u.field for u in plan.remaining_uncertainty if u.kind == 'property_fact'} == set(fields)
    assert plan.questions


def test_rank_order_is_deterministic_and_uses_effort(rule, prop, resolution):
    prop.facts.pop('units')
    rule.coverage_conditions = Expression(op='all', args=[Expression(op='gte', fact='units', value=4), Expression(op='eq', fact='owner_occupied', value=True)])
    ctx = context_for(rule, prop, resolution)
    first = plan_questions(ctx)
    ctx.fact_definitions = dict(reversed(list(ctx.fact_definitions.items())))
    assert first == plan_questions(ctx)
    assert [q.fact.field for q in first.questions] == ['units', 'owner_occupied']
    assert [q.rank_score for q in first.questions] == [1, .5]


def test_joint_only_materiality_uses_correlated_full_completions(rule, prop, resolution):
    # Equality of three unknown booleans: all single-field answers remain unknown.
    fields = ('owner_occupied', 'exemption_filed', 'subsidized')
    rule.coverage_conditions = Expression(op='any', args=[Expression(op='all', args=[Expression(op='eq', fact=f, value=b) for f in fields]) for b in (False, True)])
    plan = plan_questions(context_for(rule, prop, resolution))
    assert plan.exhaustive and {q.fact.field for q in plan.questions} == set(fields)
    assert all('Feasible evaluator probes' in q.why for q in plan.questions)
    assert all(a.evaluations[0].result == 'unknown' for q in plan.questions for a in q.alternatives)


def test_source_jurisdiction_interpretation_and_conflict_remedies_persist(rule, prop, resolution):
    prop.facts.pop('units')
    rule.review_issues = ['An exception definition needs review']
    rule.conflict_flag = True
    resolution.match_quality = 'unresolved'
    ctx = context_for(rule, prop, resolution)
    ctx.evidence_reports = [EvidenceReport(rule_id=rule.team_rule_id, rule_hash='fixture',
        checks=[EvidenceCheck(kind='source_availability', status='missing', message='Referenced source absent'),
                EvidenceCheck(kind='dependencies', status='missing', message='Exception cross-reference missing')],
        context=SourceContext(spans=[], dependencies=[], status='missing', limits={}, limits_hit=[]),
        blocking_issues=['Unresolved authority'], disclaimer='Synthetic evidence report')]
    plan = plan_questions(ctx)
    required = {'source_gap', 'jurisdiction', 'interpretation', 'conflict', 'cross_reference'}
    assert required <= {u.kind for u in plan.remaining_uncertainty}
    applied = next(a for a in question(plan, 'units').alternatives if a.probe_facts['units'] >= 8)
    assert required <= {u.kind for u in applied.remaining_uncertainty}
    assert {q.fact.field for q in plan.questions} == {'units'}


def test_unknown_temporal_boundary_keeps_useful_property_question(rule, prop, resolution):
    prop.facts.pop('units')
    rule.effective_date = '2026-11'
    plan = plan_questions(context_for(rule, prop, resolution))
    assert question(plan, 'units')
    assert any('temporal_uncertainty' in u.message for u in plan.remaining_uncertainty)


def test_boolean_enum_and_unsupported_date_string_operator(rule, prop, resolution):
    rule.coverage_conditions = Expression(op='in', fact='owner_type', value=['individual', 'trust'])
    plan = plan_questions(context_for(rule, prop, resolution))
    assert {a.probe_facts['owner_type'] for a in question(plan, 'owner_type').alternatives} == set(FACT_DEFINITIONS['owner_type'].allowed_values)
    assert plan.exhaustive
    rule.coverage_conditions = Expression(op='eq', fact='first_occupancy_date', value='2020')
    plan = plan_questions(context_for(rule, prop, resolution))
    assert not plan.exhaustive and plan.status == 'partial'
    assert any(u.kind == 'interpretation' and u.field == 'first_occupancy_date' for u in plan.remaining_uncertainty)


def test_interaction_scope_question_and_wrong_jurisdiction_gate(rule, prop, resolution):
    other = rule.model_copy(deep=True)
    other.team_rule_id, other.citation = 'target', 'Synthetic target provision'
    rule.interactions = [Interaction(kind='supersedes', target_citation=other.citation,
        target_jurisdiction=other.jurisdiction, category=other.category,
        scope=Expression(op='eq', fact='owner_occupied', value=True), evidence=rule.evidence, note='Synthetic scope')]
    ctx = context_for(rule, prop, resolution)
    ctx.rules.append(other)
    plan = plan_questions(ctx)
    q = question(plan, 'owner_occupied')
    assert q.predicate_ids == [rule.team_rule_id + ':interactions/0/scope']
    assert {next(e for e in a.evaluations if e.team_rule_id == 'target').result for a in q.alternatives} == {'applies', 'superseded'}
    rule.jurisdiction = 'Wrong City, CA'
    ctx.rules = [rule, other]
    assert plan_questions(ctx).questions == []


@pytest.mark.parametrize('case', ['decisive_question', 'irrelevant_missing_fact', 'two_unresolved_exemptions', 'unresolved_source_coverage', 'bounded_partial_analysis'])
def test_shared_research_examples_use_real_planner(case):
    data = json.loads((Path(__file__).parents[1] / 'contracts/research_examples' / (case + '.json')).read_text())
    response = AssistResponse.model_validate(data['response'])
    lookup = response.lookup
    ctx = AssistContext(property=lookup.address, jurisdiction=lookup.jurisdiction, as_of=lookup.as_of,
        rules=lookup.rules, evaluations=lookup.evaluations, evidence_reports=response.evidence_reports,
        fact_definitions=FACT_DEFINITIONS, limits=response.question_plan.limits)
    plan = plan_questions(ctx)
    assert plan.algorithm_version != response.question_plan.algorithm_version
    if case == 'irrelevant_missing_fact': assert not plan.questions
    elif case == 'bounded_partial_analysis': assert plan.status == 'partial' and not plan.exhaustive
    elif case == 'two_unresolved_exemptions': assert len(plan.questions) == 3
    elif case == 'unresolved_source_coverage': assert any(u.kind == 'source_gap' for u in plan.remaining_uncertainty)
    else: assert question(plan, 'units')


def test_exact_date_does_not_repeat_question_for_imprecise_legal_cutoff(rule, prop, resolution):
    prop.facts['certificate_of_occupancy'] = '2020-06-15'
    rule.coverage_conditions = Expression(op='date_before', fact='certificate_of_occupancy', value='2020-06')
    plan = plan_questions(context_for(rule, prop, resolution))
    assert not plan.questions
    assert any(u.kind == 'interpretation' for u in plan.remaining_uncertainty)
    assert not plan.exhaustive


def test_supplied_continuous_domain_and_membership(rule, prop, resolution):
    field = 'custom_area'
    rule.coverage_conditions = Expression(op='all', args=[Expression(op='gt', fact=field, value=4), Expression(op='lt', fact=field, value=5)])
    ctx = context_for(rule, prop, resolution)
    ctx.fact_definitions[field] = FactDefinition(field=field, meaning='Measured area', data_type='number', unit='square feet', minimum=0, maximum=10)
    plan = plan_questions(ctx)
    assert plan.exhaustive
    alt = question(plan, field).alternatives
    assert any(4 < a.probe_facts[field] < 5 and a.evaluations[0].result == 'applies' for a in alt)
    assert all(0 <= a.probe_facts[field] <= 10 for a in alt)
    rule.coverage_conditions = Expression(op='in', fact='units', value=[4, 8])
    prop.facts.pop('units')
    plan = plan_questions(context_for(rule, prop, resolution))
    assert {a.probe_facts['units'] for a in question(plan, 'units').alternatives if a.evaluations[0].result == 'applies'} == {4, 8}


def test_age_leap_day_cutoff_and_strict_date_boundary(rule, prop, resolution):
    rule.coverage_conditions = Expression(op='age_at_least', fact='first_occupancy_date', value=1)
    ctx = context_for(rule, prop, resolution)
    ctx.as_of = date(2024, 2, 29)
    rule.effective_date = '2020-01-01'
    rule.status_events = []
    rule.status_as_of = '2020-01-01'
    ctx.rules = [rule]
    plan = plan_questions(ctx)
    alt = question(plan, 'first_occupancy_date').alternatives
    cutoff = next(a for a in alt if a.probe_facts['first_occupancy_date'] == '2023-02-28')
    assert cutoff.evaluations[0].result == 'applies'
    assert any(a.probe_facts['first_occupancy_date'] > '2023-02-28' and a.evaluations[0].result == 'inapplicable' for a in alt)


def test_inactive_rules_do_not_create_false_materiality_or_poison_domains(rule, prop, resolution):
    prop.facts.pop('units')
    rule.coverage_conditions = Expression(op='all', args=[Expression(op='lt', fact='units', value=4), Expression(op='gte', fact='units', value=4)])
    wrong = rule.model_copy(deep=True)
    wrong.team_rule_id, wrong.jurisdiction = 'wrong-city', 'Wrong City, CA'
    wrong.coverage_conditions = Expression(op='gte', fact='units', value=10)
    ctx = context_for(rule, prop, resolution)
    ctx.rules.append(wrong)
    plan = plan_questions(ctx)
    assert not plan.questions and plan.exhaustive
    assert not any(u.kind == 'property_fact' for u in plan.remaining_uncertainty)
    rule.coverage_conditions = Expression(op='date_before', fact='first_occupancy_date', value='2020-01-01')
    wrong.coverage_conditions = Expression(op='eq', fact='first_occupancy_date', value='2020')
    ctx.rules = [rule, wrong]
    assert question(plan_questions(ctx), 'first_occupancy_date')


def test_source_and_temporal_remedies_survive_inapplicable_probe(rule, prop, resolution):
    prop.facts.pop('units')
    rule.review_issues = ['Synthetic source definition unresolved']
    rule.effective_date = '2026-11'
    plan = plan_questions(context_for(rule, prop, resolution))
    alt = next(a for a in question(plan, 'units').alternatives if a.probe_facts['units'] < 8)
    assert alt.evaluations[0].result == 'inapplicable'
    assert any('temporal_uncertainty' in u.message for u in alt.remaining_uncertainty)
    assert any('Synthetic source definition unresolved' in u.message for u in alt.remaining_uncertainty)


def test_number_membership_type_sensitivity_is_not_called_exhaustive(rule, prop, resolution):
    rule.coverage_conditions = Expression(op='in', fact='amount', value=[1])
    ctx = context_for(rule, prop, resolution)
    ctx.fact_definitions['amount'] = FactDefinition(field='amount', meaning='Measured amount', data_type='number')
    plan = plan_questions(ctx)
    assert plan.status == 'partial' and not plan.exhaustive
    assert any(u.kind == 'interpretation' and u.field == 'amount' for u in plan.remaining_uncertainty)


def test_absent_interaction_target_cannot_poison_date_partition(rule, prop, resolution):
    rule.coverage_conditions = Expression(op='date_before', fact='first_occupancy_date', value='2020-06-01')
    rule.interactions = [Interaction(kind='supersedes', target_citation='Absent target', target_jurisdiction='CA',
        category=rule.category, scope=Expression(op='eq', fact='first_occupancy_date', value='2020'),
        evidence=rule.evidence, note='Unresolved target')]
    plan = plan_questions(context_for(rule, prop, resolution))
    assert question(plan, 'first_occupancy_date')
    assert any(u.kind == 'cross_reference' and 'Absent target' in u.message for u in plan.remaining_uncertainty)


@pytest.mark.parametrize('low,high', [
    (2**60, 2**60 + 2),
    (float(2**60), math.nextafter(float(2**60), math.inf)),
])
def test_exact_integer_answers_between_float_endpoints_remain_material(rule, prop, resolution, low, high):
    rule.coverage_conditions = Expression(op='all', args=[
        Expression(op='gt', fact='amount', value=low),
        Expression(op='lt', fact='amount', value=high)])
    ctx = context_for(rule, prop, resolution)
    ctx.fact_definitions['amount'] = FactDefinition(field='amount', meaning='Measured amount', data_type='number')
    plan = plan_questions(ctx)
    alternatives = question(plan, 'amount').alternatives
    matching = [a for a in alternatives if a.evaluations[0].result == 'applies']
    assert plan.exhaustive and len(matching) == 1
    assert low < matching[0].probe_facts['amount'] < high
    assert type(matching[0].probe_facts['amount']) is int
    assert matching[0].interval['lower_inclusive'] is False
    assert matching[0].interval['upper_inclusive'] is False
    for alternative in alternatives:
        changed = prop.model_copy(deep=True)
        changed.facts.update(alternative.probe_facts)
        actual = engine.evaluate_rules([rule], changed, resolution, DAY)
        assert [e.result for e in actual] == [e.result for e in alternative.evaluations]
        for endpoint in ('lower', 'upper'):
            if alternative.interval[endpoint] is None:
                assert alternative.interval[endpoint + '_inclusive'] is False


@pytest.mark.parametrize('value', [math.inf, math.nan])
@pytest.mark.parametrize('origin', ['property_bound', 'fact_definition'])
def test_nonfinite_partition_bounds_stay_explicitly_partial(rule, prop, resolution, value, origin):
    prop.facts.pop('units')
    ctx = context_for(rule, prop, resolution)
    if origin == 'property_bound':
        ctx.property.bounds['units'] = Bound(lower=2, upper=value, provenance='Synthetic malformed bound')
    else:
        ctx.fact_definitions['units'] = FACT_DEFINITIONS['units'].model_copy(update={'maximum': value})
    plan = plan_questions(ctx)
    assert plan.status == 'partial' and not plan.exhaustive
    assert plan.questions == [] and plan.evaluations_used == 1
    assert any(u.kind == 'interpretation' and u.field == 'units' for u in plan.remaining_uncertainty)


def test_real_core_http_questions_answers_and_every_alternative(demo):
    from fastapi.testclient import TestClient
    from navigator.api import create_app

    request = {'address_id': 'SYNTH-003', 'as_of': DAY.isoformat()}
    original = demo.read('addresses.json')
    with TestClient(create_app(demo.root)) as client:
        response = client.post('/api/v1/lookup/assist', json=request)
        assert response.status_code == 200
        body = AssistResponse.model_validate(response.json())
        assert body.capabilities['question_planner'] == 'implemented'
        assert body.capabilities['rule_renderer'] == 'implemented'
        assert [q.fact.field for q in body.question_plan.questions] == ['units']
        assert body.lookup.evaluations[0].result == 'unknown'
        for alternative in body.question_plan.questions[0].alternatives:
            answer = {'field': 'units', 'value': alternative.probe_facts['units']}
            response = client.post('/api/v1/lookup/assist', json={**request, 'answers': [answer]})
            assert response.status_code == 200
            answered = AssistResponse.model_validate(response.json())
            expected = {e.team_rule_id: (e.result, e.coverage.value, e.conflict_flag)
                        for e in alternative.evaluations if e.result not in {'inapplicable', 'failed'}}
            assert {e.team_rule_id: (e.result, e.coverage.value, e.conflict_flag)
                    for e in answered.lookup.evaluations} == expected
            assert answered.question_plan.questions == []
            assert 'User-supplied' in answered.lookup.address.provenance['units']
            assert any(u.kind == 'source_gap' for u in answered.question_plan.remaining_uncertainty)
        # Stateless answers disappear on the next unanswered request.
        reset = client.post('/api/v1/lookup/assist', json=request).json()
        assert reset['lookup']['evaluations'][0]['result'] == 'unknown'
        assert [q['question_id'] for q in reset['question_plan']['questions']] == ['q:units']
        bounded = client.post('/api/v1/lookup/assist', json={**request, 'limits': {'max_evaluations': 1}}).json()
        assert bounded['question_plan']['evaluations_used'] == 1
        assert bounded['question_plan']['status'] == 'partial'
        assert bounded['question_plan']['limits_hit'] == ['max_evaluations']
        assert bounded['question_plan']['questions'][0]['alternatives'] == []
    assert demo.read('addresses.json') == original


def test_real_core_http_partial_date_then_two_exemptions(demo, rule):
    from fastapi.testclient import TestClient
    from navigator.api import create_app

    rule.coverage_conditions = Expression(op='date_on_or_before', fact='certificate_of_occupancy', value='2020-06-15')
    rule.exemption_conditions = Expression(op='any', args=[Expression(op='eq', fact=f, value=True)
        for f in ('owner_occupied', 'exemption_filed')])
    demo.save_collection('rules', {rule.team_rule_id: rule})
    request = {'address_id': 'SYNTH-001', 'as_of': DAY.isoformat()}
    with TestClient(create_app(demo.root)) as client:
        def answer(facts):
            response = client.post('/api/v1/lookup/assist', json={**request, 'answers': [
                {'field': field, 'value': value} for field, value in facts.items()]})
            assert response.status_code == 200
            return AssistResponse.model_validate(response.json())

        partial = answer({'certificate_of_occupancy': '2020-06'})
        assert {q.fact.field for q in partial.question_plan.questions} == {
            'certificate_of_occupancy', 'owner_occupied', 'exemption_filed'}
        for alternative in question(partial.question_plan, 'certificate_of_occupancy').alternatives:
            assert alternative.interval['lower'] >= '2020-06-01'
            assert alternative.interval['upper'] <= '2020-06-30'
        facts = {'certificate_of_occupancy': '2020-06-15'}
        precise = answer(facts)
        assert precise.lookup.evaluations[0].result == 'unknown'
        assert {q.fact.field for q in precise.question_plan.questions} == {'owner_occupied', 'exemption_filed'}
        assert {u.field for u in precise.question_plan.remaining_uncertainty if u.kind == 'property_fact'} == {
            'owner_occupied', 'exemption_filed'}
        facts['owner_occupied'] = False
        assert [q.fact.field for q in answer(facts).question_plan.questions] == ['exemption_filed']
        facts['exemption_filed'] = False
        completed = answer(facts)
        assert completed.lookup.evaluations[0].result == 'applies'
        assert completed.question_plan.questions == []
        assert any(u.kind == 'source_gap' for u in completed.question_plan.remaining_uncertainty)
