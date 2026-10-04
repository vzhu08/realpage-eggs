import pytest

from navigator.core_assist import render_rule
from navigator.models import EncodedRuleRendering, Expression, Interaction


def test_renderer_is_stable_faithful_and_distinct_from_legal_validation(rule):
    before = rule.model_dump_json()
    rendered = render_rule(rule)
    assert rendered == render_rule(rule)
    assert rule.model_dump_json() == before
    assert EncodedRuleRendering.model_validate(rendered.model_dump()) == rendered
    assert rendered.kind == 'encoded_rule_not_legal_validation'
    assert len(rendered.expression_hash) == 64
    assert 'units [dwelling units] >= 8' in rendered.text
    assert 'AND NOT (FALSE)' in rendered.text
    assert 'Effective boundary (inclusive): 2026-11-15 (day precision' in rendered.text
    assert 'Status event 1: enacted on 2026-09-01' in rendered.text
    assert 'not legal validation' in rendered.text


def test_meaningful_operator_exemption_and_date_edits_are_visible(rule):
    initial = render_rule(rule)
    changes = []
    changed = rule.model_copy(deep=True)
    changed.coverage_conditions.args[1].op = 'gt'
    changes.append(changed)
    changed = rule.model_copy(deep=True)
    changed.exemption_conditions = Expression(op='eq', fact='owner_occupied', value=True)
    changes.append(changed)
    changed = rule.model_copy(deep=True)
    changed.effective_date = '2026-11'
    changed.end_date = '2027'
    changes.append(changed)
    for changed in changes:
        rendered = render_rule(changed)
        assert rendered.expression_hash != initial.expression_hash
        assert rendered.text != initial.text
    assert 'End boundary (exclusive): 2027 (year precision; 2027-01-01 through 2027-12-31)' in render_rule(changes[-1]).text


def test_grouping_membership_negation_and_unsupported_paths(rule):
    rule.coverage_conditions = Expression(op='all', args=[
        Expression(op='any', args=[Expression(op='in', fact='owner_type', value=['individual', 'trust']),
                                  Expression(op='ne', fact='units', value=4)]),
        Expression(op='not', args=[Expression(op='unsupported', reason='Referenced exception is missing')])])
    rendered = render_rule(rule)
    assert '(owner_type IN ["individual", "trust"] OR units [dwelling units] != 4)' in rendered.text
    assert 'AND NOT (UNSUPPORTED [coverage_conditions/args/1/args/0]' in rendered.text
    assert rendered.unresolved_nodes == ['coverage_conditions/args/1/args/0']


def test_partial_dates_age_and_scoped_interaction(rule):
    rule.coverage_conditions = Expression(op='date_before', fact='certificate_of_occupancy', value='1978')
    rule.exemption_conditions = Expression(op='age_at_least', fact='first_occupancy_date', value=15)
    rule.interactions = [Interaction(kind='supersedes', target_citation='Other section', target_jurisdiction='CA',
        category=rule.category, scope=Expression(op='lte', fact='units', value=2), evidence=rule.evidence, note='Explicit encoded scope')]
    rendered = render_rule(rule)
    assert 'strictly before (<) 1978 (year precision; 1978-01-01 through 1978-12-31)' in rendered.text
    assert 'age >= 15 whole calendar years' in rendered.text
    assert 'supersedes Other section in CA' in rendered.text
    assert 'only within scope units [dwelling units] <= 2' in rendered.text


def test_hash_excludes_retrieval_artifacts_and_includes_temporal_history(rule):
    initial = render_rule(rule)
    changed = rule.model_copy(deep=True)
    changed.extraction_run_id = 'different-run'
    changed.evidence[0].start = 12345
    assert render_rule(changed).expression_hash == initial.expression_hash
    changed.status_events[0].on = '2026-08-01'
    assert render_rule(changed).expression_hash != initial.expression_hash


def test_fractional_age_is_visibly_unsupported(rule):
    rule.coverage_conditions = Expression(op='age_at_least', fact='first_occupancy_date', value=1.5)
    rendered = render_rule(rule)
    assert 'coverage_conditions' in rendered.unresolved_nodes
    assert 'UNSUPPORTED [coverage_conditions]: age_at_least 1.5' in rendered.text


@pytest.mark.parametrize('value', [float('inf'), float('nan'), 10000])
def test_out_of_range_age_is_unresolved_without_crashing(rule, value):
    rule.coverage_conditions = Expression(op='age_at_least', fact='first_occupancy_date', value=value)
    rendered = render_rule(rule)
    assert rendered == render_rule(rule)
    assert 'coverage_conditions' in rendered.unresolved_nodes
    assert 'UNSUPPORTED [coverage_conditions]: age_at_least' in rendered.text
    assert EncodedRuleRendering.model_validate_json(rendered.model_dump_json()) == rendered


def test_real_renderer_http_source_comparison_and_stable_hash(demo):
    from fastapi.testclient import TestClient
    from navigator.api import create_app

    request = {'address_id': 'SYNTH-003', 'as_of': '2026-11-15'}
    with TestClient(create_app(demo.root)) as client:
        response = client.post('/api/v1/lookup/assist', json=request)
        assert response.status_code == 200
        first = response.json()
        assert first['capabilities']['rule_renderer'] == 'implemented'
        rendered = first['encoded_rules'][0]
        ident = rendered['rule_id']
        assert rendered['kind'] == 'encoded_rule_not_legal_validation'
        assert 'units [dwelling units] >= 8' in rendered['text']
        assert 'Effective boundary (inclusive): 2026-11-15' in rendered['text']
        evidence = client.get(f'/api/v1/rules/{ident}/evidence')
        assert evidence.status_code == 200
        assert evidence.json() == next(r for r in first['evidence_reports'] if r['rule_id'] == ident)
        assert evidence.json()['context']['spans']
        source_id = next(iter(demo.sources()))
        context = client.get(f'/api/v1/sources/{source_id}/context').json()
        assert context['spans'][0]['text'] == demo.sources()[source_id].text
        answered = client.post('/api/v1/lookup/assist', json={**request, 'answers': [{'field': 'units', 'value': 8}]}).json()
        assert answered['encoded_rules'] == first['encoded_rules']
        # A changed encoding, unlike a property answer, must change the display/hash.
        rules = demo.rules()
        rules[ident].coverage_conditions.args[1].op = 'gt'
        demo.save_collection('rules', rules)
        changed = client.post('/api/v1/lookup/assist', json=request).json()['encoded_rules'][0]
        assert changed['expression_hash'] != rendered['expression_hash']
        assert 'units [dwelling units] > 8' in changed['text']
