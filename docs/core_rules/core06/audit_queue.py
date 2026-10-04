"""Read-only cache and historical usage audit. No extract()/provider invocation."""
from collections import Counter
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from navigator.config import VERSION
from navigator.extraction import PROMPT_VERSION, chunks, validate_bundle
from navigator.models import ExtractionBundle
from navigator.store import Store, digest, write_json
from offline_verify import offline

OUT = ROOT / 'docs/core_rules/core06'
snapshot = json.loads((OUT/'snapshot_manifest.json').read_text())
store = Store(Path(snapshot['working_store']))
model = store.read('latest_extract.json')['config']['model']
sources = store.sources()
index = store.read('extraction_index.json')

with offline() as (attempts, probes):
    inventory = []
    for doc, source in sorted(sources.items()):
        chunk_results = []
        for offset, text in chunks(source.text):
            key = digest([doc, source.sha256, source.url, source.retrieved_at, source.authority, model, 'live',
                          PROMPT_VERSION, VERSION, ExtractionBundle.model_json_schema(), offset, text])
            cached = store.read(f'extraction_cache/{key}.json')
            valid, error = False, None
            if cached:
                try:
                    assert cached['mode']=='live' and cached['model']==model
                    assert store.path(f"runs/{cached['origin_run_id']}.json").exists()
                    validate_bundle(ExtractionBundle.model_validate(cached['bundle']), sources, doc)
                    valid = True
                except (ValueError, KeyError, AssertionError) as exc: error = type(exc).__name__
            chunk_results.append({'offset':offset, 'characters':len(text), 'cache_key':key,
                                  'valid_cache_present':valid, 'error':error})
        inventory.append({'doc_id':doc, 'captured':bool(source.text), 'index_status':index.get(doc,{}).get('status'),
                          'full_valid_cache':bool(chunk_results) and all(c['valid_cache_present'] for c in chunk_results),
                          'chunks':chunk_results})
    usage = {}
    for path in store.root.glob('provider_outputs/*/usage.json'):
        for item in json.loads(path.read_text()):
            assert item.get('response_id'), 'Cannot deduplicate usage without response ID'
            if item['response_id'] in usage: assert usage[item['response_id']]==item
            usage[item['response_id']] = item
    totals = {key:sum(item.get('usage',{}).get(key,0) for item in usage.values()) for key in ('input_tokens','output_tokens','total_tokens')}
    prioritized = ['D069','D041','D042','D023','D024','D025','D026']
    pending = [row['doc_id'] for row in inventory if row['captured'] and row['doc_id'] not in index]
    queue = []
    for doc in sorted(pending, key=lambda k: (prioritized.index(k) if k in prioritized else len(prioritized), k)):
        row = next(r for r in inventory if r['doc_id']==doc)
        gap = doc in {'D045','D046','D047','D048'}
        benefit = ('T3 enactment/relative operative date and qualified municipal conflict; highest source-ready priority' if doc=='D069' else
                   'LA utility cutoff comparison; underlying ordinance still needed' if doc in {'D041','D042'} else
                   'Do not spend extraction budget to replace missing substantive bill/failed-ballot evidence' if gap else
                   'Additional captured corpus obligations; source and lifecycle review before reliance')
        queue.append({'doc_id':doc, 'expected_benefit':benefit, 'ready_for_paid_work':False,
                      'source_gate':'Acquire missing target text/history first' if gap else 'User must explicitly resume and approve budget',
                      'cache_chunks':row['chunks'], 'stored_rules_before':index.get(doc,{}).get('rules',0)})
    report = {'historical_model':model, 'model_source':'saved extraction run metadata; no credential values inspected',
       'historical_observed_usage':{'unique_returned_responses':len(usage),'statuses':dict(Counter(i['status'] for i in usage.values())),**totals,
         'limitation':'Returned usage only, not a billing total. Timeout/interruption and unsuccessful transport usage can be unobserved.'},
       'new_provider_calls':0, 'new_provider_tokens':0, 'offline_guard_attempts':attempts,
       'cache_inventory':inventory, 'remaining_captured_queue':queue,
       'preserve_existing':{'doc_ids':sorted(index),'instruction':'Reuse valid saved bundles without calling extraction during this pause. Review D022/124 temporal gaps first; do not replace valid empty D011.'},
       'proposed_budget_not_authorized':{
         'pilot_doc_ids':['D069'],'documents':1,'chunks':1,'concurrency':1,
         'model':model,'max_output_tokens_per_response':32000,
         'logical_responses':3,'explanation':'One extraction + one verification + at most one repair. Existing provider permits three transport attempts per logical response.',
         'expected_input_tokens_range':[12000,35000],'expected_output_tokens_range':[10000,40000],
         'returned_token_review_ceiling':150000,
         'planning_worst_case':{'transport_attempts':9,'output_tokens_if_every_attempt_is_billed_at_maximum':288000,
                               'input_tokens_allowance':360000},
         'cost_formula':'At confirmed per-million rates I and O, expected cost ≈ (12000..35000)*I/1e6 + (10000..40000)*O/1e6; conservative allowance 0.36*I + 0.288*O. Rates and dollar cap must be agreed before execution.',
         'cost_estimate_status':'No current rates or dollar cap verified/approved; token estimates are planning assumptions, not a billing guarantee.',
         'enforcement_gap':'Current pipeline bounds responses/retries but has no cumulative dollar/token cutoff. Before resuming, agree account spend cap and timeout policy; do not blindly retry an unknown-billed timeout.',
         'stop_conditions':['first document complete or validation failure','first unknown-billed timeout/interruption','three logical responses or returned review ceiling reached'],
         'authorization_needed':'Explicit user resume plus model/rate/dollar-budget approval; no queue executed.'}}
    write_json(OUT/'extraction_queue.json',report)
    assert not any(attempts.values())
print('Read-only audit complete:',len(pending),'unprocessed captures;',totals)
