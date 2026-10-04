"""Fixed HTTP/planner comparison. No provider calls and no original-store writes.

The real D001 record is unchanged, but its original source is missing locally and
its property is synthetic. This slice is not integrated real-data acceptance.
Other real cases stay explicitly blocked until CORE-06/PLAT-06 supply inputs.
"""
from contextlib import ExitStack
from datetime import date
import hashlib
import json
from pathlib import Path
import statistics
import sys
from tempfile import TemporaryDirectory
from time import perf_counter
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from fastapi.testclient import TestClient
from navigator import engine
from navigator.api import create_app
from navigator.core_assist import plan_questions
from navigator.demo import build_demo
from navigator.evidence import prepare_rules
from navigator.fact_inputs import FACT_DEFINITIONS
from navigator.models import AnalysisLimits, AssistContext, AssistResponse, Expression, Rule
from navigator.question_planner import ALGORITHM_VERSION
from navigator.rule_renderer import RENDERER_VERSION

MANIFEST = ROOT / 'tests/fixtures/core_navigation/benchmark_cases.json'


def expr(op, fact=None, value=None, args=()):
    return Expression(op=op, fact=fact, value=value, args=list(args))


def fields(expression):
    return ({expression.fact} if expression.fact else set()) | set().union(*(fields(a) for a in expression.args))


def signatures(evaluations):
    return {e.team_rule_id: (e.result, e.coverage.value, e.temporal_status,
                            e.conflict_flag, e.applied_interactions, e.uncertainty_reasons)
            for e in evaluations if e.result not in {'inapplicable', 'failed'}}


def build_case(root, case):
    store = build_demo(root)
    rule = next(iter(store.rules().values()))
    # Remove generated fixture run identity from reproducibility comparisons.
    rule.extraction_run_id = 'fixed-core07-synthetic-extraction'
    prop = store.addresses()['SYNTH-001']
    prop.facts = {'residential': True, 'units': 12}
    prop.bounds = {}
    prop.provenance = {k: 'Agent-authored synthetic benchmark fact' for k in prop.facts}
    resolution = store.resolutions()[prop.address_id]
    name = case['id']
    rules = [rule]
    limits = AnalysisLimits()
    if name in {'decisive_fact', 'missing_source', 'conflicting_versions', 'bounded_analysis'}:
        prop.facts.pop('units')
    if name == 'irrelevant_fact':
        rule.exemption_conditions = expr('all', args=[expr('lte', 'units', 2), expr('eq', 'owner_occupied', True)])
    elif name == 'two_exemptions':
        rule.exemption_conditions = expr('any', args=[expr('eq', f, True) for f in ('owner_occupied', 'exemption_filed')])
    elif name == 'partial_occupancy':
        prop.facts['certificate_of_occupancy'] = '2020-06'
        rule.coverage_conditions = expr('date_on_or_before', 'certificate_of_occupancy', '2020-06-15')
    elif name == 'missing_source':
        store.save_collection('sources', {})
    elif name == 'conflicting_versions':
        other = rule.model_copy(deep=True)
        other.team_rule_id += '-conflicting-version'
        other.key_value = 'Conflicting synthetic amount'
        rules.append(other)
    elif name == 'bounded_analysis':
        rule.exemption_conditions = expr('eq', 'owner_occupied', True)
        limits = AnalysisLimits(max_evaluations=2)
    elif name == 'berkeley_pending_and_missing_original':
        record = json.loads((ROOT / case['record']).read_text())
        rules = [Rule.model_validate(r) for r in record['rules'] if r['team_rule_id'] in case['rule_ids']]
        assert {r.team_rule_id for r in rules} == set(case['rule_ids'])
        # This is explicitly a test property, never an organizer benchmark address.
        prop.raw_address.postal_city = 'Berkeley'
        prop.normalized_address = 'SYNTHETIC TEST PROPERTY, BERKELEY, CA'
        resolution.municipality = 'Berkeley'
        resolution.method = 'synthetic_test_geography_not_verified'
        store.save_collection('sources', {})
        store.write('dataset.json', {'mode': 'real_record_with_synthetic_property',
            'label': 'UNREVIEWED_REAL_EXTRACTION_RECORD; ORIGINAL_SOURCE_MISSING; SYNTHETIC_PROPERTY'})
    store.save_collection('rules', {r.team_rule_id: r for r in rules})
    store.save_collection('addresses', {prop.address_id: prop})
    store.save_collection('resolutions', {prop.address_id: resolution})
    return store, {'address_id': prop.address_id, 'as_of': case.get('as_of', '2026-11-15'),
                   'limits': limits.model_dump()}, prop, resolution


def expected_results(name, facts, rule_ids):
    """Fixed, agent-authored test oracle; not production evaluation or legal truth."""
    if name == 'berkeley_pending_and_missing_original':
        return {ident: 'pending' for ident in rule_ids}
    if name == 'partial_occupancy':
        value = facts.get('certificate_of_occupancy')
        result = 'unknown' if value is None or len(value) < 10 else 'applies' if value <= '2020-06-15' else 'inapplicable'
    elif name == 'two_exemptions':
        values = [facts.get(f) for f in ('owner_occupied', 'exemption_filed')]
        result = 'inapplicable' if True in values else 'applies' if values == [False, False] else 'unknown'
    else:
        units = facts.get('units')
        result = 'unknown' if units is None else 'applies' if units >= 8 else 'inapplicable'
        if name in {'missing_source', 'conflicting_versions'} and result == 'applies':
            result = 'unknown'
        if name == 'bounded_analysis' and result != 'inapplicable':
            result = 'inapplicable' if facts.get('owner_occupied') is True else 'unknown'
    return {ident: result for ident in rule_ids}


def run_case(directory, case):
    store, request, prop, resolution = build_case(directory, case)
    original = {p.name: p.read_bytes() for p in directory.glob('*.json')}
    prepared, reports = prepare_rules(store)
    context = AssistContext(property=prop, jurisdiction=resolution, as_of=date.fromisoformat(request['as_of']),
        rules=list(prepared.values()), evaluations=[], evidence_reports=list(reports.values()),
        fact_definitions=FACT_DEFINITIONS, limits=AnalysisLimits.model_validate(request['limits']))
    latency = {'planner_ms': [], 'ask_every_missing_ms': [], 'generic_unknown_ms': [], 'assist_http_ms': []}
    baseline_fields = set()
    for _ in range(3):
        started = perf_counter()
        plan = plan_questions(context)
        latency['planner_ms'].append((perf_counter() - started) * 1000)
        started = perf_counter()
        engine.evaluate_rules(context.rules, prop, resolution, context.as_of)
        # Deliberately naive baseline asks any absent encoded field, even if it
        # is not in the supported input registry or a decisive branch ignores it.
        baseline_fields = {f for r in context.rules for f in fields(r.coverage_conditions) | fields(r.exemption_conditions)
                           if prop.facts.get(f) is None}
        latency['ask_every_missing_ms'].append((perf_counter() - started) * 1000)
        started = perf_counter()
        engine.evaluate_rules(context.rules, prop, resolution, context.as_of)
        latency['generic_unknown_ms'].append((perf_counter() - started) * 1000)
    with TestClient(create_app(store.root)) as client:
        repetitions = []
        for _ in range(3):
            started = perf_counter()
            response = client.post('/api/v1/lookup/assist', json=request)
            latency['assist_http_ms'].append((perf_counter() - started) * 1000)
            assert response.status_code == 200, response.text
            repetitions.append(response.json())
        assert repetitions[0] == repetitions[1] == repetitions[2], 'HTTP response is not deterministic'
        body = AssistResponse.model_validate(repetitions[0])
        assert body.question_plan == plan
        if case['id'] == 'berkeley_pending_and_missing_original':
            assert {e.team_rule_id: e.result for e in body.lookup.evaluations} == {
                ident: 'pending' for ident in case['rule_ids']}
            record = json.loads((ROOT / case['record']).read_text())
            assert [r.model_dump(mode='json') for r in store.rules().values()] == sorted(
                [Rule.model_validate(r).model_dump(mode='json') for r in record['rules'] if r['team_rule_id'] in case['rule_ids']], key=lambda r: r['team_rule_id'])
        # Count route evaluator invocations separately: two common calls plus
        # the planner's declared budget, regardless of candidate count.
        actual_evaluator = engine.evaluate_rules
        with ExitStack() as stack:
            counters = [stack.enter_context(patch(path, wraps=actual_evaluator)) for path in
                        ('navigator.engine.evaluate_rules', 'navigator.service.evaluate_rules', 'navigator.assist_service.evaluate_rules')]
            checked = client.post('/api/v1/lookup/assist', json=request)
            assert checked.status_code == 200
            calls = sum(counter.call_count for counter in counters)
        assert calls == plan.evaluations_used + 2
        alternatives = [a for q in plan.questions for a in q.alternatives]
        alternative_remedies = {u.kind for a in alternatives for u in a.remaining_uncertainty}
        missing_alternative_remedies = sorted(set(case.get("expected_alternative_remedies", [])) - alternative_remedies)
        mismatches = incorrect = certain = evaluations = 0
        lost_remedies = 0
        for alternative in alternatives:
            response = client.post('/api/v1/lookup/assist', json={**request, 'answers': [
                {'field': f, 'value': v} for f, v in alternative.probe_facts.items()]})
            assert response.status_code == 200, response.text
            answered = AssistResponse.model_validate(response.json())
            mismatches += signatures(alternative.evaluations) != signatures(answered.lookup.evaluations)
            expected = expected_results(case['id'], {**prop.facts, **alternative.probe_facts}, prepared)
            for evaluation in alternative.evaluations:
                evaluations += 1
                if evaluation.result != 'unknown':
                    certain += 1
                    incorrect += evaluation.result != expected[evaluation.team_rule_id]
            # Legal/source gaps persist even when the answer rules out coverage.
            persistent = {u.kind for u in plan.remaining_uncertainty if u.kind in {'source_gap', 'cross_reference', 'interpretation'}}
            lost_remedies += len(persistent - {u.kind for u in answered.question_plan.remaining_uncertainty})
            for field in alternative.probe_facts:
                assert 'User-supplied' in answered.lookup.address.provenance[field]
                assert 'probe' not in answered.lookup.address.provenance[field].lower()
        reset = client.post('/api/v1/lookup/assist', json=request).json()
        assert reset == repetitions[0]
    assert original == {p.name: p.read_bytes() for p in directory.glob('*.json')}, 'HTTP mutated fixture store'
    asked = {q.fact.field for q in plan.questions}
    expected = set(case['expected_useful_fields'])
    remedies = {u.kind for u in plan.remaining_uncertainty}
    return {'case': case['id'], 'mode': case['mode'], 'expected_useful_fields': sorted(expected),
            'planner_fields': sorted(asked), 'baseline_fields': sorted(baseline_fields),
            'planner_questions': len(asked), 'ask_every_missing_questions': len(baseline_fields), 'generic_unknown_questions': 0,
            'planner_unnecessary': len(asked - expected), 'baseline_unnecessary': len(baseline_fields - expected),
            'planner_missed': len(expected - asked), 'baseline_missed': len(expected - baseline_fields), 'generic_unknown_missed': len(expected),
            'missing_expected_remedies': sorted(set(case['expected_remedies']) - remedies),
            'missing_expected_alternative_remedies': missing_alternative_remedies,
            'displayed_alternatives': len(alternatives), 'alternative_rule_evaluations': evaluations,
            'certain_rule_evaluations': certain, 'incorrect_certainty': incorrect, 'http_mismatches': mismatches,
            'lost_persistent_remedy_kinds': lost_remedies, 'planner_evaluations': plan.evaluations_used,
            'ask_every_missing_evaluations': 1, 'generic_unknown_evaluations': 1, 'assist_http_evaluations': calls,
            'latency': {name: {'samples': len(values), 'median_ms': round(statistics.median(values), 3),
                             'min_ms': round(min(values), 3), 'max_ms': round(max(values), 3)} for name, values in latency.items()},
            'deterministic_repeats': 3, 'store_unchanged': True, 'status': plan.status, 'exhaustive': plan.exhaustive}


def comparison():
    manifest = json.loads(MANIFEST.read_text())
    with TemporaryDirectory(prefix='core07-benchmark-') as directory:
        rows = [run_case(Path(directory) / case['id'], case) for case in manifest['cases']]
    counts = ('planner_questions', 'ask_every_missing_questions', 'generic_unknown_questions',
              'planner_unnecessary', 'baseline_unnecessary', 'planner_missed', 'baseline_missed', 'generic_unknown_missed',
              'displayed_alternatives', 'alternative_rule_evaluations', 'certain_rule_evaluations',
              'incorrect_certainty', 'http_mismatches', 'lost_persistent_remedy_kinds', 'planner_evaluations',
              'ask_every_missing_evaluations', 'generic_unknown_evaluations', 'assist_http_evaluations')
    cohorts = {}
    for mode in sorted({r['mode'] for r in rows}):
        subset = [r for r in rows if r['mode'] == mode]
        cohorts[mode] = {'cases': len(subset), 'expected_useful_facts': sum(len(r['expected_useful_fields']) for r in subset),
                        **{key: sum(r[key] for r in subset) for key in counts}}
    return {'benchmark_version': manifest['version'], 'algorithm_version': ALGORITHM_VERSION,
            'renderer_version': RENDERER_VERSION, 'expectation_author': manifest['expectation_author'],
            'human_reviewer': manifest['human_reviewer'], 'review_status': manifest['review_status'],
            'input_sha256': {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in
                            (MANIFEST, ROOT / 'docs/core/core01_d001_live.json')},
            'method': 'Fixed agent-authored cases. All displayed probes replayed through production HTTP handlers and actual Core; no mocked planner. Baselines make zero hypothetical certainty claims. Baseline selection includes one common evaluation, planner includes its baseline and probes. HTTP includes two additional Platform evaluations. Latencies are three observed in-process samples, not load-test or network latency.',
            'certainty_denominator': 'All displayed alternative rule evaluations; also report subset with result other than unknown. Software oracle only, never legal verification.',
            'limitations': 'Seven synthetic cases and one unchanged real extraction record with a synthetic property and unavailable original snapshot. Cohorts are separate. No integrated corpus or independent legal score. Real-case bindings, sources and human review remain pending.',
            'cases': rows, 'cohorts': cohorts, 'real_snapshot_cases_pending': manifest['real_snapshot_cases_pending']}


if __name__ == '__main__':
    result = comparison()
    rendered = json.dumps(result, indent=2, ensure_ascii=False) + '\n'
    if len(sys.argv) > 1:
        Path(sys.argv[1]).write_text(rendered)
        print(json.dumps(result['cohorts'], indent=2))
    else:
        print(rendered)
    failed = any(row['planner_unnecessary'] or row['planner_missed'] or row['incorrect_certainty'] or
                 row['http_mismatches'] or row['missing_expected_remedies'] or row['missing_expected_alternative_remedies'] or row['lost_persistent_remedy_kinds']
                 for row in result['cases'])
    raise SystemExit(int(failed))
