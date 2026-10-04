from datetime import date

import pytest
from pydantic import ValidationError

from navigator.engine import evaluate_rule, evaluate_rules, temporal
from navigator.models import Expression, Bound, Interaction, StatusEvent
from navigator.predicates import evaluate_expression

DAY = date(2026, 11, 15)


@pytest.mark.parametrize("op,known,expected", [("all", False, "false"), ("any", True, "true"), ("all", True, "unknown"), ("any", False, "unknown")])
def test_three_valued_short_circuit(prop, op, known, expected):
    expr = Expression(op=op, args=[Expression(op="literal", value=known), Expression(op="eq", fact="owner_occupied", value=True)])
    result = evaluate_expression(expr, prop, DAY)
    assert result.value == expected
    assert result.missing_facts == (["owner_occupied"] if expected == "unknown" else [])


def test_ruled_out_exemption_does_not_request_owner_fact(rule, prop, resolution):
    rule.exemption_conditions = Expression(op="all", args=[Expression(op="lte", fact="units", value=2), Expression(op="eq", fact="owner_occupied", value=True)])
    result = evaluate_rule(rule, prop, resolution, DAY)
    assert result.result == "applies"
    assert not result.missing_facts


@pytest.mark.parametrize("day,expected", [(date(2026, 11, 14), "not_yet_effective"), (DAY, "applies"), (date(2026, 11, 16), "applies")])
def test_effective_date_inclusive(rule, prop, resolution, day, expected):
    assert evaluate_rule(rule, prop, resolution, day).result == expected


def test_pending_never_activates_on_proposed_effective_date(rule):
    rule.lifecycle, rule.status_events, rule.status_as_of = "pending", [], "2026-01-01"
    assert temporal(rule, date(2030, 1, 1)) == "pending"
    rule.lifecycle = "failed"
    assert temporal(rule, date(2030, 1, 1)) == "failed"


def test_partial_effective_date_and_history(rule):
    rule.effective_date = "2026-11"
    assert temporal(rule, date(2026, 11, 1)) == "unknown"
    assert temporal(rule, date(2026, 11, 30)) == "in_force"
    rule.status_events = []
    rule.status_as_of = "2026-12-01"
    assert temporal(rule, date(2026, 11, 30)) == "unknown"


@pytest.mark.parametrize("year", [1977, 1978, 1979])
def test_year_built_never_establishes_certificate_or_occupancy(prop, year):
    prop.facts["year_built"] = year
    for field in ("certificate_of_occupancy", "first_occupancy_date"):
        expr = Expression(op="date_on_or_before", fact=field, value="1978-10-01")
        answer = evaluate_expression(expr, prop, DAY)
        assert answer.value == "unknown" and answer.missing_facts == [field]
        assert field not in answer.supporting_facts
        prop.facts[field] = "1978"
        assert evaluate_expression(expr, prop, DAY).value == "unknown"
        prop.facts[field] = "1978-10-01"
        assert evaluate_expression(expr, prop, DAY).value == "true"


def test_verified_units_bound_can_rule_out_exception(prop):
    prop.facts.pop("units")
    prop.bounds["units"] = Bound(lower=5, provenance="five or more apartments")
    assert evaluate_expression(Expression(op="lte", fact="units", value=2), prop, DAY).value == "false"
    assert evaluate_expression(Expression(op="gte", fact="units", value=8), prop, DAY).value == "unknown"


def test_unsupported_conditions_are_unknown_and_eval_is_rejected(prop):
    assert evaluate_expression(Expression(op="unsupported", reason="requires legal interpretation"), prop, DAY).value == "unknown"
    with pytest.raises(ValidationError): Expression(op="eval", value="__import__('os')")
    with pytest.raises(ValidationError): Expression(op="all", args=[])


def test_municipal_uncertainty_keeps_state_answer(rule, prop, resolution):
    resolution.municipality, resolution.match_quality = None, "unresolved"
    assert evaluate_rule(rule, prop, resolution, DAY).result == "unknown"
    rule.jurisdiction, rule.level = "CA", "state"
    assert evaluate_rule(rule, prop, resolution, DAY).result == "applies"


def state_rule(rule):
    state = rule.model_copy(deep=True)
    state.team_rule_id, state.jurisdiction, state.level, state.citation = "state", "CA", "state", "Synthetic State Code 1"
    return state


def test_supersession_requires_supported_scope_and_known_local_coverage(rule, prop, resolution):
    state = state_rule(rule)
    rule.interactions = [Interaction(kind="supersedes", target_citation=state.citation, target_jurisdiction="CA", category=rule.category, scope=Expression(op="literal", value=True), evidence=rule.evidence, note="synthetic priority evidence")]
    answer = {e.team_rule_id: e for e in evaluate_rules([rule, state], prop, resolution, DAY)}
    assert answer["state"].result == "superseded"
    rule.coverage_conditions = Expression(op="eq", fact="exemption_filed", value=False)
    answer = {e.team_rule_id: e for e in evaluate_rules([rule, state], prop, resolution, DAY)}
    assert answer["state"].result == "applies"
    assert answer["state"].conflict_flag


def test_cyclic_interactions_surface_conflicts(rule, prop, resolution):
    state = state_rule(rule)
    for source, target in [(rule, state), (state, rule)]:
        source.interactions = [Interaction(kind="supersedes", target_citation=target.citation, target_jurisdiction=target.jurisdiction, category=target.category, scope=Expression(op="literal", value=True), evidence=source.evidence, note="synthetic cycle")]
    answers = evaluate_rules([state, rule], prop, resolution, DAY)
    assert all(e.conflict_flag for e in answers)
    assert all(e.result == "applies" for e in answers)


def test_deterministic_evaluation(rule, prop, resolution):
    assert evaluate_rules([rule], prop, resolution, DAY) == evaluate_rules([rule], prop, resolution, DAY)


def test_no_possible_members_does_not_require_missing_fact(prop):
    result = evaluate_expression(Expression(op="in", fact="owner_type", value=[]), prop, DAY)
    assert result.value == "false" and not result.missing_facts


def test_overlapping_versions_need_evidenced_precedence(rule, prop, resolution):
    other = rule.model_copy(deep=True)
    other.team_rule_id = "other-version"
    other.key_value = "different cap"
    results = evaluate_rules([rule, other], prop, resolution, DAY)
    assert all(e.result == "unknown" and e.conflict_flag for e in results)


def link(source, target, scope=True):
    return Interaction(kind='supersedes', target_citation=target.citation,
        target_jurisdiction=target.jurisdiction, category=target.category,
        scope=Expression(op='literal', value=scope), evidence=source.evidence, note='Synthetic priority')


def test_false_scope_reverse_edge_does_not_create_cycle(rule, prop, resolution):
    state = state_rule(rule)
    rule.interactions = [link(rule, state)]
    state.interactions = [link(state, rule, False)]
    answers = {e.team_rule_id: e for e in evaluate_rules([rule, state], prop, resolution, DAY)}
    assert answers['state'].result == 'superseded'
    assert not any(e.conflict_flag for e in answers.values())


def test_false_scope_priority_does_not_hide_overlapping_version_conflict(rule, prop, resolution):
    other = rule.model_copy(deep=True)
    other.team_rule_id, other.requirement = 'other-version', 'A different obligation'
    rule.interactions = [link(rule, other, False)]
    assert all(e.result == 'unknown' and e.conflict_flag for e in evaluate_rules([rule, other], prop, resolution, DAY))


def test_same_citation_override_does_not_target_itself(rule, prop, resolution):
    other = rule.model_copy(deep=True)
    other.team_rule_id, other.requirement = 'other-version', 'Older obligation'
    rule.interactions = [link(rule, other)]
    answers = {e.team_rule_id: e for e in evaluate_rules([rule, other], prop, resolution, DAY)}
    assert answers['other-version'].result == 'superseded'
    assert answers[rule.team_rule_id].result == 'applies'
    assert not any(e.conflict_flag for e in answers.values())


@pytest.mark.parametrize('first,second', [('2026-01-15', '2026-01'), ('2026-01-15', '2026-01-15')])
def test_overlapping_status_events_do_not_invent_order(rule, first, second):
    rule.effective_date = '2026-01-01'
    events = [StatusEvent(status='enacted', on=first, evidence=rule.evidence), StatusEvent(status='failed', on=second, evidence=rule.evidence)]
    for order in (events, list(reversed(events))):
        rule.status_events = order
        assert temporal(rule, DAY) == 'unknown'
    rule.status_events.append(StatusEvent(status='enacted', on='2026-02-01', evidence=rule.evidence))
    assert temporal(rule, DAY) == 'in_force'


def test_undated_failed_snapshot_does_not_establish_history(rule):
    rule.lifecycle, rule.status_events, rule.status_as_of = 'failed', [], None
    assert temporal(rule, date(1900, 1, 1)) == 'unknown'


@pytest.mark.parametrize('snapshot,event_status,event_date,query,expected', [
    ('failed', 'pending', '2026-01-01', '2026-11-15', 'failed'),
    ('enacted', 'pending', '2026-01-01', '2026-11-15', 'in_force'),
    ('pending', 'enacted', '2026-01-01', '2026-11-15', 'pending'),
    ('failed', 'pending', '2026-01-01', '2026-09-30', 'unknown'),
    ('enacted', 'failed', '2026-11-01', '2026-11-15', 'failed'),
    ('enacted', 'failed', '2026-10-01', '2026-11-15', 'unknown'),
    ('enacted', 'failed', '2026-10', '2026-11-15', 'unknown'),
])
def test_dated_snapshot_and_events_share_supported_temporal_order(
        rule, snapshot, event_status, event_date, query, expected):
    rule.lifecycle, rule.status_as_of = snapshot, '2026-10-01'
    rule.effective_date = '2026-06-01'
    rule.status_events = [StatusEvent(status=event_status, on=event_date, evidence=rule.evidence)]
    assert temporal(rule, date.fromisoformat(query)) == expected


def test_partial_snapshot_does_not_invent_transition_day(rule):
    rule.lifecycle, rule.status_as_of = 'failed', '2026-10'
    rule.status_events = [StatusEvent(status='pending', on='2026-01-01', evidence=rule.evidence)]
    assert temporal(rule, date(2026, 1, 1)) == 'pending'
    assert temporal(rule, date(2026, 9, 30)) == 'unknown'
    assert temporal(rule, date(2026, 10, 15)) == 'unknown'
    assert temporal(rule, date(2026, 10, 31)) == 'failed'


@pytest.mark.parametrize('events,query,expected', [
    ([('failed', '2026-09-01')], '2026-08-01', 'pending'),
    ([('failed', '2026-09')], '2026-08-01', 'pending'),
    ([('failed', '2026-09')], '2026-09-15', 'unknown'),
    ([('failed', '2026-09')], '2026-09-30', 'failed'),
    ([('failed', '2026-11-01')], '2026-08-01', 'unknown'),
    ([('failed', '2026-09-01'), ('pending', '2026-09-15')], '2026-08-01', 'unknown'),
])
def test_future_snapshot_preserves_history_only_with_explained_transition(rule, events, query, expected):
    rule.lifecycle, rule.status_as_of = 'failed', '2026-10-01'
    history = [('pending', '2026-01-01'), *events]
    rule.status_events = [StatusEvent(status=status, on=on, evidence=rule.evidence) for status, on in history]
    for ordering in (rule.status_events, list(reversed(rule.status_events))):
        rule.status_events = ordering
        assert temporal(rule, date.fromisoformat(query)) == expected


@pytest.mark.parametrize('snapshot,snapshot_date', [
    ('enacted', '2026-12-01'), ('pending', '2026-01-01'),
])
def test_snapshot_must_establish_enactment_at_query_without_effective_date(
        rule, snapshot, snapshot_date):
    rule.lifecycle, rule.status_as_of = snapshot, snapshot_date
    rule.effective_date = None
    rule.status_events = [StatusEvent(status='enacted', on='2026-06-01', evidence=rule.evidence)]
    assert temporal(rule, date(2026, 11, 15)) == 'unknown'


@pytest.mark.parametrize('snapshot', ['2026-01-01', '2026-10-01'])
def test_reenactment_does_not_reuse_snapshot_as_effective_evidence(rule, snapshot):
    rule.lifecycle, rule.status_as_of, rule.effective_date = 'enacted', snapshot, None
    rule.status_events = [StatusEvent(status=status, on=on, evidence=rule.evidence) for status, on in [
        ('enacted', '2026-01-01'), ('repealed', '2026-03-01'), ('enacted', '2026-06-01'),
    ]]
    assert temporal(rule, date(2026, 11, 15)) == 'unknown'


@pytest.mark.parametrize('with_event', [False, True])
def test_enacted_snapshot_does_not_supply_missing_effective_date(rule, prop, resolution, with_event):
    rule.lifecycle, rule.status_as_of, rule.effective_date = 'enacted', '2026-09-01', None
    rule.status_events = [StatusEvent(status='enacted', on='2026-09-01', evidence=rule.evidence)] if with_event else []
    result = evaluate_rule(rule, prop, resolution, DAY)
    assert result.temporal_status == 'unknown' and result.result == 'unknown'
    assert any('temporal_uncertainty' in reason for reason in result.uncertainty_reasons)


def test_exclusive_end_and_partial_end_boundaries(rule):
    rule.end_date = '2026-12-01'
    assert temporal(rule, date(2026, 11, 30)) == 'in_force'
    assert temporal(rule, date(2026, 12, 1)) == 'inapplicable'
    rule.end_date = '2026-12'
    assert temporal(rule, date(2026, 11, 30)) == 'in_force'
    assert temporal(rule, date(2026, 12, 1)) == 'unknown'
    assert temporal(rule, date(2026, 12, 31)) == 'inapplicable'


def test_parallel_conflict_edge_cannot_be_treated_as_supersession(rule, prop, resolution):
    state = state_rule(rule)
    priority = link(rule, state)
    conflict = priority.model_copy(update={'kind': 'conflicts_with'}, deep=True)
    for order in ([priority, conflict], [conflict, priority]):
        rule.interactions = order
        answers = evaluate_rules([rule, state], prop, resolution, DAY)
        assert all(e.conflict_flag for e in answers)
        assert all(e.result == 'applies' and not e.applied_interactions for e in answers)
