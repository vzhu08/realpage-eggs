from datetime import date

import pytest
from fastapi.testclient import TestClient

from navigator.api import create_app
from navigator.changes import compute_changes
from navigator.config import pack_dir
from navigator.export import export_all
from navigator.ingest import ingest_pack
from navigator.models import ChangeRequest
from navigator.store import Store, read_json


def test_api_normal_unknown_empty_and_invalid_contracts(demo):
    with TestClient(create_app(demo.root)) as client:
        for ident, expected in [("SYNTH-001", "applies"), ("SYNTH-003", "unknown")]:
            response = client.post("/api/v1/lookup", json={"address_id": ident, "as_of": "2026-11-15"})
            assert response.status_code == 200
            body = response.json()
            assert body["evaluations"][0]["result"] == expected
            assert "Not legal advice" in body["disclaimer"]
            assert body["metadata"]["rule_modes"] == ["synthetic"]
        assert client.post("/api/v1/lookup", json={"address_id": "SYNTH-002", "as_of": "2026-11-15"}).json()["evaluations"] == []
        assert client.post("/api/v1/lookup", json={"address_id": "MISSING"}).status_code == 404
        assert client.post("/api/v1/lookup", json={}).status_code == 422
        assert client.post("/api/v1/lookup", json={"address_id": "SYNTH-001", "as_of": "nonsense"}).status_code == 422
        assert client.get("/api/v1/addresses?limit=501").status_code == 422
        assert client.get("/api/v1/addresses?q=not-present").json()["total"] == 0
        assert client.get("/api/v1/sources/not-present").status_code == 404


def test_missing_dataset_is_service_error(tmp_path):
    with TestClient(create_app(tmp_path)) as client:
        assert client.get("/api/v1/health").json()["dataset_readiness"] == "absent"
        assert client.post("/api/v1/lookup", json={"address_id": "X"}).status_code == 503


def test_supplemental_facts_are_ephemeral_and_labelled(demo):
    with TestClient(create_app(demo.root)) as client:
        body = client.post("/api/v1/lookup", json={"address_id": "SYNTH-003", "as_of": "2026-11-15", "supplemental_facts": {"units": 12}}).json()
        assert body["evaluations"][0]["result"] == "applies"
        assert "User-supplied" in body["address"]["provenance"]["units"]
        assert "units" not in demo.addresses()["SYNTH-003"].facts
        assert client.post("/api/v1/lookup", json={"address_id": "SYNTH-003", "supplemental_facts": {"municipality": "fake"}}).status_code == 422


def test_general_changes_use_same_evaluator(demo):
    result = compute_changes(demo, ChangeRequest(before=date(2026, 11, 14), after=date(2026, 11, 15)))
    assert result.affected_address_ids == ["SYNTH-001"]
    assert result.uncertain_address_ids == ["SYNTH-003"]
    same = compute_changes(demo, ChangeRequest(before=date(2026, 11, 15), after=date(2026, 11, 15)))
    assert not same.affected_address_ids and not same.uncertain_address_ids


def test_competition_projection_and_synthetic_guard(demo, tmp_path):
    with pytest.raises(ValueError, match="Synthetic"): export_all(demo, tmp_path / "bad", allow_partial=True)
    report = export_all(demo, tmp_path / "out", date(2026, 11, 15), allow_partial=True, synthetic=True)
    assert report["artifact_label"] == "SYNTHETIC_NOT_FOR_SUBMISSION"
    assert report["all_lookup_references_resolve"]
    records = read_json(tmp_path / "out/rules.json")
    assert records[0]["status"] == "in_force"
    assert "evidence_mode" not in records[0]


@pytest.mark.skipif(not pack_dir().exists(), reason="Organizer pack not installed")
def test_real_pack_all_500_addresses_exported_without_fake_laws(tmp_path):
    store = Store(tmp_path / "data")
    ingest_pack(store, pack_dir())
    assert len(store.sources()) == 87 and sum(bool(s.text) for s in store.sources().values()) == 54
    report = export_all(store, tmp_path / "out", allow_partial=True)
    assert report["counts"]["addresses"] == 500
    assert report["all_input_addresses_represented"]
    assert report["artifact_label"] == "PARTIAL_NOT_JUDGE_READY"
    assert report["change_status"] == {f"T{i}": "blocked" for i in range(1, 6)}
    assert read_json(tmp_path / "out/rules.json") == []


def test_summary_preserves_core_results_and_separate_impact_sets(demo):
    from scripts.platform_ops import snapshot_hashes
    before = snapshot_hashes(demo.root)
    request = {"before": "2026-11-14", "after": "2026-11-15"}
    with TestClient(create_app(demo.root)) as client:
        raw = client.post("/api/v1/changes", json=request).json()
        response = client.post("/api/v1/changes/summary", json=request)
        assert response.status_code == 200
        summary = response.json()
        assert summary["result"] == raw
        assert summary["property_labels"]["SYNTH-001"] == demo.addresses()["SYNTH-001"].normalized_address
        group = next(iter(summary["by_category"].values()))
        assert group["affected_address_ids"] == raw["affected_address_ids"]
        assert group["uncertain_address_ids"] == raw["uncertain_address_ids"]
        assert client.post("/api/v1/changes/summary", json={**request, "rule_ids": ["missing"]}).status_code == 404
    assert snapshot_hashes(demo.root) == before


def test_claim_comparisons_recheck_anchors_and_do_not_choose_legal_winner(demo):
    from navigator.retrieval import span
    from navigator.source_comparison import compare_claims
    source = next(iter(demo.sources().values()))
    support = [{"span": span(source, 0, 30).model_dump(mode="json"), "anchor_valid": True}]
    row = {"field": "effective_date", "rule_ids": list(demo.rules()), "before": {"value": "2026-11-15", "support": support},
           "after": {"value": "2027", "support": support}}
    with TestClient(create_app(demo.root)) as client:
        assert client.get("/api/v1/source-comparisons").json()["status"] == "unavailable"
        demo.write("source_comparisons.json", {"applied_to_saved_sources": {"test": row}})
        body = client.get("/api/v1/source-comparisons").json()
        result = body["observations"]["test"]
        assert result == compare_claims(row["field"], "2026-11-15", "2027", [span(source,0,30)], [span(source,0,30)], demo.sources(), demo.sources(), rule_ids=row["rule_ids"])
        assert result["winner"] is None and result["legal_amendment"] is None
        assert result["semantic_support"] == "not_checked" and result["status"] == "unresolved"
        sources = demo.sources()
        sources[source.doc_id].text = "changed source"
        demo.save_collection("sources", sources)
        changed = client.get("/api/v1/source-comparisons").json()["observations"]["test"]
        assert changed["classification"] == "missing_support"
        assert not changed["before"]["support"][0]["anchor_valid"]
        assert not changed["before"]["support"][0]["source"]["identity_valid"]


def test_same_origin_frontend_does_not_mask_api_or_expose_snapshot(demo, tmp_path):
    public = tmp_path / "dist"
    public.mkdir()
    (public / "index.html").write_text("<h1>test frontend</h1>")
    (public / "bundle.js").write_text("/* build asset */")
    (public / "api").mkdir()
    (public / "api/secret.txt").write_text("must never serve")
    with TestClient(create_app(demo.root, frontend_dist=public)) as client:
        assert client.get("/").text == "<h1>test frontend</h1>"
        assert client.get("/").headers["cache-control"] == "no-cache"
        assert client.get("/bundle.js").status_code == 200
        assert client.get("/api/v1/health").json()["addresses"] == 3
        for name in ("/api/secret.txt", "/api/v1/typo", "/api"):
            assert client.get(name).status_code == 404
            assert client.get(name).headers["content-type"] == "application/json"
        for name in ("/addresses.json", "/data/addresses.json", "/%2e%2e/synthetic/addresses.json"):
            assert client.get(name).status_code == 404
    assert create_app(demo.root, frontend_dist=public).openapi() == create_app(demo.root).openapi()
    with pytest.raises(RuntimeError, match="index.html"):
        create_app(demo.root, frontend_dist=tmp_path / "missing")


@pytest.fixture
def local_release(demo, tmp_path):
    from types import SimpleNamespace
    from scripts.platform_ops import prepare_release
    frontend = tmp_path / "frontend"
    frontend.mkdir()
    (frontend / "index.html").write_text("<h1>Synthetic release test</h1>")
    args = SimpleNamespace(data_dir=demo.root, frontend_dist=frontend, output=tmp_path / "release", code_revision="a"*40, synthetic=True)
    prepare_release(args)
    return args


def test_release_freezes_code_data_assets_and_preserves_prior_release(local_release, demo, monkeypatch):
    from scripts import platform_ops as ops
    from types import SimpleNamespace
    before = ops.snapshot_hashes(demo.root)
    manifest = ops.verify_release(local_release.output)
    assert manifest["artifact_label"] == "SYNTHETIC_NOT_FOR_SUBMISSION"
    assert "runtime/navigator/api.py" in manifest["files_sha256"]
    assert "data/rules.json" in manifest["files_sha256"]
    assert not manifest["ready_for_submission"]
    assert not any("provider_outputs" in name or ".env" in name for name in manifest["files_sha256"])
    called = []
    monkeypatch.setattr(ops, "launch_server", lambda *args: called.append(args))
    ops.serve_release(SimpleNamespace(release=local_release.output, port=8900))
    assert called == [(local_release.output / "runtime", local_release.output / "data", local_release.output / "frontend", 8900)]
    with pytest.raises(RuntimeError, match="previous releases"):
        ops.prepare_release(local_release)
    assert before == ops.snapshot_hashes(demo.root)


@pytest.mark.parametrize("damage", ["changed", "missing", "added", "incomplete"])
def test_release_rejects_changed_or_incomplete_bundle(local_release, damage):
    from scripts.platform_ops import verify_release
    root = local_release.output
    if damage == "changed": (root / "data/rules.json").write_text("{}")
    elif damage == "missing": (root / "frontend/index.html").unlink()
    elif damage == "added": (root / "unexpected.json").write_text("{}")
    else: (root / "RELEASE_INCOMPLETE").write_text("incomplete")
    with pytest.raises(RuntimeError): verify_release(root)


@pytest.mark.parametrize("damage", ["synthetic_flag", "assembly_incomplete", "secret_asset", "reserved_asset"])
def test_release_rejects_unsafe_inputs_before_writing(local_release, damage):
    from scripts.platform_ops import prepare_release
    args = local_release
    args.output = args.output.parent / "second-release"
    if damage == "synthetic_flag": args.synthetic = False
    elif damage == "assembly_incomplete": (args.data_dir / "ASSEMBLY_INCOMPLETE.json").write_text("{}")
    elif damage == "secret_asset": (args.frontend_dist / ".env").write_text("synthetic-test")
    else:
        (args.frontend_dist / "data").mkdir()
        (args.frontend_dist / "data/addresses.json").write_text("{}")
    with pytest.raises(RuntimeError): prepare_release(args)
    assert not args.output.exists()
