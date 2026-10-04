import csv
import re
from pathlib import Path

from .models import Bound, PropertyFacts, RawAddress, SourceDocument, JurisdictionResolution
from .store import Store, digest


def property_from_row(row) -> PropertyFacts:
    raw = RawAddress(**{k: row[k] for k in RawAddress.model_fields})
    provenance = {"state": f"Assessor dataset: {row['source_dataset']}; retrieved {row['retrieved_at']}"}
    facts = {"residential": True}
    provenance["residential"] = "Participant guide: sample of multifamily properties (dataset convention)"
    for key in ("year_built", "units"):
        if row[key].strip():
            value = int(float(row[key]))
            if value > 0:
                facts[key] = value
                provenance[key] = provenance["state"]
    bounds = {}
    description = row["use_description"]
    # Only explicit natural-language descriptions; no decoding assessor abbreviations.
    if "units" not in facts:
        low = None
        if re.search(r"five or more apartments|5\+ units", description, re.I):
            low = 5
        match = re.search(r"(?:Apartment|Flats?|Flat & Store) (\d+) (?:to (\d+) [Uu]nits|[Uu]nits or more)", description)
        if match:
            bounds["units"] = Bound(lower=int(match[1]), upper=int(match[2]) if match[2] else None, provenance=f"Explicit use_description: {description}")
        elif low:
            bounds["units"] = Bound(lower=low, provenance=f"Explicit use_description: {description}")
    return PropertyFacts(address_id=row["address_id"], raw_address=raw,
                         normalized_address=", ".join([raw.street_address.strip().upper(), raw.postal_city.strip().upper(), raw.state, raw.zip]),
                         facts=facts, bounds=bounds, provenance=provenance,
                         missing_facts=[k for k in ("units", "year_built", "certificate_of_occupancy", "owner_type", "owner_occupied", "tenancy_start") if k not in facts])


def ingest_pack(store: Store, pack: Path):
    manifest_path = pack / "corpus/corpus_manifest.csv"
    address_path = pack / "data/sample_addresses.csv"
    if not manifest_path.exists() or not address_path.exists():
        raise ValueError("Participant pack must contain corpus/corpus_manifest.csv and data/sample_addresses.csv")
    run = store.new_run("ingest", input_hashes={"manifest": digest(manifest_path.read_bytes()), "addresses": digest(address_path.read_bytes())})
    sources = store.sources()
    seen_hashes = {}
    for row in csv.DictReader(manifest_path.open(encoding="utf-8-sig", newline="")):
        text_path = (pack / "corpus" / row["text_file"]).resolve() if row["text_file"] else None
        if text_path and not text_path.is_relative_to((pack / "corpus").resolve()):
            raise ValueError("Manifest text path escapes corpus directory")
        raw = text_path.read_bytes() if text_path and text_path.is_file() else b""
        # A local text file does not clear the manifest's access restriction.
        state = "terms_review" if row["capture"] == "check-terms" else "supplied" if raw else "failed" if row["capture"] == "yes" else "link_only"
        actual_hash = digest(raw)
        issues = []
        if raw and row["sha256"] != actual_hash:
            issues.append("Manifest hash differs from delivered file bytes; both retained, original unmodified")
        if not raw:
            issues.append(row["status"] or "No source text supplied")
        source = SourceDocument(doc_id=row["doc_id"], jurisdictions=[j.strip() for j in row["jurisdictions"].split(";")], url=row["url"], retrieved_at=row["retrieved_at"] or None, text=raw.decode("utf-8"), sha256=actual_hash,
                                manifest_sha256=row["sha256"] or None, capture_status=state, authority=row["source_type"], issues=issues,
                                duplicate_of=seen_hashes.get(actual_hash) if raw else None)
        if raw:
            seen_hashes[actual_hash] = source.doc_id
        sources[source.doc_id] = source
    addresses = {p.address_id: p for p in map(property_from_row, csv.DictReader(address_path.open(encoding="utf-8-sig", newline="")))}
    resolutions = store.resolutions()
    for ident, prop in addresses.items():
        resolutions.setdefault(ident, JurisdictionResolution(address_id=ident, state=prop.raw_address.state))
    store.save_collection("sources", sources)
    store.save_collection("addresses", addresses)
    store.save_collection("resolutions", resolutions)
    store.write("change_tests.json", __import__("json").loads((pack / "dev/change_tests.json").read_text(encoding="utf-8")))
    store.write("competition_schema.json", __import__("json").loads((pack / "schema/rule_record.schema.json").read_text(encoding="utf-8")))
    store.write("dataset.json", {"pack": str(pack.resolve()), "mode": "real", "input_hashes": run.input_hashes, "ingest_run_id": run.run_id})
    return store.finish(run, "success", manifest_entries=len(sources), source_texts=sum(bool(s.text) for s in sources.values()), addresses=len(addresses), hash_mismatches=sum(bool(s.text and s.sha256 != s.manifest_sha256) for s in sources.values()))


def ingest_document(store, path, doc_id, jurisdiction, url, retrieved_at, authority="official", synthetic=False):
    raw = Path(path).read_bytes()
    source = SourceDocument(doc_id=doc_id, jurisdictions=[jurisdiction], url=url, retrieved_at=retrieved_at, text=raw.decode("utf-8"), sha256=digest(raw), capture_status="synthetic" if synthetic else "supplementary", authority=authority)
    sources = store.sources()
    if doc_id in sources and sources[doc_id].sha256 != source.sha256:
        raise ValueError("doc_id already exists with different content; use a new version ID")
    sources[doc_id] = source
    store.save_collection("sources", sources)
    return source
