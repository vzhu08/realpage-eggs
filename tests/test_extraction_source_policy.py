"""Source-use regressions run with local fixtures and no external provider."""
import json

import pytest

from navigator.demo import SyntheticProvider, synthetic_bundle
from navigator.extraction import extract, validate_bundle
from navigator.models import ExtractionBundle, NegativeFinding
from scripts.extraction_batch import plan


def real_source(demo, **updates):
    source = next(iter(demo.sources().values())).model_copy(deep=True)
    source.capture_status = 'supplied'
    for name, value in updates.items():
        setattr(source, name, value)
    return source


@pytest.mark.parametrize('updates,status', [
    ({'authority': 'secondary (law firm / news / mirror)'}, 'context_only'),
    ({'capture_status': 'terms_review'}, 'access_blocked'),
    ({'source_type': 'status_record'}, 'context_only'),
])
def test_blocked_source_never_initializes_provider_and_preserves_records(demo, monkeypatch, updates, status):
    from navigator import extraction
    source = real_source(demo, **updates)
    demo.save_collection('sources', {source.doc_id: source})
    before = demo.read('rules.json')
    monkeypatch.setattr(extraction, 'OpenAIProvider', lambda: pytest.fail('Blocked source reached provider'))
    with pytest.raises(ValueError, match='No eligible captured source'):
        extract(demo)
    run = demo.read('latest_extract.json')
    assert run['outcome'] == 'failed' and run['counts']['processed'] == 0
    assert run['config']['skipped_sources'][0]['doc_id'] == source.doc_id
    assert run['config']['skipped_sources'][0]['status'] == status
    assert demo.read('rules.json') == before


def test_source_filter_precedes_limit(demo):
    eligible = next(iter(demo.sources().values())).model_copy(
        update={'doc_id': 'Z-PRIMARY', 'source_type': 'unclassified'}, deep=True)
    blocked = eligible.model_copy(update={'doc_id': 'A-NEWS', 'authority': 'secondary'})
    demo.save_collection('sources', {s.doc_id: s for s in (blocked, eligible)})
    run = extract(demo, limit=1, provider=SyntheticProvider(eligible))
    assert run.outcome == 'success' and run.counts['processed'] == 1
    assert set(run.input_hashes) == {eligible.doc_id}
    assert run.config['skipped_sources'][0]['doc_id'] == blocked.doc_id


@pytest.mark.parametrize('kind', ['agency_guidance', 'status_record', 'secondary', 'unclassified'])
def test_nonprimary_bundle_cannot_certify_rules_or_negative_findings(demo, kind):
    source = real_source(demo)
    bundle = ExtractionBundle.model_validate(synthetic_bundle(source))
    bundle.source_kind = kind
    bundle.negative_findings = [NegativeFinding(jurisdiction='Maple Harbor, CA',
        category='security_deposits', statement='Fictional scope limitation for this fixture.',
        evidence=[bundle.rules[0].evidence[0].model_copy(deep=True)])]
    result = validate_bundle(bundle, {source.doc_id: source}, source.doc_id)
    assert all(any(issue.startswith('source_use:') for issue in rule.review_issues) for rule in result.rules)
    assert result.negative_findings == []
    assert any('Negative finding excluded' in issue for issue in result.issues)


def test_primary_bundle_and_explicit_synthetic_fixture_keep_supported_findings(demo):
    for source in (real_source(demo), next(iter(demo.sources().values()))):
        bundle = ExtractionBundle.model_validate(synthetic_bundle(source))
        bundle.negative_findings = [NegativeFinding(jurisdiction='Maple Harbor, CA',
            category='security_deposits', statement='Fictional scope limitation for this fixture.',
            evidence=[bundle.rules[0].evidence[0].model_copy(deep=True)])]
        result = validate_bundle(bundle, {source.doc_id: source}, source.doc_id)
        assert not any(issue.startswith('source_use:') for rule in result.rules for issue in rule.review_issues)
        assert len(result.negative_findings) == 1


def test_context_from_secondary_supporting_source_keeps_rule_unresolved(demo):
    primary = real_source(demo)
    secondary = primary.model_copy(update={'doc_id': 'SECONDARY', 'authority': 'secondary'})
    bundle = ExtractionBundle.model_validate(synthetic_bundle(primary))
    bundle.rules[0].evidence.append(bundle.rules[0].evidence[0].model_copy(
        update={'doc_id': secondary.doc_id}, deep=True))
    result = validate_bundle(bundle, {s.doc_id: s for s in (primary, secondary)})
    assert any('source_use:context_only: SECONDARY' in issue for issue in result.rules[0].review_issues)


def test_unscoped_bundle_cannot_reclassify_negative_finding_support(demo):
    primary = real_source(demo)
    guidance = primary.model_copy(update={'doc_id': 'GUIDANCE', 'source_type': 'agency_guidance'})
    bundle = ExtractionBundle.model_validate(synthetic_bundle(primary))
    assert bundle.source_kind == 'legal_text'
    bundle.negative_findings = [NegativeFinding(jurisdiction='Maple Harbor, CA',
        category='security_deposits', statement='Fictional scope limitation for this fixture.',
        evidence=[bundle.rules[0].evidence[0].model_copy(update={'doc_id': guidance.doc_id}, deep=True)])]
    result = validate_bundle(bundle, {s.doc_id: s for s in (primary, guidance)})
    assert result.negative_findings == []
    assert any('GUIDANCE: needs_review' in issue for issue in result.issues)


def test_unscoped_bundle_cannot_reclassify_guidance_rule_as_primary(demo):
    guidance = real_source(demo, source_type='agency_guidance')
    bundle = ExtractionBundle.model_validate(synthetic_bundle(guidance))
    assert bundle.source_kind == 'legal_text'
    result = validate_bundle(bundle, {guidance.doc_id: guidance})
    assert all(any(issue.startswith('source_use:needs_review:') for issue in rule.review_issues)
               for rule in result.rules)


def test_existing_cache_is_regated_without_new_calls_or_rewriting_origin(demo):
    source = real_source(demo, source_type='agency_guidance')
    demo.save_collection('sources', {source.doc_id: source})
    cache_path = next((demo.root / 'extraction_cache').glob('*.json'))
    cached = json.loads(cache_path.read_text())
    cached['bundle']['source_kind'] = 'agency_guidance'
    cached['bundle']['negative_findings'] = [{
        'jurisdiction': 'Maple Harbor, CA', 'category': 'security_deposits',
        'statement': 'Fictional scope limitation for this fixture.',
        'evidence': [cached['bundle']['rules'][0]['evidence'][0]],
    }]
    demo.write(str(cache_path.relative_to(demo.root)), cached)
    before = cache_path.read_bytes()

    class NoCalls(SyntheticProvider):
        def generate(self, *_):
            pytest.fail('Existing cache must be regated without a provider call')

    run = extract(demo, provider=NoCalls(source))
    assert run.outcome == 'success' and run.counts['cache_hits'] == 1
    assert all(any(issue.startswith('source_use:needs_review:') for issue in r.review_issues)
               for r in demo.rules().values())
    assert demo.read('negative_findings.json')[source.doc_id] == []
    assert demo.read('extraction_index.json')[source.doc_id]['status'] == 'review'
    assert cache_path.read_bytes() == before
    assert {r.extraction_run_id for r in demo.rules().values()} == {cached['origin_run_id']}


def test_batch_queue_excludes_captured_news_and_terms_blocked_source(demo, tmp_path):
    source = real_source(demo)
    news = source.model_copy(update={'doc_id': 'NEWS', 'authority': 'secondary'})
    terms = source.model_copy(update={'doc_id': 'TERMS', 'capture_status': 'terms_review'})
    demo.save_collection('sources', {s.doc_id: s for s in (source, news, terms)})
    demo.write('extraction_index.json', {})
    pack = tmp_path / 'pack'
    (pack / 'corpus').mkdir(parents=True)
    (pack / 'corpus/source.txt').write_text(source.text)
    (pack / 'corpus/corpus_manifest.csv').write_text(
        'doc_id,text_file\n' + ''.join(f'{s.doc_id},source.txt\n' for s in (source, news, terms)))
    before = {p.relative_to(demo.root): p.read_bytes() for p in demo.root.rglob('*') if p.is_file()}
    output = tmp_path / 'unused-output'
    result = plan(demo.root, output, pack)
    assert [item['doc_id'] for item in result['selected']] == [source.doc_id]
    assert {item['doc_id'] for item in result['excluded_sources']} == {'NEWS', 'TERMS'}
    assert result['provider_calls_started'] == 0 and not output.exists()
    assert before == {p.relative_to(demo.root): p.read_bytes() for p in demo.root.rglob('*') if p.is_file()}


@pytest.mark.parametrize('updates', [
    {'authority': 'secondary (law firm / news / mirror)'},
    {'capture_status': 'terms_review'},
    {'source_type': 'status_record'},
])
def test_pilot_preflight_blocks_before_credentials_or_working_copy(demo, tmp_path, monkeypatch, updates):
    from scripts import extraction_pilot
    source = real_source(demo, **updates)
    demo.save_collection('sources', {source.doc_id: source})
    monkeypatch.setattr(extraction_pilot, 'configure_credentials',
                        lambda *_: pytest.fail('Ineligible pilot reached credential setup'))
    output = tmp_path / 'blocked-pilot'
    with pytest.raises(ValueError, match='not eligible for extraction'):
        extraction_pilot.main(['--source-dir', str(demo.root), '--output', str(output),
                              '--doc-id', source.doc_id, '--execute'])
    assert not output.exists()
