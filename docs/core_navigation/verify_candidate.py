"""Verify the combined candidate without rewriting shared generated contracts.

Run from any directory with the checkout's .venv/bin/python. Results are written
only to this Core B evidence directory; historical docs/core evidence is preserved.
"""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).resolve().parent / 'core07_validation'


def hashes(directory):
    return {str(p.relative_to(directory)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in directory.rglob('*') if p.is_file() and '__pycache__' not in p.parts}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    original = hashes(ROOT / 'contracts')
    base = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    environment = dict(os.environ)
    runs = []
    with tempfile.TemporaryDirectory(prefix='realpage-core-b-validation-') as temporary:
        copied = Path(temporary)
        for name in ('navigator', 'tests', 'fixtures', 'config', 'contracts'):
            shutil.copytree(ROOT / name, copied / name, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
        shutil.copy2(ROOT / 'pyproject.toml', copied / 'pyproject.toml')
        # This original comparison is read-only; retain its fixed cases/denominators.
        (copied / 'docs/core').mkdir(parents=True)
        for name in ('evaluate_planner.py', 'core01_d001_live.json'):
            shutil.copy2(ROOT / 'docs/core' / name, copied / 'docs/core' / name)
        (copied / 'docs/core_navigation').mkdir(parents=True)
        shutil.copy2(ROOT / 'docs/core_navigation/benchmark.py', copied / 'docs/core_navigation/benchmark.py')
        environment['NAVIGATOR_DATA_DIR'] = str(copied / 'data/core-b-session')
        source_hashes = {f'{name}/{path}': sha for name in ('navigator', 'tests')
                         for path, sha in hashes(copied / name).items()}
        commands = [
            ['-m', 'pytest', '-q', '-rs'],
            ['-m', 'compileall', '-q', 'navigator', 'tests'],
            ['-m', 'navigator', 'contracts'],
            ['docs/core/evaluate_planner.py'],
            ['docs/core_navigation/benchmark.py', str(OUTPUT / 'benchmark_results.json')],
        ]
        for command in commands:
            result = subprocess.run([sys.executable, *command], cwd=copied, env=environment,
                                    text=True, capture_output=True)
            run = {'command': 'python ' + ' '.join(command), 'exit_code': result.returncode,
                   'stdout': result.stdout, 'stderr': result.stderr}
            runs.append(run)
            print(run['command'], 'exit', result.returncode, flush=True)
            if command[0] == 'docs/core/evaluate_planner.py' and result.returncode == 0:
                comparison = json.loads(result.stdout)
                (OUTPUT / 'planner_evaluation.json').write_text(json.dumps(comparison, indent=2) + '\n')
                print(json.dumps(comparison['totals']), flush=True)
            else:
                print(result.stdout.strip(), flush=True)
                if result.returncode:
                    print(result.stderr.strip(), flush=True)
        generated = hashes(copied / 'contracts')
        differences = sorted(k for k in generated.keys() | original.keys() if generated.get(k) != original.get(k))
    check = subprocess.run(['git', 'diff', '--check'], cwd=ROOT, capture_output=True, text=True)
    runs.append({'command': 'git diff --check', 'exit_code': check.returncode,
                 'stdout': check.stdout, 'stderr': check.stderr})
    preserved = original == hashes(ROOT / 'contracts')
    report = {'base_commit_at_verification': base, 'source_sha256': source_hashes,
              'python': sys.version.split()[0], 'requirements': 'Reused Core B Python environment; requirements.lock matches installed prior checkout',
              'python_executable': sys.executable,
              'requirements_sha256': hashlib.sha256((ROOT / 'requirements.lock').read_bytes()).hexdigest(),
              'pack': environment.get('NAVIGATOR_PACK'), 'disposable_copy': True,
              'working_contracts_unchanged': preserved,
              'generated_contract_differences': differences, 'checks': runs}
    (OUTPUT / 'verification.json').write_text(json.dumps(report, indent=2) + '\n')
    return int(not preserved or any(run['exit_code'] for run in runs))


if __name__ == '__main__':
    raise SystemExit(main())
