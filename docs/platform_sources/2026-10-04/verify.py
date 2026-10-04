"""Offline delivery verification. --derive-only uses Python with pypdf installed."""
import json
from pathlib import Path
import sys
from capture import ROOT, derive, digest

manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
sources = json.loads((ROOT / "sources.json").read_text(encoding="utf-8"))
if "--derive-only" not in sys.argv:
    sys.path.insert(0, str(ROOT.parents[2]))
    from navigator.models import SourceDocument

verified = []
failed = []
for row in manifest["records"]:
    ident = row["doc_id"]
    if row["status"] == "failed":
        assert ident not in sources and row.get("error"), ident
        failed.append(ident)
        continue
    raw_path, text_path = ROOT / row["raw_path"], ROOT / row["text_path"]
    assert raw_path.resolve().is_relative_to(ROOT) and text_path.resolve().is_relative_to(ROOT)
    raw, text_raw = raw_path.read_bytes(), text_path.read_bytes()
    assert digest(raw) == row["raw_sha256"], ident
    assert digest(text_raw) == row["text_sha256"], ident
    assert len(raw) == row["raw_bytes"], ident
    text = text_raw.decode("utf-8")
    assert text and len(text) == row["text_characters"] and "\ufffd" not in text, ident
    assert row["http_status"] == 200 and row["content_review"]["checks"], ident
    if "--derive-only" in sys.argv:
        regenerated, method = derive(raw, raw_path.suffix[1:], row["derivation"].get("charset", "utf-8"))
        assert regenerated.encode("utf-8") == text_raw, ident
        assert method == row["derivation"], ident
    else:
        source = SourceDocument.model_validate(sources[ident])
        assert source.text == text and source.sha256 == digest(text_raw), ident
        assert source.retrieved_at == row["retrieved_at"] and source.url == row["url"], ident
        assert source.capture_status == "supplementary" and source.issues, ident
    verified.append(ident)
assert set(verified) == set(sources)
assert len(verified) == manifest["captured_documents"]
assert len(failed) == manifest["failed_attempts"]
print(json.dumps({"verified_documents": len(verified), "recorded_failed_attempts": len(failed),
                  "derivatives_reproduced": "--derive-only" in sys.argv, "network_calls": 0}))
