"""Snapshot transfer checks use labeled synthetic data and the existing evaluator."""
import json
from binascii import Error as Base64Error
from pathlib import Path
import shutil
from zipfile import ZipFile, ZIP_DEFLATED

import pytest

from scripts import render_snapshot as render
from scripts.platform_ops import fingerprint, release_files, save


@pytest.fixture
def release(tmp_path, demo):
    saved = tmp_path / "release"
    shutil.copytree(demo.root, saved / "data")
    save(saved / "data/change_tests.json", [{"test_id": "SYNTHETIC-CACHE", "type": "as_of", "rule_ids": [],
                                            "as_of_before": "2026-10-01", "as_of_after": "2026-11-15"}])
    for relative in ("runtime/navigator/api.py", "runtime/requirements.lock", "frontend/index.html"):
        dest = saved / relative
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text("Synthetic packaging fixture; never execute.", encoding="utf-8")
    save(saved / "release.json", {"format_version": "local-release-v1", "source_revision": "a" * 40,
                                "artifact_label": "SYNTHETIC_NOT_FOR_SUBMISSION", "ready_for_submission": False,
                                "files_sha256": release_files(saved)})
    return saved


@pytest.fixture
def package(tmp_path, release):
    report = render.prepare(release, tmp_path / "package")
    return Path(report["archive"]), report["sha256"]


def test_roundtrip_preserves_inputs_and_uses_current_core_cache(tmp_path, release, package, monkeypatch):
    from navigator.evidence import EvidenceStoreView, prepare_rules
    from navigator.models import ChangeRequest
    from navigator.store import Store, cached_changes

    before = release_files(release)
    archive, digest = package
    receipt = render.install(archive, digest, tmp_path / "disk", "synthetic-v1")
    installed = Path(receipt["NAVIGATOR_DATA_DIR"])
    assert receipt["counts"]["addresses"] == 3
    assert receipt["artifact_label"] == "SYNTHETIC_NOT_FOR_SUBMISSION"
    assert receipt["ready_for_submission"] is False
    assert release_files(release) == before
    assert not (installed.parent / ".synthetic-v1.installing").exists()
    for name, expected in receipt["manifest"]["files_sha256"].items():
        assert fingerprint(installed / name) == expected
    store = Store(installed)
    rules, _ = prepare_rules(store)
    view = EvidenceStoreView(store, rules)
    assert receipt["scenarios"]
    def unexpected_compute(*args):
        pytest.fail("Installed caches must be usable by the normal service")
    monkeypatch.setattr("navigator.changes.compute_changes", unexpected_compute)
    for scenario in receipt["scenarios"]:
        assert cached_changes(view, ChangeRequest(test_id=scenario["test_id"])).status == scenario["status"]
    with pytest.raises(RuntimeError, match="already exists"):
        render.install(archive, digest, tmp_path / "disk", "synthetic-v1")


def test_failed_cache_never_publishes_a_complete_snapshot(tmp_path, package, monkeypatch):
    archive, digest = package
    def failed(*args):
        raise RuntimeError("Synthetic interrupted evaluation")
    monkeypatch.setattr("navigator.changes.compute_changes", failed)
    with pytest.raises(RuntimeError, match="interrupted"):
        render.install(archive, digest, tmp_path / "disk", "new-v1")
    assert not (tmp_path / "disk/new-v1").exists()
    assert (tmp_path / "disk/.new-v1.installing").is_dir()


def test_bad_outer_hash_does_not_create_output(tmp_path, package):
    archive, _ = package
    with pytest.raises(RuntimeError, match="SHA-256 mismatch"):
        render.install(archive, "0" * 64, tmp_path / "disk", "new-v1")
    assert not (tmp_path / "disk").exists()


@pytest.mark.parametrize("mutation", ["changed_file", "extra_file", "traversal", "duplicate", "missing_file", "false_label"])
def test_archive_validation_rejects_corruption_before_writing(tmp_path, package, mutation):
    archive, _ = package
    with ZipFile(archive) as bundle:
        values = {name: bundle.read(name) for name in bundle.namelist()}
    if mutation == "changed_file":
        values["data/addresses.json"] = b"{}"
    elif mutation == "extra_file":
        values[".env"] = b"SYNTHETIC_ONLY"
    elif mutation == "missing_file":
        del values["data/addresses.json"]
    elif mutation in {"traversal", "false_label"}:
        manifest = json.loads(values["manifest.json"])
        if mutation == "traversal":
            manifest["files_sha256"]["../../escape.json"] = "0" * 64
            values["data/../../escape.json"] = b"{}"
        else:
            manifest["ready_for_submission"] = True
        values["manifest.json"] = json.dumps(manifest).encode()
    changed = tmp_path / "bad.zip"
    with ZipFile(changed, "w", compression=ZIP_DEFLATED) as bundle:
        for name, value in values.items():
            bundle.writestr(name, value)
        if mutation == "duplicate":
            with pytest.warns(UserWarning):
                bundle.writestr("data/addresses.json", values["data/addresses.json"])
    with pytest.raises(RuntimeError):
        render.install(changed, fingerprint(changed), tmp_path / "disk", "new-v1")
    assert not (tmp_path / "disk").exists()


def test_prepare_excludes_old_caches_and_private_history(release, tmp_path):
    save(release / "data/.env", {"synthetic": "secret-placeholder"})
    (release / "data/change_cache").mkdir(exist_ok=True)
    save(release / "data/change_cache/stale.json", {"synthetic": "stale"})
    manifest = json.loads((release / "release.json").read_text())
    files = release_files(release)
    del files["release.json"]
    manifest["files_sha256"] = files
    save(release / "release.json", manifest)
    report = render.prepare(release, tmp_path / "package")
    verified = render.verify_archive(Path(report["archive"]), report["sha256"])
    assert ".env" not in verified["files_sha256"]
    assert all(not name.startswith(("change_cache/", "runs/")) for name in verified["files_sha256"])
    with pytest.raises(RuntimeError, match="new output"):
        render.prepare(release, tmp_path / "package")


def test_changed_source_release_is_not_packaged(release, tmp_path):
    (release / "data/addresses.json").write_text("{}")
    with pytest.raises(RuntimeError, match="Release files changed"):
        render.prepare(release, tmp_path / "package")
    assert not (tmp_path / "package").exists()


def test_secret_file_build_installs_verified_inputs_and_hides_content(tmp_path, package, capsys):
    archive, digest = package
    output = tmp_path / "private/snapshot.b64"
    report = render.secret_file(archive, digest, output)
    assert report["bytes"] == output.stat().st_size < render.SECRET_FILE_LIMIT
    receipt = render.build_secret(output, digest, tmp_path / "image-data", required=True)
    assert receipt["counts"]["addresses"] == 3
    assert receipt["artifact_label"] == "SYNTHETIC_NOT_FOR_SUBMISSION"
    assert Path(receipt["NAVIGATOR_DATA_DIR"]).is_dir()
    assert output.read_text() not in capsys.readouterr().out
    with pytest.raises(FileExistsError):
        render.secret_file(archive, digest, output)


def test_missing_required_secret_fails_without_creating_data(tmp_path):
    missing = tmp_path / "snapshot.b64"
    root = tmp_path / "image-data"
    assert render.build_secret(missing, "", root, required=False)["status"] == "snapshot_not_configured"
    with pytest.raises(RuntimeError, match="Add Render secret file"):
        render.build_secret(missing, "", root, required=True)
    assert not root.exists()


def test_secret_file_enforces_size_limit_before_writing(tmp_path, package, monkeypatch):
    archive, digest = package
    monkeypatch.setattr(render, "SECRET_FILE_LIMIT", 10)
    output = tmp_path / "snapshot.b64"
    with pytest.raises(RuntimeError, match="1 MB"):
        render.secret_file(archive, digest, output)
    assert not output.exists()
    output.write_bytes(b"A" * 11)
    with pytest.raises(RuntimeError, match="1 MB"):
        render.build_secret(output, digest, tmp_path / "image-data", required=True)


def test_invalid_or_mismatched_secret_is_never_installed(tmp_path, package):
    archive, digest = package
    output = tmp_path / "snapshot.b64"
    render.secret_file(archive, digest, output)
    with pytest.raises(RuntimeError, match="SHA-256 mismatch"):
        render.build_secret(output, "0" * 64, tmp_path / "image-data", required=True)
    output.write_bytes(b"not-base64!")
    with pytest.raises(Base64Error):
        render.build_secret(output, digest, tmp_path / "image-data", required=True)
    assert not (tmp_path / "image-data").exists()
