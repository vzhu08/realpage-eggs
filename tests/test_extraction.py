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
