"""Fixed synthetic comparison, authored by the implementing Codex agent.

Run from the repository root with .venv/bin/python docs/core/evaluate_planner.py.
No human/independent legal review or organizer scoring is claimed.
"""
from datetime import date
import json
from pathlib import Path
import sys
from tempfile import TemporaryDirectory

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from navigator.core_assist import plan_questions
from navigator.demo import build_demo
from navigator.fact_inputs import FACT_DEFINITIONS
from navigator.models import AnalysisLimits, AssistContext, Bound, Expression


def expr(op, fact=None, value=None, args=()):
    return Expression(op=op, fact=fact, value=value, args=list(args))


def leaves(expression):
    return ({expression.fact} if expression.fact else set()) | set().union(*(leaves(a) for a in expression.args))


def comparison():
    results = []
    with TemporaryDirectory() as directory:
        store = build_demo(Path(directory))
        original = next(iter(store.rules().values()))
        template = store.addresses()['SYNTH-001']
        resolution = store.resolutions()['SYNTH-001']
        fields = ('owner_occupied', 'exemption_filed', 'subsidized')
        for name in ('decisive_units', 'irrelevant_owner', 'occupancy_two_exemptions', 'correlated_contradiction',
                     'joint_only', 'source_gap_only', 'budget_exhausted', 'sufficient_known_bound'):
            rule, prop = original.model_copy(deep=True), template.model_copy(deep=True)
            expected, limits = set(), AnalysisLimits()
            if name == 'decisive_units':
                prop.facts.pop('units')
                expected = {'units'}
            elif name == 'irrelevant_owner':
                rule.exemption_conditions = expr('all', args=[expr('lte', 'units', 2), expr('eq', 'owner_occupied', True)])
            elif name == 'occupancy_two_exemptions':
                rule.coverage_conditions = expr('all', args=[expr('gte', 'units', 4), expr('date_on_or_before', 'certificate_of_occupancy', '2020-06-30')])
                rule.exemption_conditions = expr('any', args=[expr('eq', f, True) for f in fields[:2]])
                expected = {'certificate_of_occupancy', *fields[:2]}
            elif name == 'correlated_contradiction':
                prop.facts.pop('units')
                rule.coverage_conditions = expr('all', args=[expr('lt', 'units', 4), expr('gte', 'units', 4)])
            elif name == 'joint_only':
                rule.coverage_conditions = expr('any', args=[expr('all', args=[expr('eq', f, b) for f in fields]) for b in (False, True)])
                expected = set(fields)
            elif name == 'source_gap_only':
                rule.coverage_conditions = expr('literal', value=True)
                rule.review_issues = ['Missing referenced exception source']
            elif name == 'budget_exhausted':
                four = (*fields, 'condominium')
                rule.coverage_conditions = expr('all', args=[expr('eq', f, True) for f in four])
                expected, limits = set(four), AnalysisLimits(max_evaluations=1)
            else:
                prop.facts.pop('units')
                prop.bounds['units'] = Bound(lower=8, provenance='Synthetic documented lower bound')
            context = AssistContext(property=prop, jurisdiction=resolution, as_of=date(2026, 11, 15),
                rules=[rule], evaluations=[], evidence_reports=[], fact_definitions=FACT_DEFINITIONS, limits=limits)
            plan = plan_questions(context)
            asked = {q.fact.field for q in plan.questions}
            all_missing = {f for f in leaves(rule.coverage_conditions) | leaves(rule.exemption_conditions) if prop.facts.get(f) is None}
            # Authored outcome oracle for these fixed examples, separate from AST evaluation.
            def expected_result(facts):
                if name == 'decisive_units': return 'applies' if facts['units'] >= 8 else 'inapplicable'
                if name == 'occupancy_two_exemptions':
                    occupancy = facts.get('certificate_of_occupancy')
                    if occupancy and occupancy > '2020-06-30': return 'inapplicable'
                    if any(facts.get(f) is True for f in fields[:2]): return 'inapplicable'
                    return 'unknown'  # Displayed alternatives answer only one of three facts.
                if name in {'joint_only', 'source_gap_only', 'budget_exhausted'}: return 'unknown'
                if name == 'correlated_contradiction': return 'inapplicable'
                return 'applies'
            alternatives = [a for q in plan.questions for a in q.alternatives]
            incorrect = sum(a.evaluations[0].result != 'unknown' and a.evaluations[0].result != expected_result({**prop.facts, **a.probe_facts}) for a in alternatives)
            certain = sum(a.evaluations[0].result != 'unknown' for a in alternatives)
            results.append(dict(case=name, expected_useful_fields=sorted(expected), planner_fields=sorted(asked),
                ask_every_missing_fields=sorted(all_missing), generic_unknown_questions=0,
                planner_unnecessary=len(asked - expected), baseline_unnecessary=len(all_missing - expected),
                planner_missed=len(expected - asked), generic_unknown_missed=len(expected),
                displayed_alternatives=len(alternatives), certain_alternatives=certain, incorrect_certainty=incorrect,
                evaluations_used=plan.evaluations_used, status=plan.status, exhaustive=plan.exhaustive))
    totals = {key: sum(row[key] for row in results) for key in ('planner_unnecessary', 'baseline_unnecessary', 'planner_missed', 'generic_unknown_missed', 'displayed_alternatives', 'certain_alternatives', 'incorrect_certainty', 'evaluations_used')}
    totals.update(cases=len(results), planner_questions=sum(len(r['planner_fields']) for r in results),
                  ask_every_missing_questions=sum(len(r['ask_every_missing_fields']) for r in results), generic_unknown_questions=0)
    return {'mode': 'synthetic_software_evaluation', 'expectation_author': 'Implementing Codex agent; read-only agent reviewed algorithmic traps; no human or independent legal review',
            'baseline_definition': 'Ask each absent field referenced by the encoded coverage/exemption AST; generic unknown asks nothing and asserts no certainty.',
            'limitations': 'Eight authored cases, not held out. Baselines assert no hypothetical certainty (0 claims); planner correctness denominator is displayed alternatives and their explicitly certain subset. Exhaustive covers property analysis only. No corpus/legal accuracy measured.',
            'cases': results, 'totals': totals}


if __name__ == '__main__':
    print(json.dumps(comparison(), indent=2))
