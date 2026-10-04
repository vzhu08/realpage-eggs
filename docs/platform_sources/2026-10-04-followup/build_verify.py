"""Verify follow-up capture identity and publish only the substantive NJ authority."""
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT.parent / "2026-10-04"))
from capture import derive, digest, save_json

records = [json.loads(path.read_text(encoding="utf-8")) for path in sorted((ROOT / "records").glob("*.json"))]
for row in records:
    if row["status"] == "failed":
        continue
    raw = (ROOT / row["raw_path"]).read_bytes()
    text = (ROOT / row["text_path"]).read_bytes()
    assert digest(raw) == row["raw_sha256"] and digest(text) == row["text_sha256"]
    regenerated, method = derive(raw, Path(row["raw_path"]).suffix[1:], row["derivation"].get("charset", "utf-8"))
    assert regenerated.encode("utf-8") == text and method == row["derivation"]
    row["role"] = "substantive statutory authority" if row["doc_id"] == "P12_NJ_CHARTER" else "access/provenance record, not target legal evidence"
row = next(row for row in records if row["doc_id"] == "P12_NJ_CHARTER")
text = (ROOT / row["text_path"]).read_bytes().decode("utf-8")
assert "40:69A-181" in text and "twenty days" in text
source = {"doc_id": row["doc_id"], "jurisdictions": ["NJ"], "url": row["url"],
          "retrieved_at": row["retrieved_at"], "text": text, "sha256": row["text_sha256"],
          "manifest_sha256": None, "capture_status": "supplementary", "authority": "official",
          "source_type": "statutory_compilation", "duplicate_of": None,
          "issues": ["Reference compilation, not an ordinance-specific publication record or effective-date finding.",
                     "Section 40:69A-181 on PDF page 49 contains conditions and exceptions; Core must assess applicability/version.",
                     "Full 57-page compilation contains unrelated provisions; do not run full-document paid extraction for this targeted request.",
                     "Separately derived PDF text; raw response hash retained in manifest."]}
save_json(ROOT / "sources.json", {row["doc_id"]: source})
save_json(ROOT / "manifest.json", {"label": "PARTIAL_SOURCE_FOLLOWUP_NOT_CLOSED", "records": records,
    "captured_responses": 5, "failed_docket_attempts": 2,
    "substantive_new_source_documents": 1, "original_sources_changed": False,
    "county_docket_candidate": "SJ-2026-0063 came only from search-index text; unverified. Confirm originating case via SJC-13893.",
    "limits": ["Empty archive search is not proof of no judgment.", "Hoboken notice filter still displayed 2026; does not cover 2025.",
               "Actual municipal publication/effectiveness proof and official docket verification remain open."]})
print(json.dumps({"raw_text_pairs_verified": 5, "derivatives_reproduced": 5, "substantive_sources": 1, "failed_access_attempts": 2}))
