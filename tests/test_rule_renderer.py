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
