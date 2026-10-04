"""Question priority fixtures are fictional; they do not establish legal support."""
from datetime import date

import pytest

from navigator.fact_inputs import FACT_DEFINITIONS
from navigator.models import (AnalysisLimits, AssistContext, EvidenceCheck, EvidenceReport,
                              Expression, FactDefinition, Interaction, SourceContext)
from navigator.question_planner import ALGORITHM_VERSION, plan_questions

DAY = date(2026, 11, 15)


def report(rule):
    return EvidenceReport(rule_id=rule.team_rule_id, rule_hash='fictional-priority-fixture',
        checks=[EvidenceCheck(kind='source_availability', status='pass', message='Fictional retained source'),
                EvidenceCheck(kind='dependencies', status='pass', message='Fictional references available')],
        context=SourceContext(spans=[], dependencies=[], status='available', limits={}, limits_hit=[]),
        blocking_issues=[], disclaimer='Synthetic software test, not legal evidence')


@pytest.fixture
def priority_context(rule, prop, resolution):
    prop.facts.pop('units')
    clean = rule.model_copy(deep=True)
    clean.team_rule_id = 'fictional-clean'
    clean.coverage_conditions = Expression(op='eq', fact='owner_occupied', value=True)
    clean.exemption_conditions = Expression(op='literal', value=False)
    clean.review_issues = []
    noisy = clean.model_copy(deep=True)
    noisy.team_rule_id = 'fictional-noisy'
    noisy.coverage_conditions = Expression(op='all', args=[
        Expression(op='gte', fact='units', value=value) for value in range(1, 9)])
    return AssistContext(property=prop, jurisdiction=resolution, as_of=DAY,
        rules=[clean, noisy], evaluations=[], evidence_reports=[report(clean), report(noisy)],
        fact_definitions=FACT_DEFINITIONS,
        limits=AnalysisLimits(max_fields=1, max_questions=1, max_evaluations=1))


@pytest.mark.parametrize('blocker', ['review', 'unsupported', 'unknown_date', 'semantic',
                                    'conflict', 'evidence', 'partial_context', 'unregistered',
                                    'unsupported_domain', 'missing_interaction'])
def test_other_blockers_cannot_crowd_supported_fact_under_one_field_limit(priority_context, blocker):
    ctx = priority_context
    noisy = ctx.rules[1]
    if blocker == 'review':
        noisy.review_issues = ['A source qualification remains unresolved.']
    elif blocker == 'unsupported':
        noisy.coverage_conditions.args.append(Expression(op='unsupported', reason='Uncompiled legal definition'))
    elif blocker == 'unknown_date':
        noisy.effective_date = None
    elif blocker == 'semantic':
        noisy.semantic_verification = 'needs_review'
    elif blocker == 'conflict':
        noisy.conflict_flag = True
    elif blocker == 'evidence':
        ctx.evidence_reports[1].blocking_issues = ['missing_source:fictional-authority']
    elif blocker == 'partial_context':
        ctx.evidence_reports[1].context.status = 'partial'
        ctx.evidence_reports[1].context.limits_hit = ['max_chars']
    elif blocker == 'unregistered':
        noisy.coverage_conditions.args.append(Expression(op='eq', fact='unregistered_fixture_fact', value=True))
    elif blocker == 'unsupported_domain':
        noisy.coverage_conditions.args.append(Expression(op='eq', fact='fixture_text', value='unbounded domain'))
        ctx.fact_definitions['fixture_text'] = FactDefinition(field='fixture_text', meaning='Fictional text value', data_type='string')
    else:
        noisy.interactions = [Interaction(kind='supersedes', target_citation='Missing fictional target',
            target_jurisdiction=noisy.jurisdiction, category=noisy.category,
            scope=Expression(op='literal', value=True), evidence=noisy.evidence, note='Synthetic unresolved dependency')]
    before = ctx.model_dump_json()
    plan = plan_questions(ctx)
    assert [question.fact.field for question in plan.questions] == ['owner_occupied']
    assert plan.questions[0].rank_score == .5  # The unchanged within-tier score, not a certainty score.
    assert plan.questions[0].ranking_rationale.startswith('Priority tier 1:')
    assert plan.algorithm_version == ALGORITHM_VERSION != 'correlated-partitions-v3'
    assert plan.evaluations_used == 1 and plan.questions[0].alternatives == []
    assert {'max_fields', 'max_evaluations'} <= set(plan.limits_hit)
    assert plan.status == 'partial' and not plan.exhaustive
    assert any(u.field == 'units' for u in plan.remaining_uncertainty)
    if blocker == 'unsupported_domain':
        # The field was not selected for exploration; its uncertainty and the
        # max_fields limit remain rather than inventing a completed analysis.
        assert any(u.field == 'fixture_text' for u in plan.remaining_uncertainty)
    else:
        assert any(noisy.team_rule_id in u.rule_ids and u.kind != 'property_fact'
                   for u in plan.remaining_uncertainty)
    assert ctx.model_dump_json() == before


def test_missing_report_never_earns_first_tier(priority_context):
    ctx = priority_context
    ctx.rules[1].review_issues = ['Unresolved noisy rule.']
    ctx.evidence_reports = [ctx.evidence_reports[1]]
    plan = plan_questions(ctx)
    assert [question.fact.field for question in plan.questions] == ['units']
    assert plan.questions[0].ranking_rationale.startswith('Priority tier 2:')


def test_missing_unrelated_report_does_not_remove_clean_rules_priority(priority_context):
    ctx = priority_context
    ctx.evidence_reports = [ctx.evidence_reports[0]]
    plan = plan_questions(ctx)
    assert [question.fact.field for question in plan.questions] == ['owner_occupied']
    assert plan.questions[0].ranking_rationale.startswith('Priority tier 1:')


def test_irrelevant_unsupported_leaf_does_not_block_priority(priority_context):
    ctx = priority_context
    ctx.rules[0].coverage_conditions = Expression(op='all', args=[ctx.rules[0].coverage_conditions,
        Expression(op='any', args=[Expression(op='literal', value=True),
            Expression(op='unsupported', reason='Short-circuited fictional condition')])])
    ctx.rules[1].review_issues = ['Noisy source needs review.']
    plan = plan_questions(ctx)
    assert [question.fact.field for question in plan.questions] == ['owner_occupied']
    assert plan.questions[0].ranking_rationale.startswith('Priority tier 1:')


def test_within_tier_frequency_effort_order_and_scores_are_unchanged(priority_context):
    ctx = priority_context
    ctx.limits.max_fields = ctx.limits.max_questions = 2
    plan = plan_questions(ctx)
    assert [question.fact.field for question in plan.questions] == ['units', 'owner_occupied']
    assert [question.rank_score for question in plan.questions] == [8, .5]
    assert all(question.ranking_rationale.startswith('Priority tier 1:') for question in plan.questions)
    ctx.rules.reverse()
    ctx.evidence_reports.reverse()
    assert plan_questions(ctx) == plan
