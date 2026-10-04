from copy import deepcopy
from threading import Thread
import time
from types import SimpleNamespace

import pytest
import uvicorn

from deploy.verify_container import ENVIRONMENT, http_smoke, validate_config, validate_inspection, verify
from navigator.api import create_app


def candidate(data):
    return {"services": {"api": {
        "image": "navigator:test", "build": {"args": {"SOURCE_REVISION": "a" * 40}},
        "user": "10001:10001", "read_only": True, "cap_drop": ["ALL"],
        "security_opt": ["no-new-privileges:true"], "environment": dict(ENVIRONMENT),
        "ports": [{"host_ip": "127.0.0.1", "published": "8028", "target": 8000}],
        # Compose normalizes an explicit create_host_path: false to the empty bind map.
        "volumes": [{"type": "bind", "source": str(data), "target": "/data", "read_only": True, "bind": {}}],
    }}}


def test_compose_allows_only_reviewed_local_candidate(tmp_path):
    validate_config(candidate(tmp_path), tmp_path, 8028, "a" * 40, "navigator:test")


@pytest.mark.parametrize("change", [
    {"user": "0:0"}, {"read_only": False}, {"privileged": True}, {"network_mode": "host"},
    {"cap_add": ["SYS_ADMIN"]}, {"cap_drop": []}, {"security_opt": []},
    {"environment": {**ENVIRONMENT, "OPENAI_API_KEY": "test-not-a-secret"}},
    {"env_file": [".env"]}, {"secrets": ["provider"]},
    {"ports": [{"host_ip": "0.0.0.0", "published": "8028", "target": 8000}]},
    {"ports": [{"host_ip": "127.0.0.1", "published": "9999", "target": 8000}]},
])
def test_compose_rejects_privilege_or_egress_drift(tmp_path, change):
    config = candidate(tmp_path)
    config["services"]["api"].update(change)
    with pytest.raises(RuntimeError):
        validate_config(config, tmp_path, 8028, "a" * 40, "navigator:test")


@pytest.mark.parametrize("change", [
    {"read_only": False}, {"source": "unreviewed"}, {"target": "/app"},
    {"type": "volume"}, {"bind": {"create_host_path": True}},
])
def test_compose_rejects_snapshot_mount_drift(tmp_path, change):
    config = candidate(tmp_path)
    config["services"]["api"]["volumes"][0].update(change)
    with pytest.raises(RuntimeError, match="Data mount"):
        validate_config(config, tmp_path, 8028, "a" * 40, "navigator:test")


def running_container():
    return {
        "Config": {"User": "10001:10001", "Labels": {"org.opencontainers.image.revision": "a" * 40},
                   "Env": [f"{k}={v}" for k, v in {**ENVIRONMENT, "PYTHONDONTWRITEBYTECODE": "1"}.items()]},
        "HostConfig": {"ReadonlyRootfs": True, "Privileged": False, "CapDrop": ["ALL"],
                       "SecurityOpt": ["no-new-privileges"]},
        "NetworkSettings": {"Ports": {"8000/tcp": [{"HostIp": "127.0.0.1", "HostPort": "8028"}]}},
        "Mounts": [{"Destination": "/data", "Type": "bind", "RW": False}],
        "State": {"Health": {"Status": "healthy"}},
    }


def test_inspection_checks_actual_restrictions_and_image_revision():
    running = running_container()
    validate_inspection(running, 8028, "a" * 40)
    for path, value in [(("Mounts", 0, "RW"), True), (("HostConfig", "ReadonlyRootfs"), False),
                        (("Config", "Labels", "org.opencontainers.image.revision"), "b" * 40),
                        (("NetworkSettings", "Ports", "8000/tcp", 0, "HostIp"), "0.0.0.0")]:
        changed = deepcopy(running)
        target = changed
        for key in path[:-1]:
            target = target[key]
        target[path[-1]] = value
        with pytest.raises(RuntimeError):
            validate_inspection(changed, 8028, "a" * 40)


def test_runner_preserves_existing_outputs_and_rejects_output_in_snapshot(tmp_path):
    existing = tmp_path / "existing"
    existing.mkdir()
    marker = existing / "keep.json"
    marker.write_text("preserve")
    with pytest.raises(RuntimeError, match="new output"):
        verify(SimpleNamespace(output=existing, data_dir=None, synthetic=True, port=8028))
    assert marker.read_text() == "preserve"
    with pytest.raises(RuntimeError, match="outside"):
        verify(SimpleNamespace(output=tmp_path / "new", data_dir=tmp_path, synthetic=False, port=8028))
    assert not (tmp_path / "new").exists()


def test_container_http_probe_against_actual_same_origin_app(demo, tmp_path):
    public = tmp_path / "public"
    (public / "assets").mkdir(parents=True)
    (public / "index.html").write_text('<!doctype html><script src="/assets/test.js"></script>')
    (public / "assets/test.js").write_text('console.log("synthetic test")')
    server = uvicorn.Server(uvicorn.Config(create_app(demo.root, frontend_dist=public), host="127.0.0.1", port=0,
                                         log_level="error"))
    sock = server.config.bind_socket()
    port = sock.getsockname()[1]
    thread = Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 5
        while not server.started and time.monotonic() < deadline:
            time.sleep(0.01)
        assert server.started
        result = http_smoke(f"http://127.0.0.1:{port}", demo.addresses())
        assert result["address_count"] == len(demo.addresses())
        assert result["frontend_assets"] == ["/assets/test.js"]
        assert result["private_paths_not_served"] is True
        assert result["lookup_evaluations"] > 0
    finally:
        server.should_exit = True
        thread.join(timeout=10)
        sock.close()
