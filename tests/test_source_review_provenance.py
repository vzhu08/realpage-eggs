"""Fictional offline corrections test audit mechanics, not legal accuracy."""
import shutil
from datetime import date

import httpx
import pytest

from navigator.engine import evaluate_rule
from navigator.models import (Evidence, Rule, SourceReview, SourceReviewReferenceDecision,
                              SourceReviewReferenceSpan)
from navigator.source_review import SourceReviewError, source_review_original
from navigator.store import Store, digest
from scripts import assemble_snapshot as assembly


@pytest.fixture
def reviewed_store(demo, tmp_path):
    # Pin a deliberately erroneous date in a fictional original/cache, then
    # correct it to the source's actual fictional November 15 date.
    rules = demo.read('rules.json')
    ident, original = next(iter(rules.items()))
    original.pop('source_review', None)  # Legacy bytes predate the additive field.
    original['effective_date'] = '2026-10-15'
    demo.write('rules.json', rules)
    for path in demo.path('extraction_cache').glob('*.json'):
        cached = demo.read(path.relative_to(demo.root).as_posix())
        cached['bundle']['rules'][0]['effective_date'] = original['effective_date']
        demo.write(path.relative_to(demo.root).as_posix(), cached)
    rule = Rule.model_validate(original)
    rule.effective_date = '2026-11-15'
    source = demo.sources()[rule.source_doc_id]
    proof = next(item.model_copy(deep=True) for item in rule.evidence if 'effective_date' in item.supports)
    rule.source_review = SourceReview(review_id='fictional-date-review',
        reviewed_at='2026-10-04T12:00:00+00:00', original_rule_sha256=digest(original),
        original_extraction_run_id=rule.extraction_run_id, changed_fields=['effective_date'],
        source_hashes={source.doc_id: source.sha256}, evidence=[proof],
        notes=['Fictional fixture correction against its retained date clause; not legal validation.'])
    demo.save_collection('rules', {ident: rule})
    demo.write(f'source_reviews/{rule.source_review.review_id}.json', {
        'version': 'rule-source-review-v1', 'rule_id': ident, 'original_rule': original,
        'amended_rule_sha256': digest(rule.model_dump(mode='json'))})
    return demo


def update(store, mutate_rule=None, mutate_manifest=None):
    rule = next(iter(store.rules().values()))
    name = f'source_reviews/{rule.source_review.review_id}.json'
    manifest = store.read(name)
    if mutate_rule:
        mutate_rule(rule)
    manifest['amended_rule_sha256'] = digest(rule.model_dump(mode='json'))
    if mutate_manifest:
        mutate_manifest(manifest)
    store.save_collection('rules', {rule.team_rule_id: rule})
    store.write(name, manifest)
    return rule


def combine(store, tmp_path):
    geo = Store(tmp_path / 'geo')
    shutil.copytree(store.root, geo.root)
    return assembly.assemble(store.root, geo.root, tmp_path / 'assembled',
        code_revision='a' * 40, expected_addresses=3, synthetic=True)


def test_reviewed_correction_keeps_original_cache_and_assembles_offline(reviewed_store, tmp_path, monkeypatch):
    store = reviewed_store
    before = {p.relative_to(store.root): p.read_bytes() for p in store.root.rglob('*') if p.is_file()}
    monkeypatch.setattr(httpx.Client, 'send', lambda *a, **k: pytest.fail('No network permitted'))
    rule = next(iter(store.rules().values()))
    original = source_review_original(store, rule, store.sources())
    assert original.effective_date == '2026-10-15' and original.source_review is None
    assert rule.effective_date == '2026-11-15'
    assert rule.evidence_mode == original.evidence_mode
    assert rule.extraction_run_id == original.extraction_run_id
    assert rule.review_issues == original.review_issues
    manifest = combine(store, tmp_path)
    assert manifest['status'] == 'assembled' and not manifest['ready_for_submission']
    assert 'source_reviews/fictional-date-review.json' in manifest['output_files']
    assert {p.relative_to(store.root): p.read_bytes() for p in store.root.rglob('*') if p.is_file()} == before
    for name, contents in before.items():
        if name.parts[0] in {'source_reviews', 'extraction_cache', 'provider_outputs'}:
            assert (tmp_path / 'assembled' / name).read_bytes() == contents


@pytest.mark.parametrize('damage,match', [
    ('missing_manifest', 'Missing source review manifest'),
    ('original_hash', 'original rule hash mismatch'),
    ('amended_hash', 'amended rule hash mismatch'),
    ('undeclared_field', 'changed fields mismatch'),
    ('source_hash', 'source hash mismatch'),
    ('quote', 'offsets/quote mismatch'),
    ('missing_binding', 'missing eligible field evidence'),
    ('identity', 'changed fields mismatch'),
])
def test_review_validation_rejects_unpinned_or_unexplained_changes(reviewed_store, damage, match):
    store = reviewed_store
    if damage == 'missing_manifest':
        store.path('source_reviews/fictional-date-review.json').unlink()
    elif damage == 'original_hash':
        update(store, mutate_manifest=lambda m: m['original_rule'].update(effective_date='2026-10-16'))
    elif damage == 'amended_hash':
        update(store, mutate_manifest=lambda m: m.update(amended_rule_sha256='0' * 64))
    elif damage == 'undeclared_field':
        update(store, lambda r: setattr(r, 'requirement', 'An undeclared fictional replacement requirement.'))
    elif damage == 'source_hash':
        update(store, lambda r: r.source_review.source_hashes.update({r.source_doc_id: '0' * 64}))
    elif damage == 'quote':
        update(store, lambda r: setattr(r.source_review.evidence[0], 'start', r.source_review.evidence[0].start + 1))
    elif damage == 'missing_binding':
        update(store, lambda r: setattr(r.source_review.evidence[0], 'supports', ['requirement']))
    else:
        update(store, lambda r: setattr(r, 'jurisdiction', 'Other Fictional City, ZZ'))
    with pytest.raises((SourceReviewError, ValueError), match=match if damage != 'quote' else 'offsets'):
        source_review_original(store, next(iter(store.rules().values())), store.sources())


def test_amendment_cannot_launder_a_fabricated_original_through_assembly(reviewed_store, tmp_path):
    store = reviewed_store
    def fabricated(m):
        m['original_rule']['effective_date'] = '2026-10-16'
    rule = update(store, mutate_manifest=fabricated)
    name = f'source_reviews/{rule.source_review.review_id}.json'
    original = store.read(name)['original_rule']
    rule = update(store, lambda r: setattr(r.source_review, 'original_rule_sha256', digest(original)))
    # Its self-consistent review cannot override the independent original cache.
    assert source_review_original(store, rule, store.sources()).effective_date == '2026-10-16'
    with pytest.raises(assembly.SnapshotError, match='Rule behavior differs from reviewed cache'):
        combine(store, tmp_path)
    assert not (tmp_path / 'assembled').exists()


def test_selected_fields_cannot_enable_scoped_context(reviewed_store):
    rule = next(iter(reviewed_store.rules().values()))
    value = rule.source_review.model_dump(mode='json')
    value.update(context_scope=[value['evidence'][0]], context_scope_note='Fictional scope claim.')
    with pytest.raises(ValueError, match='Only a complete_rule'):
        SourceReview.model_validate(value)


def complete_review(store):
    def change(rule):
        source = store.sources()[rule.source_doc_id]
        fields = ['requirement', 'coverage_conditions', 'exemption_conditions', 'lifecycle',
                  'key_value', 'effective_date', 'exemptions', 'status_events']
        rule.source_review.review_scope = 'complete_rule'
        rule.source_review.reviewed_fields = fields
        rule.source_review.source_hashes = {source.doc_id: source.sha256}
        proof = Evidence(doc_id=source.doc_id, quote=source.text, start=0, end=len(source.text), supports=fields)
        rule.source_review.evidence = [proof]
        rule.source_review.context_scope = [proof.model_copy(deep=True)]
        rule.source_review.context_scope_note = 'Fictional full source retained, including exceptions and date history.'
    return update(store, change)


def test_complete_review_requires_full_fields_and_exact_context_coverage(reviewed_store):
    store = reviewed_store
    rule = complete_review(store)
    assert source_review_original(store, rule, store.sources()).source_review is None
    value = rule.model_dump(mode='json')
    value['source_review']['reviewed_fields'].remove('exemption_conditions')
    with pytest.raises(ValueError, match='every required semantic field'):
        Rule.model_validate(value)
    def omit(rule):
        item = rule.source_review.context_scope[0]
        item.quote = item.quote[:30]
        item.end = item.start + len(item.quote)
    rule = update(store, omit)
    with pytest.raises(SourceReviewError, match='context omits cited'):
        source_review_original(store, rule, store.sources())


def test_source_review_does_not_clear_existing_semantic_or_conflict_gates(reviewed_store):
    store = reviewed_store
    rule = next(iter(store.rules().values()))
    rule.semantic_verification = 'needs_review'
    rule.review_issues.append('Fictional unresolved qualification remains.')
    evaluation = evaluate_rule(rule, store.addresses()['SYNTH-001'],
                               store.resolutions()['SYNTH-001'], date(2026, 11, 15))
    assert evaluation.result == 'unknown'
    assert rule.review_issues == ['Fictional unresolved qualification remains.']


@pytest.mark.parametrize('field,value', [
    ('review_id', '../escape'), ('changed_fields', ['jurisdiction']),
    ('changed_fields', ['evidence_mode']), ('changed_fields', ['effective_date', 'effective_date']),
    ('reviewed_at', '2026-10-04T12:00:00'),
])
def test_source_review_schema_rejects_unsafe_identity_and_metadata(reviewed_store, field, value):
    review = next(iter(reviewed_store.rules().values())).source_review.model_dump(mode='json')
    review[field] = value
    with pytest.raises(ValueError):
        SourceReview.model_validate(review)


def reference_review(store, status='resolved'):
    # Unit-level fictional source-version setup; no claim this amended fixture
    # still matches its prior extraction run. Assembly tests remain independent.
    sources = store.sources()
    source = next(iter(sources.values()))
    source.text += '\nSee section 2.\n'
    source.sha256 = digest(source.text.encode())
    store.save_collection('sources', sources)
    complete_review(store)
    def add(rule):
        quote = 'See section 2.'
        start = source.text.index(quote)
        origin = SourceReviewReferenceSpan(doc_id=source.doc_id, quote=quote, start=start, end=start + len(quote))
        rule.source_review.context_reference_decisions = [SourceReviewReferenceDecision(
            origin=origin, status=status, explanation='Explicitly reviewed fictional proposition boundary.',
            target_spans=rule.source_review.context_scope if status == 'resolved' else [])]
    return update(store, add)


@pytest.mark.parametrize('status', ['resolved', 'not_applicable'])
def test_reference_decisions_accept_exact_short_origins_with_explicit_disposition(reviewed_store, status):
    rule = reference_review(reviewed_store, status)
    assert len(rule.source_review.context_reference_decisions[0].origin.quote) < 20
    assert source_review_original(reviewed_store, rule, reviewed_store.sources()).source_review is None


@pytest.mark.parametrize('damage,match', [
    ('duplicate', 'Duplicate source review reference'),
    ('not_reference', 'exact recognized'),
    ('missing_target', 'requires target spans'),
    ('outside_scope', 'context omits cited'),
    ('no_rationale', 'nonblank explanation'),
])
def test_reference_decisions_reject_unanchored_or_implicit_waivers(reviewed_store, damage, match):
    store = reviewed_store
    reference_review(store)
    def damage_rule(rule):
        review = rule.source_review
        decision = review.context_reference_decisions[0]
        if damage == 'duplicate':
            review.context_reference_decisions.append(decision.model_copy(deep=True))
        elif damage == 'not_reference':
            source = store.sources()[rule.source_doc_id]
            decision.origin = SourceReviewReferenceSpan(doc_id=source.doc_id, quote=source.text[:10], start=0, end=10)
        elif damage == 'missing_target':
            decision.target_spans = []
        elif damage == 'no_rationale':
            decision.explanation = '   '
        else:
            # Ordinary current rule quotes are still covered; the new decision
            # origin and complete target are outside the shortened scope.
            scope = review.context_scope[0]
            scope.end -= len('\nSee section 2.\n')
            scope.quote = scope.quote[:scope.end]
    rule = update(store, damage_rule)
    with pytest.raises(SourceReviewError, match=match):
        source_review_original(store, rule, store.sources())
