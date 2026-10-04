"""Run remaining supplied texts through Core in a private copy; dry-run by default."""
import argparse
import csv
from decimal import Decimal
import json
import os
from pathlib import Path
import shutil
import sys

os.environ['PYTHON_DOTENV_DISABLED'] = '1'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from navigator.extraction import OpenAIProvider, ProviderFailure, chunks, extract
from navigator.source_policy import POLICY_VERSION, source_use
from navigator.store import Store, digest, now, write_json
from scripts.extraction_pilot import configure_credentials, MODEL, MAX_OUTPUT_TOKENS, MAX_REQUEST_BYTES

# Checked 2026-10-04: https://developers.openai.com/api/docs/models/gpt-6.1-sol
# Charge all input at the higher cache-write rate, including the 10% regional premium.
# No tool calls, fast mode or >272K-token prompts are permitted by this transport.
INPUT_RATE = Decimal('2.75') / 1_000_000
OUTPUT_RATE = Decimal('11') / 1_000_000
RESERVATION = Decimal('1.50')


class BudgetClient:
    def __init__(self, client, path, budget, *, prior_ledger=None):
        self.client, self.timeout = client, client.timeout
        self.path, self.budget = Path(path), Decimal(str(budget))
        if not self.budget.is_finite() or not 0 < self.budget <= 20:
            raise ValueError('Budget must be finite, positive and at most the authorized $20')
        if self.path.exists() and prior_ledger is None:
            raise ValueError('Existing ledger: reconcile the prior run before a new allocation')
        self.charged, self.blocked = Decimal('0'), False
        self.ledger = {'model': MODEL, 'budget_usd': str(self.budget), 'requests': [],
                       'charged_upper_estimate_usd': '0', 'actual_billing': False,
                       'pricing_checked': '2026-10-04', 'reservation_usd': str(RESERVATION)}
        if prior_ledger is not None:
            original = Path(prior_ledger).read_bytes()
            if not self.path.exists() or self.path.read_bytes() != original:
                raise ValueError('Continuation requires an unchanged copied ledger')
            prior = json.loads(original)
            if prior.get('model') != MODEL or Decimal(prior['budget_usd']) != self.budget:
                raise ValueError('Continuation must preserve the model and total authorized budget')
            total = Decimal('0')
            for entry in prior['requests']:
                usage = entry.get('usage', {})
                incoming, outgoing = usage.get('input_tokens'), usage.get('output_tokens')
                if (entry.get('status') != 'usage_recorded' or type(incoming) is not int
                        or type(outgoing) is not int or not 0 <= incoming < 272000
                        or not 0 <= outgoing <= MAX_OUTPUT_TOKENS):
                    raise ValueError('Prior billing is unreconciled; continuation refused')
                charge = incoming * INPUT_RATE + outgoing * OUTPUT_RATE
                if charge != Decimal(entry['upper_estimate_usd']) or charge > RESERVATION:
                    raise ValueError('Prior usage/rate mismatch; continuation refused')
                total += charge
            if total != Decimal(prior['charged_upper_estimate_usd']) or total > self.budget:
                raise ValueError('Prior ledger total mismatch; continuation refused')
            self.ledger, self.charged = prior, total
            self.ledger.setdefault('continuations', []).append(
                {'prior_ledger': str(Path(prior_ledger).resolve()), 'sha256': digest(original), 'at': now()})
            self.save()

    def post(self, url, **kwargs):
        if self.blocked or self.charged + RESERVATION > self.budget:
            raise ProviderFailure('Budget exhausted or prior failure; no further request sent')
        payload = {**kwargs['json'], 'service_tier': 'default'}
        raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        if (url != 'https://api.openai.com/v1/responses' or payload.get('model') != MODEL
                or payload.get('max_output_tokens') != MAX_OUTPUT_TOKENS
                or len(raw) > MAX_REQUEST_BYTES or payload.get('tools')):
            self.blocked = True
            raise ProviderFailure('Request exceeds the reviewed model/size policy; no request sent')
        entry = {'number': len(self.ledger['requests']) + 1, 'started_at': now(),
                 'status': 'in_flight', 'request_sha256': digest(raw), 'reserved_usd': str(RESERVATION)}
        self.ledger['requests'].append(entry)
        self.charged += RESERVATION
        self.save()
        print(f"Request {entry['number']}; reserved/estimated ${self.charged:.4f} of ${self.budget}", flush=True)
        try:
            response = self.client.post(url, **{**kwargs, 'json': payload})
            if response.is_error:
                raise ProviderFailure(f'HTTP {response.status_code}; batch stops without retry')
            body = response.json()
            usage = body.get('usage', {})
            incoming, outgoing = usage.get('input_tokens'), usage.get('output_tokens')
            if (type(incoming) is not int or type(outgoing) is not int
                    or not 0 <= incoming < 272000 or not 0 <= outgoing <= MAX_OUTPUT_TOKENS
                    or body.get('service_tier', 'default') != 'default'):
                raise ProviderFailure('Unreconciled usage/tier; reservation retained and batch stopped')
            charge = incoming * INPUT_RATE + outgoing * OUTPUT_RATE
            if charge > RESERVATION:
                raise ProviderFailure('Usage exceeds reservation; stop and reconcile billing')
            self.charged += charge - RESERVATION
            entry.update(status='usage_recorded', usage=usage, upper_estimate_usd=str(charge),
                         response_id=body.get('id'), response_status=body.get('status'))
            return response
        except BaseException as exc:
            self.blocked = True
            entry.update(status='stopped_billing_unreconciled', error=type(exc).__name__)
            if isinstance(exc, httpx.HTTPError):
                raise ProviderFailure('Transport failed; no retry, reservation retained') from None
            raise
        finally:
            entry['finished_at'] = now()
            self.save()

    def save(self):
        self.ledger['charged_upper_estimate_usd'] = str(self.charged)
        write_json(self.path, self.ledger)

    def close(self):
        # Core closes its per-document provider. The outer batch context owns
        # this shared HTTP transport and closes it once after all documents.
        pass


def plan(source_dir, output, pack):
    source_dir, output, pack = (Path(p).resolve() for p in (source_dir, output, pack))
    if source_dir == output or output.is_relative_to(source_dir) or source_dir.is_relative_to(output):
        raise ValueError('Choose separate non-nested source and output directories')
    if output.exists():
        raise ValueError('Output exists; preserve results and reconcile billing before resuming')
    if not source_dir.is_dir() or any(p.is_symlink() for p in source_dir.rglob('*')):
        raise ValueError('Source must be a complete regular-file Store')
    store = Store(source_dir)
    sources, index = store.sources(), store.read('extraction_index.json', {})
    with (pack / 'corpus/corpus_manifest.csv').open(encoding='utf-8-sig', newline='') as stream:
        manifest = {r['doc_id']: r for r in csv.DictReader(stream)}
    selected, completed, unavailable, excluded = [], [], [], []
    for ident, row in sorted(manifest.items()):
        source = sources.get(ident)
        if not source or not source.text:
            unavailable.append(ident)
            continue
        if source.capture_status == 'synthetic' or digest(source.text.encode()) != source.sha256:
            raise ValueError(f'Invalid source identity: {ident}')
        use = source_use(source)
        if not use.extraction_allowed:
            excluded.append({'doc_id': ident, 'status': use.status, 'reason': use.reason})
            continue
        rel = row.get('text_file')
        if not rel:
            raise ValueError(f'Missing supplied text path: {ident}')
        path = (pack / 'corpus' / rel).resolve()
        if not path.is_relative_to(pack / 'corpus') or not path.is_file():
            raise ValueError(f'Missing supplied corpus text: {ident}')
        if path.read_text(encoding='utf-8').replace('\r\n', '\n') != source.text.replace('\r\n', '\n'):
            raise ValueError(f'Source differs from supplied corpus: {ident}')
        if index.get(ident, {}).get('status') in {'complete', 'review'}:
            completed.append(ident)
        else:
            selected.append({'doc_id': ident, 'sha256': source.sha256,
                             'chunks': sum(1 for _ in chunks(source.text))})
    return {'source_dir': str(source_dir), 'output': str(output), 'selected': selected,
            'completed_preserved': completed, 'unavailable': unavailable, 'excluded_sources': excluded,
            'source_policy_version': POLICY_VERSION,
            'model': MODEL, 'provider_calls_started': 0, 'label': 'REVIEW_CANDIDATES_NOT_RELEASE'}


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source-dir', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--pack', type=Path, required=True)
    p.add_argument('--env-file', type=Path)
    p.add_argument('--budget-usd', type=Decimal, default=Decimal('20'))
    p.add_argument('--execute', action='store_true')
    p.add_argument('--continue-budget', action='store_true',
                   help='Carry fully reconciled source ledger into the new output; preserve the same total cap')
    args = p.parse_args(argv)
    if not args.budget_usd.is_finite() or not 0 < args.budget_usd <= 20:
        p.error('Budget must be positive and at most $20')
    details = plan(args.source_dir, args.output, args.pack)
    details['budget_usd'] = str(args.budget_usd)
    print(json.dumps(details, indent=2), flush=True)
    if not args.execute or not details['selected']:
        print('No provider calls. Add --execute to run in the new private copy.')
        return 0
    configure_credentials(args.env_file)
    shutil.copytree(args.source_dir, args.output, ignore=shutil.ignore_patterns('.env', '.env.*'))
    store = Store(args.output)
    store.write('batch_plan.json', details)
    with httpx.Client(timeout=httpx.Timeout(120, read=600)) as transport:
        budget = BudgetClient(transport, store.path('batch_budget.json'), args.budget_usd,
                              prior_ledger=args.source_dir / 'batch_budget.json' if args.continue_budget else None)
        for document in details['selected']:
            if budget.blocked or budget.charged + RESERVATION > budget.budget:
                print('Stopped at budget/failure boundary; completed documents and caches preserved.', flush=True)
                return 1
            print('Extracting ' + document['doc_id'], flush=True)
            provider = OpenAIProvider(client=budget)
            provider.max_output_tokens = MAX_OUTPUT_TOKENS
            result = extract(store, [document['doc_id']], provider=provider, limit=1)
            result.config.update(transport_attempts=1, batch_budget_usd=str(args.budget_usd),
                                 batch_ledger='batch_budget.json')
            store.save_run(result)
            print(json.dumps({'doc_id': document['doc_id'], 'outcome': result.outcome,
                              'counts': result.counts, 'errors': result.errors}), flush=True)
            if result.outcome != 'success':
                return 1
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (ValueError, OSError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2)
