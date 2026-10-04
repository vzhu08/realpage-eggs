"""Build additive handoff records from reviewed captures; never writes a live store."""
from pathlib import Path
import json
from capture import ROOT, save_json

reviews = json.loads((ROOT / "content_review.json").read_text(encoding="utf-8"))
sources = {}
records = []
for path in sorted((ROOT / "records").glob("*.json")):
    record = json.loads(path.read_text(encoding="utf-8"))
    ident = record["doc_id"]
    if record["status"] != "captured_pending_content_review":
        records.append(record)
        continue
    review = reviews[ident]
    record["content_review"] = review
    record["status"] = "captured_agent_checked_core_review_pending"
    text = (ROOT / record["text_path"]).read_bytes().decode("utf-8")
    sources[ident] = {
        "doc_id": ident, "jurisdictions": record["jurisdictions"], "url": record["url"],
        "retrieved_at": record["retrieved_at"], "text": text, "sha256": record["text_sha256"],
        "manifest_sha256": None, "capture_status": "supplementary",
        "authority": record.get("authority", "official"), "source_type": review["role"],
        "issues": ["New acquisition; Core review pending. Not installed in any existing store.",
                   "Text is a derived representation. Raw response identity is retained separately in manifest.json."] + review["caveats"],
        "duplicate_of": None,
    }
    records.append(record)
assert set(reviews) == set(sources)
save_json(ROOT / "sources.json", sources)
save_json(ROOT / "manifest.json", {
    "label": "SUPPLEMENTARY_SOURCE_ACQUISITION_CORE_REVIEW_PENDING",
    "base_commit": "445102a0b0f306f51feae94e1ac3207f025b8a92",
    "capture_date_utc": "2026-10-04", "original_stores_modified": False,
    "captured_documents": len(sources), "failed_attempts": sum(r["status"] == "failed" for r in records),
    "hash_semantics": "Raw hashes identify response bodies; SourceDocument.sha256 identifies separately derived UTF-8 text.",
    "records": records,
})
print(json.dumps({"captured_documents": len(sources), "failed_attempts": sum(r["status"] == "failed" for r in records)}))
