"""Synthetic packaging/integrity fixtures; no real legal expectations or computation."""
import json
from pathlib import Path
import shutil
import socket
import subprocess

import pytest

from scripts import prepare_handoff as handoff


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(handoff.encoded(value))


def json_digest(value):
    return handoff.sha(json.dumps(value, sort_keys=True, ensure_ascii=False).encode())


@pytest.fixture
def saved(tmp_path):
    """An authored structural fixture, not an actual release/evaluation result."""
    release, evidence = tmp_path / "release", tmp_path / "verification"
    values = {"addresses": {"SYNTH-001": {"label": "Synthetic property"}},
              "rules": {"r-synthetic": {"label": "Synthetic rule"}}, "resolutions": {"SYNTH-001": {}},
              "sources": {"D-SYNTHETIC": {"text": "Synthetic source only"}},
              "snapshot_manifest": {"status": "assembled",
                                    "ready_for_submission": False, "artifact_label": handoff.LABEL}}
    assembled = {f"{key}.json": handoff.sha(handoff.encoded(value)) for key, value in values.items() if key != "snapshot_manifest"}
    # Full historical provenance can be omitted from a serving release.
    assembled["runs/synthetic-provenance.json"] = "c" * 64
    values["snapshot_manifest"].update(output_files=assembled, snapshot_id=json_digest(assembled))
    for key, value in values.items():
        write(release / f"data/{key}.json", value)
    write(release / "data/change_cache/synthetic-derived.json", {"synthetic": "derived fixture"})
    for name in ("runtime/navigator/api.py", "runtime/requirements.lock", "frontend/index.html"):
        path = release / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("Synthetic structural fixture only\n", encoding="utf-8")
    write(release / "release.json", {"format_version": "local-release-v1", "source_revision": "a" * 40,
          "artifact_label": "RESEARCH_RELEASE_NOT_VALIDATED", "ready_for_submission": False,
          "files_sha256": handoff.inventory(release)})
    statuses = {"SYNTH-PARTIAL": "partial", "SYNTH-BLOCKED": "blocked"}
    payloads = {"rules.json": [{"team_rule_id": "r-synthetic"}],
                "lookups.json": {"as_of": "2026-10-01", "lookups": {"SYNTH-001": [{"team_rule_id": "r-synthetic"}]}},
                "changes.json": {key: {"notes": value} for key, value in statuses.items()},
                "change_details.json": {key: {"status": value} for key, value in statuses.items()},
                "validation.json": {"artifact_label": handoff.LABEL, "ready_for_submission": False,
                                    "all_input_addresses_represented": True, "all_lookup_references_resolve": True,
                                    "counts": {"addresses": 1, "rules": 1}, "change_status": statuses,
                                    "warnings": ["Synthetic packaging test only"], "errors": ["Unreviewed synthetic input"]},
                "evidence_inventory.json": {"synthetic": True}, "evidence_checks.json": {"synthetic": True}}
    for name in ("first", "replay"):
        for filename, value in payloads.items():
            write(evidence / name / filename, value)
        run = {"run_id": name, "operation": "export", "mode": "local", "outcome": "partial",
               "finished_at": "2026-10-04T00:00:00+00:00", "errors": [],
               "input_hashes": {key: json_digest(values[key]) for key in ("rules", "addresses", "resolutions")},
               "config": {"as_of": "2026-10-01", "allow_partial": True}, "counts": {"rules": 1, "addresses": 1},
               "versions": {"pipeline": "synthetic-test"}, "artifacts": [f"C:\\original\\{name}\\{key}" for key in sorted(payloads)]}
        write(evidence / name / "run_manifest.json", run)
    report = {"label": "SOFTWARE_RELEASE_CHECK_NOT_LEGAL_VALIDATION", "status": "passed",
              "release_manifest_sha256": handoff.sha(handoff.raw(release / "release.json")),
              "release_label": "RESEARCH_RELEASE_NOT_VALIDATED",
              "checks": {"release_unchanged": True, "address_count": 1,
                         "scenarios": {key: {"status": value} for key, value in statuses.items()},
                         "exports": {"payload_sha256": {name: handoff.sha(handoff.raw(evidence / "first" / name)) for name in payloads},
                                     "validation": payloads["validation.json"]}}}
    write(evidence / "report.json", report)
    return {"report_path": evidence / "report.json", "release": release, "output": tmp_path / "handoff",
            "report_sha256": handoff.sha(handoff.raw(evidence / "report.json")),
            "first_manifest_sha256": handoff.sha(handoff.raw(evidence / "first/run_manifest.json")),
            "replay_manifest_sha256": handoff.sha(handoff.raw(evidence / "replay/run_manifest.json"))}


def test_packages_exact_bytes_offline_reproducibly_and_verifies_after_move(saved, monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Packaging must not invoke network or subprocess evaluation")
    monkeypatch.setattr(socket, "socket", forbidden)
    monkeypatch.setattr(subprocess, "run", forbidden)
    source = saved["report_path"].parent
    before = handoff.inventory(source), handoff.inventory(saved["release"])
    manifest = handoff.prepare(**saved)
    output = saved["output"]
    assert manifest["artifact_label"] == handoff.LABEL and manifest["ready_for_submission"] is False
    assert manifest["change_status"] == {"SYNTH-PARTIAL": "partial", "SYNTH-BLOCKED": "blocked"}
    for name in handoff.EXPORTS | {"run_manifest.json"}:
        assert (output / name).read_bytes() == (source / "first" / name).read_bytes()
    assert (output / "provenance/replay-run-manifest.json").read_bytes() == (source / "replay/run_manifest.json").read_bytes()
    replay = output.with_name("handoff-replay")
    handoff.prepare(**{**saved, "output": replay})
    assert handoff.inventory(output) == handoff.inventory(replay)
    moved = output.with_name("moved")
    shutil.copytree(output, moved)
    pin = handoff.sha((output / "handoff.json").read_bytes())
    assert handoff.verify(moved, pin) == manifest
    assert "SYNTH-BLOCKED=blocked" in (moved / "METHOD.md").read_text(encoding="utf-8")
    assert before == (handoff.inventory(source), handoff.inventory(saved["release"]))


@pytest.mark.parametrize("relative,where", [
    ("first/rules.json", "verification"), ("replay/change_details.json", "verification"),
    ("report.json", "verification"), ("first/run_manifest.json", "verification"),
    ("replay/run_manifest.json", "verification"), ("data/sources.json", "release"),
    ("runtime/navigator/api.py", "release"), ("release.json", "release"),
])
def test_rejects_changed_bytes_before_output_creation(saved, relative, where):
    base = saved["release"] if where == "release" else saved["report_path"].parent
    path = base / relative
    path.write_bytes(path.read_bytes() + b" ")
    with pytest.raises(ValueError, match="[Hh]ash|Release files"):
        handoff.prepare(**saved)
    assert not saved["output"].exists()


@pytest.mark.parametrize("damage", ["missing", "unexpected", "failed_report", "run_input", "run_date", "same_run", "duplicate_json"])
def test_rejects_incomplete_or_inconsistent_inputs_even_with_fresh_pins(saved, damage):
    source = saved["report_path"].parent
    if damage == "missing":
        (source / "first/evidence_checks.json").unlink()
    elif damage == "unexpected":
        (source / "replay/extra.json").write_text("{}")
    elif damage == "failed_report":
        report = handoff.parse(saved["report_path"].read_bytes())
        report["status"] = "failed"
        write(saved["report_path"], report)
        saved["report_sha256"] = handoff.sha(saved["report_path"].read_bytes())
    elif damage == "duplicate_json":
        saved["report_path"].write_text('{"status":"failed","status":"passed"}')
        saved["report_sha256"] = handoff.sha(saved["report_path"].read_bytes())
    else:
        path = source / "replay/run_manifest.json"
        run = handoff.parse(path.read_bytes())
        if damage == "run_input":
            run["input_hashes"]["rules"] = "f" * 64
        elif damage == "run_date":
            run["config"]["as_of"] = "2026-11-01"
        else:
            run["run_id"] = "first"
        write(path, run)
        saved["replay_manifest_sha256"] = handoff.sha(path.read_bytes())
    with pytest.raises(ValueError):
        handoff.prepare(**saved)
    assert not saved["output"].exists()


def test_preserves_existing_output_and_rejects_nested_output(saved):
    saved["output"].mkdir()
    sentinel = saved["output"] / "user.txt"
    sentinel.write_text("preserve")
    with pytest.raises(ValueError, match="existing output"):
        handoff.prepare(**saved)
    assert sentinel.read_text() == "preserve"
    with pytest.raises(ValueError, match="separate"):
        handoff.prepare(**{**saved, "output": saved["release"] / "new-handoff"})


def test_rejects_submission_promotion_even_with_consistent_new_hashes(saved):
    source = saved["report_path"].parent
    report = handoff.parse(saved["report_path"].read_bytes())
    validation = report["checks"]["exports"]["validation"]
    validation.update(ready_for_submission=True, artifact_label="COMPLETE_INTERNAL_VALIDATION")
    for name in ("first", "replay"):
        write(source / name / "validation.json", validation)
    report["checks"]["exports"]["payload_sha256"]["validation.json"] = handoff.sha((source / "first/validation.json").read_bytes())
    write(saved["report_path"], report)
    saved["report_sha256"] = handoff.sha(saved["report_path"].read_bytes())
    with pytest.raises(ValueError, match="Only explicitly partial"):
        handoff.prepare(**saved)
    assert not saved["output"].exists()


@pytest.mark.parametrize("damage", ["source_drift", "snapshot_id"])
def test_rejects_stale_assembly_identity_even_with_repinned_release_and_report(saved, damage):
    release = saved["release"]
    if damage == "source_drift":
        write(release / "data/sources.json", {"D-SYNTHETIC": {"text": "Altered synthetic source"}})
    else:
        snapshot = handoff.parse((release / "data/snapshot_manifest.json").read_bytes())
        snapshot["snapshot_id"] = "f" * 64
        write(release / "data/snapshot_manifest.json", snapshot)
    manifest = handoff.parse((release / "release.json").read_bytes())
    manifest["files_sha256"] = {key: value for key, value in handoff.inventory(release).items() if key != "release.json"}
    write(release / "release.json", manifest)
    report = handoff.parse(saved["report_path"].read_bytes())
    report["release_manifest_sha256"] = handoff.sha((release / "release.json").read_bytes())
    write(saved["report_path"], report)
    saved["report_sha256"] = handoff.sha(saved["report_path"].read_bytes())
    with pytest.raises(ValueError, match="Serving file differs from assembled snapshot|Snapshot identity does not match"):
        handoff.prepare(**saved)
    assert not saved["output"].exists()


@pytest.mark.parametrize("damage", ["payload", "missing", "added", "manifest"])
def test_recipient_detects_tampering_with_independent_manifest_pin(saved, damage):
    handoff.prepare(**saved)
    root = saved["output"]
    pin = handoff.sha((root / "handoff.json").read_bytes())
    if damage == "payload":
        (root / "changes.json").write_text("{}")
    elif damage == "missing":
        (root / "METHOD.md").unlink()
    elif damage == "added":
        (root / "extra.json").write_text("{}")
    else:
        value = handoff.parse((root / "handoff.json").read_bytes())
        value["ready_for_submission"] = True
        write(root / "handoff.json", value)
    with pytest.raises(ValueError, match="Hash mismatch|Handoff files"):
        handoff.verify(root, pin)


def test_rejects_symlinked_input_ancestor(saved, tmp_path):
    link = tmp_path / "link"
    try:
        link.symlink_to(saved["report_path"].parent, target_is_directory=True)
    except OSError:
        pytest.skip("Host does not permit test symlink creation")
    with pytest.raises(ValueError, match="Linked path"):
        handoff.prepare(**{**saved, "report_path": link / "report.json"})


def test_cli_reports_missing_pin_failure_without_creating_output(saved, capsys):
    code = handoff.main(["prepare", "--report", str(saved["report_path"]), "--release", str(saved["release"]),
                        "--output", str(saved["output"]), "--report-sha256", "0" * 64,
                        "--first-manifest-sha256", saved["first_manifest_sha256"],
                        "--replay-manifest-sha256", saved["replay_manifest_sha256"]])
    assert code == 2
    assert json.loads(capsys.readouterr().err)["status"] == "failed"
    assert not saved["output"].exists()
