"""Verify the local frontend/API container candidate without provider calls.

Default: validate Compose and record engine availability. --build-and-run additionally
builds and tests a unique local project, then removes only that project's container/network.
The report distinguishes a validated candidate from a verified Linux runtime.
"""
import argparse
from hashlib import sha256
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import urllib.error
import urllib.request
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
ENVIRONMENT = {
    "NAVIGATOR_DATA_DIR": "/data", "NAVIGATOR_FRONTEND_DIST": "/app/public",
    "PYTHON_DOTENV_DISABLED": "1", "NAVIGATOR_CORS_ORIGINS": "",
    "OPENAI_API_KEY": "", "OPENAI_MODEL": "",
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def hashes(root):
    result = {}
    for path in sorted(root.rglob("*")):
        require(not path.is_symlink() and not path.is_junction(), "Snapshot links/junctions are not supported")
        if path.is_file():
            result[path.relative_to(root).as_posix()] = sha256(path.read_bytes()).hexdigest()
    return result


def save(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def validate_config(config, data, port, revision, image):
    require(set(config["services"]) == {"api"}, "Only the API service may be launched")
    service = config["services"]["api"]
    require(service["image"] == image, "Unexpected image tag")
    require(service["build"]["args"]["SOURCE_REVISION"] == revision, "Source revision differs")
    require(service.get("user") == "10001:10001", "Runtime must use UID/GID 10001")
    require(service.get("read_only") is True, "Container root must be read-only")
    require(service.get("privileged", False) is False, "Privileged containers are forbidden")
    require(not service.get("network_mode") and not service.get("cap_add"), "Host networking/extra capabilities are forbidden")
    require(service.get("cap_drop") == ["ALL"], "All capabilities must be dropped")
    require("no-new-privileges:true" in service.get("security_opt", []), "Privilege escalation must be disabled")
    require(service.get("environment") == ENVIRONMENT, "Unexpected runtime environment; credentials must be blank")
    require(not service.get("env_file") and not service.get("secrets"), "Environment/secret injection is not supported")
    ports = service.get("ports", [])
    require(len(ports) == 1 and ports[0].get("host_ip") == "127.0.0.1"
            and str(ports[0]["published"]) == str(port) and ports[0]["target"] == 8000
            and ports[0].get("protocol", "tcp") == "tcp", "Publish only the selected loopback TCP port")
    mounts = service.get("volumes", [])
    require(len(mounts) == 1, "Only one reviewed data mount is permitted")
    mount = mounts[0]
    require(mount.get("type") == "bind" and mount.get("target") == "/data"
            and mount.get("read_only") is True and Path(mount["source"]).resolve() == data
            and mount.get("bind", {}).get("create_host_path", False) is False, "Data mount must use the existing read-only snapshot")


def validate_inspection(container, port, revision):
    cfg, host = container["Config"], container["HostConfig"]
    require(cfg.get("User") == "10001:10001" and host.get("ReadonlyRootfs") is True,
            "Running container must be non-root with a read-only root")
    require(cfg.get("Labels", {}).get("org.opencontainers.image.revision") == revision, "Running image revision differs")
    env = dict(row.split("=", 1) for row in cfg["Env"])
    require(all(env.get(key) == value for key, value in ENVIRONMENT.items()), "Running environment differs")
    require(env.get("PYTHONDONTWRITEBYTECODE") == "1", "Python bytecode writes must be disabled")
    require(host.get("Privileged") is False and host.get("CapDrop") == ["ALL"], "Running container privileges differ")
    require(any(item in host.get("SecurityOpt", []) for item in ("no-new-privileges:true", "no-new-privileges")),
            "Running no-new-privileges restriction missing")
    ports = container["NetworkSettings"]["Ports"]
    require(ports == {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(port)}]}, "Running port publication differs")
    mounts = [row for row in container["Mounts"] if row["Destination"] == "/data"]
    require(len(mounts) == 1 and mounts[0]["Type"] == "bind" and mounts[0]["RW"] is False,
            "Running data mount is not read-only")
    require(container["State"].get("Health", {}).get("Status") == "healthy", "Container healthcheck is not healthy")


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.paths = set()

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in {"src", "href"} and value and value.startswith("/assets/"):
                self.paths.add(value)


def http_smoke(url, expected_addresses):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def request(path, payload=None, expected=200):
        body = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(url + path, data=body, headers={"Content-Type": "application/json"})
        try:
            response = opener.open(req, timeout=120)
        except urllib.error.HTTPError as exc:
            response = exc
        with response:
            require(response.status == expected, f"HTTP {path} returned {response.status}, expected {expected}")
            return response.headers, response.read()

    headers, body = request("/")
    require("text/html" in headers.get("Content-Type", ""), "Frontend HTML is missing")
    require(headers.get("Cache-Control") == "no-cache", "HTML must revalidate on rollback")
    assets = Assets()
    assets.feed(body.decode())
    require(assets.paths, "Built frontend assets are missing")
    for path in sorted(assets.paths):
        _, contents = request(path)
        require(contents, f"Empty frontend asset: {path}")
    for path in ("/data/addresses.json", "/.env", "/navigator/api.py", "/api/not-a-route"):
        request(path, expected=404)
    _, body = request("/api/v1/health")
    health = json.loads(body)
    require(health["addresses"] == len(expected_addresses), "Mounted address count differs")
    seen = []
    for offset in range(0, len(expected_addresses), 100):
        _, body = request(f"/api/v1/addresses?offset={offset}&limit=100")
        seen.extend(row["property"]["address_id"] for row in json.loads(body)["items"])
    require(sorted(seen) == sorted(expected_addresses), "HTTP pagination lost/duplicated addresses")
    chosen = sorted(expected_addresses)[0]
    _, body = request("/api/v1/lookup", {"address_id": chosen, "as_of": "2026-10-01"})
    lookup = json.loads(body)
    require(lookup["address"]["address_id"] == chosen, "Lookup used another property")
    return {"health": health, "frontend_assets": sorted(assets.paths), "address_count": len(seen),
            "lookup_address_id": chosen, "lookup_evaluations": len(lookup["evaluations"]),
            "private_paths_not_served": True}


def verify(args):
    output = args.output.resolve()
    require(not output.exists(), "Choose a new output directory; existing reports are preserved")
    data = args.data_dir.resolve() if args.data_dir else output / "synthetic-data"
    require(not output.is_relative_to(data), "Verification output must be outside the input snapshot")
    require(1024 <= args.port <= 65535, "Port must be between 1024 and 65535")
    if not args.synthetic:
        require(data.is_dir() and not data.is_symlink() and not data.is_junction(), "Choose an existing snapshot directory")
    output.mkdir(parents=True)
    report = {"label": "SOFTWARE_CONTAINER_CHECK_NOT_LEGAL_VALIDATION", "checks": {}, "runtime_verified": False}
    env = os.environ.copy()
    # Compose must not inherit application configuration, provider credentials, or an ambient .env.
    for key in list(env):
        if key.startswith(("NAVIGATOR_", "COMPOSE_", "OPENAI_")):
            env.pop(key)
    env.update(PYTHON_DOTENV_DISABLED="1", PYTHONDONTWRITEBYTECODE="1", OPENAI_API_KEY="", OPENAI_MODEL="")
    empty_env = output / "compose-empty.env"
    empty_env.write_text("# Deliberately empty; never read the repository .env.\n", encoding="utf-8")
    project = "navigator-check-" + uuid4().hex[:12]
    compose = ["docker", "compose", "--env-file", str(empty_env), "--project-name", project,
               "--file", str(ROOT / "deploy/compose.yaml")]
    started = False
    before = None

    def run(command, *, timeout=120, log=None, check=True):
        result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, timeout=timeout)
        if log:
            (output / log).write_text(result.stdout + result.stderr, encoding="utf-8")
        require(not check or result.returncode == 0, f"Command {command[0]} {command[1]} failed (exit {result.returncode}); see local logs")
        return result

    try:
        revision = run(["git", "-c", f"safe.directory={ROOT.as_posix()}", "rev-parse", "HEAD"]).stdout.strip()
        require(re.fullmatch(r"[0-9a-f]{40}", revision), "Source revision must be a full Git SHA")
        dirty = bool(run(["git", "-c", f"safe.directory={ROOT.as_posix()}", "status", "--porcelain", "--untracked-files=all"]).stdout.strip())
        report.update(source_revision=revision, source_worktree_dirty=dirty, project=project,
                      snapshot_mode="synthetic" if args.synthetic else "supplied_snapshot")
        if args.build_and_run:
            require(not dirty, "Commit source changes before building a revision-labeled image")
        env.update(NAVIGATOR_SOURCE_REVISION=revision, NAVIGATOR_IMAGE=f"realpage-navigator:{project}",
                   NAVIGATOR_DATA_PATH=str(data), NAVIGATOR_PORT=str(args.port))
        if args.synthetic:
            run([sys.executable, "-m", "navigator", "--data-dir", str(data), "demo"], log="synthetic-data.log")
        before = hashes(data)
        expected = json.loads((data / "addresses.json").read_text(encoding="utf-8"))
        require(expected, "Snapshot must have at least one address")
        report["snapshot_sha256"] = sha256(json.dumps(before, sort_keys=True).encode()).hexdigest()
        report["snapshot_files"] = len(before)
        config = json.loads(run(compose + ["config", "--format", "json"], log="compose-config.log").stdout)
        validate_config(config, data, args.port, revision, env["NAVIGATOR_IMAGE"])
        report["checks"]["compose_restrictions"] = "passed"
        engine = run(["docker", "info", "--format", "{{json .ServerVersion}}"], log="engine.log", check=False)
        report["engine_available"] = engine.returncode == 0
        if not args.build_and_run:
            report["status"] = "candidate_validated"
            return 0
        if engine.returncode != 0:
            report.update(status="runtime_unavailable", limitation="Docker engine is not reachable; no image was built or started")
            return 3
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", args.port))
        run(compose + ["build"], timeout=1800, log="build.log")
        started = True
        run(compose + ["up", "--detach", "--no-build", "--wait", "--wait-timeout", "90"], timeout=120, log="startup.log")
        cid = run(compose + ["ps", "--quiet", "api"]).stdout.strip()
        require(cid and "\n" not in cid, "Expected exactly one task container")
        inspection = json.loads(run(["docker", "inspect", cid]).stdout)[0]
        validate_inspection(inspection, args.port, revision)
        report["checks"]["runtime_restrictions"] = "passed"
        report["image_id"] = inspection["Image"]
        report["checks"]["http"] = http_smoke(f"http://127.0.0.1:{args.port}", expected)
        probe_code = """import json,os,pathlib
result={'uid':os.getuid(),'denied':[]}
for name in ['/app/container-write-probe','/data/container-write-probe']:
    path=pathlib.Path(name)
    try:
        with path.open('x') as stream: stream.write('probe')
    except OSError:
        result['denied'].append(name)
    else:
        path.unlink()
assert result['uid']==10001 and len(result['denied'])==2, result
print(json.dumps(result))
"""
        result = run(compose + ["exec", "-T", "api", "python", "-c", probe_code])
        report["checks"]["write_denial"] = json.loads(result.stdout)
        report.update(status="passed", runtime_verified=True)
        return 0
    except Exception as exc:
        report.update(status="failed", failure=f"{type(exc).__name__}: {exc}")
        return 2
    finally:
        if started:
            cleanup = run(compose + ["down", "--timeout", "10"], log="cleanup.log", check=False)
            report["checks"]["cleanup"] = "passed" if cleanup.returncode == 0 else "failed"
            if cleanup.returncode != 0:
                report.update(status="failed", runtime_verified=False)
        if before is not None:
            report["checks"]["snapshot_unchanged"] = hashes(data) == before
            if not report["checks"]["snapshot_unchanged"]:
                report.update(status="failed", runtime_verified=False)
        save(output / "report.json", report)
        print(json.dumps({"status": report["status"], "runtime_verified": report["runtime_verified"], "report": str(output / "report.json")}))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--data-dir", type=Path, help="Existing reviewed read-only snapshot")
    mode.add_argument("--synthetic", action="store_true", help="Create labeled synthetic input inside new output")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--port", type=int, default=8028)
    parser.add_argument("--build-and-run", action="store_true")
    args = parser.parse_args()
    try:
        code = verify(args)
        # Final preservation/cleanup checks can fail after the main verification path.
        if json.loads((args.output.resolve() / "report.json").read_text())["status"] == "failed":
            code = 2
        return code
    except Exception as exc:
        print(f"Container verification refused: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
