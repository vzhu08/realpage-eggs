"""Synthetic rule fixtures exercise adapters, not the legal accuracy of the corpus."""
from datetime import date

import pytest

from navigator.changes import compute_changes
from navigator.config import pack_dir
from navigator.models import ChangeRequest, Expression, Interaction, StatusEvent
from navigator.store import read_json


@pytest.fixture
def scenarios(demo, rule):
    specs = [
        ("ca", "CA", "AB 325 / SB 763", "2026-01-01", "enacted", "algorithmic_rent_setting"),
        ("hob", "Hoboken, NJ", "Hoboken local ban", "2025-07-01", "enacted", "algorithmic_rent_setting"),
        ("jc", "Jersey City, NJ", "Jersey City local ban", "2025-06-01", "enacted", "algorithmic_rent_setting"),
        ("nj", "NJ", "FAIR Act", "2027-07-01", "enacted", "algorithmic_rent_setting"),
        ("ma1", "MA", "S.2983", "2027-01-01", "pending", "algorithmic_rent_setting"),
        ("ma2", "MA", "H.5222", "2027-01-01", "pending", "algorithmic_rent_setting"),
        ("failed", "MA", "IP 25-21 ballot", None, "failed", "rent_increase_limits")]
    rules = {}
    for ident, jurisdiction, citation, effective, lifecycle, category in specs:
        record = rule.model_copy(deep=True)
        record.team_rule_id, record.jurisdiction, record.citation, record.category = ident, jurisdiction, citation, category
        record.level = "city" if "," in jurisdiction else "state"
        record.effective_date, record.lifecycle = effective, lifecycle
        record.coverage_conditions = Expression(op="literal", value=True)
        record.status_events = [StatusEvent(status=lifecycle, on="2025-01-01", evidence=record.evidence)]
        record.title = "Synthetic adapter fixture: " + citation
        rules[ident] = record
    rules["nj"].interactions = [Interaction(kind="conflicts_with", target_citation=rules[target].citation, target_jurisdiction=rules[target].jurisdiction, category="algorithmic_rent_setting", scope=Expression(op="literal", value=True), evidence=rule.evidence, note="Synthetic possible preemption") for target in ("hob", "jc")]
    properties, resolutions = {}, {}
    for ident, state, city in [("ca-home", "CA", "Los Angeles"), ("hob-home", "NJ", "Hoboken"), ("jc-home", "NJ", "Jersey City"), ("newark-home", "NJ", "Newark"), ("ma-home", "MA", "Boston")]:
        prop = demo.addresses()["SYNTH-001"].model_copy(deep=True)
        prop.address_id, prop.raw_address.state = ident, state
        resolution = demo.resolutions()["SYNTH-001"].model_copy(deep=True)
        resolution.address_id, resolution.state, resolution.municipality = ident, state, city
        properties[ident], resolutions[ident] = prop, resolution
    demo.save_collection("rules", rules)
    demo.save_collection("addresses", properties)
    demo.save_collection("resolutions", resolutions)
    demo.write("change_tests.json", read_json(pack_dir() / "dev/change_tests.json") or read_json(__import__('pathlib').Path(__file__).parent / "fixtures/change_tests.json"))
    return demo


def test_t1_date_transition(scenarios):
    result = compute_changes(scenarios, ChangeRequest(test_id="T1"))
    assert result.affected_address_ids == ["ca-home"]


def test_t2_uses_resolved_municipal_boundaries(scenarios):
    result = compute_changes(scenarios, ChangeRequest(test_id="T2"))
    assert result.affected_address_ids == ["hob-home", "jc-home"]


def test_t3_retains_state_obligations_and_flags_local_conflicts(scenarios):
    result = compute_changes(scenarios, ChangeRequest(test_id="T3"))
    assert set(result.conflict_flag_address_ids) == {"hob-home", "jc-home"}
    assert set(result.affected_address_ids) | set(result.uncertain_address_ids) == {"hob-home", "jc-home", "newark-home"}


def test_t4_hypothetical_does_not_mutate_pending_law(scenarios):
    before = scenarios.read("rules.json")
    result = compute_changes(scenarios, ChangeRequest(test_id="T4"))
    assert result.scenario == "if_enacted" and result.affected_address_ids == ["ma-home"]
    assert before == scenarios.read("rules.json")


def test_t5_failed_proposal_is_not_operational(scenarios):
    result = compute_changes(scenarios, ChangeRequest(test_id="T5"))
    assert result.status == "complete"
    assert not result.affected_address_ids and not result.uncertain_address_ids


def test_partial_end_date_preserves_uncertain_changes(demo, rule):
    rule.end_date = '2026-12'
    demo.save_collection('rules', {rule.team_rule_id: rule})
    before = demo.read('rules.json')
    result = compute_changes(demo, ChangeRequest(before=date(2026, 11, 30), after=date(2026, 12, 1)))
    assert not result.affected_address_ids
    # The unresolved property can also be affected within the imprecise interval.
    assert result.uncertain_address_ids == ['SYNTH-001', 'SYNTH-003']
    assert result.status == 'partial'
    assert demo.read('rules.json') == before
    exact = rule.model_copy(deep=True)
    exact.end_date = '2026-12-01'
    demo.save_collection('rules', {exact.team_rule_id: exact})
    result = compute_changes(demo, ChangeRequest(before=date(2026, 11, 30), after=date(2026, 12, 1)))
    assert result.affected_address_ids == ['SYNTH-001']
    assert result.uncertain_address_ids == ['SYNTH-003']


def test_equal_unknown_results_do_not_hide_unestablished_change(demo, rule):
    rule.effective_date = None
    demo.save_collection('rules', {rule.team_rule_id: rule})
    result = compute_changes(demo, ChangeRequest(before=date(2026, 11, 14), after=date(2026, 11, 16)))
    assert result.status == 'partial' and not result.affected_address_ids
    assert set(result.uncertain_address_ids) == {'SYNTH-001', 'SYNTH-003'}
    assert 'SYNTH-002' not in result.uncertain_address_ids  # Known outside geography remains excluded.


def test_review_needed_rule_prevents_complete_empty_change_claim(demo, rule):
    rule.review_issues = ['Synthetic missing legal dependency']
    demo.save_collection('rules', {rule.team_rule_id: rule})
    result = compute_changes(demo, ChangeRequest(before=date(2026, 11, 16), after=date(2026, 11, 17)))
    assert result.status == 'partial' and not result.affected_address_ids
    assert any('Unresolved rule evidence' in note for note in result.notes)


def test_unestablished_failed_proposal_does_not_claim_no_operative_obligation(scenarios):
    rules = scenarios.rules()
    rules['failed'].lifecycle = 'pending'
    rules['failed'].status_events = [StatusEvent(status='pending', on='2025-01-01', evidence=rules['failed'].evidence)]
    scenarios.save_collection('rules', rules)
    result = compute_changes(scenarios, ChangeRequest(test_id='T5'))
    assert result.status == 'partial'
    assert not any('creates no operative obligation' in note for note in result.notes)


def test_negative_case_requires_dated_failure_even_outside_geography(scenarios):
    rules = scenarios.rules()
    rules['failed'].status_events = []
    rules['failed'].status_as_of = None
    scenarios.save_collection('rules', rules)
    # Excluded addresses cannot turn an undated lifecycle label into proof of failure.
    scenarios.save_collection('addresses', {'ca-home': scenarios.addresses()['ca-home']})
    scenarios.save_collection('resolutions', {'ca-home': scenarios.resolutions()['ca-home']})
    result = compute_changes(scenarios, ChangeRequest(test_id='T5'))
    assert not result.affected_address_ids and not result.uncertain_address_ids
    assert result.status == 'partial'
    assert any('Failed lifecycle is not established' in note for note in result.notes)
    assert not any('creates no operative obligation' in note for note in result.notes)


def test_conflict_dependencies_accept_explicit_local_to_state_edges(scenarios):
    rules = scenarios.rules()
    rules['nj'].interactions = []
    for ident in ('hob', 'jc'):
        rules[ident].interactions = [Interaction(kind='conflicts_with', target_citation=rules['nj'].citation,
                                               target_jurisdiction=rules['nj'].jurisdiction, category=rules['nj'].category,
                                               scope=Expression(op='literal', value=True), evidence=rules[ident].evidence,
                                               note='Fictional local record identifies the state-law conflict')]
    scenarios.save_collection('rules', rules)
    result = compute_changes(scenarios, ChangeRequest(test_id='T3'))
    assert set(result.conflict_flag_address_ids) == {'hob-home', 'jc-home'}
    assert not any(note.startswith('No evidence-backed state/local interaction') for note in result.notes)
    assert result.status == 'partial'  # A conflict still requires human interpretation.


def test_unrelated_interaction_does_not_satisfy_mapped_conflict_dependencies(scenarios):
    rules = scenarios.rules()
    rules['nj'].interactions = [rules['nj'].interactions[0].model_copy(deep=True, update={
        'target_citation': 'Unrelated fictional provision', 'target_jurisdiction': 'Newark, NJ'})]
    scenarios.save_collection('rules', rules)
    result = compute_changes(scenarios, ChangeRequest(test_id='T3'))
    assert not result.conflict_flag_address_ids
    assert result.status == 'partial'
    for ref in ('JC-ALG-01', 'HOB-ALG-01'):
        assert any(note.startswith(f'No evidence-backed state/local interaction extracted for {ref};') for note in result.notes)


def test_missing_municipality_record_keeps_state_and_marks_local_coverage_uncertain(scenarios):
    resolutions = scenarios.resolutions()
    del resolutions['hob-home']
    scenarios.save_collection('resolutions', resolutions)
    result = compute_changes(scenarios, ChangeRequest(test_id='T2'))
    assert result.affected_address_ids == ['jc-home']
    assert result.uncertain_address_ids == ['hob-home']
    assert result.status == 'partial'
    # The supplied state remains usable; no postal-city inference supplies the municipality.
    for delta in result.differences['hob-home']:
        assert delta['after']['jurisdiction'] == 'unknown'
    state_result = compute_changes(scenarios, ChangeRequest(test_id='T1'))
    assert state_result.affected_address_ids == ['ca-home']


@pytest.mark.parametrize('test_id', ['T1', 'T2', 'T3', 'T4', 'T5'])
def test_missing_references_skip_unrelated_property_evaluations(demo, monkeypatch, test_id):
    definitions = read_json(__import__('pathlib').Path(__file__).parent / 'fixtures/change_tests.json')
    demo.write('change_tests.json', definitions)
    definition = next(test for test in definitions if test['test_id'] == test_id)
    assert demo.rules() and demo.addresses()  # Dataset exists, but the requested legal evidence does not.

    def unexpected_evaluation(*args, **kwargs):
        pytest.fail('Blocked missing-rule comparisons must not evaluate unrelated rules/properties')

    monkeypatch.setattr('navigator.changes.evaluate_rules', unexpected_evaluation)
    result = compute_changes(demo, ChangeRequest(test_id=test_id))
    references = definition['rule_ids'] + definition.get('conflict_with', [])
    assert result.status == 'blocked'
    assert result.mapped_rule_ids == {reference: [] for reference in references}
    assert result.affected_address_ids == result.uncertain_address_ids == result.conflict_flag_address_ids == []
    assert result.differences == {}
    expected_notes = [f'Missing extracted legal evidence for {reference}; test cannot be established from its description'
                      for reference in definition['rule_ids']]
    expected_notes += [f'Missing local conflict evidence for {reference}' for reference in definition.get('conflict_with', [])]
    if definition['type'] == 'pending':
        expected_notes.append('Hypothetical only: selected pending rules are assumed enacted and effective on the comparison date; stored law is unchanged')
    assert result.notes == expected_notes
    assert result.before.isoformat() == definition.get('as_of_before', definition.get('as_of'))
    assert result.after.isoformat() == definition.get('as_of_after', definition.get('as_of'))
