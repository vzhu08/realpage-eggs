"""Offline source-only preparation: identity, provenance and no promotion."""
from hashlib import sha256
import json
from pathlib import Path
import shutil
from zipfile import ZipFile

import pytest

from navigator.models import SourceDocument
from navigator.source_policy import evidence_source_allowed, source_use
from scripts.prepare_change_case_sources import CAPTURES, RESEARCH, ROOT, SELECTIONS, main, prepare


CHECKPOINT = ROOT / "docs/core_rules/snapshots/core-store.zip"


def fingerprint(root):
    return {str(p.relative_to(root)): sha256(p.read_bytes()).hexdigest()
            for p in root.rglob("*") if p.is_file()}


@pytest.fixture
def supplied(tmp_path):
    with ZipFile(CHECKPOINT) as archive:
        original = json.loads(archive.read("sources.json"))
    store = tmp_path / "input-store"
    store.mkdir()
    (store / "sources.json").write_text(json.dumps({i: original[i] for i in ("D022", "D069")}))
    (store / "rules.json").write_text('{"sentinel": "must not be copied or consumed"}')
    (store / "extraction_index.json").write_text('{"run_id": "must-not-be-borrowed"}')
    return store


def test_bundle_is_pinned_source_only_and_keeps_admission_separate(supplied, tmp_path):
    before, captures_before = fingerprint(supplied), fingerprint(CAPTURES)
    output = tmp_path / "bundle"
    manifest = prepare(store=supplied, output=output)
    assert fingerprint(supplied) == before
    assert fingerprint(CAPTURES) == captures_before
    assert manifest["sources"] == len(SELECTIONS) == 24
    assert manifest["source_roles"] == {"legal_text": 17, "status_record": 7}
    assert manifest["admission_counts"] == {"supplied_corpus": 2, RESEARCH: 22}
    assert manifest["rules_created"] == manifest["provider_calls"] == 0
    assert not manifest["ready_for_submission"]
    assert manifest["case_readiness"] == "not_evaluated"
    assert set(manifest["remaining_gaps"]) == {"T1", "T2", "T3", "T4", "T5"}
    assert {p.name for p in output.iterdir()} == {"manifest.json", "sources.json", "evidence"}
    assert not any("run_id" in p.name or "rule" in p.name for p in output.rglob("*"))
    source_bytes = (output / "sources.json").read_bytes()
    assert sha256(source_bytes).hexdigest() == manifest["sources_json_sha256"]
    sources = {i: SourceDocument.model_validate(s) for i, s in json.loads(source_bytes).items()}
    assert set(sources) == {s.doc_id for s in SELECTIONS}
    rows = {r["doc_id"]: r for r in manifest["documents"]}
    for ident, source in sources.items():
        assert sha256(source.text.encode()).hexdigest() == source.sha256 == rows[ident]["text_sha256"]
        for item in rows[ident]["files"]:
            raw = (output / item["path"]).read_bytes()
            assert sha256(raw).hexdigest() == item["sha256"]
            assert len(raw) == item["bytes"]
    # The original snapshot is unclassified; the new declaration changes no text/ID.
    assert rows["D069"]["original_source_metadata"]["source_type"] == "unclassified"
    assert sources["D069"].source_type == "legal_text"
    assert rows["D069"]["admission"] == "supplied_corpus"
    assert rows["P11_MA_H5222_TEXT"]["admission"] == RESEARCH
    assert "P11_MA_CELLA_OPINION_MIRROR" not in sources
    assert "P11_NJ_HOB_ADOPTION" not in sources
    if __import__("os").name == "posix":
        assert output.stat().st_mode & 0o777 == 0o700
        assert (output / "sources.json").stat().st_mode & 0o777 == 0o600


def test_status_sources_cannot_be_used_as_substantive_provisions(supplied, tmp_path):
    output = tmp_path / "bundle"
    manifest = prepare(store=supplied, output=output)
    sources = json.loads((output / "sources.json").read_text())
    for row in manifest["documents"]:
        source = SourceDocument.model_validate(sources[row["doc_id"]])
        if source.source_type == "status_record":
            assert not source_use(source).extraction_allowed
            assert not evidence_source_allowed(source)
            assert evidence_source_allowed(source, temporal=True)
        if row["doc_id"].startswith("MA_SJ"):
            assert row["provenance"]["kind"] == "retained_browser_visible_text"
            assert not row["provenance"]["raw_response_available"]
            assert len(row["files"]) == 1
            assert "not original HTTP" in row["provenance"]["capture"]["method"]


def test_nine_primary_plan_is_bounded_and_separates_temporal_context(supplied, tmp_path):
    manifest = prepare(store=supplied, output=tmp_path / "bundle")
    rows = {r["doc_id"]: r for r in manifest["documents"]}
    jobs = manifest["extraction_jobs"]
    assert len(jobs) == 9
    assert [j["doc_id"] for j in jobs] == sorted(j["doc_id"] for j in jobs)
    for job in jobs:
        assert job["plan_only"]
        assert rows[job["doc_id"]]["declaration"]["source_type"] == "legal_text"
        assert job["context_characters"] <= 128000
        assert set(job["supporting_doc_ids"]) == set(job["substantive_context_doc_ids"]) | set(job["temporal_context_doc_ids"])
        for ident in job["substantive_context_doc_ids"]:
            assert rows[ident]["declaration"]["source_type"] == "legal_text"
        for ident in job["temporal_context_doc_ids"]:
            assert rows[ident]["declaration"]["source_type"] == "status_record"
    fair = next(j for j in jobs if j["doc_id"] == "D069")
    assert fair["deferred_bounded_span_review_doc_ids"] == ["P11_NJ_HOB_MINUTES", "P12_NJ_CHARTER"]


def test_bundle_is_reproducible_for_same_inputs_and_reads_archive_without_extracting(tmp_path):
    before = CHECKPOINT.read_bytes()
    first = prepare(archive=CHECKPOINT, output=tmp_path / "first")
    second = prepare(archive=CHECKPOINT, output=tmp_path / "second")
    assert first == second
    assert fingerprint(tmp_path / "first") == fingerprint(tmp_path / "second")
    assert CHECKPOINT.read_bytes() == before
    assert first["input"]["archive_sha256"] == sha256(before).hexdigest()


@pytest.mark.parametrize("destination", ["sources.json", "new-bundle", "nested/bundle"])
def test_output_cannot_overwrite_or_be_nested_in_input(supplied, destination):
    before = fingerprint(supplied)
    with pytest.raises(ValueError, match="new directory outside"):
        prepare(store=supplied, output=supplied / destination)
    assert fingerprint(supplied) == before


def test_refuses_existing_output_and_input_alias(supplied, tmp_path):
    existing = tmp_path / "existing"
    existing.mkdir()
    with pytest.raises(ValueError, match="new directory"):
        prepare(store=supplied, output=existing)
    alias = tmp_path / "alias"
    alias.symlink_to(supplied, target_is_directory=True)
    with pytest.raises(ValueError, match="new directory outside"):
        prepare(store=supplied, output=alias / "new-output")
    assert not list(existing.iterdir())


def test_rehashed_changed_source_fails_reviewed_body_pin(supplied, tmp_path):
    path = supplied / "sources.json"
    sources = json.loads(path.read_text())
    sources["D022"]["text"] += "\nDifferent legal version."
    sources["D022"]["sha256"] = sha256(sources["D022"]["text"].encode()).hexdigest()
    path.write_text(json.dumps(sources))
    output = tmp_path / "bundle"
    with pytest.raises(ValueError, match="Reviewed text version pin mismatch: D022"):
        prepare(store=supplied, output=output)
    assert not output.exists()


@pytest.mark.parametrize("target", ["raw/P11_CA_AB325_TEXT.html", "text/P11_CA_AB325_TEXT.txt"])
def test_tampered_retained_capture_is_rejected_before_output(supplied, tmp_path, target):
    captures = tmp_path / "captures"
    shutil.copytree(CAPTURES, captures)
    path = captures / "2026-10-04" / target
    path.write_bytes(path.read_bytes() + b" altered")
    output = tmp_path / "bundle"
    with pytest.raises(ValueError, match="capture identity mismatch"):
        prepare(store=supplied, output=output, captures_root=captures)
    assert not output.exists()


def test_existing_store_supplemental_id_collision_is_not_silently_replaced(supplied, tmp_path):
    path = supplied / "sources.json"
    sources = json.loads(path.read_text())
    sources["P11_CA_AB325_TEXT"] = dict(sources["D022"], doc_id="P11_CA_AB325_TEXT")
    path.write_text(json.dumps(sources))
    with pytest.raises(ValueError, match="conflicting source ID"):
        prepare(store=supplied, output=tmp_path / "bundle")


def test_missing_input_and_missing_required_source_fail_cleanly(supplied, tmp_path, capsys):
    assert main(["--store", str(tmp_path / "absent"), "--output", str(tmp_path / "bundle")]) == 2
    assert "Cannot prepare source bundle" in capsys.readouterr().err
    path = supplied / "sources.json"
    path.write_text("{}")
    assert main(["--store", str(supplied), "--output", str(tmp_path / "bundle")]) == 2
    assert "D022" in capsys.readouterr().err
    assert not (tmp_path / "bundle").exists()


def test_cli_success_is_not_reported_as_scenario_or_submission_success(supplied, tmp_path, capsys):
    output = tmp_path / "bundle"
    assert main(["--store", str(supplied), "--output", str(output)]) == 0
    response = json.loads(capsys.readouterr().out)
    assert response["sources"] == 24
    assert response["ready_for_submission"] is False
