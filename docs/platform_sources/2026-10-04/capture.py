"""One-off official-source acquisition; no models, rule extraction or store mutation.

Run with Python 3.12+ and pypdf installed. Optional positional IDs limit requests.
Completed captures are immutable; use a new directory for subsequent versions.
"""
from datetime import datetime, timezone
from hashlib import sha256
from html.parser import HTMLParser
from pathlib import Path
import json
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent


def digest(raw):
    return sha256(raw).hexdigest()


def save_json(path, value):
    path.write_bytes((json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))


class VisibleText(HTMLParser):
    """Deterministic visible-text derivative; raw HTML remains authoritative."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.hidden = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript"}:
            self.hidden += 1
        if not self.hidden and tag in {"p", "br", "div", "tr", "li", "h1", "h2", "h3", "h4", "section", "td", "th"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript"}:
            self.hidden = max(0, self.hidden - 1)
        if not self.hidden and tag in {"p", "div", "tr", "li", "h1", "h2", "h3", "h4", "section", "td", "th"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)

    def result(self):
        return "\n".join(line.strip() for line in "".join(self.parts).splitlines() if line.strip()) + "\n"


def derive(raw, kind, charset="utf-8"):
    if kind == "pdf":
        import io
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(raw))
        text = "\n\f\n".join(page.extract_text() or "" for page in reader.pages) + "\n"
        return text, {"method": "pypdf.PdfReader.extract_text", "version": pypdf.__version__, "pages": len(reader.pages)}
    parser = VisibleText()
    parser.feed(raw.decode(charset))
    return parser.result(), {"method": "capture.py VisibleText HTMLParser", "charset": charset}


def main():
    requests = json.loads((ROOT / "requests.json").read_text(encoding="utf-8"))
    requests += json.loads((ROOT / "additional_requests.json").read_text(encoding="utf-8"))
    selected = set(sys.argv[1:])
    if selected - {row["doc_id"] for row in requests}:
        raise ValueError("Unknown capture ID")
    for sub in ["raw", "text", "records"]:
        (ROOT / sub).mkdir(exist_ok=True)
    for row in requests:
        ident = row["doc_id"]
        record_path = ROOT / "records" / (ident + ".json")
        if (selected and ident not in selected) or record_path.exists():
            continue
        record = {**row, "attempted_at": datetime.now(timezone.utc).isoformat(), "status": "failed"}
        try:
            headers = {"Accept-Encoding": "identity"}
            if row.get("user_agent", "Mozilla/5.0 (official document research)"):
                headers["User-Agent"] = row.get("user_agent", "Mozilla/5.0 (official document research)")
            record["request_headers"] = headers
            request = urllib.request.Request(row["url"], headers=headers)
            with urllib.request.urlopen(request, timeout=45) as response:
                raw = response.read()
                record.update({"http_status": response.status, "final_url": response.url,
                    "retrieved_at": datetime.now(timezone.utc).isoformat(),
                    "headers": {k: response.headers[k] for k in ["Content-Type", "Last-Modified", "ETag", "Date"] if k in response.headers}})
                charset = response.headers.get_content_charset() or "utf-8"
            kind = "pdf" if raw.startswith(b"%PDF-") else "html"
            raw_path = ROOT / "raw" / (ident + "." + kind)
            raw_path.write_bytes(raw)
            record.update({"raw_path": raw_path.relative_to(ROOT).as_posix(), "raw_sha256": digest(raw), "raw_bytes": len(raw)})
            text, method = derive(raw, kind, charset)
            text_raw = text.encode("utf-8")
            text_path = ROOT / "text" / (ident + ".txt")
            text_path.write_bytes(text_raw)
            record.update({"text_path": text_path.relative_to(ROOT).as_posix(), "text_sha256": digest(text_raw),
                "text_characters": len(text), "derivation": method, "status": "captured_pending_content_review"})
        except Exception as exc:
            record["error"] = str(exc)
        save_json(record_path, record)
        print(ident, record["status"], record.get("raw_bytes", 0), record.get("error", ""), flush=True)


if __name__ == "__main__":
    main()
