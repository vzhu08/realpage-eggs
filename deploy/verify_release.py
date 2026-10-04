"""Verify an already running local release with real HTTP and copied-store exports.

No provider calls. Probe answers are unverified test inputs and never saved as property facts.
"""
import argparse
from collections import Counter
import json
from pathlib import Path
import shutil
import subprocess
import sys

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from scripts.platform_ops import child_env, fingerprint, require, save, snapshot_hashes, verify_release


def verify(args):
    release, output = args.release.resolve(), args.output.resolve()
    manifest = verify_release(release)
    require(not output.exists() and not output.is_relative_to(release), "Choose a new verification output outside the release")
    output.mkdir(parents=True)
    before = snapshot_hashes(release)
    props = json.loads((release / "data/addresses.json").read_text(encoding="utf-8"))
    resolutions = json.loads((release / "data/resolutions.json").read_text(encoding="utf-8"))
    report = {"label": "SOFTWARE_RELEASE_CHECK_NOT_LEGAL_VALIDATION", "release_manifest_sha256": fingerprint(release / "release.json"),
              "release_label": manifest["artifact_label"], "base_url": args.url, "checks": {}}
    try:
        with httpx.Client(base_url=args.url.rstrip("/"), timeout=120, trust_env=False) as client:
            health = client.get("/api/v1/health")
            require(health.status_code == 200 and health.json()["addresses"] == len(props), "Release health/count mismatch")
            report["checks"]["health"] = health.json()
            require(client.get("/").status_code == 200 and "text/html" in client.get("/").headers["content-type"], "Frontend not served")
            require(client.get("/data/addresses.json").status_code == 404, "Private store exposed as static content")
            seen = []
            for offset in range(0, len(props), 100):
                page = client.get("/api/v1/addresses", params={"offset": offset, "limit": 100}).json()
                seen.extend(item["property"]["address_id"] for item in page["items"])
            require(sorted(seen) == sorted(props), "HTTP pagination lost or duplicated addresses")
            report["checks"]["address_count"] = len(seen)
            comparisons = client.get("/api/v1/source-comparisons")
            comparisons.raise_for_status()
            save(output / "source-comparisons.json", comparisons.json())
            report["checks"]["comparisons"] = {k: row["classification"] for k,row in comparisons.json()["observations"].items()}
            # Search one real property per resolved municipality for an existing planner question.
            representatives = {}
            for ident, row in sorted(resolutions.items()):
                if row["match_quality"] == "resolved":
                    representatives.setdefault((row["state"], row["municipality"]), ident)
            chosen = None
            attempted = []
            for ident in representatives.values():
                request = {"address_id": ident, "as_of": args.as_of}
                response = client.post("/api/v1/lookup/assist", json=request)
                response.raise_for_status()
                baseline = response.json()
                attempted.append({"address_id": ident, "questions": len(baseline["question_plan"]["questions"])})
                if baseline["question_plan"]["questions"]:
                    chosen = (request, baseline)
                    break
            require(chosen is not None, "No real-property question found; preserve the report and choose another reviewed case")
            request, baseline = chosen
            question = baseline["question_plan"]["questions"][0]
            field = question["fact"]["field"]
            value = next(a["probe_facts"][field] for a in question["alternatives"] if field in a["probe_facts"])
            answer = {"field": field, "value": value, "provenance": "user_provided", "note": "Software check: hypothetical unverified probe, not a documented property fact"}
            answered_request = {**request, "answers": [answer]}
            answered = client.post("/api/v1/lookup/assist", json=answered_request)
            answered.raise_for_status()
            require(answered.json()["answers_applied"] == [answer], "Answer provenance not retained")
            reset = client.post("/api/v1/lookup/assist", json=request)
            require(reset.json() == baseline, "Reset failed to reproduce original lookup")
            downloaded = client.post("/api/v1/lookup/evidence-package", json=answered_request)
            downloaded.raise_for_status()
            require("attachment" in downloaded.headers.get("content-disposition", ""), "Evidence download header missing")
            save(output / "property-evidence.json", downloaded.json())
            save(output / "browser-case.json", {"request": request, "answer": answer, "question": question,
                                               "rule_id": question["rule_ids"][0], "baseline": baseline,
                                               "answered": answered.json(), "candidate_search": attempted})
            report["checks"]["property_journey"] = {"address_id": request["address_id"], "as_of": args.as_of,
                "field": field, "probe_is_unverified": True, "answer_reset_reproduced": True,
                "before_results": dict(Counter(e["result"] for e in baseline["lookup"]["evaluations"])),
                "after_results": dict(Counter(e["result"] for e in answered.json()["lookup"]["evaluations"]))}
            print(json.dumps(report["checks"]["property_journey"]), flush=True)
            scenarios = {}
            for ident in ("T1", "T2", "T3", "T4", "T5"):
                response = client.post("/api/v1/changes/summary", json={"test_id": ident})
                response.raise_for_status()
                save(output / f"{ident}.json", response.json())
                result = response.json()["result"]
                scenarios[ident] = {"status": result["status"], "affected": len(result["affected_address_ids"]),
                                   "uncertain": len(result["uncertain_address_ids"]), "conflicts": len(result["conflict_flag_address_ids"]),
                                   "notes": result["notes"]}
                print(json.dumps({"scenario": ident, "status": result["status"]}), flush=True)
            report["checks"]["scenarios"] = scenarios
        def cli(data, *arguments):
            result = subprocess.run([sys.executable, "-m", "navigator", "--data-dir", str(data), *arguments],
                cwd=release / "runtime", env=child_env(data), capture_output=True, text=True, timeout=300)
            allowed = (0, 1) if arguments[0] == "export" and "--allow-partial" in arguments else (0,)
            require(result.returncode in allowed, f"Release CLI {arguments[0]} failed with exit {result.returncode}: {result.stderr[-1000:]}")
            value = json.loads(result.stdout)
            if result.returncode == 1:
                require(value.get("artifact_label") == "PARTIAL_NOT_JUDGE_READY" and value.get("ready_for_submission") is False,
                        "Nonzero export exit must retain its explicit partial validation result")
            report["checks"].setdefault("cli_exits", []).append({"command": arguments[0], "exit_code": result.returncode})
            return value
        report["checks"]["evidence_replay"] = cli(output / "absent", "replay-evidence-package", str(output / "property-evidence.json"))
        working = output / "export-store"
        shutil.copytree(release / "data", working)
        for name in ("first", "replay"):
            cli(working, "export", "--as-of", args.as_of, "--allow-partial", "--output", str(output / name))
            print(json.dumps({"export": name, "complete": True}), flush=True)
        hashes = {}
        for p in sorted((output / "first").glob("*.json")):
            if p.name == "run_manifest.json": continue
            require(p.read_bytes() == (output / "replay" / p.name).read_bytes(), f"Export replay differs: {p.name}")
            hashes[p.name] = fingerprint(p)
        require(len(hashes) == 7, "Missing export payloads")
        validation = json.loads((output / "first/validation.json").read_text(encoding="utf-8"))
        require(validation["all_input_addresses_represented"] and validation["all_lookup_references_resolve"], "Export lost addresses or references")
        report["checks"]["exports"] = {"payload_sha256": hashes, "validation": validation}
        require(snapshot_hashes(release) == before, "Release changed during verification")
        report["checks"]["release_unchanged"] = True
        report["status"] = "passed"
    except Exception as exc:
        report.update(status="failed", failure=f"{type(exc).__name__}: {exc}")
        raise
    finally:
        save(output / "report.json", report)
    print(json.dumps({"status": "passed", "report": str(output / "report.json")}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", type=Path, required=True)
    parser.add_argument("--url", required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--as-of", default="2026-10-01")
    verify(parser.parse_args())
