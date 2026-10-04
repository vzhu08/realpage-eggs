from concurrent.futures import ThreadPoolExecutor
from datetime import date
import gzip
import json
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

from navigator.api import create_app
from navigator.assist_cache import AssistCache, Artifact, CacheBusy, identity, request_key
from navigator.assist_service import assist
from navigator.assist_wire import MEDIA_TYPE, unpack
from navigator.models import AssistRequest
from scripts.prime_assist import prime


def request(**changes):
    return AssistRequest(**{"address_id": "SYNTH-003", "as_of": "2026-11-15", **changes})


def body(artifact):
    return json.loads(b"".join(artifact.chunks(False)))


def test_hit_is_exact_and_does_not_rebuild_graph(demo, tmp_path, monkeypatch):
    cache = AssistCache(tmp_path / "cache")
    req = request()
    expected = assist(demo, req).model_dump(mode="json")
    assert body(cache.resolve(demo, req)) == expected
    monkeypatch.setattr("navigator.assist_service.assist", lambda *a: pytest.fail("hit called Core"))
    hit = cache.resolve(demo, req)
    assert hit.hit and body(hit) == expected
    assert unpack(body(cache.resolve(demo, req, "dag"))) == expected


@pytest.mark.parametrize("name", ["dataset.json", "addresses.json", "resolutions.json", "rules.json", "sources.json", "extraction_index.json", "semantic_reviews/new.json"])
def test_every_consumed_snapshot_file_invalidates_even_same_mtime(demo, name):
    before = identity(demo)
    path = demo.path(name)
    path.parent.mkdir(exist_ok=True)
    raw = path.read_bytes() if path.exists() else b"{}"
    path.write_bytes(raw + b"\n")
    assert identity(demo) != before


def test_code_and_runtime_invalidates(demo, tmp_path, monkeypatch):
    root = tmp_path / "code"
    (root / "navigator").mkdir(parents=True)
    code = root / "navigator" / "engine.py"
    code.write_text("first")
    monkeypatch.setattr("navigator.assist_cache.ROOT", root)
    before = identity(demo)
    code.write_text("other")
    assert identity(demo) != before
    before = identity(demo)
    monkeypatch.setattr("navigator.assist_cache.version", lambda name: "changed")
    assert identity(demo) != before


def test_all_request_dimensions_are_distinct(demo):
    stamp = identity(demo)
    requests = [request(), request(as_of=date(2025, 1, 1)), request(address_id="SYNTH-001"),
                request(scenario_id="another"), request(limits={"max_evaluations": 8}),
                request(supplemental_facts={"owner_occupied": False})]
    for value in (False, None, True):
        for provenance in ("demo", "user_provided"):
            for note in (None, "hypothesis"):
                requests.append(request(answers=[{"field": "owner_occupied", "value": value, "provenance": provenance, "note": note}]))
    assert len({request_key(stamp, r) for r in requests}) == len(requests)


def test_validation_before_hits(demo, tmp_path, monkeypatch):
    cache = AssistCache(tmp_path / "cache")
    monkeypatch.setattr(cache, "get", lambda *a, **k: pytest.fail("invalid request reached cache"))
    with pytest.raises(ValueError):
        cache.resolve(demo, request(answers=[{"field": "owner_occupied", "value": "false"}]))
    demo.write("dataset.json", {"mode": "dataset"})
    with pytest.raises(ValueError, match="Demo answers"):
        cache.resolve(demo, request(answers=[{"field": "owner_occupied", "value": False, "provenance": "demo"}]))


def test_corrupt_entry_recomputed_and_bounded(demo, tmp_path):
    cache = AssistCache(tmp_path / "cache", max_entries=2)
    req = request()
    artifact = cache.resolve(demo, req)
    key = artifact.key
    expected = body(artifact)
    (cache.root / key / "canonical.json.gz").write_bytes(b"bad gzip")
    assert body(cache.resolve(demo, req)) == expected
    (cache.root / key / "entry.json").write_text("{")
    assert body(cache.resolve(demo, req)) == expected
    for scenario in ("second", "third"):
        body(cache.resolve(demo, request(scenario_id=scenario)))
    assert len(list(cache.root.glob("*/entry.json"))) == 2
    assert sum(p.stat().st_size for p in cache.root.rglob("*") if p.is_file()) <= cache.max_bytes


def test_simultaneous_users_receive_only_own_answers(demo, tmp_path):
    cache = AssistCache(tmp_path / "cache")
    requests = [request(answers=[{"field": "owner_occupied", "value": v}], scenario_id=f"user-{v}") for v in (False, None)]
    expected = [body(cache.resolve(demo, r)) for r in requests]
    with ThreadPoolExecutor(max_workers=2) as pool:
        actual = list(pool.map(lambda r: body(cache.resolve(demo, r)), requests))
    assert actual == expected
    assert actual[0]["answers_applied"] != actual[1]["answers_applied"]
    actual[0]["answers_applied"][0]["value"] = "mutated"
    assert body(cache.resolve(demo, requests[0])) == expected[0]


def test_busy_cold_requests_have_bounded_admission(demo, tmp_path):
    cache = AssistCache(tmp_path / "cache")
    with cache.compute:
        with pytest.raises(CacheBusy):
            cache.resolve(demo, request())


def test_http_compression_negotiation_errors_and_uncached_equivalence(demo, tmp_path):
    with TestClient(create_app(demo.root, assist_cache_dir=tmp_path / "cache")) as client:
        req = request().model_dump(mode="json")
        first = client.post("/api/v1/lookup/assist", json=req)
        assert first.status_code == 200 and first.headers["x-assist-cache"] == "miss"
        expected = assist(demo, request()).model_dump(mode="json")
        assert first.json() == expected
        for accept in ("application/json", MEDIA_TYPE):
            for encoding in ("gzip", "identity", "gzip;q=0", "gzip;q=0.00"):
                hit = client.post("/api/v1/lookup/assist", json=req, headers={"Accept": accept, "Accept-Encoding": encoding})
                assert hit.status_code == 200 and hit.headers["x-assist-cache"] == "hit"
                assert (unpack(hit.json()) if accept == MEDIA_TYPE else hit.json()) == expected
                assert hit.headers["cache-control"] == "no-store"
                assert hit.headers["content-encoding"] == ("gzip" if encoding == "gzip" else "identity")
        assert client.post("/api/v1/lookup/assist", json={**req, "address_id": "absent"}).status_code == 404
        assert client.post("/api/v1/lookup/assist", json={**req, "supplemental_facts": {"owner_occupied": "false"}}).status_code == 422


def test_injected_unavailable_core_not_replaced_by_cache(demo, tmp_path):
    cache = AssistCache(tmp_path / "cache")
    body(cache.resolve(demo, request()))
    result = cache.resolve(demo, request(), core_services=SimpleNamespace())
    assert result.question_plan.status == "unavailable"


def test_snapshot_change_during_request_is_not_mislabeled(demo, tmp_path, monkeypatch):
    original = AssistCache.resolve

    def changing(cache, store, req, *args, **kwargs):
        artifact = original(cache, store, req, *args, **kwargs)
        store.path("sources.json").write_bytes(store.path("sources.json").read_bytes() + b"\n")
        return artifact

    monkeypatch.setattr(AssistCache, "resolve", changing)
    with TestClient(create_app(demo.root, assist_cache_dir=tmp_path / "cache")) as client:
        response = client.post("/api/v1/lookup/assist", json=request().model_dump(mode="json"))
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "snapshot_changed"


def test_prime_reproducible_and_sources_unchanged(demo, tmp_path):
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"format": "realpage-demo-requests-v1", "label": "synthetic test", "steps": [{"id": "opening", "request": request().model_dump(mode="json")}]}))
    before = identity(demo)
    report = prime(demo.root, tmp_path / "cache", manifest, tmp_path / "receipt.json", verify=True)
    assert report["steps"][0]["uncached_equivalent"]
    assert identity(demo) == before
