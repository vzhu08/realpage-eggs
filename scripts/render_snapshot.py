"""Prepare/verify/install a private serving snapshot; no deployment or provider calls."""
import argparse
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import sys
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.platform_ops import SERVING_FILES, fingerprint, require, save, verify_release

REQUIRED = {"addresses.json", "resolutions.json", "rules.json", "sources.json", "dataset.json"}
LABELS = {"SYNTHETIC_NOT_FOR_SUBMISSION", "RESEARCH_RELEASE_NOT_VALIDATED"}


def allowed(name):
    return name in SERVING_FILES or bool(re.fullmatch(r"semantic_reviews/[A-Za-z0-9_-]+\.json", name))


def verify_archive(archive, expected_sha256):
    require(bool(re.fullmatch(r"[0-9a-f]{64}", expected_sha256)), "Expected a lowercase SHA-256")
    require(fingerprint(archive) == expected_sha256, "Archive SHA-256 mismatch")
    with ZipFile(archive) as bundle:
        entries = bundle.infolist()
        names = [entry.filename for entry in entries]
        require(len(names) == len(set(names)) and len(names) <= 4096, "Duplicate or excessive archive entries")
        require(sum(entry.file_size for entry in entries) <= 256 * 1024 * 1024, "Archive exceeds 256 MiB unpacked")
        require("manifest.json" in names, "Missing snapshot manifest")
        manifest = json.loads(bundle.read("manifest.json"))
        require(manifest.get("format_version") == "render-snapshot-v1", "Unsupported snapshot format")
        require(manifest.get("artifact_label") in LABELS and manifest.get("ready_for_submission") is False,
                "Snapshot must retain its research/synthetic label")
        files = manifest.get("files_sha256")
        require(isinstance(files, dict) and REQUIRED <= files.keys(), "Missing serving files")
        require(all(allowed(name) for name in files), "Unexpected snapshot path")
        require(set(names) == {"manifest.json", *(f"data/{name}" for name in files)}, "Unexpected archive entries")
        for name, expected in files.items():
            require(sha256(bundle.read(f"data/{name}")).hexdigest() == expected, f"File hash mismatch: {name}")
    return manifest


def prepare(release, output):
    release, output = release.resolve(), output.resolve()
    require(not output.exists() and not output.is_relative_to(release), "Choose a new output outside the saved release")
    original = verify_release(release)
    original_hash = fingerprint(release / "release.json")
    files = {name.removeprefix("data/"): value for name, value in original["files_sha256"].items()
             if name.startswith("data/") and allowed(name.removeprefix("data/"))}
    manifest = {"format_version": "render-snapshot-v1", "artifact_label": original["artifact_label"],
                "ready_for_submission": False, "release_manifest_sha256": original_hash,
                "release_source_revision": original["source_revision"], "files_sha256": files}
    output.mkdir(parents=True)
    archive = output / "snapshot.zip"
    with ZipFile(archive, "x", compression=ZIP_DEFLATED) as bundle:
        bundle.writestr("manifest.json", json.dumps(manifest, indent=2) + "\n")
        for name in sorted(files):
            bundle.write(release / "data" / name, f"data/{name}")
    digest = fingerprint(archive)
    verify_archive(archive, digest)
    require(verify_release(release) == original and fingerprint(release / "release.json") == original_hash,
            "Original release changed during packaging")
    (output / "snapshot.zip.sha256").write_text(digest + "\n", encoding="ascii")
    report = {"archive": str(archive), "sha256": digest, "bytes": archive.stat().st_size,
              "files": len(files), "artifact_label": manifest["artifact_label"], "ready_for_submission": False}
    save(output / "receipt.json", report)
    return report


def install(archive, expected_sha256, data_root, name):
    # Set before importing navigator, so neither local .env nor inherited credentials are used.
    os.environ.update(PYTHON_DOTENV_DISABLED="1", OPENAI_API_KEY="", OPENAI_MODEL="")
    require(bool(re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", name)), "Use a simple lowercase snapshot name")
    manifest = verify_archive(archive, expected_sha256)
    data_root = data_root.resolve()
    target, staging = data_root / name, data_root / f".{name}.installing"
    require(not target.exists() and not staging.exists(), "Snapshot or incomplete installation already exists; use a new name")
    staging.mkdir(parents=True)
    # Never extract paths or execute code from the archive. Only allowlisted bytes are copied.
    with ZipFile(archive) as bundle:
        for relative, expected in manifest["files_sha256"].items():
            content = bundle.read(f"data/{relative}")
            require(sha256(content).hexdigest() == expected, "Archive changed during installation")
            dest = staging / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            with dest.open("xb") as stream:
                stream.write(content)
    from navigator.changes import compute_changes
    from navigator.evidence import EvidenceStoreView, prepare_rules
    from navigator.models import ChangeRequest
    from navigator.store import Store, save_change_cache

    store = Store(staging)
    counts = {"addresses": len(store.addresses()), "rules": len(store.rules()), "sources": len(store.sources()),
              "resolutions": len(store.resolutions())}
    prepared, _ = prepare_rules(store)
    view = EvidenceStoreView(store, prepared)
    scenarios = []
    for scenario in store.read("change_tests.json", []):
        request = ChangeRequest(test_id=scenario["test_id"])
        result = compute_changes(view, request)
        key = save_change_cache(staging / "change_cache", view, request, result)
        entry = {"test_id": request.test_id, "status": result.status, "cache_key": key}
        scenarios.append(entry)
        print(json.dumps(entry), flush=True)
    require(all(fingerprint(staging / relative) == digest for relative, digest in manifest["files_sha256"].items()),
            "Serving inputs changed while caching")
    receipt = {"format_version": "render-install-v1", "archive_sha256": expected_sha256,
               "artifact_label": manifest["artifact_label"], "ready_for_submission": False,
               "manifest": manifest, "counts": counts, "scenarios": scenarios,
               "serving_code_revision": os.getenv("RENDER_GIT_COMMIT"),
               "NAVIGATOR_DATA_DIR": str(target)}
    save(staging / "render_install.json", receipt)
    # A failed run leaves only a clearly incomplete staging directory, never the final snapshot.
    staging.rename(target)
    return receipt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    package = commands.add_parser("prepare")
    package.add_argument("--release", required=True, type=Path)
    package.add_argument("--output", required=True, type=Path)
    for name in ("verify", "install"):
        command = commands.add_parser(name)
        command.add_argument("--archive", required=True, type=Path)
        command.add_argument("--sha256", required=True)
        if name == "install":
            command.add_argument("--data-root", type=Path, default=Path("/var/data"))
            command.add_argument("--name", required=True)
    args = parser.parse_args()
    if args.command == "prepare":
        result = prepare(args.release, args.output)
    elif args.command == "verify":
        verified = verify_archive(args.archive, args.sha256)
        result = {"status": "verified", "files": len(verified["files_sha256"]), "artifact_label": verified["artifact_label"]}
    else:
        result = install(args.archive, args.sha256, args.data_root, args.name)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
