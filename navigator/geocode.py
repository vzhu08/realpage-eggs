"""Census geographic lookup; a mailing city is never used as a legal municipality."""
import os
import re
from concurrent.futures import ThreadPoolExecutor

import httpx

from .models import JurisdictionResolution
from .store import Store, digest, now

ENDPOINT = "https://geocoding.geo.census.gov/geocoder/geographies/address"
STATE_FIPS = {"06": "CA", "25": "MA", "34": "NJ"}


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

    def parse(self, prop, body, timestamp, key):
        matches = body["result"]["addressMatches"]
        base = dict(address_id=prop.address_id, state=prop.raw_address.state, benchmark=self.benchmark, vintage=self.vintage, retrieved_at=timestamp, response_hash=digest(body), method="census_geographies")
        if len(matches) != 1:
            return JurisdictionResolution(**base, match_quality="ambiguous" if len(matches) > 1 else "unresolved", unresolved=["Multiple Census matches" if matches else "No Census address match"])
        match = matches[0]
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
        municipality = place.get("BASENAME") or re.sub(r" (city|town|township|borough)$", "", place["NAME"], flags=re.I)
        return JurisdictionResolution(**base, county=counties[0].get("NAME") if len(counties) == 1 else None, municipality=municipality, identifiers={"municipality_geoid": str(place["GEOID"]), "geography_type": place["MTFCC"], "response_cache_key": key}, match_quality="resolved", unresolved=[])

    def resolve(self, prop):
        raw = prop.raw_address
        variants = [(raw.street_address, raw.zip)]
        if raw.zip: variants.append((raw.street_address, ""))
        attempts = []
        last = JurisdictionResolution(address_id=prop.address_id, state=raw.state)
        for street, zip_code in variants:
            try:
                body, timestamp, key = self.request(raw, street, zip_code)
                last = self.parse(prop, body, timestamp, key)
                attempts.append({"street": street, "zip": zip_code, "cache_key": key, "quality": last.match_quality})
                if last.match_quality == "resolved":
                    last.attempts = attempts
                    return last
            except (httpx.HTTPError, ValueError, KeyError) as exc:
                attempts.append({"street": street, "zip": zip_code, "error": type(exc).__name__})
                last.match_quality = "failed"
                last.unresolved = ["Census request failed; cached/state-level facts remain available"]
                break
        address_range = re.match(r"^(\d+)-(\d+)\s+(.+)$", raw.street_address)
        if address_range and last.match_quality != "failed":
            candidates = []
            for number in address_range.groups()[:2]:
                street = f"{number} {address_range[3]}"
                try:
                    body, timestamp, key = self.request(raw, street, "")
                    result = self.parse(prop, body, timestamp, key)
                    candidates.append(result)
                    attempts.append({"street": street, "zip": "", "cache_key": key, "quality": result.match_quality})
                except (httpx.HTTPError, ValueError, KeyError) as exc:
                    attempts.append({"street": street, "error": type(exc).__name__})
            if len(candidates) == 2 and all(c.match_quality == "resolved" for c in candidates) and candidates[0].identifiers["municipality_geoid"] == candidates[1].identifiers["municipality_geoid"]:
                last = candidates[0]
                last.method = "census_range_endpoints_agree"
                last.response_hash = digest([c.response_hash for c in candidates])
            else:
                last.match_quality = "ambiguous"
                last.unresolved = ["Address range endpoints do not establish one legal municipality"]
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
