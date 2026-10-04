"""Compare full outputs and local timings against a Git baseline in disposable copies.

Uses the pinned Core snapshot, not the hosted real-002 release. No provider calls.
"""
import argparse
from hashlib import sha256
from io import BytesIO
import json
import os
from pathlib import Path
import platform
from statistics import median
import subprocess
import sys
import tarfile
import tempfile
from time import perf_counter, process_time
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[3]
SNAPSHOT_SHA256 = "157581d64b1c19fdfcc0414d08bbd0ffeeeca60e3142bd621a7152fe5c6e44bc"
IDS = ("A0001", "A0002", "A0005", "A0006")  # CA/NJ/MA, including prior latency diagnostic IDs.


def digest(value):
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def files(directory):
    return {path.relative_to(directory).as_posix(): sha256(path.read_bytes()).hexdigest()
            for path in directory.rglob("*") if path.is_file()}


def timed(call, repeats):
    wall, cpu, outputs = [], [], []
    for _ in range(repeats):
        begin, cpu_begin = perf_counter(), process_time()
        value = call()
        cpu.append(process_time() - cpu_begin)
        wall.append(perf_counter() - begin)
        outputs.append(value)
    hashes = [digest(value) for value in outputs]
    assert len(set(hashes)) == 1, "Repeated output changed"
    return {"wall_seconds": wall, "cpu_seconds": cpu, "median_wall_seconds": median(wall),
            "median_cpu_seconds": median(cpu), "output_sha256": hashes[0]}, outputs[0]


def worker(runtime, data, output, repeats):
    sys.path.insert(0, str(runtime))
    from datetime import date
    from navigator.assist_service import assist
    from navigator.engine import evaluate_rules, rule_traces
    from navigator.models import AssistRequest
    from navigator.store import Store

    class ReadOnlyStore(Store):
        def write(self, *args, **kwargs):
            raise AssertionError("Benchmark attempted a Store write")

    before = files(data)
    store = ReadOnlyStore(data)
    rules = list(store.rules().values())
    properties, resolutions = store.addresses(), store.resolutions()
    day = date(2026, 10, 1)
    rows = []
    for ident in IDS:
        prop, resolution = properties[ident], resolutions[ident]
        result, _ = timed(lambda: [item.model_dump(mode="json") for item in
                                  evaluate_rules(rules, prop, resolution, day)], repeats)
        traces = [item.model_dump(mode="json") for rule in rules
                  for item in rule_traces(rule, prop, resolution, day)]
        rows.append({"kind": "evaluate_rules", "address_id": ident, "state": resolution.state,
                     "as_of": day.isoformat(), "trace_sha256": digest(traces), **result})
    requests = [AssistRequest(address_id=ident, as_of=day) for ident in IDS]
    # Hypothetical request-local answers, explicitly not new stored property findings.
    requests += [AssistRequest(address_id="A0001", as_of=day,
                               answers=[{"field": "owner_occupied", "value": value}])
                 for value in (False, True, None)]
    requests += [AssistRequest(address_id="A0001", as_of=date(2027, 7, 1))]
    for request in requests:
        result, response = timed(lambda: assist(store, request).model_dump(mode="json"), repeats)
        plan = response["question_plan"]
        rows.append({"kind": "assist", "request": request.model_dump(mode="json"),
                     "plan_status": plan["status"], "evaluations_used": plan["evaluations_used"],
                     "question_count": len(plan["questions"]), **result})
    assert files(data) == before, "Benchmark changed snapshot files"
    output.write_text(json.dumps({"rows": rows, "input_files_sha256": digest(before),
                                 "rules": len(rules), "addresses": len(properties),
                                 "resolved_municipalities": sum(r.match_quality == "resolved" for r in resolutions.values())},
                                indent=2) + "\n")


def main(baseline_ref, output, repeats):
    baseline_sha = subprocess.check_output(["git", "rev-parse", baseline_ref], cwd=ROOT, text=True).strip()
    snapshot = ROOT / "docs/core_rules/snapshots/core-store.zip"
    assert sha256(snapshot.read_bytes()).hexdigest() == SNAPSHOT_SHA256
    env = dict(os.environ, PYTHON_DOTENV_DISABLED="1", PYTHONDONTWRITEBYTECODE="1",
               OPENAI_API_KEY="", OPENAI_MODEL="")
    with tempfile.TemporaryDirectory(prefix="realpage-core-perf-") as temporary:
        temp = Path(temporary)
        baseline, data = temp / "baseline", temp / "data"
        baseline.mkdir()
        archive = subprocess.check_output(["git", "archive", baseline_sha, "navigator", "config"], cwd=ROOT)
        with tarfile.open(fileobj=BytesIO(archive)) as bundle:
            bundle.extractall(baseline, filter="data")
        with ZipFile(snapshot) as bundle:
            for name in bundle.namelist():
                assert not Path(name).is_absolute() and ".." not in Path(name).parts
            bundle.extractall(data)
        runs = {}
        for label, runtime in (("baseline", baseline), ("candidate", ROOT)):
            target = temp / f"{label}.json"
            subprocess.run([sys.executable, str(Path(__file__).resolve()), "--worker", "--runtime", str(runtime),
                            "--data", str(data), "--output", str(target), "--repeats", str(repeats)],
                           cwd=temp, env=env, check=True)
            runs[label] = json.loads(target.read_text())
            print(f"{label} complete", flush=True)
        old, new = runs["baseline"], runs["candidate"]
        assert old["input_files_sha256"] == new["input_files_sha256"]
        assert len(old["rows"]) == len(new["rows"])
        comparisons = []
        for before, after in zip(old["rows"], new["rows"]):
            assert before["kind"] == after["kind"]
            assert before["output_sha256"] == after["output_sha256"], "Complete result changed"
            assert before.get("trace_sha256") == after.get("trace_sha256"), "Complete audit trace changed"
            comparisons.append({"kind": after["kind"], "address_id": after.get("address_id", after.get("request", {}).get("address_id")),
                                "speedup": before["median_wall_seconds"] / after["median_wall_seconds"]})
        names = ("navigator/engine.py", "navigator/predicates.py", "navigator/models.py", "navigator/question_planner.py")
        report = {"label": "LOCAL_CORE_SNAPSHOT_NOT_HOSTED_LATENCY_ACCEPTANCE", "baseline_commit": baseline_sha,
                  "candidate_parent_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
                  "python": sys.version.split()[0], "platform": platform.platform(), "repeats_per_request": repeats,
                  "snapshot_sha256": SNAPSHOT_SHA256, "input_files_unchanged": True,
                  "provider_calls": 0, "store_writes": 0, "complete_results_and_traces_equal": True,
                  "baseline_code_sha256": {name: sha256((baseline / name).read_bytes()).hexdigest() for name in names},
                  "candidate_code_sha256": {name: sha256((ROOT / name).read_bytes()).hexdigest() for name in names},
                  "baseline": old, "candidate": new, "comparisons": comparisons,
                  "limits": "Sequential local diagnostic runs, includes serialization, no hosted/cold-start/concurrent-user/p95 claim. All municipalities are unresolved in this Core snapshot. Follow-up answers are hypothetical request-local probes. No response cache or reduced planner limits."}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(comparisons, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline-ref", default="912643a047568f6df4bddf3c1222ea7043676ec2")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--repeats", type=int, default=3)
    parser.add_argument("--worker", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--runtime", type=Path, help=argparse.SUPPRESS)
    parser.add_argument("--data", type=Path, help=argparse.SUPPRESS)
    args = parser.parse_args()
    assert args.repeats > 0
    if args.worker:
        worker(args.runtime, args.data, args.output, args.repeats)
    else:
        main(args.baseline_ref, args.output, args.repeats)
