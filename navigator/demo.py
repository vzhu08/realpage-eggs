"""Explicit synthetic provider fixture. Never used as an extraction fallback."""
from .config import ROOT, pack_dir
from .extraction import extract
from .ingest import ingest_document
from .models import PropertyFacts, RawAddress, JurisdictionResolution
from .store import Store, read_json


def synthetic_bundle(source):
    quote = "Beginning November 15, 2026, residential rental buildings containing at least eight units must limit a security deposit to one month's rent."
    return {"source_kind": "legal_text", "rules": [{"jurisdiction": "Maple Harbor, CA", "level": "city", "category": "security_deposits", "provision_key": "deposit-cap", "title": "Synthetic Maple Harbor deposit cap", "requirement": "Covered buildings must limit security deposits to one month's rent.", "key_value": "one month's rent", "citation": "Maple Harbor Ordinance TEST-42, section 2", "quoted_span": quote, "source_doc_id": source.doc_id, "source_url": source.url,
        "coverage_conditions": {"op": "all", "args": [{"op": "eq", "fact": "residential", "value": True}, {"op": "gte", "fact": "units", "value": 8}]}, "exemption_conditions": {"op": "literal", "value": False}, "exemptions": "None", "lifecycle": "enacted", "effective_date": "2026-11-15", "status_events": [{"status": "enacted", "on": "2026-09-01", "evidence": [{"doc_id": source.doc_id, "quote": "Maple Harbor Ordinance TEST-42, section 2. Enacted September 1, 2026.", "supports": ["lifecycle"]}]}],
        "evidence": [{"doc_id": source.doc_id, "quote": quote, "supports": ["requirement", "key_value", "coverage_conditions", "effective_date"]}, {"doc_id": source.doc_id, "quote": "There are no exemptions to this section. This ordinance applies only within Maple Harbor city limits.", "supports": ["exemptions", "exemption_conditions"]}, {"doc_id": source.doc_id, "quote": "Maple Harbor Ordinance TEST-42, section 2. Enacted September 1, 2026.", "supports": ["lifecycle"]}]}], "negative_findings": [], "issues": []}


class SyntheticProvider:
    mode = "synthetic"
    model = "synthetic-fixture-v1-not-an-LLM"
    usage = []

    def __init__(self, source): self.source = source

    def generate(self, instruction, payload):
        if payload["source_text"] != self.source.text or self.source.capture_status != "synthetic":
            raise ValueError("Synthetic provider only accepts its explicitly labeled synthetic ordinance")
        return synthetic_bundle(self.source)


def build_demo(root):
    store = Store(root)
    if store.read("dataset.json", {}).get("mode") == "real" or any(s.capture_status != "synthetic" for s in store.sources().values()):
        raise ValueError("Demo must use a separate synthetic data directory")
    source = ingest_document(store, ROOT / "fixtures/synthetic_ordinance.txt", "SYNTHETIC-42", "Maple Harbor, CA", "https://example.invalid/synthetic-42", "2026-10-03T00:00:00Z", synthetic=True)
    properties, resolutions = {}, {}
    for ident, units in [("SYNTH-001", 12), ("SYNTH-002", 2), ("SYNTH-003", None)]:
        facts = {"residential": True}
        if units is not None: facts["units"] = units
        raw = RawAddress(street_address=f"{ident[-1]} Test Street", postal_city="Maple Harbor", state="CA")
        properties[ident] = PropertyFacts(address_id=ident, raw_address=raw, normalized_address=f"{ident[-1]} TEST STREET, MAPLE HARBOR, CA, ", facts=facts, provenance={k: "Synthetic fixture" for k in facts}, missing_facts=[] if units else ["units"])
        resolutions[ident] = JurisdictionResolution(address_id=ident, state="CA", municipality="Maple Harbor", match_quality="resolved", method="synthetic_fixture_not_geocoded", unresolved=[])
    store.save_collection("addresses", properties)
    store.save_collection("resolutions", resolutions)
    store.write("dataset.json", {"mode": "synthetic", "label": "SYNTHETIC_NOT_ACTUAL_LAW"})
    schema = read_json(pack_dir() / "schema/rule_record.schema.json") or read_json(ROOT / "contracts/competition_rule.schema.json")
    if schema: store.write("competition_schema.json", schema)
    store.write("change_tests.json", [])
    extract(store, provider=SyntheticProvider(source))
    return store
