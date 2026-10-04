"""Explicit source context uses fictional documents and local providers only."""
from copy import deepcopy
import json

import httpx
import pytest

from navigator import extraction
from navigator.demo import SyntheticProvider, synthetic_bundle
from navigator.extraction import extract, stable_id, validate_bundle
from navigator.models import ExtractionBundle, Interaction, SourceDocument
from navigator.store import digest


@pytest.fixture
def context(demo):
    primary = next(iter(demo.sources().values()))
    text = 'Fictional status record: the ordinance is effective November 15, 2026. It was enacted September 1, 2026.'
    support = SourceDocument(doc_id='FIXTURE-STATUS', jurisdictions=['Maple Harbor, CA'],
        url='https://example.invalid/fictional-status', retrieved_at='2026-10-03', text=text,
        sha256=digest(text.encode()), authority='official', source_type='status_record', capture_status='supplied')
    demo.save_collection('sources', {primary.doc_id: primary, support.doc_id: support})
    bundle = synthetic_bundle(primary)
    bundle['rules'][0]['evidence'][0]['supports'].remove('effective_date')
    bundle['rules'][0]['evidence'].append({'doc_id': support.doc_id, 'quote': text, 'supports': ['effective_date']})
    return primary, support, bundle


class ContextProvider(SyntheticProvider):
    # Deliberately share the one-document fixture model: context must be a
    # separate cache identity even when model, primary text and prompt match.
    def __init__(self, primary, bundle):
        super().__init__(primary)
        self.bundle, self.calls, self.payloads = bundle, 0, []

    def generate(self, instruction, payload):
        super().generate(instruction, payload)
        assert 'supporting_sources' in payload and 'supporting_sources' in instruction
        self.calls += 1
        self.payloads.append(deepcopy(payload))
        return deepcopy(self.bundle)


class NoCalls(ContextProvider):
    def generate(self, *_):
        pytest.fail('No provider call is permitted for this check')


def context_cache(demo):
    return [path for path in (demo.root / 'extraction_cache').glob('*.json')
            if json.loads(path.read_text()).get('supporting_context_sha256')]


def test_explicit_status_context_anchors_dates_without_extracting_or_promoting_support(demo, context):
    primary, support, bundle = context
    provider = ContextProvider(primary, bundle)
    old_cache = {path: path.read_bytes() for path in (demo.root / 'extraction_cache').glob('*.json')}
    before_support = demo.sources()[support.doc_id].model_dump()
    run = extract(demo, [primary.doc_id], provider=provider, supporting_doc_ids=[support.doc_id])
    assert run.outcome == 'success' and run.counts['processed'] == 1 and run.counts['cache_hits'] == 0
    assert provider.calls == 2
    assert run.input_hashes == {primary.doc_id: primary.sha256, support.doc_id: support.sha256}
    assert run.config['primary_doc_ids'] == [primary.doc_id]
    assert run.config['supporting_doc_ids'] == [support.doc_id]
    payload = provider.payloads[0]
    assert payload == extraction.source_segment_payload(primary, 0, primary.text, [support])
    assert payload['source_sha256'] == primary.sha256
    supplied = payload['supporting_sources'][0]
    assert supplied['source_text'] == support.text and supplied['sha256'] == support.sha256
    assert supplied['source_type'] == 'status_record' and supplied['source_url'] == support.url
    assert demo.sources()[support.doc_id].model_dump() == before_support
    assert support.doc_id not in demo.read('extraction_index.json')
    rule = next(iter(demo.rules().values()))
    assert rule.source_doc_id == primary.doc_id and rule.extraction_run_id == run.run_id
    assert rule.review_issues == []
    span = next(span for span in rule.evidence if span.doc_id == support.doc_id)
    assert support.text[span.start:span.end] == span.quote
    assert all(path.read_bytes() == value for path, value in old_cache.items())
    cache_path = context_cache(demo)[0]
    cache_before = cache_path.read_bytes()
    replay = extract(demo, [primary.doc_id], provider=NoCalls(primary, bundle), supporting_doc_ids=[support.doc_id])
    assert replay.counts['cache_hits'] == 1 and cache_path.read_bytes() == cache_before
    assert next(iter(demo.rules().values())).extraction_run_id == run.run_id


@pytest.mark.parametrize('name,expected_hash', [
    ('DRAFT_INSTRUCTIONS', '4dd9a10951107e10cefc602bf1bdda5712a3d3ba2303e5d27d1ac48b03c5c241'),
    ('REVIEW_INSTRUCTIONS', 'a9e51b62ace47c511439660cd9ce1014d617f1c7a7610975a9449ec8f49f2ca0'),
    ('REPAIR_INSTRUCTIONS', 'bb945630d38be47f6b60dbf0588df9dc02717d68c471bf0193b26f70a175ac75'),
])
def test_request_builder_preserves_prior_transport_bytes_and_matches_generate(monkeypatch, name, expected_hash):
    # These fingerprints were captured from generate before factoring the
    # builders; offline sizing must preserve its JSON escaping and prompts.
    monkeypatch.setenv('OPENAI_API_KEY', 'fictional-test-key')
    monkeypatch.setenv('OPENAI_MODEL', 'fictional-test')
    payload = {'source_text': 'A “quoted” line.\nSecond \\ line.', 'schema': {'type': 'object'}}
    before = deepcopy(payload)
    instruction = getattr(extraction, name)
    request = extraction.build_provider_request('fictional-test', 32000, instruction, payload)
    assert digest(json.dumps(request, ensure_ascii=False).encode('utf-8')) == expected_hash
    def handler(sent):
        assert json.loads(sent.content) == request
        return httpx.Response(200, json={'status': 'completed', 'output': [
            {'content': [{'type': 'output_text', 'text': '{"rules": []}'}]}]})
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert extraction.OpenAIProvider(client).generate(instruction, payload) == {'rules': []}
    assert payload == before


def test_segment_payload_preserves_primary_chunk_and_complete_support_metadata(context):
    primary, support, _ = context
    before = primary.model_dump(), support.model_dump()
    text = primary.text[7:37]
    single = extraction.source_segment_payload(primary, 7, text)
    assert single['source_text'] == text and single['original_offset'] == 7
    assert 'source_sha256' not in single and 'supporting_sources' not in single
    contextual = extraction.source_segment_payload(primary, 7, text, [support], schema=single['schema'])
    assert {key: contextual[key] for key in single} == single
    assert contextual['source_sha256'] == primary.sha256
    assert contextual['supporting_sources'] == [{
        'doc_id': support.doc_id, 'source_url': support.url, 'sha256': support.sha256,
        'retrieved_at': support.retrieved_at, 'jurisdictions': support.jurisdictions,
        'source_authority': support.authority, 'source_type': support.source_type,
        'capture_status': support.capture_status, 'source_text': support.text}]
    assert (primary.model_dump(), support.model_dump()) == before


def test_official_legal_context_can_support_a_substantive_field(demo, context):
    primary, support, bundle = context
    support.source_type = 'legal_text'
    bundle['rules'][0]['evidence'][-1]['supports'] = ['effective_date', 'coverage_conditions']
    sources = {primary.doc_id: primary, support.doc_id: support}
    validated = validate_bundle(ExtractionBundle.model_validate(bundle), sources, primary.doc_id,
                                supporting_doc_ids=[support.doc_id])
    assert validated.rules[0].review_issues == []
    assert support.source_type == 'legal_text'  # No classification inferred from bundle.source_kind.


@pytest.mark.parametrize('field', ['requirement', 'coverage_conditions/args/0', 'exemption_conditions', 'background'])
def test_status_record_cannot_be_used_for_nontemporal_rule_claims(demo, context, field):
    primary, support, bundle = context
    bundle['rules'][0]['evidence'][-1]['supports'] = [field]
    with pytest.raises(ValueError, match='only lifecycle and date'):
        validate_bundle(ExtractionBundle.model_validate(bundle), demo.sources(), primary.doc_id,
                        supporting_doc_ids=[support.doc_id])


def test_status_event_context_is_allowed_but_interactions_and_negatives_are_not(demo, context):
    primary, support, bundle = context
    status_span = {'doc_id': support.doc_id, 'quote': support.text, 'supports': ['status', 'on']}
    bundle['rules'][0]['status_events'][0]['evidence'] = [status_span]
    assert validate_bundle(ExtractionBundle.model_validate(bundle), demo.sources(), primary.doc_id,
                           supporting_doc_ids=[support.doc_id]).rules
    interaction = {'kind': 'supersedes', 'target_citation': 'Fictional target', 'target_jurisdiction': 'Maple Harbor, CA',
                   'category': 'security_deposits', 'scope': {'op': 'literal', 'value': True},
                   'evidence': [status_span], 'note': 'Fictional interaction'}
    bundle['rules'][0]['interactions'] = [interaction]
    with pytest.raises(ValueError, match='substantive interaction'):
        validate_bundle(ExtractionBundle.model_validate(bundle), demo.sources(), primary.doc_id,
                        supporting_doc_ids=[support.doc_id])
    bundle['rules'][0]['interactions'] = []
    bundle['negative_findings'] = [{'jurisdiction': 'Maple Harbor, CA', 'category': 'security_deposits',
                                    'statement': 'Fictional unsupported absence.', 'evidence': [status_span]}]
    with pytest.raises(ValueError, match='negative finding'):
        validate_bundle(ExtractionBundle.model_validate(bundle), demo.sources(), primary.doc_id,
                        supporting_doc_ids=[support.doc_id])


def test_unprovided_evidence_and_cross_primary_rule_are_rejected(demo, context):
    primary, support, bundle = context
    with pytest.raises(ValueError, match='not provided'):
        validate_bundle(ExtractionBundle.model_validate(bundle), demo.sources(), primary.doc_id)
    # Even an explicitly provided support source cannot become the primary rule.
    bundle['rules'][0].update(source_doc_id=support.doc_id, source_url=support.url, quoted_span=support.text)
    with pytest.raises(ValueError, match='Rule uses source not provided'):
        validate_bundle(ExtractionBundle.model_validate(bundle), demo.sources(), primary.doc_id,
                        supporting_doc_ids=[support.doc_id])


@pytest.mark.parametrize('change', ['bytes', 'role', 'url', 'retrieval'])
def test_context_identity_changes_invalidate_cache_without_borrowing_old_origin(demo, context, change):
    primary, support, bundle = context
    provider = ContextProvider(primary, bundle)
    old_run = extract(demo, [primary.doc_id], provider=provider, supporting_doc_ids=[support.doc_id])
    old_cache = {path: path.read_bytes() for path in context_cache(demo)}
    if change == 'bytes':
        support.text += '\nFictional metadata revision.'
        support.sha256 = digest(support.text.encode())
    elif change == 'role':
        support.source_type = 'legal_text'
    elif change == 'url':
        support.url += '/revised'
    else:
        support.retrieved_at = '2026-10-04'
    demo.save_collection('sources', {primary.doc_id: primary, support.doc_id: support})
    new_run = extract(demo, [primary.doc_id], provider=provider, supporting_doc_ids=[support.doc_id])
    assert new_run.counts['cache_hits'] == 0 and provider.calls == 4
    assert new_run.config['supporting_context_sha256'] != old_run.config['supporting_context_sha256']
    assert all(path.read_bytes() == value for path, value in old_cache.items())
    assert len(demo.rules()) == 1  # A prior context-owned rule was replaced, not retained as another origin.
    assert next(iter(demo.rules().values())).extraction_run_id == new_run.run_id


def test_prior_single_source_origin_cannot_be_falsely_claimed_for_context_cache(demo, context):
    primary, support, bundle = context
    old_run_id = demo.read('latest_extract.json')['run_id']
    extract(demo, [primary.doc_id], provider=ContextProvider(primary, bundle), supporting_doc_ids=[support.doc_id])
    cache_path = context_cache(demo)[0]
    cached = json.loads(cache_path.read_text())
    cached['origin_run_id'] = old_run_id
    demo.write(str(cache_path.relative_to(demo.root)), cached)
    before_cache, before_rules = cache_path.read_bytes(), demo.read('rules.json')
    run = extract(demo, [primary.doc_id], provider=NoCalls(primary, bundle), supporting_doc_ids=[support.doc_id])
    assert run.outcome == 'failed' and any('recorded extraction origin' in error for error in run.errors)
    assert cache_path.read_bytes() == before_cache and demo.read('rules.json') == before_rules


@pytest.mark.parametrize('container', ['field', 'status_event', 'interaction'])
def test_replacement_preserves_rules_with_any_outside_context_evidence(demo, context, container):
    primary, support, bundle = context
    original = next(iter(demo.rules().values()))
    outside = primary.model_copy(update={'doc_id': 'FIXTURE-OUTSIDE'}, deep=True)
    sources = demo.sources()
    sources[outside.doc_id] = outside
    demo.save_collection('sources', sources)
    retained = original.model_copy(deep=True)
    retained.provision_key += '-outside-context'
    retained.team_rule_id = stable_id(retained)
    span = retained.evidence[0].model_copy(update={'doc_id': outside.doc_id}, deep=True)
    if container == 'field':
        retained.evidence.append(span)
    elif container == 'status_event':
        retained.status_events[0].evidence = [span]
    else:
        retained.interactions = [Interaction(kind='supersedes', target_citation='Fictional outside target',
            target_jurisdiction=retained.jurisdiction, category=retained.category,
            scope={'op': 'literal', 'value': True}, evidence=[span], note='Fictional prior evidence')]
    demo.save_collection('rules', {original.team_rule_id: original, retained.team_rule_id: retained})
    before = retained.model_dump()
    run = extract(demo, [primary.doc_id], provider=ContextProvider(primary, bundle),
                  supporting_doc_ids=[support.doc_id])
    assert run.outcome == 'success'
    assert len(demo.rules()) == 2
    assert demo.rules()[retained.team_rule_id].model_dump() == before
    assert demo.rules()[original.team_rule_id].extraction_run_id == run.run_id


def test_same_identity_with_outside_context_cannot_borrow_prior_run_provenance(demo, context):
    primary, support, bundle = context
    original = next(iter(demo.rules().values()))
    outside = primary.model_copy(update={'doc_id': 'FIXTURE-OUTSIDE'}, deep=True)
    sources = demo.sources()
    sources[outside.doc_id] = outside
    demo.save_collection('sources', sources)
    original.evidence.append(original.evidence[0].model_copy(update={'doc_id': outside.doc_id}, deep=True))
    demo.save_collection('rules', {original.team_rule_id: original})
    before = demo.read('rules.json')
    run = extract(demo, [primary.doc_id], provider=ContextProvider(primary, bundle),
                  supporting_doc_ids=[support.doc_id])
    assert run.outcome == 'failed'
    assert any('preserved outside-context evidence' in error for error in run.errors)
    assert demo.read('rules.json') == before
    assert demo.read('extraction_index.json')[primary.doc_id]['status'] == 'failed'
    # Completed provider evidence remains attributable to its real run even
    # though it cannot safely replace an existing record from another context.
    cache = json.loads(context_cache(demo)[0].read_text())
    assert cache['origin_run_id'] == run.run_id
    assert cache['origin_run_id'] != original.extraction_run_id


@pytest.mark.parametrize('change', ['secondary', 'guidance', 'terms_review', 'support_hash', 'primary_hash', 'synthetic_status'])
def test_context_preflight_rejects_ineligible_or_changed_inputs_before_provider(demo, context, change):
    primary, support, bundle = context
    if change == 'secondary': support.authority = 'secondary'
    elif change == 'guidance': support.source_type = 'agency_guidance'
    elif change == 'terms_review': support.capture_status = 'terms_review'
    elif change == 'synthetic_status': support.capture_status = 'synthetic'
    elif change == 'support_hash': support.sha256 = '0' * 64
    else: primary.sha256 = '0' * 64
    demo.save_collection('sources', {primary.doc_id: primary, support.doc_id: support})
    before = demo.read('rules.json')
    with pytest.raises(ValueError):
        extract(demo, [primary.doc_id], provider=NoCalls(primary, bundle), supporting_doc_ids=[support.doc_id])
    assert demo.read('rules.json') == before


@pytest.mark.parametrize('case', ['unknown', 'duplicate_support', 'duplicate_primary', 'no_primary', 'overlap'])
def test_context_scope_must_be_explicit_and_unambiguous(demo, context, case):
    primary, support, bundle = context
    primaries, supports = [primary.doc_id], [support.doc_id]
    if case == 'unknown': supports = ['MISSING']
    elif case == 'duplicate_support': supports *= 2
    elif case == 'duplicate_primary': primaries *= 2
    elif case == 'no_primary': primaries = None
    else: primaries.append(support.doc_id)
    with pytest.raises(ValueError):
        extract(demo, primaries, provider=NoCalls(primary, bundle), supporting_doc_ids=supports)


def test_oversized_context_is_rejected_without_truncation(demo, context, monkeypatch):
    from navigator import extraction
    primary, support, bundle = context
    monkeypatch.setattr(extraction, 'MAX_SUPPORTING_TEXT_CHARS', len(support.text) - 1)
    with pytest.raises(ValueError, match='context limit'):
        extract(demo, [primary.doc_id], provider=NoCalls(primary, bundle), supporting_doc_ids=[support.doc_id])
    assert demo.sources()[support.doc_id].text == support.text
