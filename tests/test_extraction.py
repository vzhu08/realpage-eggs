import json

import httpx
import pytest

from navigator.demo import SyntheticProvider, synthetic_bundle
from navigator.extraction import extract, validate_bundle, ProviderUnavailable, ProviderFailure, OpenAIProvider, stable_id
from navigator.models import ExtractionBundle


def test_general_ordinance_flows_through_same_boundary_and_replays(demo):
    source = next(iter(demo.sources().values()))
    before = set(demo.rules())
    run = extract(demo, provider=SyntheticProvider(source))
    assert set(demo.rules()) == before
    assert run.counts["cache_hits"] == 1
    assert all(r.evidence_mode == "synthetic" for r in demo.rules().values())
    for rule in demo.rules().values():
        for evidence in rule.evidence:
            assert source.text[evidence.start:evidence.end] == evidence.quote


def test_fabricated_or_stitched_quote_rejected(demo):
    source = next(iter(demo.sources().values()))
    bundle = ExtractionBundle.model_validate(synthetic_bundle(source))
    bundle.rules[0].quoted_span = "These invented twenty characters are not the source."
    with pytest.raises(ValueError, match="quoted_span"): validate_bundle(bundle, demo.sources())
    bundle = ExtractionBundle.model_validate(synthetic_bundle(source))
    bundle.rules[0].evidence[0].quote = "Beginning November 15, 2026, security deposit to one month's rent."
    with pytest.raises(ValueError, match="Quote not found"): validate_bundle(bundle, demo.sources())


def test_missing_semantic_support_retained_for_review(demo):
    source = next(iter(demo.sources().values()))
    bundle = ExtractionBundle.model_validate(synthetic_bundle(source))
    bundle.rules[0].evidence[0].supports.remove("key_value")
    validated = validate_bundle(bundle, demo.sources())
    assert "Missing field-level evidence for key_value" in validated.rules[0].review_issues


def test_no_key_records_failure_without_fixture_fallback(demo, monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    before = demo.read("rules.json")
    with pytest.raises(ProviderUnavailable): extract(demo)
    assert demo.read("rules.json") == before
    assert demo.read("latest_extract.json")["outcome"] == "failed"


def test_invalid_provider_response_is_bounded(demo):
    class Broken:
        model, mode, usage = "test-invalid", "synthetic", []
        calls = 0
        def generate(self, *_):
            self.calls += 1
            return {"rules": "bad"}
    provider = Broken()
    run = extract(demo, provider=provider)
    assert run.outcome == "failed"
    assert provider.calls == 3  # draft, semantic review, one structural repair
    assert demo.rules()  # last good rules preserved, failure exposed in extraction index


def test_openai_refusal_or_http_error_never_becomes_empty_success(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-never-log")
    monkeypatch.setenv("OPENAI_MODEL", "explicit-test-model")
    def handler(request):
        payload = json.loads(request.content)
        assert payload["store"] is False
        assert payload["text"]["format"]["type"] == "json_object"
        return httpx.Response(200, json={"id": "fixture", "status": "completed", "output": [{"content": [{"type": "refusal", "refusal": "refused"}]}]})
    client = httpx.Client(transport=httpx.MockTransport(handler))
    with pytest.raises(ProviderFailure, match="no output text"): OpenAIProvider(client).generate("test", {})


def test_json_mode_requirement_is_explicit_in_api_input(monkeypatch):
    monkeypatch.setenv('OPENAI_API_KEY', 'synthetic-test-key')
    monkeypatch.setenv('OPENAI_MODEL', 'synthetic-test-model')
    original = {'source_text': 'Ordinary source material without a format instruction.', 'schema': {}}
    def handler(request):
        sent = json.loads(request.content)
        # The live endpoint rejected a JSON-only payload even with JSON in instructions.
        if 'json' not in sent['input'].lower():
            return httpx.Response(400, json={'error': {'param': 'input', 'type': 'invalid_request_error'}})
        assert json.loads(sent['input'].split('\n', 1)[1]) == original
        return httpx.Response(200, json={'id': 'synthetic-response', 'status': 'completed',
                                       'output': [{'content': [{'type': 'output_text', 'text': '{"rules": []}'}]}]})
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        assert OpenAIProvider(client).generate('Extract.', original) == {'rules': []}


@pytest.mark.parametrize('field,value', [('end_date', '2027-01-01'), ('status_as_of', '2026-10-01')])
def test_lifecycle_boundaries_require_field_level_evidence(demo, field, value):
    source = next(iter(demo.sources().values()))
    bundle = ExtractionBundle.model_validate(synthetic_bundle(source))
    setattr(bundle.rules[0], field, value)
    validated = validate_bundle(bundle, demo.sources())
    assert f'Missing field-level evidence for {field}' in validated.rules[0].review_issues


def test_merge_preserves_distinct_supported_lifecycle_history(rule):
    from datetime import date
    from navigator.engine import temporal
    from navigator.extraction import merge_rules
    from navigator.models import StatusEvent

    later = rule.model_copy(deep=True)
    later.status_events.append(StatusEvent(status='repealed', on='2026-12-01', evidence=rule.evidence))
    merged = merge_rules({rule.team_rule_id: rule}, [later])
    assert len(merged) == 2
    assert all(r.conflict_flag for r in merged.values())
    assert {temporal(r, date(2026, 12, 1)) for r in merged.values()} == {'in_force', 'inapplicable'}


def test_merge_preserves_distinct_lifecycle_snapshot(rule):
    from navigator.extraction import merge_rules
    rule.status_events = []
    rule.status_as_of = '2026-10-01'
    incoming = rule.model_copy(deep=True)
    incoming.status_as_of = '2026-09-01'
    merged = merge_rules({rule.team_rule_id: rule}, [incoming])
    assert len(merged) == 2
    assert {r.status_as_of for r in merged.values()} == {'2026-09-01', '2026-10-01'}


@pytest.mark.parametrize('corrupt', [{}, [], {'origin_run_id': 'fixture-origin'}, {'bundle': {}, 'origin_run_id': None}])
def test_invalid_cache_metadata_finishes_failure_without_new_provider_calls(demo, corrupt):
    source = next(iter(demo.sources().values()))
    cache_path = next((demo.root / 'extraction_cache').glob('*.json'))
    before = demo.read('rules.json')
    demo.write(str(cache_path.relative_to(demo.root)), corrupt)
    class NoCalls(SyntheticProvider):
        def generate(self, *_):
            pytest.fail('Invalid cached metadata must fail explicitly without a new provider call')
    run = extract(demo, provider=NoCalls(source))
    assert run.outcome == 'failed' and run.finished_at
    assert any('cache metadata' in error for error in run.errors)
    assert demo.read('rules.json') == before
    assert demo.read(str(cache_path.relative_to(demo.root))) == corrupt
    assert demo.read('latest_extract.json')['outcome'] == 'failed'


def test_valid_empty_result_is_preserved_and_replays_without_provider_calls(demo):
    class Empty:
        model, mode = 'synthetic-empty-result', 'synthetic'
        usage = []
        calls = 0
        def generate(self, *_):
            self.calls += 1
            return {'source_kind': 'legal_text', 'rules': [], 'negative_findings': [], 'issues': []}
    provider = Empty()
    first = extract(demo, provider=provider)
    assert first.outcome == 'success' and demo.rules() == {} and provider.calls == 2
    second = extract(demo, provider=provider)
    assert second.outcome == 'success' and second.counts['cache_hits'] == 1
    assert provider.calls == 2 and demo.rules() == {}


def test_equivalent_event_order_does_not_create_conflicting_rule(rule):
    from navigator.extraction import merge_rules
    from navigator.models import StatusEvent
    rule.status_events.append(StatusEvent(status='pending', on='2026-08-01', evidence=rule.evidence))
    incoming = rule.model_copy(deep=True)
    incoming.status_events.reverse()
    merged = merge_rules({rule.team_rule_id: rule}, [incoming])
    assert len(merged) == 1 and not rule.conflict_flag


def test_equivalent_history_retains_additional_event_evidence(rule):
    from navigator.extraction import merge_rules
    incoming = rule.model_copy(deep=True)
    incoming.status_events[0].evidence[0].doc_id = 'OTHER-SYNTHETIC-SNAPSHOT'
    merged = merge_rules({rule.team_rule_id: rule}, [incoming])
    assert len(merged) == 1
    assert {e.doc_id for e in rule.status_events[0].evidence} == {'SYNTHETIC-42', 'OTHER-SYNTHETIC-SNAPSHOT'}


def test_repeated_alternative_history_preserves_all_supporting_evidence(rule):
    from navigator.extraction import merge_rules
    from navigator.models import StatusEvent
    alternatives = []
    for doc_id in ('SYNTHETIC-B', 'SYNTHETIC-C'):
        alternative = rule.model_copy(deep=True)
        for span in alternative.evidence:
            span.doc_id = doc_id
        alternative.status_events.append(StatusEvent(status='repealed', on='2026-12-01', evidence=alternative.evidence))
        alternative.review_issues = [f'Review {doc_id}']
        alternatives.append(alternative)
    merged = merge_rules({rule.team_rule_id: rule}, alternatives)
    assert len(merged) == 2 and all(r.conflict_flag for r in merged.values())
    variant = next(r for r in merged.values() if r.team_rule_id != rule.team_rule_id)
    assert {e.doc_id for e in variant.evidence} == {'SYNTHETIC-B', 'SYNTHETIC-C'}
    repeal = next(e for e in variant.status_events if e.status == 'repealed')
    assert {e.doc_id for e in repeal.evidence} == {'SYNTHETIC-B', 'SYNTHETIC-C'}
    assert set(variant.review_issues) == {'Review SYNTHETIC-B', 'Review SYNTHETIC-C'}
