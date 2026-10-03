import httpx

from navigator.geocode import CensusGeocoder
from navigator.ingest import property_from_row
from navigator.store import Store


def response(place=True, cdp=False, state="CA"):
    geos = {"States": [{"STUSAB": state}], "Counties": [{"NAME": "Example County"}]}
    if place: geos["Incorporated Places"] = [{"MTFCC": "G4110", "FUNCSTAT": "A", "GEOID": "123", "BASENAME": "Verified City"}]
    if cdp: geos["Census Designated Places"] = [{"BASENAME": "Postal Town", "MTFCC": "G4210"}]
    return {"result": {"addressMatches": [{"geographies": geos}]}}


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
        return httpx.Response(200, json=response())
    coder = CensusGeocoder(Store(tmp_path), httpx.Client(transport=httpx.MockTransport(handler)))
    result = coder.resolve(prop)
    assert result.method == "census_range_endpoints_agree" and result.municipality == "Verified City"
