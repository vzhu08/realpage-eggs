from .config import DISCLAIMER, VERSION
from .engine import evaluate_rules
from .evidence import prepare_rules, EvidenceStoreView
from .fact_inputs import validate_facts
from .models import LookupResponse, JurisdictionResolution, PropertyFacts
from .store import digest


class DatasetUnavailable(RuntimeError): pass


def lookup(store, request, answer_provenance=None):
    validate_facts(request.supplemental_facts)
    if not isinstance(store, EvidenceStoreView):
        prepared, _ = prepare_rules(store)
        store = EvidenceStoreView(store, prepared)
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
        if value is None: prop.facts.pop(key, None)
        else: prop.facts[key] = value
        mode = (answer_provenance or {}).get(key, "user_provided")
        prop.provenance[key] = "Demo answer (synthetic scenario)" if mode == "demo" else "User-supplied supplemental fact (not independently verified)"
        prop.bounds.pop(key, None)
        prop.missing_facts = [f for f in prop.missing_facts if f != key]
        if value is None: prop.missing_facts.append(key)
    resolution = store.resolutions().get(prop.address_id, JurisdictionResolution(address_id=prop.address_id, state=prop.raw_address.state))
    evaluations = [e for e in evaluate_rules(rules, prop, resolution, request.as_of) if e.result not in {"inapplicable", "failed"}]
    evaluated_ids = {e.team_rule_id for e in evaluations}
    relevant_rules = [r for r in rules if r.team_rule_id in evaluated_ids]
    source_ids = {e.doc_id for r in relevant_rules for e in r.evidence}
    sources = store.sources()
    # Relevant full source text is available separately, reducing lookup payload size.
    metadata_sources = [sources[sid].model_copy(update={"text": ""}) for sid in sorted(source_ids) if sid in sources]
    missing = [s.doc_id for s in sources.values() if not s.text]
    unprocessed = [s.doc_id for s in sources.values() if s.text and (extraction_index.get(s.doc_id, {}).get("status") != "complete" or extraction_index.get(s.doc_id, {}).get("sha256") != s.sha256)]
    warnings = []
    if source_ids - sources.keys(): warnings.append("Supporting source records are missing; evidence review required")
    if any(any(i.startswith("evidence_check:") for i in r.review_issues) for r in rules): warnings.append("Current evidence checks have unresolved failures; inspect rule evidence reports")
    if missing: warnings.append(f"Missing source material: {len(missing)} documents; no-rule conclusions are not established")
    if unprocessed: warnings.append(f"Unresolved extraction: {len(unprocessed)} source documents")
    if resolution.match_quality != "resolved": warnings.append("Local jurisdiction unresolved; state answers retained and same-state local candidates marked uncertain")
    if not rules: warnings.append("No relevant rules extracted; this is not proof that no law exists")
    modes = sorted({r.evidence_mode for r in relevant_rules})
    if "synthetic" in modes: warnings.append("SYNTHETIC DEMONSTRATION: not actual housing law")
    return LookupResponse(address=prop, as_of=request.as_of, jurisdiction=resolution, evaluations=evaluations, rules=relevant_rules, sources=metadata_sources, warnings=warnings, metadata={"version": VERSION, "dataset": store.read("dataset.json", {}), "rule_modes": modes, "extraction_run_ids": sorted({r.extraction_run_id for r in relevant_rules}), "partial_data": bool(missing or unprocessed), "missing_source_ids": missing, "unprocessed_source_ids": unprocessed}, disclaimer=DISCLAIMER)
