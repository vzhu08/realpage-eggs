"""Synthetic structural checks; no legal expectations or network providers."""
from datetime import date
import shutil

from fastapi.testclient import TestClient
import httpx
import pytest

from navigator.api import create_app
from navigator.export import export_all
from navigator.geocode import CensusGeocoder
from navigator.models import JurisdictionResolution
from navigator.store import Store, digest, read_json
from scripts import assemble_snapshot as assembly

REVISION = "a" * 40


def hashes(root):
    return {p.relative_to(root).as_posix(): assembly.fingerprint(p) for p in root.rglob("*") if p.is_file()}


@pytest.fixture
def inputs(demo, tmp_path):
    geo = Store(tmp_path / "geography")
    shutil.copytree(demo.root, geo.root)
    # Different geography is the intended merge; keep one municipality unresolved.
    resolutions = geo.resolutions()
    resolutions["SYNTH-003"] = JurisdictionResolution(address_id="SYNTH-003", state="CA")
    geo.save_collection("resolutions", resolutions)
    return demo, geo, tmp_path / "snapshot"


def combine(inputs, **kwargs):
    core, geo, output = inputs
    return assembly.assemble(core.root, geo.root, output, code_revision=REVISION,
                             expected_addresses=3, synthetic=True, **kwargs)


def test_snapshot_is_reproducible_preserves_inputs_and_works_through_http_and_export(inputs, tmp_path, monkeypatch):
    core, geo, output = inputs
    # Secrets/unrelated outputs in a store are never copied into the release.
    core.path(".env").write_text("NOT_A_REAL_SECRET=synthetic")
    before = [hashes(s.root) for s in (core, geo)]
    monkeypatch.setattr(httpx.Client, "send", lambda *a, **k: pytest.fail("No network permitted"))
    manifest = combine(inputs)
    assert manifest["artifact_label"] == "SYNTHETIC_NOT_FOR_SUBMISSION"
    assert not manifest["ready_for_submission"]
    assert manifest["counts"] == {"addresses": 3, "rules": 1, "sources": 1, "resolved_municipalities": 2}
    assert manifest["unresolved_address_ids"] == ["SYNTH-003"]
    assert not (output / ".env").exists() and not (output / "ASSEMBLY_INCOMPLETE.json").exists()
    for name, expected in manifest["output_files"].items():
        assert assembly.fingerprint(output / name) == expected
    assert (output / "rules.json").read_bytes() == core.path("rules.json").read_bytes()
    assert (output / "resolutions.json").read_bytes() == geo.path("resolutions.json").read_bytes()
    again = assembly.assemble(core.root, geo.root, tmp_path / "replay", code_revision=REVISION,
                              expected_addresses=3, synthetic=True)
    assert again == manifest
    assert [hashes(s.root) for s in (core, geo)] == before
    monkeypatch.undo()
    snapshot_before = hashes(output)
    with TestClient(create_app(output)) as client:
        health = client.get("/api/v1/health").json()
        assert health["addresses"] == 3 and health["resolved_municipalities"] == 2
        result = client.post("/api/v1/lookup/assist", json={"address_id": "SYNTH-003", "as_of": "2026-11-15"})
        assert result.status_code == 200
        assert result.json()["lookup"]["evaluations"][0]["result"] == "unknown"
    working = tmp_path / "export-working"
    shutil.copytree(output, working)
    report = export_all(Store(working), tmp_path / "exports", date(2026, 11, 15), allow_partial=True, synthetic=True)
    assert report["all_input_addresses_represented"] and report["all_lookup_references_resolve"]
    assert hashes(output) == snapshot_before


@pytest.mark.parametrize("damage,expected", [
    ("missing_index", "missing required files"), ("missing_run", "extraction run"),
    ("missing_cache", "cache provenance"), ("cache_origin", "Cache origin mismatch"),
    ("source_hash", "Source text/hash mismatch"), ("source_url", "Source identity differs"),
    ("evidence_offset", "Evidence offsets/quote mismatch"), ("index_hash", "Stale extraction index"),
    ("index_count", "count/mode mismatch"), ("address_fact", "Address/facts/provenance mismatch"),
    ("normalized_address", "Normalized address mismatch"), ("missing_address", "ID sets"),
    ("resolution_state", "Resolution address/state mismatch"), ("fake_geography", "Census provenance"),
    ("run_collision", "Conflicting provenance file"), ("duplicate_key", "Duplicate JSON key"),
    ("provider_origin", "Missing provider-output origin"), ("mixed_dataset", "explicitly synthetic"),
])
def test_rejects_mismatches_without_publishing_or_modifying_inputs(inputs, damage, expected):
    core, geo, output = inputs
    if damage == "missing_index": core.path("extraction_index.json").unlink()
    elif damage == "missing_run":
        rule = next(iter(core.rules().values()))
        core.path(f"runs/{rule.extraction_run_id}.json").unlink()
    elif damage == "missing_cache":
        for path in core.path("extraction_cache").glob("*.json"): path.unlink()
    elif damage == "cache_origin":
        path = next(core.path("extraction_cache").glob("*.json"))
        value = read_json(path)
        value["model"] = "different-model"
        core.write(str(path.relative_to(core.root)), value)
    elif damage in {"source_hash", "source_url"}:
        sources = geo.sources()
        source = next(iter(sources.values()))
        if damage == "source_hash": source.text += " changed"
        else: source.url = "https://example.invalid/different"
        geo.save_collection("sources", sources)
    elif damage == "evidence_offset":
        rules = core.rules()
        next(iter(rules.values())).status_events[0].evidence[0].start += 1
        core.save_collection("rules", rules)
    elif damage in {"index_hash", "index_count"}:
        index = core.read("extraction_index.json")
        entry = next(iter(index.values()))
        entry["sha256" if damage == "index_hash" else "rules"] = "bad" if damage == "index_hash" else 50
        core.write("extraction_index.json", index)
    elif damage == "address_fact":
        props = geo.addresses()
        props["SYNTH-001"].facts["units"] = 999
        geo.save_collection("addresses", props)
    elif damage == "normalized_address":
        for store in (core, geo):
            props = store.addresses()
            props["SYNTH-001"].normalized_address = "bad"
            store.save_collection("addresses", props)
    elif damage == "missing_address":
        props = geo.addresses()
        del props["SYNTH-001"]
        geo.save_collection("addresses", props)
    elif damage in {"resolution_state", "fake_geography"}:
        resolutions = geo.resolutions()
        item = resolutions["SYNTH-001"]
        if damage == "resolution_state": item.state = "NJ"
        else: item.method = "postal_city_guess"
        geo.save_collection("resolutions", resolutions)
    elif damage == "run_collision":
        path = next(geo.path("runs").glob("*.json"))
        value = read_json(path)
        value["errors"].append("conflicting copy")
        geo.write(str(path.relative_to(geo.root)), value)
    elif damage == "duplicate_key": core.path("rules.json").write_text('{"x": {}, "x": {}}')
    elif damage == "provider_origin": core.write("provider_outputs/missing/usage.json", [])
    elif damage == "mixed_dataset": geo.write("dataset.json", {"mode": "real"})
    before = [hashes(s.root) for s in (core, geo)]
    with pytest.raises(assembly.SnapshotError, match=expected): combine(inputs)
    assert not output.exists()
    assert [hashes(s.root) for s in (core, geo)] == before


def test_existing_or_nested_output_cannot_be_overwritten(inputs):
    core, geo, output = inputs
    output.mkdir()
    sentinel = output / "keep.txt"
    sentinel.write_text("keep")
    with pytest.raises(assembly.SnapshotError, match="new directory"): combine(inputs)
    assert sentinel.read_text() == "keep"
    with pytest.raises(assembly.SnapshotError, match="non-nested"):
        combine((core, geo, core.root / "snapshot"))


def test_changed_input_during_copy_never_gets_a_success_manifest(inputs, monkeypatch):
    core, _, output = inputs
    original = assembly.shutil.copyfile
    def racing_copy(source, target):
        result = original(source, target)
        if source == core.path("rules.json"):
            source.write_bytes(source.read_bytes() + b"\n")
        return result
    monkeypatch.setattr(assembly.shutil, "copyfile", racing_copy)
    with pytest.raises(assembly.SnapshotError, match="Inputs changed"): combine(inputs)
    assert not (output / "snapshot_manifest.json").exists()
    assert (output / "ASSEMBLY_INCOMPLETE.json").exists()


def test_resolved_geography_replays_saved_response_and_rejects_borrowed_city(inputs, monkeypatch):
    _, geo, _ = inputs
    prop = geo.addresses()["SYNTH-001"]
    body = {"result": {"addressMatches": [{"matchedAddress": "1 Test Street, POSTAL CITY, CA", "geographies": {
        "States": [{"STUSAB": "CA"}], "Counties": [{"NAME": "Example County"}],
        "Incorporated Places": [{"MTFCC": "G4110", "FUNCSTAT": "A", "GEOID": "123", "BASENAME": "Verified City"}]}}]}}
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=body))) as client:
        resolution = CensusGeocoder(geo, client).resolve(prop)
    resolutions = geo.resolutions()
    resolutions[prop.address_id] = resolution
    geo.save_collection("resolutions", resolutions)
    monkeypatch.setattr(httpx.Client, "send", lambda *a, **k: pytest.fail("No network permitted"))
    combine(inputs)
    # Older saved stores have minimal attempts but full resolution provenance.
    resolution.attempts = [{k: v for k, v in attempt.items() if k in {"street", "zip", "cache_key", "quality"}}
                           for attempt in resolution.attempts]
    geo.save_collection("resolutions", resolutions)
    combine((inputs[0], geo, inputs[2].parent / "legacy"))
    resolution.attempts[0]["response_hash"] = "incorrect"
    geo.save_collection("resolutions", resolutions)
    with pytest.raises(assembly.SnapshotError, match="attempt/cache mismatch"):
        combine((inputs[0], geo, inputs[2].parent / "bad-attempt"))
    del resolution.attempts[0]["response_hash"]
    resolution.municipality = prop.raw_address.postal_city
    geo.save_collection("resolutions", resolutions)
    with pytest.raises(assembly.SnapshotError, match="does not reproduce"):
        combine((inputs[0], geo, inputs[2].parent / "rejected"))


def test_real_mode_never_accepts_synthetic_content(inputs):
    core, geo, output = inputs
    for store in (core, geo):
        store.write("dataset.json", {"mode": "real", "input_hashes": {"addresses": "a", "manifest": "b"}})
    with pytest.raises(assembly.SnapshotError, match="Synthetic content"):
        assembly.assemble(core.root, geo.root, output, code_revision=REVISION, expected_addresses=3)


def test_legacy_range_match_to_one_endpoint_is_not_verified_geography(inputs, monkeypatch):
    core, geo, _ = inputs
    for store in (core, geo):
        props = store.addresses()
        props["SYNTH-001"].raw_address.street_address = "100-102 Test Street"
        props["SYNTH-001"].normalized_address = "100-102 TEST STREET, MAPLE HARBOR, CA, "
        store.save_collection("addresses", props)
    prop = geo.addresses()["SYNTH-001"]
    params = {"street": prop.raw_address.street_address, "city": prop.raw_address.postal_city,
              "state": "CA", "zip": "", "benchmark": "Public_AR_Current", "vintage": "Current_Current",
              "layers": "States,Counties,Incorporated Places,County Subdivisions", "format": "json"}
    body = {"result": {"addressMatches": [{"matchedAddress": "102 Test Street, POSTAL CITY, CA", "geographies": {
        "States": [{"STUSAB": "CA"}], "Counties": [{"NAME": "Example County"}],
        "Incorporated Places": [{"MTFCC": "G4110", "FUNCSTAT": "A", "GEOID": "123", "BASENAME": "Verified City"}]}}]}}
    key = digest(params)
    stamp = "2026-10-03T00:00:00Z"
    geo.write(f"geocode_cache/{key}.json", {"params": params, "response": body, "retrieved_at": stamp})
    # This mirrors the earlier saved format, which had no house-number guard.
    with httpx.Client() as client:
        coder = CensusGeocoder(geo, client)
        coder.benchmark, coder.vintage = params["benchmark"], params["vintage"]
        legacy = coder.parse(prop, body, stamp, key)
    assert legacy.match_quality == "resolved"
    legacy.attempts = [{"street": params["street"], "zip": "", "cache_key": key, "quality": "resolved"}]
    resolutions = geo.resolutions()
    resolutions[prop.address_id] = legacy
    geo.save_collection("resolutions", resolutions)
    monkeypatch.setattr(httpx.Client, "send", lambda *a, **k: pytest.fail("No network permitted"))
    with pytest.raises(assembly.SnapshotError, match="does not reproduce"):
        combine(inputs)
    before = hashes(geo.root)
    audit = assembly.audit_geography(geo.root, inputs[2].parent / "audit", expected_addresses=3, synthetic=True)
    assert audit["counts"] == {"addresses": 3, "stored_resolved": 2, "verified_resolved": 1, "rejected_records": 1}
    assert audit["status"] == "blocked" and set(audit["rejections"]) == {"SYNTH-001"}
    assert audit["provider_calls"] == 0 and hashes(geo.root) == before
