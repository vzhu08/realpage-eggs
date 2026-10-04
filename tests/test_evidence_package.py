"""Evidence export/replay uses labeled synthetic laws and the real Core services."""
import json
from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient
import pytest

from navigator.api import create_app
from navigator.cli import main
from navigator.evidence import semantic_key
from navigator.evidence_package import build_evidence_package, package_digest, replay_evidence_package
from navigator.models import EvidencePackage, SemanticReview
from navigator.service import DatasetUnavailable
from navigator.store import Store, digest, write_json

REQUEST = {"address_id": "SYNTH-003", "as_of": "2026-11-15"}
ANSWER = {"field": "units", "value": 8, "provenance": "demo"}


def hashes(root):
    return {p.relative_to(root).as_posix(): digest(p.read_bytes()) for p in root.rglob("*") if p.is_file()}


def forbid_providers(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Evidence packaging/replay must not construct a provider")
    monkeypatch.setattr("navigator.extraction.OpenAIProvider.__init__", forbidden)
    monkeypatch.setattr("navigator.geocode.CensusGeocoder.__init__", forbidden)


def test_http_download_preserves_facts_answers_unicode_sources_and_replays_without_store(demo, monkeypatch):
    forbid_providers(monkeypatch)
    sources = demo.sources()
    for source in sources.values():
        source.text += "\r\nSynthetic Unicode appendix: café 🏠\r\n"
        source.sha256 = digest(source.text.encode("utf-8"))
    demo.save_collection("sources", sources)
    index = demo.read("extraction_index.json")
    for ident, source in sources.items(): index[ident]["sha256"] = source.sha256
    demo.write("extraction_index.json", index)
    demo.path(".env").write_text("SYNTHETIC_SENTINEL=do-not-package")
    dataset = demo.read("dataset.json")
    demo.write("dataset.json", {**dataset, "pack": "private-local-path", "deployment_secret": "do-not-package"})
    before = hashes(demo.root)
    request = {**REQUEST, "answers": [ANSWER, {"field": "certificate_of_occupancy", "value": "2020-06", "provenance": "demo"}]}
    with TestClient(create_app(demo.root)) as client:
        response = client.post("/api/v1/lookup/evidence-package", json=request, headers={"Origin": "http://localhost:5173"})
        assert response.status_code == 200
        assert response.headers["content-disposition"].startswith('attachment; filename="evidence-package-')
        assert response.headers["cache-control"] == "no-store"
        assert "Content-Disposition" in response.headers["access-control-expose-headers"]
        package = EvidencePackage.model_validate(response.json())
        normal = client.post("/api/v1/lookup/assist", json=request).json()
        assert package.response.lookup.evaluations == [type(package.response.lookup.evaluations[0]).model_validate(e) for e in normal["lookup"]["evaluations"]]
        assert package.response.question_plan.model_dump(mode="json") == normal["question_plan"]
        reset = client.post("/api/v1/lookup/evidence-package", json=REQUEST).json()
        assert reset["response"]["lookup"]["evaluations"][0]["result"] == "unknown"
    assert "units" not in package.inputs.original_property.facts
    assert package.response.lookup.address.facts["units"] == 8
    assert package.response.lookup.address.facts["certificate_of_occupancy"] == "2020-06"
    assert package.response.answers_applied[0].model_dump(mode="json") == {**ANSWER, "note": None}
    assert package.inputs.sources == sources
    serialized = package.model_dump_json()
    assert "do-not-package" not in serialized and "private-local-path" not in serialized
    assert "SYNTH-001" not in serialized and "SYNTH-002" not in serialized
    assert package.artifact_label == "SYNTHETIC_NOT_FOR_SUBMISSION"
    assert hashes(demo.root) == before
    monkeypatch.setattr(Store, "read", lambda *a, **k: pytest.fail("Replay must not use the original disk store"))
    replay = replay_evidence_package(json.loads(json.dumps(package.model_dump(mode="json"), sort_keys=True)))
    assert replay.status == "reproduced" and replay.package_sha256 == package.package_sha256


def test_repeated_package_is_deterministic_and_answers_are_request_local(demo):
    a = build_evidence_package(demo, {**REQUEST, "supplemental_facts": {"units": 8, "owner_occupied": None}})
    b = build_evidence_package(demo, {**REQUEST, "supplemental_facts": {"owner_occupied": None, "units": 8}})
    assert a == b
    assert replay_evidence_package(a).status == "reproduced"
    reset = build_evidence_package(demo, REQUEST)
    assert reset.response.lookup.evaluations[0].result == "unknown"
    assert reset.response.answers_applied == []


@pytest.mark.parametrize("failure", ["missing_source", "changed_source", "stale_review", "bounded_plan", "missing_core"])
def test_uncertainty_and_capability_limits_survive_replay(demo, failure):
    core = None
    request = dict(REQUEST)
    if failure == "missing_source": demo.write("sources.json", {})
    elif failure == "changed_source":
        sources = demo.sources()
        for source in sources.values(): source.text = "Changed synthetic source without the original evidence."
        demo.save_collection("sources", sources)
    elif failure == "stale_review":
        rule = next(iter(demo.rules().values()))
        sources = demo.sources()
        review = SemanticReview(rule_id=rule.team_rule_id, rule_hash="stale", source_hashes={k: s.sha256 for k, s in sources.items()},
                                mode="fixture", verifier_version="test", model="synthetic", decisions=[], limitations=["Synthetic test"])
        demo.write(f"semantic_reviews/{semantic_key(rule, sources)}.json", review)
    elif failure == "bounded_plan": request["limits"] = {"max_evaluations": 1}
    else: core = SimpleNamespace()
    package = build_evidence_package(demo, request, core)
    if failure in {"missing_source", "changed_source", "stale_review"}:
        assert package.response.evidence_reports[0].blocking_issues
        assert package.response.lookup.evaluations[0].result == "unknown"
    elif failure == "bounded_plan":
        assert package.response.question_plan.status == "partial"
        assert package.response.question_plan.limits_hit
    else:
        assert package.response.question_plan.status == "unavailable"
    assert replay_evidence_package(package).status == "reproduced"


@pytest.mark.parametrize("part", ["request", "source", "answer", "response"])
def test_tampering_is_rejected(demo, part):
    package = build_evidence_package(demo, {**REQUEST, "answers": [ANSWER]})
    if part == "request": package.request.as_of = package.request.as_of.replace(year=2027)
    elif part == "source": next(iter(package.inputs.sources.values())).text += " tampered"
    elif part == "answer": package.request.answers[0].value = 2
    else: package.response.lookup.evaluations[0].result = "unknown"
    with pytest.raises(ValueError, match="integrity"): replay_evidence_package(package)


def test_rehashed_incorrect_output_fails_actual_reproduction(demo):
    package = build_evidence_package(demo, {**REQUEST, "answers": [ANSWER]})
    package.response.lookup.evaluations[0].result = "unknown"
    package.response_sha256 = digest(package.response.model_dump(mode="json"))
    package.package_sha256 = package_digest(package)
    with pytest.raises(ValueError, match="does not reproduce"): replay_evidence_package(package)


def test_code_change_cannot_claim_exact_replay(demo):
    package = build_evidence_package(demo, REQUEST)
    package.code.files_sha256["navigator/engine.py"] = "0" * 64
    package.package_sha256 = package_digest(package)
    with pytest.raises(ValueError, match="code/runtime differs"): replay_evidence_package(package)


def test_http_errors_follow_existing_lookup_contract(demo, tmp_path):
    route = "/api/v1/lookup/evidence-package"
    with TestClient(create_app(demo.root)) as client:
        for request in ({}, {"address": demo.addresses()["SYNTH-001"].raw_address.model_dump()},
                        {**REQUEST, "answers": [{**ANSWER, "value": True}]},
                        {**REQUEST, "answers": [ANSWER, ANSWER]}):
            assert client.post(route, json=request).status_code == 422
        assert client.post(route, json={**REQUEST, "address_id": ""}).status_code == 404
        demo.write("dataset.json", {"mode": "real"})
        assert client.post(route, json={**REQUEST, "answers": [ANSWER]}).status_code == 422
    with TestClient(create_app(tmp_path / "absent")) as client:
        assert client.post(route, json=REQUEST).status_code == 503


def test_concurrent_input_change_is_rejected(demo, monkeypatch):
    original = Path.read_bytes
    count = 0
    def changing(path):
        nonlocal count
        raw = original(path)
        if path == demo.path("addresses.json"):
            count += 1
            if count > 1: return raw + b"\n"
        return raw
    monkeypatch.setattr(Path, "read_bytes", changing)
    with pytest.raises(DatasetUnavailable, match="Dataset changed"):
        build_evidence_package(demo, REQUEST)


def test_cli_package_and_offline_replay_preserve_input_and_existing_output(demo, tmp_path, monkeypatch, capsys):
    forbid_providers(monkeypatch)
    request, output = tmp_path / "request.json", tmp_path / "package.json"
    write_json(request, {**REQUEST, "answers": [ANSWER]})
    before = hashes(demo.root)
    args = ["--data-dir", str(demo.root), "evidence-package", "--request", str(request), "--output", str(output)]
    assert main(args) == 0
    package_bytes = output.read_bytes()
    assert main(args) == 2
    assert output.read_bytes() == package_bytes
    capsys.readouterr()
    assert main(["--data-dir", str(tmp_path / "no-store"), "replay-evidence-package", str(output)]) == 0
    assert json.loads(capsys.readouterr().out)["status"] == "reproduced"
    assert hashes(demo.root) == before
    assert main([*args[:-1], str(demo.path("package.json"))]) == 2
    assert not demo.path("package.json").exists()
