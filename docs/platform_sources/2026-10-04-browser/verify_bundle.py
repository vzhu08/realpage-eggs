"""Verify preserved browser evidence offline; this is not legal validation."""
from pathlib import Path
import hashlib
import json
from pypdf import PdfReader

root = Path(__file__).resolve().parent
manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
for entry in manifest["files"]:
    payload = (root / entry["path"]).read_bytes()
    assert len(payload) == entry["bytes"], entry["path"]
    assert hashlib.sha256(payload).hexdigest() == entry["sha256"], entry["path"]
captures = json.loads((root / "captures.json").read_text(encoding="utf-8"))
assert len(captures) == 13
for capture in captures:
    assert capture["url"].startswith("https://")
    assert capture["captured_at"].endswith("Z")
    for field in ("text", "file"):
        if field in capture:
            assert (root / capture[field]).is_file(), capture["id"]
    assert "html" not in capture
assert not list(root.glob("*.html")), "Keep token-bearing browser HTML private"
expected = {"HOB_B781_PRINTOUT": 3, "JC_25_057_ADOPTION_NOTICE": 1,
            "JC_25_098_ADOPTION_NOTICE": 1, "JC_25_105_ADOPTION_NOTICE": 1}
for stem, pages in expected.items():
    path = root / (stem + ".pdf")
    assert path.read_bytes().startswith(b"%PDF-")
    reader = PdfReader(path)
    assert len(reader.pages) == pages
    text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    assert text == (root / (stem + ".extracted.txt")).read_text(encoding="utf-8")
full = (root / "MA_SJC_13893_DOCKET.txt").read_text(encoding="utf-8")
county = (root / "MA_SJ_2026_0063_DOCKET.txt").read_text(encoding="utf-8")
assert "SJC-13893" in full and "SJ-2026-0063" in full
assert "06/23/2026" in full and "RESCRIPT ISSUED to trial court." in full
assert "SJ-2026-0063" in county and "07/21/2026" in county
assert "Declaratory Judgment In Accordance with the Rescript Opinion, as on file." in county
assert "Disposed: judgment after rescrpt" in county
print(f"PASS: {len(manifest['files'])} preserved payload hashes; 13 captures; 4 PDFs / 6 pages; text reproduction and docket entries")
