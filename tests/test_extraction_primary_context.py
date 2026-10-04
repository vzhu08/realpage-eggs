"""Bounded primary-document context; all provider responses are fictional and local."""
from copy import deepcopy
import json

import pytest

from navigator import extraction
from navigator.demo import synthetic_bundle
from navigator.models import ExtractionBundle, SourceDocument
from navigator.store import digest


def source_with_text(text):
    return SourceDocument(doc_id='FICTIONAL-CONTEXT', jurisdictions=['Maple Harbor, CA'],
        url='https://example.invalid/primary-context', retrieved_at='2026-10-03', text=text,
        sha256=digest(text.encode()), authority='synthetic', source_type='legal_text',
        capture_status='synthetic')


def complete_spans(payload):
    start = payload['original_offset']
    return sorted([{'start': start, 'end': start + len(payload['source_text']),
                    'text': payload['source_text']}, *payload['primary_document_context']['spans']],
                  key=lambda span: span['start'])


def test_two_segments_each_retain_exact_scope_and_dated_footer_without_duplication():
    scope = 'Fictional scope: this section governs residential tenant dwellings.\n'
    footer = '\nFictional amendment: effective January 1, 2026.'
    source = source_with_text(scope + 'Explicit fictional body text. ' * 900 + footer)
    before = source.model_dump()
    chunks = list(extraction.chunks(source.text))
    assert len(chunks) == 2
    assert footer not in chunks[0][1] and scope not in chunks[1][1]
    for offset, segment in chunks:
        payload = extraction.source_segment_payload(source, offset, segment)
        context = payload['primary_document_context']
        assert context['status'] == 'complete' and context['omitted_ranges'] == []
        assert context['source_sha256'] == source.sha256
        assert context['source_chars'] == len(source.text)
        spans = complete_spans(payload)
        assert ''.join(span['text'] for span in spans) == source.text
        cursor = 0
        for span in spans:
            assert span['start'] == cursor
            assert span['text'] == source.text[span['start']:span['end']]
            cursor = span['end']
        assert cursor == len(source.text)
    assert source.model_dump() == before


def test_single_segment_does_not_duplicate_source_and_always_supplies_full_hash():
    source = source_with_text('Fictional short section with an explicit scope.')
    payload = extraction.source_segment_payload(source, 0, source.text)
    assert payload['primary_document_context'] == {
        'version': extraction.PRIMARY_CONTEXT_VERSION, 'doc_id': source.doc_id,
        'source_sha256': source.sha256, 'source_chars': len(source.text),
        'status': 'complete', 'spans': [], 'omitted_ranges': []}
    assert 'supporting_sources' not in payload


def test_large_unicode_source_is_bounded_and_explicitly_reports_omitted_ranges():
    source = source_with_text('Fictional ☃🔬 text\n' * 6000)
    offset, end = 24000, 42000
    payload = extraction.source_segment_payload(source, offset, source.text[offset:end])
    context = payload['primary_document_context']
    boundary = extraction.PRIMARY_BOUNDARY_CHARS
    assert context['status'] == 'partial'
    assert context['omitted_ranges'] == [
        {'start': boundary, 'end': offset},
        {'start': end, 'end': len(source.text) - boundary}]
    assert sum(len(span['text']) for span in context['spans']) == boundary * 2
    for span in context['spans']:
        assert span['text'] == source.text[span['start']:span['end']]
        assert span['end'] <= offset or span['start'] >= end
    assert digest(source.text.encode()) == context['source_sha256']


@pytest.mark.parametrize('offset,text,wrong_hash', [(-1, 'test', False), (0, 'different', False),
                                                   (0, 'Fictional source', True)])
def test_mismatched_focus_or_full_hash_is_rejected(offset, text, wrong_hash):
    source = source_with_text('Fictional source')
    if wrong_hash:
        source.sha256 = '0' * 64
    with pytest.raises(ValueError, match='(Focus segment|text/hash mismatch)'):
        extraction.source_segment_payload(source, offset, text)


def test_main_quote_must_be_in_focus_but_scope_and_date_can_use_context(demo):
    source = next(iter(demo.sources().values()))
    bundle = synthetic_bundle(source)
    quote = bundle['rules'][0]['quoted_span']
    validated = extraction.validate_bundle(ExtractionBundle.model_validate(bundle),
        demo.sources(), source.doc_id, focus_text=quote)
    assert not validated.rules[0].review_issues
    assert any(span.quote not in quote for span in validated.rules[0].evidence)
    with pytest.raises(ValueError, match='outside the extraction focus segment'):
        extraction.validate_bundle(ExtractionBundle.model_validate(bundle), demo.sources(),
                                  source.doc_id, focus_text=source.text[:30])


class LocalProvider:
    mode, model, usage = 'synthetic', 'fictional-primary-context-local', []

    def __init__(self, *outputs):
        self.outputs, self.requests = outputs, []

    def generate(self, instruction, payload):
        assert payload['doc_id'] == 'SYNTHETIC-42'
        assert payload['source_url'] == 'https://example.invalid/synthetic-42'
        self.requests.append((instruction, deepcopy(payload)))
        return deepcopy(self.outputs[min(len(self.requests) - 1, len(self.outputs) - 1)])


def test_draft_review_and_bounded_repair_receive_identical_primary_context(demo):
    source = next(iter(demo.sources().values()))
    repaired = synthetic_bundle(source)
    invalid = deepcopy(repaired)
    invalid['rules'][0]['coverage_conditions'] = {'op': 'eq', 'fact': 'owner_type', 'value': 'natural_person'}
    provider = LocalProvider(invalid, invalid, repaired)
    run = extraction.extract(demo, provider=provider)
    assert run.outcome == 'success' and len(provider.requests) == 3
    expected = extraction.primary_document_context(source, 0, source.text)
    assert all(payload['primary_document_context'] == expected for _, payload in provider.requests)
    assert run.config['primary_context_version'] == extraction.PRIMARY_CONTEXT_VERSION
    cache = next(path for path in (demo.root / 'extraction_cache').glob('*.json')
                 if json.loads(path.read_text())['model'] == provider.model)
    assert json.loads(cache.read_text())['primary_context_sha256'] == digest(expected)


def test_irreparable_context_only_rule_cannot_replace_prior_candidates(demo, monkeypatch):
    source = next(iter(demo.sources().values()))
    before = demo.read('rules.json')
    provider = LocalProvider(synthetic_bundle(source))
    monkeypatch.setattr(extraction, 'chunks', lambda text: [(0, text[:30])])
    run = extraction.extract(demo, provider=provider)
    assert run.outcome == 'failed' and len(provider.requests) == 3
    assert any('outside the extraction focus segment' in error for error in run.errors)
    assert demo.read('rules.json') == before
    assert demo.read('extraction_index.json')[source.doc_id]['status'] == 'failed'
    assert not any(json.loads(path.read_text())['model'] == provider.model
                   for path in (demo.root / 'extraction_cache').glob('*.json'))


def test_context_version_invalidates_cache_without_supporting_sources(demo, monkeypatch):
    source = next(iter(demo.sources().values()))
    provider = LocalProvider(synthetic_bundle(source))
    first = extraction.extract(demo, provider=provider)
    cache_before = {path: path.read_bytes() for path in (demo.root / 'extraction_cache').glob('*.json')}
    provider.requests.clear()
    replay = extraction.extract(demo, provider=provider)
    assert replay.counts['cache_hits'] == 1 and not provider.requests
    monkeypatch.setattr(extraction, 'PRIMARY_CONTEXT_VERSION', 'fictional-next-context-version')
    newer = extraction.extract(demo, provider=provider)
    assert newer.outcome == first.outcome == 'success'
    assert newer.counts['cache_hits'] == 0 and len(provider.requests) == 2
    assert all(path.read_bytes() == data for path, data in cache_before.items())


def test_source_change_outside_identical_focus_changes_cache_identity(demo, monkeypatch):
    source = next(iter(demo.sources().values()))
    focus = source.text
    monkeypatch.setattr(extraction, 'chunks', lambda text: [(0, focus)])
    provider = LocalProvider(synthetic_bundle(source))
    first = extraction.extract(demo, provider=provider)
    cache_before = {path: path.read_bytes() for path in (demo.root / 'extraction_cache').glob('*.json')}
    source.text += '\nFictional appendix containing additional source context.'
    source.sha256 = digest(source.text.encode())
    demo.save_collection('sources', {source.doc_id: source})
    provider.requests.clear()
    changed = extraction.extract(demo, provider=provider)
    assert changed.outcome == first.outcome == 'success'
    assert changed.counts['cache_hits'] == 0 and len(provider.requests) == 2
    assert provider.requests[0][1]['source_text'] == focus
    assert provider.requests[0][1]['primary_document_context']['source_sha256'] == source.sha256
    assert all(path.read_bytes() == data for path, data in cache_before.items())


def test_corrupt_primary_context_cache_is_preserved_without_new_provider_calls(demo):
    cache = next((demo.root / 'extraction_cache').glob('*.json'))
    value = json.loads(cache.read_text())
    value['primary_context_sha256'] = '0' * 64
    demo.write(str(cache.relative_to(demo.root)), value)
    before, rules = cache.read_bytes(), demo.read('rules.json')
    provider = LocalProvider({})
    provider.model = value['model']
    run = extraction.extract(demo, provider=provider)
    assert run.outcome == 'failed' and not provider.requests
    assert any('primary-context identity mismatch' in error for error in run.errors)
    assert cache.read_bytes() == before and demo.read('rules.json') == rules


def test_offline_budget_uses_expanded_payload_and_rejects_oversized_unicode():
    from scripts.extract_change_cases import request_sizes
    from scripts.extraction_pilot import MODEL, MAX_OUTPUT_TOKENS, MAX_REQUEST_BYTES
    source = source_with_text('Fictional section body. ' * 1200)
    sizes = request_sizes(source, [])
    actual = []
    for offset, text in extraction.chunks(source.text):
        payload = extraction.source_segment_payload(source, offset, text)
        request = extraction.build_provider_request(MODEL, MAX_OUTPUT_TOKENS,
                                                   extraction.DRAFT_INSTRUCTIONS, payload)
        request['service_tier'] = 'default'
        actual.append(len(json.dumps(request, ensure_ascii=False).encode()))
    assert sizes['draft_max_json_bytes'] == max(actual)
    assert sizes['request_limit_bytes'] == MAX_REQUEST_BYTES == 131072
    assert sizes['review_completion_guaranteed'] is False
    oversized = source_with_text('🔬' * extraction.MAX_COMPLETE_PRIMARY_CHARS)
    with pytest.raises(ValueError, match='insufficient request/review space'):
        request_sizes(oversized, [])
