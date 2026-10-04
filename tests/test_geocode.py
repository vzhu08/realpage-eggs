import httpx
import pytest
from copy import deepcopy

from navigator.geocode import CensusGeocoder, resolve_addresses
from navigator.ingest import property_from_row
from navigator.store import Store


def response(place=True, cdp=False, state="CA", street="1 Test Street"):
    geos = {"States": [{"STUSAB": state}], "Counties": [{"NAME": "Example County"}]}
    if place: geos["Incorporated Places"] = [{"MTFCC": "G4110", "FUNCSTAT": "A", "GEOID": "123", "BASENAME": "Verified City"}]
    if cdp: geos["Census Designated Places"] = [{"BASENAME": "Postal Town", "MTFCC": "G4210"}]
    return {"result": {"addressMatches": [{"matchedAddress": f"{street}, POSTAL CITY, {state}", "geographies": geos}]}}


def test_legal_place_over_postal_name_and_cached_provenance(tmp_path, prop):
    calls = []
    def handler(request):
        calls.append(str(request.url))
        return httpx.Response(200, json=response())
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(handler)))
    actual = coder.resolve(prop)
    assert actual.municipality == "Verified City"
    assert actual.response_hash and actual.retrieved_at and actual.benchmark
    assert coder.resolve(prop) == actual
    assert len(calls) == 1


def test_cdp_is_not_a_legal_city(tmp_path, prop):
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response(False, True)))))
    result = coder.resolve(prop)
    assert result.municipality is None
    assert result.match_quality == "unresolved"
    assert result.state == "CA"


def test_failure_retains_state_and_does_not_guess(tmp_path, prop):
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(503))))
    result = coder.resolve(prop)
    assert result.match_quality == "failed" and result.state == "CA"
    assert result.municipality is None


def test_conflicting_state_is_ambiguous(tmp_path, prop):
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response(state="NJ")))))
    assert coder.resolve(prop).match_quality == "ambiguous"


def test_assessor_abbreviations_do_not_invent_units():
    base = {"address_id": "X", "street_address": "1 Test St", "postal_city": "Hoboken", "state": "NJ", "zip": "07030", "year_built": "", "units": "", "use_description": "6B-20U-G", "source_dataset": "test", "retrieved_at": "2026-10-01"}
    prop = property_from_row(base)
    assert "units" not in prop.facts and "units" not in prop.bounds
    base["use_description"] = "Alameda County use code (5+ units)"
    assert property_from_row(base).bounds["units"].lower == 5


def test_range_endpoints_must_agree(tmp_path, prop):
    prop.raw_address.street_address = "100-102 Test Street"
    def handler(request):
        if "-" in request.url.params["street"]:
            return httpx.Response(200, json={"result": {"addressMatches": []}})
        return httpx.Response(200, json=response(street=request.url.params["street"]))
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(handler)))
    result = coder.resolve(prop)
    assert result.method == "census_range_endpoints_agree" and result.municipality == "Verified City"


def test_multiple_matches_resolve_only_municipality_with_full_response_provenance(tmp_path, prop):
    body = response()
    duplicate = deepcopy(body["result"]["addressMatches"][0])
    duplicate["geographies"]["Counties"] = [{"NAME": "Another County"}]
    body["result"]["addressMatches"].append(duplicate)
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=body))))
    result = coder.resolve(prop)
    assert result.match_quality == "resolved"
    assert result.method == "census_multiple_matches_agree"
    assert result.county is None
    assert result.identifiers["candidate_count"] == "2"
    attempt = result.attempts[0]
    assert attempt["response_hash"] == result.response_hash
    assert attempt["retrieved_at"] == result.retrieved_at
    assert coder.store.read(f"geocode_cache/{attempt['cache_key']}.json")["response"] == body


@pytest.mark.parametrize("problem", ["different_city", "missing_boundary", "different_state", "missing_identifier", "inactive"])
def test_multiple_matches_cannot_discard_an_unsupported_candidate(tmp_path, prop, problem):
    body = response()
    other = deepcopy(body["result"]["addressMatches"][0])
    geos = other["geographies"]
    if problem == "different_city": geos["Incorporated Places"][0]["GEOID"] = "456"
    elif problem == "missing_boundary": del geos["Incorporated Places"]
    elif problem == "different_state": geos["States"][0]["STUSAB"] = "NJ"
    elif problem == "missing_identifier": del geos["Incorporated Places"][0]["GEOID"]
    elif problem == "inactive": geos["Incorporated Places"][0]["FUNCSTAT"] = "I"
    body["result"]["addressMatches"].append(other)
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=body))))
    result = coder.resolve(prop)
    assert result.match_quality == "ambiguous" and result.municipality is None


def test_ordinal_retry_preserves_house_number_and_original_input(tmp_path, prop):
    prop.raw_address.street_address = "0042 09TH AV"
    before = prop.model_dump()
    calls = []
    def handler(request):
        street = request.url.params["street"]
        calls.append(street)
        body = {"result": {"addressMatches": []}} if street == "0042 09TH AV" else response(street=street)
        return httpx.Response(200, json=body)
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(handler)))
    result = coder.resolve(prop)
    assert result.match_quality == "resolved"
    assert calls == ["0042 09TH AV", "0042 9TH AV"]
    assert [a["street"] for a in result.attempts] == calls
    assert prop.model_dump() == before


@pytest.mark.parametrize("street,matched", [("42.5 Test Street", "5 Test Street"), ("42 1/2 Test Street", "42 Test Street"), ("42 Test Street", "43 Test Street"), ("Test Street", "1 Test Street")])
def test_rewritten_or_missing_house_number_is_not_boundary_evidence(tmp_path, prop, street, matched):
    prop.raw_address.street_address = street
    calls = []
    def handler(request):
        calls.append(request.url.params["street"])
        return httpx.Response(200, json=response(street=matched))
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(handler)))
    result = coder.resolve(prop)
    assert result.match_quality == "ambiguous" and result.municipality is None
    assert calls == [street]


@pytest.mark.parametrize("street,parts,method", [
    ("42-42.5 Test Street", ["42 Test Street", "42.5 Test Street"], "census_range_endpoints_agree"),
    ("42 First Street/43 Second Street", ["42 First Street", "43 Second Street"], "census_compound_addresses_agree"),
])
@pytest.mark.parametrize("outcome", ["agree", "conflict", "no_match", "failed", "fraction_misparsed"])
def test_all_explicit_address_components_are_required(tmp_path, prop, street, parts, method, outcome):
    prop.raw_address.street_address = street
    calls = []
    def handler(request):
        query = request.url.params["street"]
        calls.append(query)
        # Even if the provider reports success for the original, components are checked.
        body = response(street=query)
        if query == parts[1]:
            if outcome == "conflict": body["result"]["addressMatches"][0]["geographies"]["Incorporated Places"][0]["GEOID"] = "456"
            elif outcome == "no_match": body["result"]["addressMatches"] = []
            elif outcome == "failed": return httpx.Response(503)
            elif outcome == "fraction_misparsed": body = response(street="5 Test Street")
        return httpx.Response(200, json=body)
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(handler)))
    result = coder.resolve(prop)
    assert calls == [street, *parts]
    if outcome == "agree":
        assert result.match_quality == "resolved" and result.method == method
        assert "response_cache_key" not in result.identifiers  # Aggregate uses both snapshots.
    else:
        assert result.match_quality == ("failed" if outcome == "failed" else "ambiguous")
        assert result.municipality is None and result.identifiers == {}


def test_retry_preserves_previous_attempts_and_skips_resolved(tmp_path, prop, monkeypatch):
    store = Store(tmp_path)
    other = prop.model_copy(deep=True)
    other.address_id = "ALREADY-RESOLVED"
    store.save_collection("addresses", {p.address_id: p for p in [prop, other]})
    coder = CensusGeocoder(store, httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(200, json=response()))))
    previous = coder.resolve(prop)
    resolved = previous.model_copy(deep=True)
    resolved.address_id = other.address_id
    previous.match_quality = "unresolved"
    previous.municipality = None
    previous.attempts = [{"street": "original spelling", "error": "ReadTimeout"}]
    store.save_collection("resolutions", {prop.address_id: previous, other.address_id: resolved})
    monkeypatch.setattr("navigator.geocode.CensusGeocoder", lambda _: coder)
    run = resolve_addresses(store, retry_unresolved=True)
    actual = store.resolutions()
    assert run.counts["attempted"] == 1 and run.counts["resolved"] == 2
    assert actual[prop.address_id].attempts[0] == previous.attempts[0]
    assert actual[prop.address_id].attempts[1]["response_hash"]
    assert actual[other.address_id] == resolved
