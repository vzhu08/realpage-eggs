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
    if request.address_id is not None:
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
def source_comparisons(store):
    """Recheck Core-authored claim annotations against this store's unchanged sources."""
    from .config import DISCLAIMER
    from .models import SourceComparisonsResponse, SourceSpan, ClaimComparison
    from .source_comparison import compare_claims
    from .store import digest

    annotations = store.read("source_comparisons.json")
    if annotations is None:
        return SourceComparisonsResponse(status="unavailable", observations={}, annotation_sha256=None,
                                         source_hashes={}, notes=["Core claim annotations are absent from this snapshot."], disclaimer=DISCLAIMER)
    sources = store.sources()
    observations, unused = {}, []
    for name, row in annotations.get("applied_to_saved_sources", {}).items():
        if "field" not in row:
            unused.append(name)
            continue
        def spans(side):
            return [SourceSpan.model_validate(s["span"]) for s in row[side]["support"]]
        compared = compare_claims(row["field"], row["before"]["value"], row["after"]["value"],
                                  spans("before"), spans("after"), sources, sources, rule_ids=row["rule_ids"])
        observations[name] = ClaimComparison.model_validate(compared)
    notes = ["Core-authored observations; semantic support and legal precedence remain unverified.",
             "Source hashes and exact anchors are recomputed against the selected snapshot on each request."]
    if unused:
        notes.append("Separate internal rule-version/conditional-impact records are not claim observations: " + ", ".join(sorted(unused)))
    return SourceComparisonsResponse(status="available", observations=observations, annotation_sha256=digest(annotations),
                                     source_hashes={k: digest(v.text.encode("utf-8")) for k, v in sources.items()},
                                     notes=notes, disclaimer=DISCLAIMER)


def change_summary(store, request):
    """Group the existing Core result without evaluating legal truth a second time."""
    from .store import cached_changes
    from .evidence import prepare_rules, EvidenceStoreView
    from .models import ChangeSummary, ChangeImpactGroup

    if not store.addresses():
        raise DatasetUnavailable("Dataset absent; run navigator ingest")
    rules, _ = prepare_rules(store)
    result = cached_changes(EvidenceStoreView(store, rules), request)
    by_id = rules
    groups = [{}, {}]
    changed_rules = set()
    for address_id, deltas in result.differences.items():
        for delta in deltas:
            rid = delta["team_rule_id"]
            changed_rules.add(rid)
            rule = by_id[rid]
            for group, label in zip(groups, (rule.jurisdiction, rule.category)):
                row = group.setdefault(label, {"rule_ids": set(), "affected_address_ids": set(),
                                               "uncertain_address_ids": set(), "conflict_flag_address_ids": set()})
                row["rule_ids"].add(rid)
                row["affected_address_ids" if delta["certainty"] == "definite" else "uncertain_address_ids"].add(address_id)
                if delta.get("after", {}).get("conflict_flag"):
                    row["conflict_flag_address_ids"].add(address_id)
    related = set(result.affected_address_ids + result.uncertain_address_ids + result.conflict_flag_address_ids) | set(result.differences)
    props = store.addresses()
    return ChangeSummary(result=result, property_labels={k: props[k].normalized_address for k in sorted(related)},
                         rule_labels={k: by_id[k].title for k in sorted(changed_rules)},
                         by_jurisdiction={k: ChangeImpactGroup(**{f: sorted(ids) for f, ids in v.items()}) for k,v in sorted(groups[0].items())},
                         by_category={k: ChangeImpactGroup(**{f: sorted(ids) for f, ids in v.items()}) for k,v in sorted(groups[1].items())},
                         notes=["Groups are unions of Core-produced differences; a property can occur in multiple groups or certainty sets.",
                                "An empty group does not establish no impact; retain the result's status, mapping and blocker notes."])
