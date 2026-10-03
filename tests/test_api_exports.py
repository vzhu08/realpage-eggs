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
