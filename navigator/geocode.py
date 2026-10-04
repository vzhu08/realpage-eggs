"""Census geographic lookup; a mailing city is never used as a legal municipality."""
import os
import re
from concurrent.futures import ThreadPoolExecutor

import httpx

from .models import JurisdictionResolution
from .store import Store, digest, now

ENDPOINT = "https://geocoding.geo.census.gov/geocoder/geographies/address"
STATE_FIPS = {"06": "CA", "25": "MA", "34": "NJ"}


def street_variants(street):
    """Remove padding only from street ordinals, never from house numbers."""
    normalized = re.sub(r"(?<=\s)0+([1-9]\d*(?:ST|ND|RD|TH))\b", r"\1", street, flags=re.I)
    return list(dict.fromkeys([street, normalized]))


def address_parts(street):
    number = r"\d+(?:\.\d+| \d+/\d+)?"
    address_range = re.fullmatch(rf"({number})-({number})\s+(.+)", street)
    if address_range:
        return "range_endpoints", [f"{n} {address_range[3]}" for n in address_range.groups()[:2]]
    # Require two explicit numbered streets; a fraction is not a compound address.
    compound = re.fullmatch(r"(\d+[A-Za-z]?\s+[A-Za-z][^/]+)/\s*(\d+[A-Za-z]?\s+[A-Za-z][^/]+)", street)
    if compound:
        return "compound_addresses", [s.strip() for s in compound.groups()]
    return None, []


def house_number(street):
    match = re.match(r"^(\d+(?:\.\d+|\s+\d+/\d+)?[A-Za-z]?)(?=\s)", street.strip())
    return re.sub(r"\s+", " ", match[1]).upper() if match else None


def municipalities_agree(results):
    return bool(results) and all(r.match_quality == "resolved" for r in results) and len({
        (r.state, r.identifiers.get("municipality_geoid"), r.identifiers.get("geography_type"))
        for r in results
    }) == 1


class CensusGeocoder:
    def __init__(self, store: Store, client=None):
        self.store = store
        self.client = client or httpx.Client(timeout=25)
        self.benchmark = os.getenv("CENSUS_BENCHMARK", "Public_AR_Current")
        self.vintage = os.getenv("CENSUS_VINTAGE", "Current_Current")

    def request(self, raw, street, zip_code):
        params = {"street": street, "city": raw.postal_city, "state": raw.state, "zip": zip_code, "benchmark": self.benchmark, "vintage": self.vintage, "layers": "States,Counties,Incorporated Places,County Subdivisions", "format": "json"}
        key = digest(params)
        cached = self.store.read(f"geocode_cache/{key}.json")
        if cached:
            return cached["response"], cached["retrieved_at"], key
        response = self.client.get(ENDPOINT, params=params)
        response.raise_for_status()
        body = response.json()
        if "result" not in body or "addressMatches" not in body["result"]:
            raise ValueError("Invalid Census response")
        timestamp = now()
        self.store.write(f"geocode_cache/{key}.json", {"params": params, "retrieved_at": timestamp, "response": body})
        return body, timestamp, key

    def parse(self, prop, body, timestamp, key, street=None):
        matches = body["result"]["addressMatches"]
        base = dict(address_id=prop.address_id, state=prop.raw_address.state, benchmark=self.benchmark, vintage=self.vintage, retrieved_at=timestamp, response_hash=digest(body), method="census_geographies")
        if not matches:
            return JurisdictionResolution(**base, unresolved=["No Census address match"])
        # Census can silently read a fractional/range address as another house number.
        if street is not None and (house_number(street) is None or any(
            house_number(m.get("matchedAddress", "")) != house_number(street) for m in matches
        )):
            return JurisdictionResolution(**base, match_quality="ambiguous", unresolved=["Census matched house number does not preserve the requested address"])
        candidates = [self.parse_match(prop, match, base, key) for match in matches]
        if len(candidates) == 1:
            return candidates[0]
        if not municipalities_agree(candidates):
            return JurisdictionResolution(**base, match_quality="ambiguous", unresolved=["Multiple Census matches do not all establish the same active legal municipality"])
        result = candidates[0]
        result.method = "census_multiple_matches_agree"
        result.identifiers["candidate_count"] = str(len(matches))
        if len({c.county for c in candidates}) != 1:
            result.county = None
        return result

    def parse_match(self, prop, match, base, key):
        geos = match.get("geographies", {})
        states = geos.get("States", [])
        resolved_state = states[0].get("STUSAB") or STATE_FIPS.get(states[0].get("STATE")) if len(states) == 1 else None
        if resolved_state != prop.raw_address.state:
            return JurisdictionResolution(**base, match_quality="ambiguous", unresolved=["Census state is absent or contradicts assessor state; retain assessor state only"])
        counties = geos.get("Counties", [])
        places = [g for g in geos.get("Incorporated Places", []) if g.get("MTFCC") == "G4110" and g.get("FUNCSTAT") in {"A", "B", "C"}]
        # Legal municipalities in MA/NJ may be represented as active county subdivisions.
        if not places and resolved_state in {"MA", "NJ"}:
            places = [g for g in geos.get("County Subdivisions", []) if g.get("MTFCC") == "G4040" and g.get("FUNCSTAT") == "A" and g.get("LSADC") in {"21", "25", "43", "44", "47"}]
        if len(places) != 1:
            return JurisdictionResolution(**base, county=counties[0].get("NAME") if len(counties) == 1 else None, unresolved=["No unique active legal municipality in returned Census boundaries"])
        place = places[0]
        municipality = place.get("BASENAME") or re.sub(r" (city|town|township|borough)$", "", place.get("NAME", ""), flags=re.I)
        if not municipality or not place.get("GEOID"):
            return JurisdictionResolution(**base, unresolved=["Census municipality lacks a name or geographic identifier"])
        return JurisdictionResolution(**base, county=counties[0].get("NAME") if len(counties) == 1 else None, municipality=municipality, identifiers={"municipality_geoid": str(place["GEOID"]), "geography_type": place["MTFCC"], "response_cache_key": key}, match_quality="resolved", unresolved=[])

    def resolve(self, prop):
        raw = prop.raw_address
        attempts = []

        def lookup(street_address, purpose):
            last = JurisdictionResolution(address_id=prop.address_id, state=raw.state)
            for street in street_variants(street_address):
                for zip_code in dict.fromkeys([raw.zip, ""]):
                    try:
                        body, timestamp, key = self.request(raw, street, zip_code)
                        last = self.parse(prop, body, timestamp, key, street)
                        attempts.append({"street": street, "zip": zip_code, "purpose": purpose,
                                         "cache_key": key, "quality": last.match_quality,
                                         "response_hash": last.response_hash, "retrieved_at": timestamp,
                                         "method": last.method, "unresolved": last.unresolved,
                                         "candidate_count": len(body["result"]["addressMatches"])})
                        if last.match_quality == "resolved":
                            return last
                    except (httpx.HTTPError, ValueError, KeyError) as exc:
                        attempts.append({"street": street, "zip": zip_code, "purpose": purpose, "error": type(exc).__name__})
                        return JurisdictionResolution(address_id=prop.address_id, state=raw.state,
                                                      match_quality="failed", unresolved=["Census request failed; cached/state-level facts remain available"])
            return last

        last = lookup(raw.street_address, "original_address")
        kind, parts = address_parts(raw.street_address)
        if parts and last.match_quality != "failed":
            # Even a successful raw range/compound match may cover only its last number.
            candidates = [lookup(street, kind) for street in parts]
            if municipalities_agree(candidates):
                last = candidates[0].model_copy(deep=True)
                last.method = f"census_{kind}_agree"
                last.response_hash = digest([c.response_hash for c in candidates])
                last.retrieved_at = max(c.retrieved_at for c in candidates)
                last.identifiers = {k: v for k, v in last.identifiers.items() if k in {"municipality_geoid", "geography_type"}}
                if len({c.county for c in candidates}) != 1:
                    last.county = None
            else:
                last = JurisdictionResolution(address_id=prop.address_id, state=raw.state,
                                              benchmark=self.benchmark, vintage=self.vintage,
                                              match_quality="failed" if any(c.match_quality == "failed" for c in candidates) else "ambiguous",
                                              unresolved=["Address components do not all establish one legal municipality"])
        last.attempts = attempts
        return last


def resolve_addresses(store, limit=None, workers=4, retry_unresolved=False):
    props = store.addresses()
    if not props: raise ValueError("Dataset absent; run ingest first")
    existing = store.resolutions()
    selected = [p for k, p in sorted(props.items()) if k not in existing or existing[k].match_quality != "resolved"][:limit]
    if not retry_unresolved:
        selected = [p for p in selected if not existing.get(p.address_id) or not existing[p.address_id].attempts]
    geocoder = CensusGeocoder(store)
    run = store.new_run("geocode", "live", input_hashes={"addresses": digest({k: p.model_dump() for k, p in props.items()})}, config={"workers": max(1, min(workers, 8)), "benchmark": geocoder.benchmark, "vintage": geocoder.vintage, "cache_policy": "immutable request snapshots; Current identifiers can change upstream"})
    try:
        with ThreadPoolExecutor(max_workers=max(1, min(workers, 8))) as pool:
            for result in pool.map(geocoder.resolve, selected):
                previous = existing.get(result.address_id)
                if previous:
                    result.attempts = previous.attempts + [a for a in result.attempts if a not in previous.attempts]
                existing[result.address_id] = result
                store.save_collection("resolutions", existing)
        failed = sum(r.match_quality == "failed" for r in existing.values())
        unresolved = sum(r.match_quality != "resolved" for r in existing.values())
        return store.finish(run, "partial" if unresolved else "success", attempted=len(selected), resolved=len(existing)-unresolved, unresolved=unresolved, failed=failed)
    except Exception as exc:
        run.errors.append(f"Geocoding interrupted: {type(exc).__name__}; completed responses remain cached")
        store.finish(run, "failed", attempted=len(selected))
        raise
    finally:
        geocoder.client.close()
