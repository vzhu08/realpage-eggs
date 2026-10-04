"""Offline CLI/API closeout of an explicitly selected, stopped Core data store."""
import argparse
from collections import Counter
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shlex
import subprocess
import sys
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient
from navigator.api import create_app
from navigator.extraction import OpenAIProvider


def read(path):
    return json.loads(path.read_text())


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n")


def protected_hashes(data):
    # CLI evaluation/export may append local manifests and artifacts, but these
    # original inputs, saved rules, extraction caches and provider receipts must stay intact.
    files = [p for p in data.rglob("*") if p.is_file()
             and p.relative_to(data).parts[0] not in {"core01-live", "runs"}
             and p.name not in {"latest_evaluate.json", "latest_export.json"}]
    return {str(p.relative_to(data)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, required=True)
    parser.add_argument("--pack", type=Path, required=True)
    args = parser.parse_args()
    data, pack = args.data_dir.resolve(), args.pack.resolve()
    last = read(data / "latest_extract.json")
    if not last.get("finished_at") or last["outcome"] == "running":
        raise SystemExit("Extraction must finish or stop before closeout")
    before = protected_hashes(data)
    output = data / "core01-live" / ("core-a-closeout-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"))
    output.mkdir(parents=True, exist_ok=False)
    commands = []
    prefix = [str(ROOT / ".venv/bin/python"), "-m", "navigator", "--data-dir", str(data)]
    jobs = [
        ["evaluate", "--as-of", "2026-10-01", "--allow-partial", "--output", str(output / "evaluations.json")],
        ["validate", "--as-of", "2026-10-01", "--output", str(output / "validation.json")],
        ["export", "--as-of", "2026-10-01", "--allow-partial", "--output", str(output / "partial-export")],
        ["lookup", "A0001", "--as-of", "2026-10-01"],
    ]
    for job in jobs:
        result = subprocess.run(prefix + job, cwd=ROOT, text=True, capture_output=True)
        (output / f"{job[0]}.stdout.json").write_text(result.stdout)
        (output / f"{job[0]}.stderr.log").write_text(result.stderr)
        commands.append({"command": shlex.join(prefix + job), "exit_code": result.returncode})
        print(job[0], "exit", result.returncode, flush=True)

    exported = output / "partial-export"
    rules = read(exported / "rules.json")
    rule_ids = {r["team_rule_id"] for r in rules}
    lookups = read(exported / "lookups.json")["lookups"]
    internal_ids = set(read(data / "rules.json"))
    with (pack / "data/sample_addresses.csv").open(newline="") as handle:
        input_ids = {row["address_id"] for row in csv.DictReader(handle)}
    checks = {
        "input_stored_evaluated_exported_address_ids_equal": input_ids == set(read(data / "addresses.json")) == set(read(output / "evaluations.json")["evaluations"]) == set(lookups),
        "all_lookup_rule_references_resolve": all(row["team_rule_id"] in rule_ids for rows in lookups.values() for row in rows),
        "all_override_rule_references_resolve": all(set(r["overrides"]) <= rule_ids for r in rules),
        "all_change_mapped_rule_references_resolve_in_internal_store": all(set(ids) <= internal_ids for detail in read(exported / "change_details.json").values() for ids in detail["mapped_rule_ids"].values()),
    }
    http = {}
    request = {"address_id": "A0001", "as_of": "2026-10-01"}
    # Exercise real integrated services in-process, with provider calls forbidden.
    with patch.object(OpenAIProvider, "generate", side_effect=AssertionError("Offline closeout must not call a model")), TestClient(create_app(data)) as client:
        for route, payload in [
            ("lookup", request),
            ("lookup/assist", {**request, "limits": {"max_questions": 2, "max_fields": 3, "max_evaluations": 8, "max_joint_fields": 1}}),
        ]:
            response = client.post("/api/v1/" + route, json=payload)
            body = response.json()
            save(output / (route.replace("/", "-") + ".http.json"), body)
            entry = {"status_code": response.status_code, "request": payload}
            if response.status_code == 200:
                lookup = body["lookup"] if route.endswith("assist") else body
                entry.update({"evaluations": dict(Counter(e["result"] for e in lookup["evaluations"])), "rules": len(lookup["rules"]), "warnings": lookup["warnings"], "jurisdiction": lookup["jurisdiction"]})
                if route.endswith("assist"):
                    plan = body["question_plan"]
                    entry.update({"capabilities": body["capabilities"], "mode": body["mode"], "plan_status": plan["status"], "question_count": len(plan["questions"]), "evaluations_used": plan["evaluations_used"], "limits_hit": plan["limits_hit"], "exhaustive": plan["exhaustive"], "encoded_rules": len(body["encoded_rules"]), "evidence_reports": len(body["evidence_reports"]), "uncertainty_kinds": dict(Counter(u["kind"] for u in plan["remaining_uncertainty"]))})
                checks[route + "_references_resolve"] = {e["team_rule_id"] for e in lookup["evaluations"]} <= {r["team_rule_id"] for r in lookup["rules"]}
            else:
                entry["error"] = body
            http[route] = entry
    checks["protected_store_bytes_unchanged"] = before == protected_hashes(data)
    report = {
        "candidate_commit": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
        "as_of": "2026-10-01", "data_dir": str(data), "pack": str(pack), "artifacts": str(output),
        "mode": "offline processing of actual live/replay extraction; no synthetic law or property answers",
        "commands": commands, "checks": checks, "validation": read(output / "validation.json"),
        "export_label": read(exported / "validation.json")["artifact_label"],
        "exported_rule_statuses": dict(Counter(r["status"] for r in rules)),
        "change_status": read(exported / "validation.json")["change_status"],
        "evaluate_run": read(data / "latest_evaluate.json"), "export_run": read(data / "latest_export.json"),
        "http": http, "protected_file_count": len(before),
    }
    save(ROOT / "docs/core_rules/saved_store_closeout.json", report)
    print(json.dumps({"checks": checks, "artifacts": str(output), "counts": report["validation"]["counts"], "http_status": {k:v["status_code"] for k,v in http.items()}}, indent=2))
    return int(not all(checks.values()) or any(v["status_code"] != 200 for v in http.values()))


if __name__ == "__main__":
    raise SystemExit(main())
