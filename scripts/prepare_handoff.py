"""Package a verified partial release without evaluating rules or calling providers."""
import argparse
from hashlib import sha256
import json
from pathlib import Path, PurePosixPath, PureWindowsPath
import re
import sys


EXPORTS = frozenset({"rules.json", "lookups.json", "changes.json", "validation.json",
                     "change_details.json", "evidence_inventory.json", "evidence_checks.json"})
LABEL = "PARTIAL_NOT_JUDGE_READY"
FORMAT = "private-handoff-v1"
ROOT = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(data):
    return sha256(data).hexdigest()


def ordinary(path):
    """Do not resolve away a link before checking its ancestors (including junctions)."""
    path = path.absolute()
    for item in (path, *path.parents):
        require(not item.is_symlink() and not getattr(item, "is_junction", lambda: False)(),
                f"Linked path is not permitted: {item}")
    return path.resolve()


def raw(path):
    ordinary(path)
    require(path.is_file(), f"Missing ordinary file: {path}")
    return path.read_bytes()


def parse(data):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f"Duplicate JSON key: {key}")
            result[key] = value
        return result
    def invalid(value):
        raise ValueError(f"Non-finite JSON value: {value}")
    return json.loads(data, object_pairs_hook=unique, parse_constant=invalid)


def encoded(value):
    return (json.dumps(value, indent=2, sort_keys=True, ensure_ascii=False) + "\n").encode("utf-8")


def pinned(path, expected):
    require(isinstance(expected, str) and re.fullmatch(r"[0-9a-f]{64}", expected), "Expected SHA-256 must be 64 lowercase hex digits")
    data = raw(path)
    require(sha(data) == expected, f"Hash mismatch: {path}")
    return data


def inventory(root):
    ordinary(root)
    require(root.is_dir(), f"Missing directory: {root}")
    result = {}
    for path in sorted(root.rglob("*")):
        ordinary(path)
        require(path.is_file() or path.is_dir(), f"Non-ordinary path: {path}")
        if path.is_file():
            result[path.relative_to(root).as_posix()] = sha(raw(path))
    return result


def hash_map(value):
    require(isinstance(value, dict) and value, "Missing file hash inventory")
    for name, digest in value.items():
        path = PurePosixPath(name)
        require(not path.is_absolute() and not PureWindowsPath(name).drive and "\\" not in name
                and str(path) == name and all(p not in {".", ".."} for p in path.parts), "Unsafe manifest path")
        require(isinstance(digest, str) and re.fullmatch(r"[0-9a-f]{64}", digest), "Invalid file SHA-256")
    return value


def verify_release(release, expected):
    manifest = parse(pinned(release / "release.json", expected))
    require(manifest.get("format_version") == "local-release-v1", "Unsupported release format")
    require(manifest.get("ready_for_submission") is False, "This command packages unaccepted research releases only")
    require(re.fullmatch(r"[0-9a-f]{40}", manifest.get("source_revision", "")), "Missing release code revision")
    files = inventory(release)
    files.pop("release.json")
    require(files == hash_map(manifest.get("files_sha256")), "Release files missing, changed or added")
    require({"runtime/navigator/api.py", "runtime/requirements.lock", "frontend/index.html",
             "data/sources.json", "data/snapshot_manifest.json", "data/addresses.json",
             "data/rules.json", "data/resolutions.json"} <= files.keys(), "Incomplete release provenance")
    return manifest


def validate_exports(payloads, report, runs, release):
    values = {name: parse(value) for name, value in payloads.items()}
    validation, checks = values["validation.json"], report["checks"]
    require(validation == checks["exports"]["validation"], "Validation report differs from saved verification")
    require(validation.get("artifact_label") == LABEL and validation.get("ready_for_submission") is False,
            "Only explicitly partial exports are supported; this command cannot approve submission")
    require(validation.get("all_input_addresses_represented") is True
            and validation.get("all_lookup_references_resolve") is True, "Export reference checks did not pass")
    addresses = parse(raw(release / "data/addresses.json"))
    lookups = values["lookups.json"]
    require(set(lookups["lookups"]) == set(addresses), "Export address IDs do not match release")
    rules = values["rules.json"]
    ids = {row["team_rule_id"] for row in rules}
    require(len(ids) == len(rules), "Duplicate exported rule ID")
    require(all(row["team_rule_id"] in ids for rows in lookups["lookups"].values() for row in rows),
            "Dangling lookup rule reference")
    statuses = {key: value["status"] for key, value in values["change_details.json"].items()}
    require(statuses and set(statuses) == set(values["changes.json"]), "Change export scenario IDs differ")
    require(statuses == validation["change_status"] == {k: v["status"] for k, v in checks["scenarios"].items()},
            "Scenario status differs from verification")
    require(all(status in {"complete", "partial", "blocked"} for status in statuses.values()), "Invalid change status")
    # Match the exporter's existing logical JSON input digest; never prepare/evaluate rules here.
    inputs = {key: sha(json.dumps(parse(raw(release / f"data/{key}.json")), sort_keys=True,
                                  ensure_ascii=False, default=str).encode("utf-8"))
              for key in ("rules", "addresses", "resolutions")}
    require(runs[0]["run_id"] != runs[1]["run_id"], "Replay must be a separate export run")
    for run in runs:
        require(run.get("operation") == "export" and run.get("mode") == "local" and run.get("outcome") == "partial",
                "Expected a completed local partial export run")
        require(run.get("finished_at") and not run.get("errors"), "Run is unfinished or failed")
        require(run.get("input_hashes") == inputs, "Run inputs do not match saved release")
        require(run.get("config") == {"as_of": lookups["as_of"], "allow_partial": True}, "Run date/config differs from exports")
        require(run.get("counts") == {"rules": len(rules), "addresses": len(addresses)}, "Run counts differ from exports")
        names = [PureWindowsPath(p).name for p in run.get("artifacts", [])]
        require(len(names) == len(EXPORTS) and set(names) == EXPORTS, "Run artifacts do not describe the seven exports")
    require(runs[0].get("versions") == runs[1].get("versions"), "Replay pipeline versions differ")
    require(checks.get("address_count") == len(addresses), "Verification address count differs")
    return validation, statuses, inputs, lookups["as_of"]


def prepare(report_path, release, output, *, report_sha256, first_manifest_sha256, replay_manifest_sha256):
    report_path, release, output = map(lambda p: ordinary(Path(p)), (report_path, release, output))
    require(not output.exists(), "Choose a new output directory; existing output is preserved")
    for source in (report_path.parent, release):
        require(not output.is_relative_to(source) and not source.is_relative_to(output), "Input and output trees must be separate")
    report_bytes = pinned(report_path, report_sha256)
    report = parse(report_bytes)
    require(report.get("label") == "SOFTWARE_RELEASE_CHECK_NOT_LEGAL_VALIDATION" and report.get("status") == "passed",
            "A passed saved software verification report is required")
    require(report.get("checks", {}).get("release_unchanged") is True, "Saved verification did not preserve its release")
    release_manifest = verify_release(release, report["release_manifest_sha256"])
    require(report.get("release_label") == release_manifest["artifact_label"], "Release label differs from verification")
    expected = hash_map(report["checks"]["exports"]["payload_sha256"])
    require(set(expected) == EXPORTS, "Expected exactly seven named export payloads")
    first, replay = report_path.parent / "first", report_path.parent / "replay"
    files = {}
    for source in (first, replay):
        require(set(inventory(source)) == EXPORTS | {"run_manifest.json"}, "Export directory contains missing or unexpected files")
    for name, digest in expected.items():
        files[name] = pinned(first / name, digest)
        require(pinned(replay / name, digest) == files[name], f"Export replay differs: {name}")
    files["run_manifest.json"] = pinned(first / "run_manifest.json", first_manifest_sha256)
    files["provenance/replay-run-manifest.json"] = pinned(replay / "run_manifest.json", replay_manifest_sha256)
    runs = [parse(files[name]) for name in ("run_manifest.json", "provenance/replay-run-manifest.json")]
    validation, statuses, inputs, as_of = validate_exports({k: files[k] for k in EXPORTS}, report, runs, release)
    files["provenance/verification-report.json"] = report_bytes
    files["provenance/release.json"] = raw(release / "release.json")
    files["provenance/snapshot_manifest.json"] = raw(release / "data/snapshot_manifest.json")
    snapshot = parse(files["provenance/snapshot_manifest.json"])
    require(snapshot.get("status") == "assembled" and snapshot.get("ready_for_submission") is False
            and snapshot.get("artifact_label") == LABEL, "Expected an assembled partial snapshot")
    require(re.fullmatch(r"[0-9a-f]{64}", snapshot.get("snapshot_id", "")), "Missing snapshot identity")
    template = raw(ROOT / "docs/METHOD.md")
    note = template.decode("utf-8").replace("<!-- SAVED_RUN -->", "\n".join([
        f"- Export date: `{as_of}`. Runtime commit: `{release_manifest['source_revision']}`.",
        f"- Snapshot: `{snapshot['snapshot_id']}`.",
        f"- Export runs: `{runs[0]['run_id']}` and `{runs[1]['run_id']}`.",
        f"- Saved validation counts: `{json.dumps(validation['counts'], sort_keys=True)}`.",
        "- Change statuses: " + ", ".join(f"{key}={value}" for key, value in sorted(statuses.items())) + ".",
        "- Remaining errors and warnings are preserved in `validation.json`; full detail stays in `change_details.json`.",
    ]))
    require("<!-- SAVED_RUN -->" in template.decode("utf-8"), "Method template lacks saved-run marker")
    files["METHOD.md"] = note.encode("utf-8")
    manifest = {"format_version": FORMAT, "artifact_label": LABEL, "ready_for_submission": False,
                "verification_status": "saved_software_checks_passed", "as_of": as_of,
                "runtime_code_revision": release_manifest["source_revision"], "snapshot_id": snapshot["snapshot_id"],
                "report_sha256": report_sha256, "release_manifest_sha256": report["release_manifest_sha256"],
                "run_ids": [run["run_id"] for run in runs], "export_input_hashes": inputs,
                "source_catalog_sha256": release_manifest["files_sha256"]["data/sources.json"],
                "change_status": statuses, "validation_counts": validation["counts"],
                "packager_sha256": sha(raw(Path(__file__))), "method_template_sha256": sha(template),
                "files_sha256": {name: sha(data) for name, data in sorted(files.items())},
                "limitations": ["Private partial handoff, not submission approval or legal validation.",
                                "Pins detect drift from a trusted record; they do not establish authenticity.",
                                "Original manifests retain original paths and timestamps; these paths are provenance, not commands.",
                                "Full source store, runnable release and provider/geocoder history remain separate immutable artifacts.",
                                "Packaging performs no legal computation and does not rerun saved HTTP/browser checks."]}
    # Complete validation precedes creation; interrupted copies stay visibly incomplete.
    output.mkdir(parents=True)
    marker = output / "HANDOFF_INCOMPLETE"
    marker.write_text("Handoff preparation has not completed.\n", encoding="utf-8")
    for name, data in sorted(files.items()):
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    verify_release(release, report["release_manifest_sha256"])
    pinned(report_path, report_sha256)
    for directory, pin in ((first, first_manifest_sha256), (replay, replay_manifest_sha256)):
        require(inventory(directory) == {**expected, "run_manifest.json": pin}, "Export inputs changed during packaging")
    manifest_bytes = encoded(manifest)
    (output / "handoff.json").write_bytes(manifest_bytes)
    marker.unlink()
    verify(output, sha(manifest_bytes))
    return manifest


def verify(bundle, expected):
    bundle = ordinary(Path(bundle))
    manifest = parse(pinned(bundle / "handoff.json", expected))
    require(manifest.get("format_version") == FORMAT and manifest.get("artifact_label") == LABEL
            and manifest.get("ready_for_submission") is False, "Unsupported or promoted handoff")
    files = inventory(bundle)
    files.pop("handoff.json")
    require(files == hash_map(manifest.get("files_sha256")), "Handoff files missing, changed or added")
    require(EXPORTS | {"run_manifest.json", "METHOD.md", "provenance/verification-report.json",
                      "provenance/replay-run-manifest.json", "provenance/release.json",
                      "provenance/snapshot_manifest.json"} == set(files), "Incomplete handoff contents")
    return manifest


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("prepare", help="Copy an already verified partial export into a new private directory")
    for name in ("report", "release", "output"):
        create.add_argument(f"--{name}", required=True, type=Path)
    for name in ("report-sha256", "first-manifest-sha256", "replay-manifest-sha256"):
        create.add_argument(f"--{name}", required=True)
    check = commands.add_parser("verify", help="Check an existing handoff against its independently retained manifest hash")
    check.add_argument("--bundle", required=True, type=Path)
    check.add_argument("--manifest-sha256", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "prepare":
            manifest = prepare(args.report, args.release, args.output, report_sha256=args.report_sha256,
                               first_manifest_sha256=args.first_manifest_sha256, replay_manifest_sha256=args.replay_manifest_sha256)
            bundle = args.output
        else:
            manifest, bundle = verify(args.bundle, args.manifest_sha256), args.bundle
        print(json.dumps({"status": "prepared" if args.command == "prepare" else "verified", "bundle": str(bundle.resolve()),
                          "manifest_sha256": sha(raw(bundle / "handoff.json")), "artifact_label": manifest["artifact_label"],
                          "ready_for_submission": False}))
        return 0
    except (ValueError, OSError, KeyError, TypeError) as exc:
        print(json.dumps({"status": "failed", "error": str(exc)}), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
