"""Having a file on disk must not silently clear a manifest's access restriction."""
import csv

from navigator.ingest import ingest_pack
from navigator.source_policy import source_use
from navigator.store import Store, digest


def test_supplied_file_preserves_terms_review_and_original_bytes(tmp_path):
    pack = tmp_path / "pack"
    for name in ("corpus", "data", "dev", "schema"):
        (pack / name).mkdir(parents=True)
    text = "Fictional restricted source retained only for provenance.\n"
    path = pack / "corpus/source.txt"
    path.write_text(text, encoding="utf-8")
    row = dict(doc_id="TEST-TERMS", text_file="source.txt", capture="check-terms",
               sha256=digest(text.encode()), status="Access review required",
               jurisdictions="Fictional, ZZ", url="https://example.invalid/source",
               retrieved_at="2026-10-04", source_type="official")
    with (pack / "corpus/corpus_manifest.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(row))
        writer.writeheader()
        writer.writerow(row)
    (pack / "data/sample_addresses.csv").write_text("address_id\n", encoding="utf-8")
    (pack / "dev/change_tests.json").write_text("[]", encoding="utf-8")
    (pack / "schema/rule_record.schema.json").write_text("{}", encoding="utf-8")
    before = {p.relative_to(pack): p.read_bytes() for p in pack.rglob("*") if p.is_file()}
    store = Store(tmp_path / "store")

    ingest_pack(store, pack)

    source = store.sources()[row["doc_id"]]
    assert source.capture_status == "terms_review"
    assert source.text == text and source.sha256 == row["sha256"]
    assert not source_use(source, "legal_text").extraction_allowed
    assert not source_use(source, "legal_text").operative_allowed
    assert before == {p.relative_to(pack): p.read_bytes() for p in pack.rglob("*") if p.is_file()}
