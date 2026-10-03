"""Run generator-writing checks in a disposable copy of the actual candidate."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
PYTHON = ROOT / '.venv/bin/python'


def hashes(directory):
    return {str(p.relative_to(directory)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in directory.rglob('*') if p.is_file()}


def main():
    original = hashes(ROOT / 'contracts')
    candidate = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    environment = dict(os.environ)
    # Use the actual located participant pack unless the caller supplies another pack.
    located = Path('/Users/danny/Downloads/participant-final-no-hour16')
    if 'NAVIGATOR_PACK' not in environment and located.exists():
        environment['NAVIGATOR_PACK'] = str(located)
    runs = []
    with tempfile.TemporaryDirectory(prefix='realpage-core-validation-') as temporary:
        copied = Path(temporary)
        for name in ('navigator', 'tests', 'fixtures', 'config', 'contracts'):
            shutil.copytree(ROOT / name, copied / name, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        shutil.copy2(ROOT / 'pyproject.toml', copied / 'pyproject.toml')
        commands = [
            ['-m', 'pytest', 'tests/test_engine.py', 'tests/test_question_planner.py', 'tests/test_rule_renderer.py', 'tests/test_extraction.py', 'tests/test_change_adapters.py', '-q'],
            ['-m', 'pytest', '-q'],
            ['-m', 'compileall', '-q', 'navigator', 'tests'],
            ['-m', 'navigator', 'contracts'],
        ]
        for command in commands:
            result = subprocess.run([str(PYTHON), *command], cwd=copied, env=environment,
                                    text=True, capture_output=True)
            runs.append({'command': 'python ' + ' '.join(command), 'exit_code': result.returncode,
                         'stdout': result.stdout, 'stderr': result.stderr})
            print(runs[-1]['command'], 'exit', result.returncode, flush=True)
            print(result.stdout.strip(), flush=True)
        generated = hashes(copied / 'contracts')
        changed = sorted(k for k in generated.keys() | original.keys() if generated.get(k) != original.get(k))
    check = subprocess.run(['git', 'diff', '--check'], cwd=ROOT, capture_output=True, text=True)
    runs.append({'command': 'git diff --check', 'exit_code': check.returncode, 'stdout': check.stdout, 'stderr': check.stderr})
    preserved = original == hashes(ROOT / 'contracts')
    report = {'candidate_commit': candidate, 'python': sys.version.split()[0], 'requirements': 'Exact requirements.lock installed in checkout .venv',
              'pack': environment.get('NAVIGATOR_PACK'), 'disposable_copy': True,
              'working_contracts_unchanged': preserved, 'generated_contract_differences': changed, 'checks': runs}
    (ROOT / 'docs/core/verification.json').write_text(json.dumps(report, indent=2) + '\n')
    return int(not preserved or any(run['exit_code'] for run in runs))


if __name__ == '__main__':
    raise SystemExit(main())
