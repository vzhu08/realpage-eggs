from datetime import date
from pathlib import Path

from .changes import compute_changes
from .engine import evaluate_rules
from .evidence import prepare_rules, EvidenceStoreView
from .models import ChangeRequest
from .store import digest, write_json
from .validation import export_rule, inventory, validate


def export_all(store, output: Path, as_of=date(2026, 10, 1), allow_partial=False, synthetic=False):
    prepared, evidence_reports = prepare_rules(store)
    store = EvidenceStoreView(store, prepared)
    report = validate(store, as_of)
    if report["counts"]["synthetic_rules"] and not synthetic:
        raise ValueError("Synthetic data requires --synthetic and a separate output directory")
    if not report["ready_for_submission"] and not allow_partial:
        raise ValueError("Dataset not ready; inspect validate. Use --allow-partial to create explicitly incomplete artifacts")
    run = store.new_run("export", "synthetic" if synthetic else "local", input_hashes={"rules": digest(store.read("rules.json", {})), "addresses": digest(store.read("addresses.json", {})), "resolutions": digest(store.read("resolutions.json", {}))}, config={"as_of": str(as_of), "allow_partial": allow_partial})
    rules = list(store.rules().values())
    exported_ids = set(report["exportable_rule_ids"])
    exported_rules = [export_rule(r, rules, as_of) for r in sorted(rules, key=lambda r: r.team_rule_id) if r.team_rule_id in exported_ids]
    resolutions, lookups = store.resolutions(), {}
    for ident, prop in sorted(store.addresses().items()):
        evaluated = evaluate_rules(rules, prop, resolutions[ident], as_of)
        lookups[ident] = [{"team_rule_id": e.team_rule_id, "result": e.result, "explanation": e.explanation, "conflict_flag": e.conflict_flag} for e in evaluated if e.team_rule_id in exported_ids and e.result not in {"inapplicable", "failed"}]
    changes, details = {}, {}
    for test in store.read("change_tests.json", []):
        result = compute_changes(store, ChangeRequest(test_id=test["test_id"]))
        details[test["test_id"]] = result.model_dump(mode="json")
        changes[test["test_id"]] = {"affected_address_ids": result.affected_address_ids, "conflict_flag_address_ids": result.conflict_flag_address_ids, "notes": f"{result.status}; {result.scenario}. " + " ".join(result.notes) + f" Uncertain set ({len(result.uncertain_address_ids)} addresses) retained in change_details.json; definite-only export pending organizer guidance."}
    report["change_status"] = {k: v["status"] for k, v in details.items()}
    if any(v["status"] != "complete" for v in details.values()): report["ready_for_submission"] = False
    if not report["ready_for_submission"] and not allow_partial:
        run.errors.append("Change scenarios incomplete; no export written without --allow-partial")
        store.finish(run, "failed")
        raise ValueError("Change scenarios incomplete; inspect changes or explicitly use --allow-partial")
    report["all_input_addresses_represented"] = set(lookups) == set(store.addresses())
    report["all_lookup_references_resolve"] = all(row["team_rule_id"] in exported_ids for rows in lookups.values() for row in rows)
    report["artifact_label"] = "SYNTHETIC_NOT_FOR_SUBMISSION" if synthetic else "COMPLETE_INTERNAL_VALIDATION" if report["ready_for_submission"] else "PARTIAL_NOT_JUDGE_READY"
    artifacts = {"rules.json": exported_rules, "lookups.json": {"as_of": str(as_of), "lookups": lookups}, "changes.json": changes, "validation.json": report, "change_details.json": details, "evidence_inventory.json": inventory(store)}
    artifacts["evidence_checks.json"] = {k: v.model_dump(mode="json") for k,v in evidence_reports.items()}
    for name, value in artifacts.items(): write_json(output / name, value)
    run.artifacts = [str((output / name).resolve()) for name in artifacts]
    store.finish(run, "success" if report["ready_for_submission"] else "partial", rules=len(exported_rules), addresses=len(lookups))
    write_json(output / "run_manifest.json", run)
    return report
