"""Budget/source guards use synthetic transports; no provider calls."""
import json
from decimal import Decimal

import httpx
import pytest

from navigator.extraction import OpenAIProvider, ProviderFailure
from scripts.extraction_batch import BudgetClient, MODEL, MAX_OUTPUT_TOKENS, plan


def test_usage_releases_reservation_and_cap_blocks_before_request(tmp_path):
    calls = []
    def handle(request):
        calls.append(request)
        assert json.loads(request.content)['service_tier'] == 'default'
        return httpx.Response(200, json={'usage': {'input_tokens': 1000, 'output_tokens': 1000},
                                       'status': 'completed', 'service_tier': 'default'})
    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        client = BudgetClient(transport, tmp_path / 'ledger.json', 2)
        payload = {'model': MODEL, 'max_output_tokens': MAX_OUTPUT_TOKENS}
        client.post('https://api.openai.com/v1/responses', json=payload)
        assert client.charged == Decimal('0.013750')
        client.budget = Decimal('1.50')
        with pytest.raises(ProviderFailure, match='Budget'):
            client.post('https://api.openai.com/v1/responses', json=payload)
        assert len(calls) == 1


@pytest.mark.parametrize('failure', ['timeout', 'http', 'no_usage'])
def test_uncertain_charge_stops_core_retries_and_retains_reservation(tmp_path, monkeypatch, failure):
    calls = []
    def handle(request):
        calls.append(request)
        if failure == 'timeout': raise httpx.ReadTimeout('synthetic')
        return httpx.Response(500 if failure == 'http' else 200, json={})
    monkeypatch.setenv('OPENAI_API_KEY', 'synthetic-only')
    monkeypatch.setenv('OPENAI_MODEL', MODEL)
    with httpx.Client(transport=httpx.MockTransport(handle)) as transport:
        client = BudgetClient(transport, tmp_path / 'ledger.json', 20)
        provider = OpenAIProvider(client=client)
        with pytest.raises(ProviderFailure): provider.generate('JSON', {})
        with pytest.raises(ProviderFailure): provider.generate('JSON', {})
        assert len(calls) == 1
        assert client.charged == Decimal('1.50') and client.blocked


def test_remaining_queue_preserves_completed_and_requires_supplied_text(demo, tmp_path):
    source = next(iter(demo.sources().values()))
    source.capture_status = 'supplementary'
    demo.save_collection('sources', {source.doc_id: source})
    pack = tmp_path / 'pack'
    (pack / 'corpus/text').mkdir(parents=True)
    (pack / 'corpus/text/source.txt').write_text(source.text, encoding='utf-8', newline='')
    (pack / 'corpus/corpus_manifest.csv').write_text(
        f'doc_id,text_file\n{source.doc_id},text/source.txt\nUNAVAILABLE,\n', encoding='utf-8')
    before = {p.relative_to(demo.root): p.read_bytes() for p in demo.root.rglob('*') if p.is_file()}
    output = tmp_path / 'output'
    queue = plan(demo.root, output, pack)
    assert queue['completed_preserved'] == [source.doc_id]
    assert queue['unavailable'] == ['UNAVAILABLE'] and not output.exists()
    assert before == {p.relative_to(demo.root): p.read_bytes() for p in demo.root.rglob('*') if p.is_file()}
    demo.write('extraction_index.json', {})
    assert plan(demo.root, output, pack)['selected'][0]['doc_id'] == source.doc_id
    (pack / 'corpus/text/source.txt').write_text('changed', encoding='utf-8')
    with pytest.raises(ValueError, match='differs'): plan(demo.root, output, pack)


@pytest.mark.parametrize('budget', ['nan', 'inf', '0', '-1', '20.01'])
def test_invalid_budget_refused(tmp_path, budget):
    with httpx.Client() as transport:
        with pytest.raises(ValueError): BudgetClient(transport, tmp_path / 'ledger.json', budget)
