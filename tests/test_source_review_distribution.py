"""Derived caches/releases must preserve and revalidate correction manifests."""
import json
import os
from pathlib import Path
from types import SimpleNamespace

import httpx
import pytest

from navigator.assist_cache import AssistCache, Artifact, identity
from navigator.evidence import prepare_rules
from navigator.models import AssistRequest, SourceReview
from navigator.source_review import SourceReviewError, source_review_original
from navigator.store import Store, digest
from scripts import platform_ops
from scripts import apply_source_review, assemble_snapshot


@pytest.fixture
def corrected_demo(demo):
    originals = demo.read('rules.json')
    ident, raw = next(iter(originals.items()))
    rule = demo.rules()[ident]
    rule.title += ' (fictional source review)'
    source = demo.sources()[rule.source_doc_id]
    evidence = rule.evidence[0].model_copy(deep=True)
    evidence.supports = ['title']
    rule.source_review = SourceReview(
        review_id='distribution-test', reviewed_at='2026-10-04T15:00:00+00:00',
        original_rule_sha256=digest(raw), original_extraction_run_id=rule.extraction_run_id,
        changed_fields=['title'], source_hashes={source.doc_id: source.sha256}, evidence=[evidence],
        notes=['Fictional title correction; no legal claim or new provider extraction.'])
    demo.save_collection('rules', {ident: rule})
    demo.write('source_reviews/distribution-test.json', {
        'version': 'rule-source-review-v1', 'rule_id': ident, 'original_rule': raw,
        'amended_rule_sha256': digest(rule.model_dump(mode='json'))})
    return demo


def decoded(result):
    assert isinstance(result, Artifact)
    return json.loads(b''.join(result.chunks(False)))


def test_changed_or_missing_manifest_invalidates_cached_applies_even_same_mtime(corrected_demo, tmp_path):
    store = corrected_demo
    request = AssistRequest(address_id='SYNTH-001', as_of='2026-11-15',
        limits={'max_questions': 1, 'max_fields': 1, 'max_evaluations': 1, 'max_joint_fields': 1})
    cache = AssistCache(tmp_path / 'assist-cache')
    initial = cache.resolve(store, request)
    assert not initial.hit
    expected = decoded(initial)
    assert expected['lookup']['evaluations'][0]['result'] == 'applies'
    hit = cache.resolve(store, request)
    assert hit.hit and decoded(hit) == expected
    before = identity(store)
    rule_bytes = store.path('rules.json').read_bytes()
    manifest = store.path('source_reviews/distribution-test.json')
    original_bytes, stat = manifest.read_bytes(), manifest.stat()
    changed = json.loads(original_bytes)
    changed['amended_rule_sha256'] = '0' * 64
    store.write('source_reviews/distribution-test.json', changed)
    os.utime(manifest, ns=(stat.st_atime_ns, stat.st_mtime_ns))
    assert identity(store) != before
    invalid = cache.resolve(store, request)
    assert not invalid.hit
    invalid_body = decoded(invalid)
    assert invalid_body['lookup']['evaluations'][0]['result'] == 'unknown'
    assert 'invalid_source_review' in invalid_body['evidence_reports'][0]['blocking_issues']
    changed_stamp = identity(store)
    manifest.unlink()
    assert identity(store) != changed_stamp
    missing = cache.resolve(store, request)
    assert not missing.hit
    missing_body = decoded(missing)
    assert missing_body['lookup']['evaluations'][0]['result'] == 'unknown'
    assert 'invalid_source_review' in missing_body['evidence_reports'][0]['blocking_issues']
    assert store.path('rules.json').read_bytes() == rule_bytes
    manifest.write_bytes(original_bytes)
    restored = cache.resolve(store, request)
    assert restored.hit and decoded(restored) == expected


def test_release_copies_review_manifest_and_retains_runtime_validation(corrected_demo, tmp_path, monkeypatch):
    store = corrected_demo
    frontend = tmp_path / 'frontend-dist'
    frontend.mkdir()
    (frontend / 'index.html').write_text('<!doctype html><title>Fictional offline fixture</title>')
    output = tmp_path / 'release'
    monkeypatch.setattr(httpx.Client, 'send', lambda *a, **k: pytest.fail('No network permitted'))
    selected, _ = platform_ops.release_inputs(store.root, frontend)
    name = 'source_reviews/distribution-test.json'
    assert selected[name] == platform_ops.fingerprint(store.path(name))
    platform_ops.prepare_release(SimpleNamespace(data_dir=store.root, frontend_dist=frontend,
        output=output, code_revision='a' * 40, synthetic=True))
    assert (output / 'data' / name).read_bytes() == store.path(name).read_bytes()
    manifest = json.loads((output / 'release.json').read_text())
    assert manifest['files_sha256']['data/' + name] == selected[name]
    packaged = Store(output / 'data')
    prepared, reports = prepare_rules(packaged)
    rule = next(iter(prepared.values()))
    assert rule.source_review.review_id == 'distribution-test'
    assert 'invalid_source_review' not in reports[rule.team_rule_id].blocking_issues


def test_selected_field_review_cannot_clear_original_semantic_gate(corrected_demo):
    store = corrected_demo
    rule = next(iter(store.rules().values()))
    manifest = store.read('source_reviews/distribution-test.json')
    manifest['original_rule']['semantic_verification'] = 'needs_review'
    rule.semantic_verification = 'model_reviewed'
    rule.source_review.changed_fields.append('semantic_verification')
    rule.source_review.original_rule_sha256 = digest(manifest['original_rule'])
    manifest['amended_rule_sha256'] = digest(rule.model_dump(mode='json'))
    store.save_collection('rules', {rule.team_rule_id: rule})
    store.write('source_reviews/distribution-test.json', manifest)
    with pytest.raises(SourceReviewError, match='Selected-field review cannot clear'):
        source_review_original(store, rule, store.sources())
    prepared, reports = prepare_rules(store)
    assert 'invalid_source_review' in reports[rule.team_rule_id].blocking_issues
    assert prepared[rule.team_rule_id].semantic_verification == 'needs_review'


def reconstruction_plan(store):
    rule = next(iter(store.rules().values()))
    raw = store.read('rules.json')[rule.team_rule_id]
    proof = rule.evidence[0].model_copy(deep=True)
    proof.supports = ['title']
    return {
        'version': 'source-review-plan-v1',
        'input_hashes': {name: assemble_snapshot.fingerprint(store.path(name)) for name in
                        ('rules.json', 'sources.json', 'addresses.json', 'resolutions.json', 'extraction_index.json')},
        'reviews': [{'rule_id': rule.team_rule_id, 'original_rule_sha256': digest(raw),
                     'changes': {'title': rule.title + ' (fictional reviewed title)'},
                     'source_hashes': {rule.source_doc_id: store.sources()[rule.source_doc_id].sha256},
                     'evidence': [proof.model_dump(mode='json')],
                     'notes': ['Synthetic reconstruction test; not actual law or provider recovery.']}],
    }


@pytest.fixture
def incomplete_demo(demo):
    rule = next(iter(demo.rules().values()))
    demo.path(f'runs/{rule.extraction_run_id}.json').unlink()
    for path in demo.path('extraction_cache').glob('*.json'):
        path.unlink()
    return demo


def test_missing_historical_provider_artifacts_require_explicit_mode(incomplete_demo, tmp_path):
    output = tmp_path / 'strict'
    with pytest.raises(assemble_snapshot.SnapshotError, match='extraction run'):
        apply_source_review.apply_plan(incomplete_demo.root, output, reconstruction_plan(incomplete_demo))
    assert not output.exists()


def test_explicit_reconstruction_preserves_missing_lineage_and_strict_assembly_rejection(incomplete_demo, tmp_path, monkeypatch):
    store = incomplete_demo
    before = {p.relative_to(store.root): p.read_bytes() for p in store.root.rglob('*') if p.is_file()}
    original = next(iter(store.rules().values()))
    plan = reconstruction_plan(store)
    monkeypatch.setattr(httpx.Client, 'send', lambda *a, **k: pytest.fail('No network permitted'))
    output = tmp_path / 'reconstructed'
    receipt = apply_source_review.apply_plan(store.root, output, plan, reconstructed_input=True)
    assert receipt['provider_calls'] == 0 and receipt['original_store_unchanged']
    assert receipt['historical_extraction_lineage'] == 'unverified_reconstructed_input'
    result = Store(output)
    amended = result.rules()[original.team_rule_id]
    assert amended.extraction_run_id == original.extraction_run_id
    assert amended.evidence_mode == original.evidence_mode
    assert not result.path(f'runs/{original.extraction_run_id}.json').exists()
    assert not list(result.path('extraction_cache').glob('*.json'))
    assert any('historical' in note.lower() and 'unavailable' in note.lower()
               for note in amended.source_review.notes)
    assert result.read('source_review_plan.json') == plan
    assert 'HISTORICAL_EXTRACTION_LINEAGE_INCOMPLETE' in result.read('dataset.json')['label']
    assert result.read('latest_source_review.json')['config']['historical_extraction_lineage'] == 'unverified_reconstructed_input'
    assert source_review_original(result, amended, result.sources()).model_dump() == original.model_dump()
    hashes = assemble_snapshot.inventory(output, apply_source_review.REVIEW_REQUIRED,
        apply_source_review.REVIEW_OPTIONAL, assemble_snapshot.CORE_DIRS + ('geocode_cache',))
    with pytest.raises(assemble_snapshot.SnapshotError, match='extraction run'):
        assemble_snapshot.extraction_provenance(result, result.sources(), result.rules(), hashes)
    assert {p.relative_to(store.root): p.read_bytes() for p in store.root.rglob('*') if p.is_file()} == before
    # Source/fact/geography records are copied byte-for-byte even in explicit mode.
    for name in ('sources.json', 'addresses.json', 'resolutions.json', 'extraction_index.json'):
        assert result.path(name).read_bytes() == before[Path(name)]
    for name in plan['input_hashes']:
        assert result.path(f'source_review_inputs/{name}').read_bytes() == before[Path(name)]


@pytest.mark.parametrize('damage', ['source_hash', 'exact_quote'])
def test_reconstruction_does_not_waive_source_or_quote_integrity(incomplete_demo, tmp_path, damage):
    store = incomplete_demo
    if damage == 'source_hash':
        sources = store.sources()
        next(iter(sources.values())).text += '\nUnhashed fictional text.'
        store.save_collection('sources', sources)
    else:
        rules = store.rules()
        next(iter(rules.values())).evidence[0].start += 1
        store.save_collection('rules', rules)
    output = tmp_path / 'rejected'
    with pytest.raises((assemble_snapshot.SnapshotError, ValueError), match='hash mismatch|offsets/quote mismatch'):
        apply_source_review.apply_plan(store.root, output, reconstruction_plan(store), reconstructed_input=True)
    assert not output.exists()
