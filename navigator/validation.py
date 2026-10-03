from collections import Counter
from datetime import date

import jsonschema

from .engine import temporal
from .extraction import anchor_evidence
from .models import CATEGORIES


EXPORT_FIELDS = {"team_rule_id", "jurisdiction", "level", "category", "title", "requirement", "key_value", "coverage_conditions", "exemptions", "effective_date", "citation", "source_doc_id", "source_url", "quoted_span", "conflict_flag", "conflict_note"}


def export_rule(rule, rules, as_of):
    status = temporal(rule, as_of)
    if status not in {"in_force", "not_yet_effective", "pending", "failed"}:
        raise ValueError(f"{rule.team_rule_id}: temporal status {status} cannot be represented in competition schema")
    value = rule.model_dump(mode="json", include=EXPORT_FIELDS)
    value["status"] = status
    value["confidence"] = None
    value["overrides"] = sorted({target.team_rule_id for interaction in rule.interactions if interaction.kind == "supersedes" for target in rules if target.citation.casefold() == interaction.target_citation.casefold() and target.jurisdiction.casefold() == interaction.target_jurisdiction.casefold() and target.category == interaction.category})
    value["interaction"] = "; ".join(f"{i.kind} {i.target_citation} in {i.target_jurisdiction}: {i.note}" for i in rule.interactions) or None
    return value


def inventory(store):
    sources, rules = store.sources(), list(store.rules().values())
    index, negatives = store.read("extraction_index.json", {}), store.read("negative_findings.json", {})
    jurisdictions = sorted({j for s in sources.values() for j in s.jurisdictions} | {r.jurisdiction for r in rules})
    rows = []
    for jurisdiction in jurisdictions:
        docs = [s for s in sources.values() if jurisdiction in s.jurisdictions]
        missing = [s.doc_id for s in docs if not s.text]
        unresolved = [s.doc_id for s in docs if s.text and (index.get(s.doc_id, {}).get("status") != "complete" or index.get(s.doc_id, {}).get("sha256") != s.sha256)]
        for category in CATEGORIES:
            supported = [r.team_rule_id for r in rules if r.jurisdiction == jurisdiction and r.category == category and not r.review_issues and r.semantic_verification != "needs_review"]
            negative = [n for batch in negatives.values() for n in batch if n["jurisdiction"] == jurisdiction and n["category"] == category]
            state = "supported_rule" if supported else "supported_negative_finding" if negative else "incomplete_source_coverage" if missing else "unresolved_extraction"
            rows.append({"jurisdiction": jurisdiction, "category": category, "state": state, "rule_ids": supported, "negative_findings": negative, "missing_documents": missing, "unresolved_documents": unresolved, "source_coverage_complete": not missing and not unresolved})
    return rows


def validate(store, as_of=date(2026, 10, 1)):
    sources, rules = store.sources(), list(store.rules().values())
    addresses, resolutions = store.addresses(), store.resolutions()
    errors, warnings = [], []
    schema = store.read("competition_schema.json")
    quote_failures = schema_failures = 0
    exportable = []
    for rule in rules:
        quote_ok = True
        try:
            anchor_evidence(rule.evidence + [e for event in rule.status_events for e in event.evidence] + [e for interaction in rule.interactions for e in interaction.evidence], sources)
            if rule.quoted_span not in sources[rule.source_doc_id].text: raise ValueError("quoted_span absent")
            if rule.source_url != sources[rule.source_doc_id].url: raise ValueError("source_url mismatch")
        except (ValueError, KeyError) as exc:
            quote_ok = False
            quote_failures += 1
            errors.append(f"{rule.team_rule_id}: {exc}")
        try:
            record = export_rule(rule, rules, as_of)
            if schema: jsonschema.Draft202012Validator(schema).validate(record)
            if quote_ok: exportable.append(rule.team_rule_id)
        except (ValueError, jsonschema.ValidationError) as exc:
            schema_failures += 1
            errors.append(f"{rule.team_rule_id}: {str(exc)[:250]}")
    if not addresses: errors.append("No address dataset")
    if not schema: errors.append("Competition schema absent")
    if not rules: warnings.append("No extracted rules: empty lookup arrays do not establish absence of law")
    index = store.read("extraction_index.json", {})
    missing_text = [s.doc_id for s in sources.values() if not s.text]
    pending_extraction = [s.doc_id for s in sources.values() if s.text and (index.get(s.doc_id, {}).get("status") != "complete" or index.get(s.doc_id, {}).get("sha256") != s.sha256)]
    unresolved = [a for a in addresses if a not in resolutions or resolutions[a].match_quality != "resolved"]
    if missing_text: warnings.append(f"Missing text for {len(missing_text)} manifest sources")
    if pending_extraction: warnings.append(f"Incomplete/review-needed extraction for {len(pending_extraction)} sources")
    if unresolved: warnings.append(f"Legal municipality unresolved for {len(unresolved)} addresses")
    review_count = sum(bool(r.review_issues or r.semantic_verification == "needs_review") for r in rules)
    if review_count: warnings.append(f"{review_count} rules require semantic review")
    synthetic = sum(r.evidence_mode == "synthetic" for r in rules)
    if synthetic: warnings.append("Synthetic rules present: not competition output")
    return {"report_type": "internal_validation_not_official_scoring", "as_of": as_of.isoformat(), "schema_valid": not schema_failures and bool(schema), "quote_valid": not quote_failures, "ready_for_submission": bool(rules) and not errors and not warnings,
            "counts": {"sources": len(sources), "source_texts": sum(bool(s.text) for s in sources.values()), "addresses": len(addresses), "rules": len(rules), "exportable_rules": len(exportable), "quote_failures": quote_failures, "schema_failures": schema_failures, "resolved_municipalities": len(addresses)-len(unresolved), "synthetic_rules": synthetic, "review_rules": review_count},
            "capture_status_counts": dict(Counter(s.capture_status for s in sources.values())), "missing_source_ids": missing_text, "unresolved_extraction_ids": pending_extraction, "unresolved_address_ids": unresolved, "exportable_rule_ids": exportable, "errors": errors, "warnings": warnings, "official_score": None}
