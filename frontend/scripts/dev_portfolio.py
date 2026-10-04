"""UX development fixture: a small fictional portfolio for building the changes UI.

Everything here is fictional and labeled. The source texts in dev_fixture/ describe a
made-up state ("Zenith", code ZZ) and two made-up cities. They exist so the synthetic
demo has more than one jurisdiction, category, date and source to lay out without showing
any real law. The fixture is replayed in demo mode only; the live API never serves it.

What is authored here: the fictional source texts, the fictional properties, the
encodings a provider would return for those texts, and the claim annotations a Core review
would save as source_comparisons.json. What is NOT authored here: any result. Rules are created by the backend's own ingest and extraction path (quotes are
anchored and validated there), and every evaluation, change set, conflict flag, question
and evidence check is computed by the backend, including the anchor and identity checks on each annotated claim.
Nothing in this file is legal evidence.
"""
from __future__ import annotations

from pathlib import Path

from navigator.extraction import extract
from navigator.ingest import ingest_document
from navigator.models import JurisdictionResolution, PropertyFacts, RawAddress
from navigator.retrieval import span as source_span
from navigator.store import Store

SOURCES = Path(__file__).resolve().parent / "dev_fixture"
LABEL = "UX_DEVELOPMENT_FIXTURE_NOT_ACTUAL_LAW"
RETRIEVED_AT = "2026-10-03T00:00:00Z"
PROVENANCE = "UX development fixture (fictional)"

# doc_id -> (jurisdiction, authority). URLs use the reserved .invalid domain.
DOCUMENTS = {
    "DEV-ZZ-ACT-11": ("ZZ", "official"),
    "DEV-CL-ORD-07": ("Cedar Landing, ZZ", "official"),
    "DEV-CL-NOTICE-07": ("Cedar Landing, ZZ", "secondary"),
    "DEV-LP-ORD-03": ("Larch Point, ZZ", "official"),
    "DEV-LP-CODE-03": ("Larch Point, ZZ", "official"),
    "DEV-LP-BILL-19": ("Larch Point, ZZ", "official"),
}


def url(doc_id: str) -> str:
    return f"https://example.invalid/ux-dev-fixture/{doc_id.lower()}"


def _rule(doc_id, quoted, **fields):
    return {"source_doc_id": doc_id, "source_url": url(doc_id), "quoted_span": quoted, **fields}


def _span(doc_id, quote, *supports):
    return {"doc_id": doc_id, "quote": quote, "supports": list(supports)}


RESIDENTIAL = {"op": "eq", "fact": "residential", "value": True}
NO_EXEMPTION = {"op": "literal", "value": False}


def bundles() -> dict[str, dict]:
    """The encoding a provider would return for each fictional source, keyed by document."""
    act, act_quote = "DEV-ZZ-ACT-11", "Beginning January 1, 2027, a landlord of a residential rental property in this State may not collect a security deposit greater than two months' rent."
    act_enacted = "Zenith Tenancy Act 2026, section 4. Enacted June 10, 2026."
    ordinance = "DEV-CL-ORD-07"
    deposit_quote = "Beginning November 1, 2026, residential rental buildings containing at least five units must limit a security deposit to one month's rent."
    deposit_enacted = "Cedar Landing Ordinance DEV-07, section 3. Enacted August 18, 2026."
    interaction_quote = "For buildings containing at least five units, section 3 sets a different limit from the Zenith Tenancy Act 2026, section 4, and this ordinance does not state which limit controls."
    cause_quote = "A landlord of a residential rental building containing at least two units may end a tenancy only for a cause listed in section 5."
    cause_effective = "Section 5 takes effect in December 2026."
    cause_enacted = "Cedar Landing Ordinance DEV-07, section 5. Enacted August 18, 2026."
    exemption_quote = "Section 2 does not apply to an owner-occupied building containing four or fewer units."
    bill, bill_quote = "DEV-LP-BILL-19", "If enacted, a landlord of a residential rental building constructed before 2005 may not increase rent by more than five percent in any twelve-month period."
    bill_status = "Status as of September 22, 2026: pending before the city council and not enacted."

    def fee(doc_id, amount, enacted):
        quote = f"Beginning October 15, 2026, a landlord of a residential rental property may not charge an applicant a screening fee greater than {amount}."
        return _rule(
            doc_id, quote,
            jurisdiction="Larch Point, ZZ", level="city", category="application_screening_fees", provision_key="screening-fee-cap",
            title="Larch Point screening fee cap (fictional)", requirement=f"A landlord may not charge an applicant a screening fee greater than {amount}.", key_value=amount,
            citation="Larch Point Ordinance DEV-03, section 2",
            coverage_conditions=RESIDENTIAL,
            exemption_conditions={"op": "all", "args": [{"op": "eq", "fact": "owner_occupied", "value": True}, {"op": "lte", "fact": "units", "value": 4}]},
            exemptions="Owner-occupied buildings containing four or fewer units",
            lifecycle="enacted", effective_date="2026-10-15",
            status_events=[{"status": "enacted", "on": "2026-09-09", "evidence": [_span(doc_id, enacted, "lifecycle")]}],
            evidence=[_span(doc_id, quote, "requirement", "key_value", "coverage_conditions", "effective_date"), _span(doc_id, exemption_quote, "exemptions", "exemption_conditions"), _span(doc_id, enacted, "lifecycle")],
        )

    return {
        act: {"source_kind": "legal_text", "issues": [], "negative_findings": [], "rules": [_rule(
            act, act_quote,
            jurisdiction="ZZ", level="state", category="security_deposits", provision_key="deposit-cap",
            title="Zenith state deposit cap (fictional)", requirement="A landlord may not collect a security deposit greater than two months' rent.", key_value="two months' rent",
            citation="Zenith Tenancy Act 2026, section 4",
            coverage_conditions=RESIDENTIAL, exemption_conditions=NO_EXEMPTION, exemptions="None",
            lifecycle="enacted", effective_date="2027-01-01",
            status_events=[{"status": "enacted", "on": "2026-06-10", "evidence": [_span(act, act_enacted, "lifecycle")]}],
            evidence=[_span(act, act_quote, "requirement", "key_value", "coverage_conditions", "effective_date"), _span(act, "Section 4 contains no exemptions.", "exemptions", "exemption_conditions"), _span(act, act_enacted, "lifecycle")],
        )]},
        ordinance: {"source_kind": "legal_text", "issues": [], "negative_findings": [], "rules": [
            _rule(
                ordinance, deposit_quote,
                jurisdiction="Cedar Landing, ZZ", level="city", category="security_deposits", provision_key="deposit-cap",
                title="Cedar Landing deposit cap (fictional)", requirement="Covered buildings must limit a security deposit to one month's rent.", key_value="one month's rent",
                citation="Cedar Landing Ordinance DEV-07, section 3",
                coverage_conditions={"op": "all", "args": [RESIDENTIAL, {"op": "gte", "fact": "units", "value": 5}]},
                exemption_conditions=NO_EXEMPTION, exemptions="None",
                lifecycle="enacted", effective_date="2026-11-01",
                status_events=[{"status": "enacted", "on": "2026-08-18", "evidence": [_span(ordinance, deposit_enacted, "lifecycle")]}],
                evidence=[_span(ordinance, deposit_quote, "requirement", "key_value", "coverage_conditions", "effective_date"), _span(ordinance, "There are no exemptions to section 3.", "exemptions", "exemption_conditions"), _span(ordinance, deposit_enacted, "lifecycle")],
                interactions=[{
                    "kind": "conflicts_with", "target_citation": "Zenith Tenancy Act 2026, section 4", "target_jurisdiction": "ZZ", "category": "security_deposits",
                    "scope": {"op": "gte", "fact": "units", "value": 5},
                    "evidence": [_span(ordinance, interaction_quote, "interactions")],
                    "note": "The ordinance sets a different deposit limit and does not state which limit controls",
                }],
            ),
            _rule(
                ordinance, cause_quote,
                jurisdiction="Cedar Landing, ZZ", level="city", category="just_cause_eviction", provision_key="just-cause",
                title="Cedar Landing just-cause requirement (fictional)", requirement="A landlord may end a tenancy only for a cause listed in section 5.", key_value=None,
                citation="Cedar Landing Ordinance DEV-07, section 5",
                coverage_conditions={"op": "all", "args": [RESIDENTIAL, {"op": "gte", "fact": "units", "value": 2}]},
                exemption_conditions=NO_EXEMPTION, exemptions="None",
                # The source states a month, not a day. The precision is kept as written.
                lifecycle="enacted", effective_date="2026-12",
                status_events=[{"status": "enacted", "on": "2026-08-18", "evidence": [_span(ordinance, cause_enacted, "lifecycle")]}],
                evidence=[_span(ordinance, cause_quote, "requirement", "coverage_conditions"), _span(ordinance, cause_effective, "effective_date"), _span(ordinance, "There are no exemptions to section 5.", "exemptions", "exemption_conditions"), _span(ordinance, cause_enacted, "lifecycle")],
            ),
        ]},
        # Two captured documents give different amounts for the same section. The backend keeps
        # both and flags the conflict itself (navigator.extraction.merge_rules); nothing here picks one.
        "DEV-LP-ORD-03": {"source_kind": "legal_text", "issues": [], "negative_findings": [], "rules": [fee("DEV-LP-ORD-03", "$35", "Larch Point Ordinance DEV-03, section 2. Enacted September 9, 2026.")]},
        "DEV-LP-CODE-03": {"source_kind": "legal_text", "issues": [], "negative_findings": [], "rules": [fee("DEV-LP-CODE-03", "$50", "Larch Point Municipal Code, codified text of Larch Point Ordinance DEV-03, section 2. Enacted September 9, 2026.")]},
        bill: {"source_kind": "status_record", "issues": [], "negative_findings": [], "rules": [_rule(
            bill, bill_quote,
            jurisdiction="Larch Point, ZZ", level="city", category="rent_increase_limits", provision_key="annual-increase-cap",
            title="Larch Point proposed rent increase limit (fictional)", requirement="A landlord may not increase rent by more than five percent in any twelve-month period.", key_value="five percent in any twelve-month period",
            citation="Larch Point Proposed Ordinance DEV-19, section 1",
            coverage_conditions={"op": "all", "args": [RESIDENTIAL, {"op": "lt", "fact": "year_built", "value": 2005}]},
            exemption_conditions=NO_EXEMPTION, exemptions="None",
            lifecycle="pending", status_as_of="2026-09-22",
            status_events=[{"status": "pending", "on": "2026-09-22", "evidence": [_span(bill, bill_status, "lifecycle")]}],
            evidence=[_span(bill, bill_quote, "requirement", "key_value", "coverage_conditions"), _span(bill, "The proposal lists no exemptions to section 1.", "exemptions", "exemption_conditions"), _span(bill, bill_status, "lifecycle", "status_as_of")],
        )]},
        # The clerk's notice is captured as a source but encodes no rule.
        "DEV-CL-NOTICE-07": {"source_kind": "secondary", "issues": [], "negative_findings": [], "rules": []},
    }


class DevFixtureProvider:
    """Returns the fixed encodings above. Not a model; refuses anything but the fixture texts."""
    mode = "synthetic"
    model = "ux-dev-fixture-v1-not-an-LLM"
    usage: list = []

    def __init__(self, sources):
        self.sources, self.bundles = sources, bundles()

    def generate(self, instruction, payload):
        source = self.sources.get(payload["doc_id"])
        if source is None or source.capture_status != "synthetic" or payload["source_text"] != source.text:
            raise ValueError("The development provider only accepts its labeled fixture texts")
        return self.bundles[source.doc_id]


# (id, street, municipality or None, match quality, facts)
PROPERTIES = [
    ("DEV-P01", "12 Alder Row", "Cedar Landing", "resolved", {"units": 12}),
    ("DEV-P02", "40 Alder Row", "Cedar Landing", "resolved", {"units": 6}),
    ("DEV-P03", "7 Birch Court", "Cedar Landing", "resolved", {"units": 3}),
    ("DEV-P04", "19 Birch Court", "Cedar Landing", "resolved", {}),
    ("DEV-P05", "88 Canal Street", "Cedar Landing", "resolved", {"units": 5}),
    ("DEV-P06", "3 Dune Lane", "Larch Point", "resolved", {"units": 3, "owner_occupied": True, "year_built": 1996}),
    ("DEV-P07", "25 Dune Lane", "Larch Point", "resolved", {"units": 8, "owner_occupied": False, "year_built": 1988}),
    ("DEV-P08", "61 Ember Road", "Larch Point", "resolved", {"units": 4, "year_built": 2010}),
    ("DEV-P09", "70 Ember Road", "Larch Point", "resolved", {"units": 20, "owner_occupied": False, "year_built": 2001}),
    ("DEV-P10", "5 Fern Close", "Larch Point", "resolved", {}),
    ("DEV-P11", "14 Gable Street", "Port Alder", "resolved", {"units": 10}),
    ("DEV-P12", "2 Gable Street", "Port Alder", "resolved", {"units": 2}),
    ("DEV-P13", "33 Harbor View", None, "unresolved", {"units": 9}),
    ("DEV-P14", "90 Harbor View", None, "ambiguous", {"units": 6}),
]
POSTAL_CITY = {"DEV-P13": "Cedar Landing", "DEV-P14": "Larch Point"}
QUESTION_FACTS = ("units", "owner_occupied", "year_built")


def build_dev_portfolio(root) -> Store:
    store = Store(root)
    for doc_id, (jurisdiction, authority) in DOCUMENTS.items():
        ingest_document(store, SOURCES / f"{doc_id}.txt", doc_id, jurisdiction, url(doc_id), RETRIEVED_AT, authority=authority, synthetic=True)
    properties, resolutions = {}, {}
    for ident, street, municipality, quality, given in PROPERTIES:
        facts = {"residential": True, **given}
        city = municipality or POSTAL_CITY[ident]
        properties[ident] = PropertyFacts(
            address_id=ident, raw_address=RawAddress(street_address=street, postal_city=city, state="ZZ"),
            normalized_address=f"{street.upper()}, {city.upper()}, ZZ, ", facts=facts,
            provenance={name: PROVENANCE for name in facts}, missing_facts=[name for name in QUESTION_FACTS if name not in facts],
        )
        resolutions[ident] = JurisdictionResolution(
            address_id=ident, state="ZZ", municipality=municipality, match_quality=quality, method="ux_dev_fixture_not_geocoded",
            unresolved=[] if quality == "resolved" else ["Legal municipality not resolved (fictional example of an unresolved location)"],
        )
    store.save_collection("addresses", properties)
    store.save_collection("resolutions", resolutions)
    store.write("dataset.json", {"mode": "synthetic", "label": LABEL})
    store.write("change_tests.json", [])
    run = extract(store, provider=DevFixtureProvider(store.sources()))
    index = store.read("extraction_index.json", {})
    failed = {doc: entry for doc, entry in index.items() if entry.get("status") == "failed"}
    if failed:
        raise RuntimeError(f"Development fixture did not pass the backend's extraction validation: {failed}")
    write_claim_annotations(store)
    return store


def write_claim_annotations(store: Store) -> None:
    """Save fictional claim annotations in the shape Core saves as source_comparisons.json.

    GET /api/v1/source-comparisons re-checks every span against the stored source and classifies
    the pair itself; nothing here states a classification, a winner or a remedy. Offsets and
    hashes are read from the stored fixture texts, never typed by hand. The four rows give the
    comparison view one of each outcome to lay out: two supported claims that differ (twice),
    two supported claims that agree, and a claim with no captured support on one side.
    """
    sources, rules = store.sources(), store.rules()

    def support(doc_id, quote):
        text = sources[doc_id].text
        start = text.find(quote)
        if start < 0 or text.find(quote, start + 1) >= 0:
            raise RuntimeError(f"Fixture quote must occur exactly once in {doc_id}")
        return {"span": source_span(sources[doc_id], start, start + len(quote)).model_dump(mode="json")}

    def rule_ids(citation):
        return sorted(ident for ident, rule in rules.items() if rule.citation == citation)

    deposit = "Cedar Landing Ordinance DEV-07, section 3"
    fee = "Larch Point Ordinance DEV-03, section 2"
    bill = "Larch Point Proposed Ordinance DEV-19, section 1"
    rows = {
        "cedar_landing_deposit_effective_date": {
            "field": "effective_date", "rule_ids": rule_ids(deposit),
            "before": {"value": "2026-11-01", "support": [support("DEV-CL-ORD-07", "Beginning November 1, 2026, residential rental buildings containing at least five units must limit a security deposit to one month's rent.")]},
            "after": {"value": "2026-12-01", "support": [support("DEV-CL-NOTICE-07", "The clerk's office advises that section 3 of Ordinance DEV-07, the security deposit limit, takes effect on December 1, 2026.")]},
        },
        "larch_point_screening_fee_amount": {
            "field": "key_value", "rule_ids": rule_ids(fee),
            "before": {"value": "$35", "support": [support("DEV-LP-ORD-03", "Beginning October 15, 2026, a landlord of a residential rental property may not charge an applicant a screening fee greater than $35.")]},
            "after": {"value": "$50", "support": [support("DEV-LP-CODE-03", "Beginning October 15, 2026, a landlord of a residential rental property may not charge an applicant a screening fee greater than $50.")]},
        },
        "larch_point_screening_fee_enactment": {
            "field": "enactment_date", "rule_ids": rule_ids(fee),
            "before": {"value": "2026-09-09", "support": [support("DEV-LP-ORD-03", "Larch Point Ordinance DEV-03, section 2. Enacted September 9, 2026.")]},
            "after": {"value": "2026-09-09", "support": [support("DEV-LP-CODE-03", "Larch Point Municipal Code, codified text of Larch Point Ordinance DEV-03, section 2. Enacted September 9, 2026.")]},
        },
        "larch_point_rent_limit_enactment": {
            "field": "lifecycle", "rule_ids": rule_ids(bill),
            "before": {"value": "pending as of 2026-09-22", "support": [support("DEV-LP-BILL-19", "Status as of September 22, 2026: pending before the city council and not enacted.")]},
            "after": {"value": "enactment not established", "support": []},
        },
    }
    store.write("source_comparisons.json", {"authored_by": "UX lane development fixture (fictional); not Core A output", "applied_to_saved_sources": rows})
