"""Offline audit checks: source-role honesty and unchanged input snapshots."""
from hashlib import sha256
import json
from pathlib import Path
from zipfile import ZipFile

import pytest

from scripts.audit_sources import audit, main


ROOT = Path(__file__).resolve().parents[1]
CHECKPOINT = ROOT / "docs/core_rules/snapshots/core-store.zip"


def fingerprint(root):
    return {str(path.relative_to(root)): sha256(path.read_bytes()).hexdigest()
            for path in root.rglob("*") if path.is_file()}


def test_saved_snapshot_quantifies_secondary_links_and_guidance_without_promoting_them():
    before = CHECKPOINT.read_bytes()
    report = audit(archive=CHECKPOINT)
    assert CHECKPOINT.read_bytes() == before
    counts = report["counts"]
    assert counts["sources"] == 87
    assert counts["captured_sources"] == 54
    assert counts["rules"] == counts["rules_needing_existing_review"] == 140
    assert counts["secondary_sources"] == 23
    assert counts["secondary_source_rules"] == 0
    assert counts["processed_captured_sources"] == 15
    assert counts["unprocessed_captured_sources"] == 39
    assert report["rules_by_source_type"] == {"agency_guidance": 136, "legal_text": 4}
    assert counts["context_only_sources"] == 24  # 23 secondary links plus D011 status record.
    assert report["missing_rule_source_ids"] == []
    assert counts["captured_hash_mismatches"] == 0
    rows = {row["doc_id"]: row for row in report["sources"]}
    assert rows["D004"]["authority"] == "official"  # An agency's /news/ URL is not journalism.
    assert rows["D004"]["disposition"] == "needs_review"
    assert rows["D004"]["operative_allowed"] is False
    assert rows["D010"]["authority"] == "official city-linked policy"
    assert rows["D011"]["disposition"] == "context_only"
    assert rows["D016"]["source_type"] == "agency_guidance"
    assert {"D023", "D024", "D025", "D026", "D027", "D069", "D073"} <= {
        row["doc_id"] for row in report["extraction_review_queue"]}
    assert all(row["legal_status"] == "not_determined" and not row["accepted_for_release"]
               for row in report["extraction_review_queue"])
    assert report == audit(archive=CHECKPOINT)


def test_committed_report_reproduces_from_checkpoint_and_shared_policy():
    recorded = json.loads((ROOT / "docs/evidence/source_data_audit.json").read_text())
    assert recorded == audit(archive=CHECKPOINT)


def test_store_and_archive_report_same_sources_without_input_writes(demo, tmp_path, capsys):
    before = fingerprint(demo.root)
    source_report = audit(store=demo.root)
    assert fingerprint(demo.root) == before
    archive = tmp_path / "checkpoint.zip"
    with ZipFile(archive, "w") as bundle:
        for name in ("sources.json", "rules.json", "extraction_index.json"):
            bundle.write(demo.root / name, name)
    archive_report = audit(archive=archive)
    assert source_report["input"]["files_sha256"] == archive_report["input"]["files_sha256"]
    assert {key: value for key, value in source_report.items() if key != "input"} == {
        key: value for key, value in archive_report.items() if key != "input"}
    assert main(["--store", str(demo.root)]) == 0
    assert json.loads(capsys.readouterr().out) == source_report
    output = tmp_path / "outside-store" / "audit.json"
    assert main(["--store", str(demo.root), "--output", str(output)]) == 0
    assert json.loads(output.read_text()) == source_report
    assert fingerprint(demo.root) == before


def test_unavailable_processing_index_is_not_claimed_as_unprocessed(demo):
    demo.path("extraction_index.json").unlink()
    report = audit(store=demo.root)
    assert not report["extraction_index_available"]
    assert report["counts"]["unprocessed_captured_sources"] is None
    assert {row["processing_status"] for row in report["sources"]} == {"not_recorded"}


def test_changed_source_hash_disables_extraction_and_promotion(demo):
    sources = demo.read("sources.json")
    source = next(iter(sources.values()))
    source.update(authority="official", capture_status="supplied", source_type="legal_text")
    source["text"] += " altered capture"
    demo.write("sources.json", sources)
    before = fingerprint(demo.root)
    report = audit(store=demo.root)
    row = report["sources"][0]
    assert row["disposition"] == "invalid_capture"
    assert not row["extraction_allowed"] and not row["operative_allowed"]
    assert report["extraction_review_queue"] == []
    assert report["counts"]["captured_hash_mismatches"] == 1
    assert fingerprint(demo.root) == before


@pytest.mark.parametrize("destination", ["sources.json", "new-audit.json", "nested/audit.json"])
def test_output_cannot_mutate_the_input_store(demo, destination):
    before = fingerprint(demo.root)
    with pytest.raises(SystemExit) as exc:
        main(["--store", str(demo.root), "--output", str(demo.root / destination)])
    assert exc.value.code == 2
    assert fingerprint(demo.root) == before


def test_output_cannot_overwrite_input_archive_or_hardlink(tmp_path):
    archive = tmp_path / "checkpoint.zip"
    archive.write_bytes(CHECKPOINT.read_bytes())
    alias = tmp_path / "alias.json"
    alias.hardlink_to(archive)
    before = archive.read_bytes()
    for output in (archive, alias):
        with pytest.raises(SystemExit):
            main(["--archive", str(archive), "--output", str(output)])
        assert archive.read_bytes() == before


def test_output_cannot_overwrite_a_hardlink_to_other_store_artifacts(demo, tmp_path):
    alias = tmp_path / "outside-but-linked.json"
    alias.hardlink_to(demo.path("dataset.json"))
    before = fingerprint(demo.root)
    with pytest.raises(SystemExit):
        main(["--store", str(demo.root), "--output", str(alias)])
    assert fingerprint(demo.root) == before


def test_duplicate_json_keys_are_rejected_without_writes(demo):
    demo.path("sources.json").write_text('{"duplicate": {}, "duplicate": {}}')
    before = fingerprint(demo.root)
    with pytest.raises(ValueError, match="Duplicate JSON key"):
        audit(store=demo.root)
    assert fingerprint(demo.root) == before


def test_duplicate_archive_members_are_rejected(tmp_path):
    archive = tmp_path / "ambiguous.zip"
    with ZipFile(archive, "w") as bundle:
        bundle.writestr("sources.json", "{}")
        with pytest.warns(UserWarning, match="Duplicate name"):
            bundle.writestr("sources.json", "{}")
        bundle.writestr("rules.json", "{}")
    before = archive.read_bytes()
    with pytest.raises(ValueError, match="Duplicate archive member"):
        audit(archive=archive)
    assert archive.read_bytes() == before
