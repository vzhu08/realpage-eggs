"""Reproducible local setup and offline packaging checks; never deploys or calls a model."""
import argparse
from contextlib import contextmanager
from hashlib import sha256
import json
import os
from pathlib import Path
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


def child_env(data=None):
    env = os.environ.copy()
    # Offline checks and the HTTP-only launch never inherit extraction credentials.
    env.update(OPENAI_API_KEY="", OPENAI_MODEL="", PYTHON_DOTENV_DISABLED="1")
    if data is not None:
        env["NAVIGATOR_DATA_DIR"] = str(data)
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
    return subprocess.call([sys.executable, "-m", "uvicorn", "navigator.api:app", "--host", "127.0.0.1",
                            "--port", str(args.port), "--workers", "1"], cwd=ROOT, env=child_env(data))


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
    launch.add_argument("--port", type=int, choices=range(1, 65536), metavar="PORT", default=8000)
    verify = commands.add_parser("smoke", help="Offline real HTTP, missing-key and export replay checks")
    verify.add_argument("--output", type=Path, required=True)
    verify.add_argument("--real-data", type=Path, help="Optional real store copied into the output before checks")
    args = parser.parse_args()
    try:
        return {"bootstrap": bootstrap, "serve": serve, "smoke": smoke}[args.command](args) or 0
    except (RuntimeError, OSError, subprocess.SubprocessError) as exc:
        print(f"Packaging check failed: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
