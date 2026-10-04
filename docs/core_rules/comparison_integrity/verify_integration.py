"""Verify Core A against current Platform/Core B in an isolated disposable copy."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


ROOT = Path(__file__).resolve().parents[3]
OUTPUT = Path(__file__).with_name("integration_verification.json")


def hashes(directory):
    return {p.relative_to(directory).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in directory.rglob("*") if p.is_file() and "__pycache__" not in p.parts}


def main():
    original = hashes(ROOT / "contracts")
    candidate = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    base = subprocess.check_output(["git", "rev-parse", "origin/main"], cwd=ROOT, text=True).strip()
    environment = dict(os.environ)
    located = Path("/Users/danny/Downloads/participant-final-no-hour16")
    if "NAVIGATOR_PACK" not in environment and located.exists():
        environment["NAVIGATOR_PACK"] = str(located)
    runs = []
    with tempfile.TemporaryDirectory(prefix="realpage-core-a-integration-") as temporary:
        copied = Path(temporary)
        for name in ("navigator", "tests", "fixtures", "config", "contracts", "scripts"):
            shutil.copytree(ROOT / name, copied / name, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
        for name in ("pyproject.toml", "requirements.lock"):
            shutil.copy2(ROOT / name, copied / name)
        for name in ("docs/core_navigation/benchmark.py", "docs/core/core01_d001_live.json", "docs/METHOD.md"):
            (copied / name).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / name, copied / name)
        environment["NAVIGATOR_DATA_DIR"] = str(copied / "data")
        inputs = {f"{name}/{path}": sha for name in ("navigator", "tests", "scripts", "docs")
                  for path, sha in hashes(copied / name).items()}
        replay = (
            "import json; from pathlib import Path; "
            "from navigator.evidence_package import replay_evidence_package; "
            "names = ['property_package', 'package_missing_support']; "
            "results = {name: replay_evidence_package(json.loads("
            "Path(f'contracts/evidence_examples/{name}.json').read_text())['response']).status "
            "for name in names}; assert set(results.values()) == {'reproduced'}; "
            "print(json.dumps(results, sort_keys=True))"
        )
        for command in (["-m", "pytest", "-q", "-rs"],
                        ["-m", "compileall", "-q", "navigator", "tests"],
                        ["-m", "navigator", "contracts"], ["-c", replay]):
            result = subprocess.run([sys.executable, *command], cwd=copied, env=environment,
                                    capture_output=True, text=True)
            runs.append({"command": ["python", *command], "exit_code": result.returncode,
                         "stdout": result.stdout, "stderr": result.stderr})
            print("python", " ".join(command[:3]), "exit", result.returncode, flush=True)
            print(result.stdout.strip(), flush=True)
            if result.returncode:
                print(result.stderr.strip(), flush=True)
                break
        generated = hashes(copied / "contracts")
        differences = sorted(k for k in generated.keys() | original.keys()
                             if generated.get(k) != original.get(k))
    schemas = [p for p in differences if "/" not in p]
    check = subprocess.run(["git", "diff", "--check"], cwd=ROOT, text=True, capture_output=True)
    runs.append({"command": ["git", "diff", "--check"], "exit_code": check.returncode,
                 "stdout": check.stdout, "stderr": check.stderr})
    preserved = original == hashes(ROOT / "contracts")
    report = {"candidate_commit": candidate, "origin_main_at_verification": base,
              "python": sys.version.split()[0], "python_executable": sys.executable,
              "requirements_sha256": hashlib.sha256((ROOT / "requirements.lock").read_bytes()).hexdigest(),
              "source_sha256": inputs, "pack": environment.get("NAVIGATOR_PACK"),
              "disposable_copy": True, "working_contracts_unchanged": preserved,
              "generated_contract_differences": differences, "schema_differences": schemas,
              "checks": runs}
    OUTPUT.write_text(json.dumps(report, indent=2) + "\n")
    return int(not preserved or bool(schemas) or any(r["exit_code"] for r in runs))


if __name__ == "__main__":
    raise SystemExit(main())
