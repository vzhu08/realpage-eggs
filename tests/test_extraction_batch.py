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


def test_core_finishes_multiple_documents_and_records_separate_usage(demo, tmp_path, monkeypatch):
    from scripts import extraction_batch as batch
    source = next(iter(demo.sources().values()))
    source.capture_status = 'supplementary'
    second = source.model_copy(update={'doc_id': 'SYNTHETIC-SECOND'})
    demo.save_collection('sources', {s.doc_id:s for s in (source, second)})
    demo.write('extraction_index.json', {})
    pack = tmp_path/'pack'
    (pack/'corpus').mkdir(parents=True)
    (pack/'corpus/source.txt').write_text(source.text, encoding='utf-8', newline='')
    (pack/'corpus/corpus_manifest.csv').write_text(
        f'doc_id,text_file\n{source.doc_id},source.txt\n{second.doc_id},source.txt\n', encoding='utf-8')
    calls=[]
    def handle(request):
        calls.append(request)
        return httpx.Response(200,json={'status':'completed','service_tier':'default',
            'usage':{'input_tokens':1000,'output_tokens':1000},
            'output':[{'content':[{'type':'output_text','text':json.dumps(
                {'source_kind':'legal_text','rules':[],'issues':['Synthetic empty test response']})}]}]})
    factory=httpx.Client
    monkeypatch.setattr(batch.httpx,'Client',lambda **kw:factory(transport=httpx.MockTransport(handle),**kw))
    monkeypatch.setattr(batch,'configure_credentials',lambda path:None)
    monkeypatch.setenv('OPENAI_API_KEY','synthetic-only')
    monkeypatch.setenv('OPENAI_MODEL',MODEL)
    output=tmp_path/'batch'
    assert batch.main(['--source-dir',str(demo.root),'--output',str(output),'--pack',str(pack),'--execute'])==0
    assert len(calls)==4
    index=json.loads((output/'extraction_index.json').read_text())
    for entry in index.values():
        run_id=entry['run_id']
        assert json.loads((output/f'runs/{run_id}.json').read_text())['outcome']=='success'
        assert len(json.loads((output/f'provider_outputs/{run_id}/usage.json').read_text()))==2


@pytest.mark.parametrize('unreconciled',[False,True])
def test_continuation_preserves_spend_and_refuses_unknown_billing(tmp_path, unreconciled):
    import shutil
    with httpx.Client(transport=httpx.MockTransport(lambda request:httpx.Response(200,json={
            'usage':{'input_tokens':1000,'output_tokens':1000},'status':'completed'}))) as transport:
        first=BudgetClient(transport,tmp_path/'first.json',20)
        first.post('https://api.openai.com/v1/responses',json={'model':MODEL,'max_output_tokens':MAX_OUTPUT_TOKENS})
        if unreconciled:
            first.ledger['requests'][0]['status']='in_flight'
            first.save()
        copy=tmp_path/'copy.json'
        shutil.copyfile(first.path,copy)
        if unreconciled:
            with pytest.raises(ValueError,match='unreconciled'): BudgetClient(transport,copy,20,prior_ledger=first.path)
        else:
            second=BudgetClient(transport,copy,20,prior_ledger=first.path)
            assert second.charged==first.charged and second.budget==20
            second.close()
            second.post('https://api.openai.com/v1/responses',json={'model':MODEL,'max_output_tokens':MAX_OUTPUT_TOKENS})
            assert len(second.ledger['requests'])==2 and second.charged==2*first.charged
