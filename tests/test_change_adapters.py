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
