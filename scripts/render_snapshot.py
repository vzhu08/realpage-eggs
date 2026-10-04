"""Prepare/verify/install a private serving snapshot; no deployment or provider calls."""
import argparse
from base64 import b64decode, b64encode
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import sys
from tempfile import TemporaryDirectory
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_LZMA

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.platform_ops import SERVING_FILES, fingerprint, require, save, verify_release

REQUIRED = {"addresses.json", "resolutions.json", "rules.json", "sources.json", "dataset.json"}
LABELS = {"SYNTHETIC_NOT_FOR_SUBMISSION", "RESEARCH_RELEASE_NOT_VALIDATED"}
SECRET_FILE_LIMIT = 1_000_000  # Render's combined secret-file limit; use decimal MB conservatively.
SECRET_PART_LIMIT = 500 * 1024  # BuildKit rejects individual secrets larger than 500 KiB.


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


def prepare(release, output, compression="deflate"):
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
    with ZipFile(archive, "x", compression={"deflate": ZIP_DEFLATED, "lzma": ZIP_LZMA}[compression]) as bundle:
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


def secret_part_two(output):
    return output.with_name(f"{output.stem}-part-2{output.suffix}")


def secret_file(archive, expected_sha256, output):
    """Create plaintext transport without putting the dataset in the repository."""
    verify_archive(archive, expected_sha256)
    content = b64encode(archive.read_bytes())
    require(len(content) <= SECRET_FILE_LIMIT, "Snapshot exceeds Render's 1 MB secret-file allowance")
    outputs = (output, secret_part_two(output))
    if any(path.exists() for path in outputs):
        raise FileExistsError("Choose new paths for both secret-file parts")
    midpoint = (len(content) + 1) // 2
    parts = (content[:midpoint], content[midpoint:])
    require(all(len(part) <= SECRET_PART_LIMIT for part in parts), "Secret part exceeds BuildKit's 500 KiB limit")
    output.parent.mkdir(parents=True, exist_ok=True)
    for path, part in zip(outputs, parts):
        with path.open("xb") as stream:
            stream.write(part)
    return {"status": "prepared", "secret_file": str(output), "bytes": len(content),
            "secret_files": [{"path": str(path), "bytes": len(part)} for path, part in zip(outputs, parts)],
            "NAVIGATOR_SNAPSHOT_SHA256": expected_sha256}


def build_secret(secret, expected_sha256, data_root, required, part_two=None):
    """Initialize the image at build time so free-service cold starts do no work."""
    if not secret.exists():
        require(not required and (part_two is None or not part_two.exists()),
                "Add Render secret files snapshot.b64 and snapshot-part-2.b64, then rebuild. No snapshot was installed.")
        return {"status": "snapshot_not_configured"}
    secrets = [secret] if part_two is None else [secret, part_two]
    require(all(path.exists() for path in secrets), "Add both snapshot secret-file parts, then rebuild")
    require(sum(path.stat().st_size for path in secrets) <= SECRET_FILE_LIMIT, "Secret files exceed 1 MB")
    require(all(path.stat().st_size <= SECRET_PART_LIMIT for path in secrets), "Secret part exceeds BuildKit's 500 KiB limit")
    content = b64decode(b"".join(path.read_bytes().strip() for path in secrets), validate=True)
    with TemporaryDirectory(prefix="navigator-snapshot-") as temporary:
        archive = Path(temporary) / "snapshot.zip"
        archive.write_bytes(content)
        return install(archive, expected_sha256, data_root, "snapshot-v1")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    package = commands.add_parser("prepare")
    package.add_argument("--release", required=True, type=Path)
    package.add_argument("--output", required=True, type=Path)
    package.add_argument("--compression", choices=("deflate", "lzma"), default="deflate")
    for name in ("verify", "install"):
        command = commands.add_parser(name)
        command.add_argument("--archive", required=True, type=Path)
        command.add_argument("--sha256", required=True)
        if name == "install":
            command.add_argument("--data-root", type=Path, default=Path("/var/data"))
            command.add_argument("--name", required=True)
    secret = commands.add_parser("secret-file", help="Encode a verified snapshot for Render's private secret-file upload")
    secret.add_argument("--archive", required=True, type=Path)
    secret.add_argument("--sha256", required=True)
    secret.add_argument("--output", required=True, type=Path)
    build = commands.add_parser("build-secret", help="Prepare an image from a BuildKit secret; never run on each startup")
    build.add_argument("--secret-file", required=True, type=Path)
    build.add_argument("--secret-file-part-2", type=Path)
    build.add_argument("--sha256", default="")
    build.add_argument("--data-root", required=True, type=Path)
    build.add_argument("--require-snapshot", choices=("0", "1"), default="0")
    args = parser.parse_args()
    if args.command == "prepare":
        result = prepare(args.release, args.output, args.compression)
    elif args.command == "verify":
        verified = verify_archive(args.archive, args.sha256)
        result = {"status": "verified", "files": len(verified["files_sha256"]), "artifact_label": verified["artifact_label"]}
    elif args.command == "install":
        result = install(args.archive, args.sha256, args.data_root, args.name)
    elif args.command == "secret-file":
        result = secret_file(args.archive, args.sha256, args.output)
    else:
        result = build_secret(args.secret_file, args.sha256, args.data_root, args.require_snapshot == "1",
                              args.secret_file_part_2)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
