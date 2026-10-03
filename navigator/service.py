from .config import DISCLAIMER, VERSION
from .engine import evaluate_rules
from .models import LookupResponse, JurisdictionResolution, PropertyFacts
from .store import digest


class DatasetUnavailable(RuntimeError): pass


def lookup(store, request):
    addresses, rules = store.addresses(), list(store.rules().values())
    if not addresses: raise DatasetUnavailable("Dataset absent; run navigator ingest")
    extraction_index = store.read("extraction_index.json", {})
    if not rules and not any(v.get("status") in {"complete", "review"} for v in extraction_index.values()):
        raise DatasetUnavailable("No completed extraction; configure provider and run navigator extract")
    if request.address_id:
        if request.address_id not in addresses: raise KeyError(f"Unknown address ID {request.address_id}")
        prop = addresses[request.address_id].model_copy(deep=True)
    else:
        normalized = ", ".join([request.address.street_address.strip().upper(), request.address.postal_city.strip().upper(), request.address.state, request.address.zip])
        matches = [p for p in addresses.values() if p.normalized_address == normalized]
        prop = matches[0].model_copy(deep=True) if len(matches) == 1 else PropertyFacts(address_id="custom-" + digest(request.address.model_dump())[:12], raw_address=request.address, normalized_address=normalized, provenance={"state": "user_supplied_address"})
    for key, value in request.supplemental_facts.items():
        if key in {"state", "municipality", "county", "jurisdiction"}: raise ValueError("Supplemental facts cannot override legal geography")
        if not isinstance(value, (str, int, float, bool)) and value is not None: raise ValueError("Supplemental facts must be scalar values or null")
        prop.facts[key] = value
        prop.provenance[key] = "User-supplied supplemental fact (not independently verified)"
        prop.bounds.pop(key, None)
        prop.missing_facts = [f for f in prop.missing_facts if f != key]
    resolution = store.resolutions().get(prop.address_id, JurisdictionResolution(address_id=prop.address_id, state=prop.raw_address.state))
    evaluations = [e for e in evaluate_rules(rules, prop, resolution, request.as_of) if e.result not in {"inapplicable", "failed"}]
    evaluated_ids = {e.team_rule_id for e in evaluations}
    relevant_rules = [r for r in rules if r.team_rule_id in evaluated_ids]
    source_ids = {e.doc_id for r in relevant_rules for e in r.evidence}
    sources = store.sources()
    # Relevant full source text is available separately, reducing lookup payload size.
    metadata_sources = [sources[sid].model_copy(update={"text": ""}) for sid in sorted(source_ids)]
    missing = [s.doc_id for s in sources.values() if not s.text]
    unprocessed = [s.doc_id for s in sources.values() if s.text and extraction_index.get(s.doc_id, {}).get("status") != "complete"]
    warnings = []
    if missing: warnings.append(f"Missing source material: {len(missing)} documents; no-rule conclusions are not established")
    if unprocessed: warnings.append(f"Unresolved extraction: {len(unprocessed)} source documents")
    if resolution.match_quality != "resolved": warnings.append("Local jurisdiction unresolved; state answers retained and same-state local candidates marked uncertain")
    if not rules: warnings.append("No relevant rules extracted; this is not proof that no law exists")
    modes = sorted({r.evidence_mode for r in relevant_rules})
    if "synthetic" in modes: warnings.append("SYNTHETIC DEMONSTRATION: not actual housing law")
    return LookupResponse(address=prop, as_of=request.as_of, jurisdiction=resolution, evaluations=evaluations, rules=relevant_rules, sources=metadata_sources, warnings=warnings, metadata={"version": VERSION, "dataset": store.read("dataset.json", {}), "rule_modes": modes, "extraction_run_ids": sorted({r.extraction_run_id for r in relevant_rules}), "partial_data": bool(missing or unprocessed), "missing_source_ids": missing, "unprocessed_source_ids": unprocessed}, disclaimer=DISCLAIMER)
