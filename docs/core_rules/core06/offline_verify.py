"""Replay saved data through public interfaces, with paid work and networking blocked.

Run from the checkout root; this never invokes extraction, including cache replay.
All writes target the explicit private copy or this lane's report directory.
"""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import socket
import subprocess
import sys
import time
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from navigator.store import Store, digest, write_json

REPORTS = ROOT / 'docs/core_rules/core06'
SNAPSHOT = json.loads((REPORTS / 'snapshot_manifest.json').read_text())
DATA = Path(SNAPSHOT['working_store'])
OUTPUT = DATA / 'core06-results'
AS_OF = '2026-10-01'


def hashes(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(root.rglob('*')) if p.is_file()}


@contextlib.contextmanager
def offline():
    import httpx
    from navigator.extraction import OpenAIProvider
    counters = {'provider_attempts': 0, 'network_attempts': 0}
    def deny(kind):
        def blocked(*args, **kwargs):
            counters[kind] += 1
            raise RuntimeError('CORE-06 offline guard: ' + kind)
        return blocked
    with contextlib.ExitStack() as stack:
        for name in ('__init__', 'generate'):
            stack.enter_context(patch.object(OpenAIProvider, name, deny('provider_attempts')))
        for obj, name in [(socket.socket, 'connect'), (socket.socket, 'connect_ex'),
                          (socket, 'create_connection'), (socket, 'getaddrinfo'),
                          (httpx.HTTPTransport, 'handle_request'),
                          (httpx.AsyncHTTPTransport, 'handle_async_request')]:
            stack.enter_context(patch.object(obj, name, deny('network_attempts')))
        # Prove the guard before running; these probes cannot contact a provider.
        for probe in (lambda: OpenAIProvider(), lambda: socket.create_connection(('example.invalid', 443))):
            try: probe()
            except RuntimeError: pass
            else: raise AssertionError('Offline guard did not reject probe')
        probes = dict(counters)
        counters.update(provider_attempts=0, network_attempts=0)
        yield counters, probes


def main():
    assert DATA.resolve() != Path(SNAPSHOT['input_store']).resolve()
    assert DATA.resolve().is_relative_to(ROOT / 'data')
    original = hashes(Path(SNAPSHOT['input_store']))
    assert original == SNAPSHOT['all_input_file_hashes'], 'Original input changed since snapshot'
    protected = {name: hashes(DATA)[name] for name in SNAPSHOT['working_files']}
    OUTPUT.mkdir(parents=True, exist_ok=True)
    records = []
    with offline() as (attempts, probes):
        from navigator.cli import main as cli
        commands = [
            ('validate', ['validate', '--as-of', AS_OF, '--output', str(OUTPUT / 'validation.json')], 1),
            ('evaluate', ['evaluate', '--as-of', AS_OF, '--allow-partial', '--output', str(OUTPUT / 'evaluations.json')], 0),
            ('export', ['export', '--as-of', AS_OF, '--allow-partial', '--output', str(OUTPUT / 'partial-export')], 1),
            ('lookup', ['lookup', 'A0001', '--as-of', AS_OF], 0),
        ]
        for name, args, expected in commands:
            assert args[0] in {'validate', 'evaluate', 'export', 'lookup'}
            start = time.monotonic()
            with (OUTPUT / f'{name}.stdout.json').open('w') as out, (OUTPUT / f'{name}.stderr.txt').open('w') as err:
                with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
                    code = cli(['--data-dir', str(DATA), *args])
            records.append({'argv': ['navigator', '--data-dir', str(DATA), *args], 'exit_code': code,
                            'expected_exit_code': expected, 'seconds': round(time.monotonic() - start, 3)})
            print(name, 'exit', code, flush=True)
            assert code == expected, (name, code)
        from fastapi.testclient import TestClient
        from navigator.api import create_app
        with TestClient(create_app(DATA)) as client:
            request = {'address_id': 'A0001', 'as_of': AS_OF,
                       'limits': {'max_questions': 2, 'max_fields': 3, 'max_evaluations': 8, 'max_joint_fields': 1}}
            response = client.post('/api/v1/lookup/assist', json=request)
            assert response.status_code == 200, response.status_code
            body = response.json()
            write_json(OUTPUT / 'assist.json', body)
            integration = {'method': 'POST', 'path': '/api/v1/lookup/assist', 'transport': 'in-process ASGI TestClient',
                           'request': request, 'status_code': response.status_code,
                           'capabilities': body.get('capabilities'), 'mode': body.get('mode')}
    store = Store(DATA)
    exported = json.loads((OUTPUT / 'partial-export/rules.json').read_text())
    lookups = json.loads((OUTPUT / 'partial-export/lookups.json').read_text())['lookups']
    evaluated = json.loads((OUTPUT / 'evaluations.json').read_text())['evaluations']
    changes = json.loads((OUTPUT / 'partial-export/change_details.json').read_text())
    validation = json.loads((OUTPUT / 'partial-export/validation.json').read_text())
    rule_ids = {r['team_rule_id'] for r in exported}
    current = hashes(DATA)
    checks = {
        'original_store_unchanged': original == hashes(Path(SNAPSHOT['input_store'])),
        'working_input_bytes_unchanged': all(current[k] == v for k,v in protected.items()),
        'all_500_input_ids_survive': set(store.addresses()) == set(lookups) == set(evaluated) and len(lookups) == 500,
        'lookup_references_resolve': all(row['team_rule_id'] in rule_ids for rows in lookups.values() for row in rows),
        'override_references_resolve': all(ref in rule_ids for r in exported for ref in r['overrides']),
        'change_references_resolve_in_store': all(rid in store.rules() for case in changes.values() for ids in case['mapped_rule_ids'].values() for rid in ids),
        'no_provider_or_network_attempts': not any(attempts.values()),
        'export_explicitly_partial': validation['artifact_label'] == 'PARTIAL_NOT_JUDGE_READY',
        'no_resolved_municipalities_invented': validation['counts']['resolved_municipalities'] == 0,
    }
    report = {'candidate_commit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
              'code_hashes': {**{'navigator/'+k:v for k,v in hashes(ROOT/'navigator').items() if k.endswith('.py')},
                              'offline_verify.py': hashlib.sha256(Path(__file__).read_bytes()).hexdigest()},
              'data_dir': str(DATA), 'output': str(OUTPUT), 'as_of': AS_OF,
              'original_store_sha256': SNAPSHOT['original_store_sha256'],
              'offline_guard': {'blocked_self_test_probes': probes, 'workload_attempts': attempts},
              'commands': records, 'checks': checks, 'validation': validation,
              'evaluate_run': store.read('latest_evaluate.json'), 'export_run': store.read('latest_export.json'),
              'assist_integration': integration, 'human_review': 'pending', 'new_provider_usage': 0}
    write_json(REPORTS / 'offline_results.json', report)
    assert all(checks.values()), checks
    print('All integrity checks passed; evidence remains partial.', flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
