"""Reproducible local setup and offline packaging checks; never deploys or calls a model."""
import argparse
from contextlib import contextmanager
from hashlib import sha256
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
from threading import Thread
import time

ROOT = Path(__file__).resolve().parents[1]


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def fingerprint(path):
    return sha256(path.read_bytes()).hexdigest()


def snapshot_hashes(root):
    return {p.relative_to(root).as_posix(): fingerprint(p) for p in sorted(root.rglob("*")) if p.is_file()}


def child_env(data=None, frontend=None):
    env = os.environ.copy()
    # Offline checks and the HTTP-only launch never inherit extraction credentials.
    env.update(OPENAI_API_KEY="", OPENAI_MODEL="", PYTHON_DOTENV_DISABLED="1", PYTHONDONTWRITEBYTECODE="1")
    env.pop("NAVIGATOR_FRONTEND_DIST", None)
    env.pop("PYTHONPATH", None)
    if data is not None:
        env["NAVIGATOR_DATA_DIR"] = str(data)
    if frontend is not None:
        env["NAVIGATOR_FRONTEND_DIST"] = str(frontend)
    return env


def cli(data, *args, expected=0):
    result = subprocess.run([sys.executable, "-m", "navigator", "--data-dir", str(data), *args],
                            cwd=ROOT, env=child_env(data), capture_output=True, text=True, timeout=120)
    require(result.returncode == expected, f"navigator {args[0]} returned {result.returncode}; expected {expected}")
    # Parse structured output, avoiding ambient environment or arbitrary process logs in reports.
    return json.loads(result.stderr if expected else result.stdout)


def bootstrap(args):
    target = args.venv.resolve()
    require(not target.exists(), "Choose a new --venv directory; existing environments are preserved")
    subprocess.run([sys.executable, "-m", "venv", str(target)], check=True)
    python = target / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    subprocess.run([str(python), "-m", "pip", "--isolated", "--disable-pip-version-check", "install",
                    "--index-url", "https://pypi.org/simple", "-r", str(ROOT / "requirements.lock")], check=True)
    subprocess.run([str(python), "-m", "pip", "check"], check=True)
    save(target / "platform-install.json", {"python": str(python), "lock_sha256": fingerprint(ROOT / "requirements.lock"),
                                            "install": "requirements.lock", "pip_check": "passed"})
    print(f"Installed locked environment: {python}")


def serve(args):
    data = args.data_dir.resolve()
    require(data.is_dir(), "--data-dir must be an existing directory; empty stores expose absent readiness")
    frontend = args.frontend_dist.resolve() if args.frontend_dist else None
    if frontend:
        require((frontend / "index.html").is_file(), "--frontend-dist must contain a built index.html")
    require(not (data / "ASSEMBLY_INCOMPLETE").exists(), "Snapshot assembly is incomplete")
    return launch_server(ROOT, data, frontend, args.port)


def launch_server(code, data, frontend, port):
    return subprocess.call([sys.executable, "-m", "uvicorn", "navigator.api:app", "--host", "127.0.0.1",
                            "--port", str(port), "--workers", "1"], cwd=code, env=child_env(data, frontend))


SERVING_FILES = ("addresses.json", "resolutions.json", "rules.json", "sources.json", "dataset.json",
                 "extraction_index.json", "latest_extract.json", "change_tests.json", "competition_schema.json",
                 "negative_findings.json", "latest_ingest.json", "assembly_manifest.json")
PUBLIC_SUFFIXES = {".html", ".js", ".css", ".map", ".json", ".svg", ".png", ".ico", ".jpg", ".jpeg", ".webp", ".woff", ".woff2", ".ttf", ".txt"}


def release_files(root):
    """Inventory ordinary files only; never follow symlinks or Windows junctions."""
    require(root.is_dir(), f"Missing directory: {root}")
    found = {}
    for path in [root, *sorted(root.rglob("*"))]:
        require(not path.is_symlink() and not path.is_junction(), f"Linked release input: {path}")
        require(path.resolve().is_relative_to(root.resolve()), f"Release input escapes root: {path}")
        if path.is_file():
            found[path.relative_to(root).as_posix()] = fingerprint(path)
    return found


def release_inputs(data, frontend):
    require(not (data / "ASSEMBLY_INCOMPLETE").exists(), "Snapshot assembly is incomplete")
    data_hashes, public_hashes = release_files(data), release_files(frontend)
    required = {"addresses.json", "resolutions.json", "rules.json", "sources.json", "dataset.json"}
    require(required <= data_hashes.keys(), "Snapshot is missing required serving files")
    require("index.html" in public_hashes, "Frontend must contain a built index.html")
    for name in public_hashes:
        path = Path(name)
        require(not any(part.startswith(".") for part in path.parts) and path.suffix.lower() in PUBLIC_SUFFIXES,
                f"Unexpected public file: {name}")
        require(path.parts[0] not in {"api", "data", "navigator", "config"}, f"Reserved public path: {name}")
    selected = {name: value for name, value in data_hashes.items() if name in SERVING_FILES
                or (name.startswith("semantic_reviews/") and name.endswith(".json"))}
    return selected, public_hashes


def prepare_release(args):
    data, frontend, output = args.data_dir.resolve(), args.frontend_dist.resolve(), args.output.resolve()
    require(not output.exists(), "Choose a new --output directory; previous releases are preserved")
    for source in (data, frontend, ROOT / "navigator", ROOT / "config"):
        require(not output.is_relative_to(source) and not source.is_relative_to(output), "Release output and inputs must be separate trees")
    require(bool(re.fullmatch(r"[0-9a-fA-F]{40}", args.code_revision)), "--code-revision must be a full Git SHA")
    data_hashes, public_hashes = release_inputs(data, frontend)
    dataset = json.loads((data / "dataset.json").read_text(encoding="utf-8"))
    rules = json.loads((data / "rules.json").read_text(encoding="utf-8"))
    sources = json.loads((data / "sources.json").read_text(encoding="utf-8"))
    synthetic = (dataset.get("mode") == "synthetic" or any(r.get("evidence_mode") == "synthetic" for r in rules.values())
                 or any(s.get("capture_status") == "synthetic" for s in sources.values()))
    require(synthetic == args.synthetic, "Synthetic inputs require --synthetic; real inputs must omit it")
    inputs = {f"data/{name}": (data / name, value) for name, value in data_hashes.items()}
    inputs.update({f"frontend/{name}": (frontend / name, value) for name, value in public_hashes.items()})
    for directory, suffix in (("navigator", ".py"), ("config", ".json")):
        for name, value in release_files(ROOT / directory).items():
            if Path(name).suffix == suffix:
                inputs[f"runtime/{directory}/{name}"] = (ROOT / directory / name, value)
    inputs["runtime/requirements.lock"] = (ROOT / "requirements.lock", fingerprint(ROOT / "requirements.lock"))
    output.mkdir(parents=True)
    marker = output / "RELEASE_INCOMPLETE"
    marker.write_text("Preparation has not completed. Do not launch.\n", encoding="utf-8")
    for name, (source, expected) in inputs.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        require(fingerprint(target) == expected and fingerprint(source) == expected, "Release input changed during copy")
    require(release_inputs(data, frontend) == (data_hashes, public_hashes), "Snapshot or frontend changed during preparation")
    require(all(fingerprint(source) == expected for source, expected in inputs.values()), "Code changed during preparation")
    manifest = {"format_version": "local-release-v1", "source_revision": args.code_revision,
                "artifact_label": "SYNTHETIC_NOT_FOR_SUBMISSION" if synthetic else "RESEARCH_RELEASE_NOT_VALIDATED",
                "ready_for_submission": False,
                "files_sha256": {name: value for name, (_, value) in sorted(inputs.items())},
                "limitations": ["Local packaging verifies file integrity, not legal accuracy, source coverage or release acceptance.",
                                "Source revision is operator-supplied; file hashes identify the actual bundled bytes.",
                                "Serving inputs are copied; original provider/geocoder caches and run history stay in the source store.",
                                "Python and dependencies are installed separately from the included requirements.lock."]}
    save(output / "release.json", manifest)
    marker.unlink()
    verify_release(output)
    print(json.dumps({"status": "prepared", "release": str(output), "manifest_sha256": fingerprint(output / "release.json"),
                      "artifact_label": manifest["artifact_label"], "ready_for_submission": False}, indent=2))


def verify_release(root):
    root = root.resolve()
    files = release_files(root)
    require("RELEASE_INCOMPLETE" not in files, "Release preparation is incomplete")
    require("release.json" in files, "Missing release manifest")
    manifest = json.loads((root / "release.json").read_text(encoding="utf-8"))
    require(manifest.get("format_version") == "local-release-v1", "Unsupported release manifest")
    files.pop("release.json")
    require(files == manifest.get("files_sha256"), "Release files changed, missing or added; restore the saved release")
    require({"runtime/navigator/api.py", "runtime/requirements.lock", "frontend/index.html", "data/addresses.json"} <= files.keys(),
            "Release is missing required launch files")
    return manifest


def verify_release_command(args):
    manifest = verify_release(args.release)
    print(json.dumps({"status": "verified", "manifest_sha256": fingerprint(args.release / "release.json"),
                      "artifact_label": manifest["artifact_label"], "ready_for_submission": False}, indent=2))


def serve_release(args):
    release = args.release.resolve()
    verify_release(release)
    return launch_server(release / "runtime", release / "data", release / "frontend", args.port)


@contextmanager
def local_api(data):
    import httpx
    import uvicorn
    from navigator.api import create_app

    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen(128)
    port = listener.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(create_app(data), log_level="error", access_log=False))
    thread = Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
    thread.start()
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=5, trust_env=False) as client:
            deadline = time.monotonic() + 15
            while not server.started and thread.is_alive() and time.monotonic() < deadline:
                time.sleep(0.05)
            require(server.started, "Local API failed to start")
            yield client
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        listener.close()
        require(not thread.is_alive(), "Local API failed to stop")


def export_replay(data, output, *, synthetic):
    options = ["--allow-partial"] + (["--synthetic"] if synthetic else [])
    for name in ["first", "replay"]:
        cli(data, "export", "--as-of", "2026-10-01", *options, "--output", str(output / name))
    hashes = {}
    for path in sorted((output / "first").glob("*.json")):
        if path.name == "run_manifest.json":
            continue  # Run IDs, timestamps and output paths intentionally differ.
        require(path.read_bytes() == (output / "replay" / path.name).read_bytes(), f"Replay differs: {path.name}")
        hashes[path.name] = fingerprint(path)
    require(len(hashes) == 7, "Expected all seven export payloads")
    first = json.loads((output / "first/run_manifest.json").read_text())
    replay = json.loads((output / "replay/run_manifest.json").read_text())
    require(first["input_hashes"] == replay["input_hashes"], "Replay input hashes differ")
    require(first["run_id"] != replay["run_id"], "Export runs must keep distinct identities")
    validation = json.loads((output / "first/validation.json").read_text())
    return {"payload_sha256": hashes, "input_hashes": first["input_hashes"],
            "run_ids": [first["run_id"], replay["run_id"]], "artifact_label": validation["artifact_label"],
            "ready_for_submission": validation["ready_for_submission"], "counts": validation["counts"]}


def smoke(args):
    output = args.output.resolve()
    require(not output.exists(), "Choose a new --output directory; previous artifacts are preserved")
    real = args.real_data.resolve() if args.real_data else None
    if real:
        require(real.is_dir(), "--real-data must be an existing store")
        require(not output.is_relative_to(real) and not real.is_relative_to(output), "Output and real store must be separate trees")
    output.mkdir(parents=True)
    # Set before importing navigator so a local .env cannot affect the checks.
    os.environ.update(OPENAI_API_KEY="", OPENAI_MODEL="", PYTHON_DOTENV_DISABLED="1")
    sys.path.insert(0, str(ROOT))
    report = {"label": "PACKAGING_CHECK_NOT_LEGAL_VALIDATION", "python": sys.version,
              "lock_sha256": fingerprint(ROOT / "requirements.lock"), "checks": {}}
    try:
        absent = output / "absent"
        absent.mkdir()
        with local_api(absent) as client:
            health = client.get("/api/v1/health")
            require(health.status_code == 200 and health.json()["dataset_readiness"] == "absent", "Absent health contract")
            require(client.post("/api/v1/lookup", json={"address_id": "MISSING"}).status_code == 503, "Absent lookup contract")
            report["checks"]["absent_http"] = health.json()

        demo = output / "synthetic"
        cli(demo, "demo")
        provider_store = output / "missing-provider"
        shutil.copytree(demo, provider_store)
        missing = cli(provider_store, "extract", "--doc-id", "SYNTHETIC-42", expected=2)
        require(missing["error"] == "ProviderUnavailable", "Missing-key path must fail before a model call")
        report["checks"]["missing_provider"] = {"exit_code": 2, "error": missing["error"]}

        with local_api(demo) as client:
            health = client.get("/api/v1/health")
            require(health.status_code == 200 and health.json()["addresses"] == 3, "Synthetic health contract")
            for ident, expected in [("SYNTH-001", "applies"), ("SYNTH-003", "unknown")]:
                result = client.post("/api/v1/lookup", json={"address_id": ident, "as_of": "2026-11-15"})
                require(result.status_code == 200 and result.json()["evaluations"][0]["result"] == expected, "Synthetic lookup contract")
                require(result.json()["metadata"]["rule_modes"] == ["synthetic"], "Synthetic provenance missing")
            require(client.post("/api/v1/lookup", json={}).status_code == 422, "Invalid input contract")
            require(client.post("/api/v1/lookup", json={"address_id": "MISSING"}).status_code == 404, "Unknown ID contract")
            report["checks"]["synthetic_http"] = health.json()
        report["checks"]["synthetic_validation"] = cli(demo, "validate", "--output", str(output / "synthetic-validation.json"))
        report["checks"]["synthetic_exports"] = export_replay(demo, output / "synthetic-exports", synthetic=True)

        if real:
            before = snapshot_hashes(real)
            copied = output / "real-snapshot"
            shutil.copytree(real, copied)
            require(snapshot_hashes(copied) == before, "Source changed during snapshot; retry with a quiet store")
            with local_api(copied) as client:
                health = client.get("/api/v1/health")
                require(health.status_code == 200, "Real snapshot health contract")
                report["checks"]["real_http"] = health.json()
            report["checks"]["real_validation"] = cli(copied, "validate", "--output", str(output / "real-validation.json"))
            report["checks"]["real_exports"] = export_replay(copied, output / "real-exports", synthetic=False)
            require(snapshot_hashes(real) == before, "Original real store changed during verification")
            report["checks"]["original_real_store_unchanged"] = True
        report["status"] = "passed"
    except Exception as exc:
        report.update(status="failed", failure_type=type(exc).__name__)
        raise
    finally:
        save(output / "report.json", report)
    print(json.dumps({"status": report["status"], "report": str(output / "report.json")}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    setup = commands.add_parser("bootstrap", help="Install the lock in a new environment; requires network")
    setup.add_argument("--venv", type=Path, default=ROOT / ".venv")
    launch = commands.add_parser("serve", help="Launch the existing HTTP API on loopback without provider credentials")
    launch.add_argument("--data-dir", type=Path, required=True)
    launch.add_argument("--frontend-dist", type=Path, help="Optional existing frontend build served from the same origin")
    launch.add_argument("--port", type=int, choices=range(1, 65536), metavar="PORT", default=8000)
    verify = commands.add_parser("smoke", help="Offline real HTTP, missing-key and export replay checks")
    verify.add_argument("--output", type=Path, required=True)
    verify.add_argument("--real-data", type=Path, help="Optional real store copied into the output before checks")
    bundle = commands.add_parser("prepare-release", help="Copy code, serving inputs and a built frontend into a new local release")
    bundle.add_argument("--data-dir", type=Path, required=True)
    bundle.add_argument("--frontend-dist", type=Path, required=True)
    bundle.add_argument("--output", type=Path, required=True)
    bundle.add_argument("--code-revision", required=True, help="Full source SHA; manifest hashes also identify any local changes")
    bundle.add_argument("--synthetic", action="store_true")
    check = commands.add_parser("verify-release", help="Verify every file of a previously prepared release")
    check.add_argument("--release", type=Path, required=True)
    frozen = commands.add_parser("serve-release", help="Verify and launch a saved frontend/API release on loopback")
    frozen.add_argument("--release", type=Path, required=True)
    frozen.add_argument("--port", type=int, choices=range(1, 65536), metavar="PORT", default=8000)
    args = parser.parse_args()
    try:
        return {"bootstrap": bootstrap, "serve": serve, "smoke": smoke, "prepare-release": prepare_release,
                "verify-release": verify_release_command, "serve-release": serve_release}[args.command](args) or 0
    except (RuntimeError, OSError, ValueError, subprocess.SubprocessError) as exc:
        print(f"Packaging check failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
