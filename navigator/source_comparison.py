"""Offline comparison observations, pending Platform's public result contract.

These ordinary dictionaries are internal analysis results, not a second public
schema or a legal amendment detector. Canonical models supply every input/span.
"""
from datetime import date
from difflib import SequenceMatcher

from .engine import evaluate_rules
from .evidence import all_evidence
from .models import Rule, SourceDocument, SourceSpan
from .retrieval import span
from .store import digest


def _words(value):
    return " ".join(value.split())


def _identity_valid(source, doc_id):
    return bool(source and source.doc_id == doc_id
                and source.sha256 == digest(source.text.encode("utf-8")))


def _source(source):
    if source is None:
        return None
    return {**source.model_dump(exclude={"text"}),
            "actual_sha256": digest(source.text.encode("utf-8")),
            "identity_valid": digest(source.text.encode("utf-8")) == source.sha256}


def _body(text):
    lines = text.splitlines(keepends=True)
    if len(lines) >= 2 and lines[0].startswith("SOURCE: ") and lines[1].startswith("RETRIEVED: "):
        return "".join(lines[2:])
    return text


def compare_sources(before: SourceDocument | None, after: SourceDocument | None, *, max_spans=12):
    """Classify byte/text drift; changed regions retain each original's offsets."""
    if not 1 <= max_spans <= 100:
        raise ValueError("max_spans must be between 1 and 100")
    result = {"before": _source(before), "after": _source(after), "changes": [],
              "legal_amendment": None, "winner": None, "truncated": False}
    if before is None or after is None or not before.text or not after.text:
        result.update(classification="missing_source", remedy="Acquire the missing original snapshot; no comparison conclusion is established.")
        return result
    if before.text == after.text:
        classification = "identical_text"
    elif _body(before.text) == _body(after.text):
        classification = "capture_metadata_only"
    elif _words(_body(before.text)) == _words(_body(after.text)):
        classification = "formatting_only"
    else:
        classification = "text_changed"
    # Line diff bounds work for long source pages; it never alters the inputs.
    left, right = before.text.splitlines(keepends=True), after.text.splitlines(keepends=True)
    offsets = []
    for lines in (left, right):
        positions = [0]
        for line in lines: positions.append(positions[-1] + len(line))
        offsets.append(positions)
    for tag, a, b, c, d in SequenceMatcher(None, left, right, autojunk=False).get_opcodes():
        if tag == "equal": continue
        if len(result["changes"]) >= max_spans:
            result["truncated"] = True
            break
        result["changes"].append({"kind": tag,
            "before_span": span(before, offsets[0][a], offsets[0][b]).model_dump(mode="json") if a != b else None,
            "after_span": span(after, offsets[1][c], offsets[1][d]).model_dump(mode="json") if c != d else None})
    result.update(classification=classification,
                  remedy="Revalidate anchors against each source version; review meaning, scope and lifecycle before asserting a legal amendment.")
    return result


def _checked_spans(spans, sources):
    checks = []
    for item in spans:
        source = sources.get(item.doc_id)
        valid = bool(source and source.text and source.doc_id == item.doc_id
                     and item.source_hash == source.sha256 == digest(source.text.encode("utf-8"))
                     and 0 <= item.start < item.end <= len(source.text)
                     and source.text[item.start:item.end] == item.text)
        checks.append({"span": item.model_dump(mode="json"), "anchor_valid": valid,
                       "source": _source(source)})
    return checks


def compare_claims(field, before_value, after_value, before_spans: list[SourceSpan],
                   after_spans: list[SourceSpan], before_sources, after_sources, *, rule_ids=()):
    """Compare explicit observations, without promoting annotations to Rule records."""
    left, right = _checked_spans(before_spans, before_sources), _checked_spans(after_spans, after_sources)
    supported = bool(left and right and all(c["anchor_valid"] for c in left + right))
    changed = before_value != after_value
    return {"field": field, "rule_ids": sorted(set(rule_ids)),
            "before": {"value": before_value, "support": left},
            "after": {"value": after_value, "support": right},
            "classification": "missing_support" if not supported else "different_claims" if changed else "same_claim",
            "status": "unresolved" if changed or not supported else "same_observation_not_semantically_verified",
            "semantic_support": "not_checked", "winner": None, "legal_amendment": None,
            "remedy": "Acquire missing support or re-anchor invalid spans, then review authority, scope, dates and the meaning of both claims; retrieval recency does not decide precedence."}


def _evidence_checks(rule, sources):
    checks = []
    grouped = [("evidence", item) for item in rule.evidence]
    grouped += [(f"status_events/{i}", item) for i, event in enumerate(rule.status_events) for item in event.evidence]
    grouped += [(f"interactions/{i}", item) for i, interaction in enumerate(rule.interactions) for item in interaction.evidence]
    for origin, evidence in grouped:
        source = sources.get(evidence.doc_id)
        positions = []
        if source and source.text:
            at = source.text.find(evidence.quote)
            while at >= 0 and len(positions) < 12:
                positions.append(at)
                at = source.text.find(evidence.quote, at + 1)
        start, end = evidence.start, evidence.end
        if start is None and len(positions) == 1: start = positions[0]
        if end is None and start is not None: end = start + len(evidence.quote)
        valid = bool(source and start is not None and end is not None
                     and 0 <= start < end <= len(source.text)
                     and source.text[start:end] == evidence.quote)
        identity_valid = _identity_valid(source, evidence.doc_id)
        checks.append({"origin": origin, "evidence": evidence.model_dump(mode="json"), "anchor_valid": valid,
                       "span": span(source, start, end).model_dump(mode="json") if valid else None,
                       "exact_quote_positions": positions,
                       "source_identity_valid": identity_valid,
                       "remedy": None if valid and identity_valid else "Obtain the original supported snapshot, verify its document ID and hash, then review/re-anchor this exact quote; never normalize the stored source to make it match."})
    return checks


def _field_value(rule, field):
    if field == "status_events":
        return sorted((event.status, event.on) for event in rule.status_events)
    if field == "interactions":
        return sorted([item.model_dump(mode="json", exclude={"evidence"}) for item in rule.interactions], key=digest)
    value = getattr(rule, field)
    return value.model_dump(mode="json") if hasattr(value, "model_dump") else value


def compare_rule_versions(before: Rule, after: Rule, before_sources, after_sources):
    """Retain incompatible encodings and evidence drift without choosing a winner."""
    checks = {"before": _evidence_checks(before, before_sources), "after": _evidence_checks(after, after_sources)}
    fields = {"requirement": "requirement", "key_value": "threshold", "penalties": "penalty",
              "coverage_conditions": "coverage", "exemption_conditions": "exemption", "exemptions": "exemption",
              "lifecycle": "lifecycle", "effective_date": "effective_date", "end_date": "end_date",
              "status_as_of": "lifecycle_observation", "status_events": "lifecycle_history",
              "interactions": "interaction", "citation": "citation_relocation", "provision_key": "provision_identity",
              "jurisdiction": "jurisdiction", "level": "jurisdiction", "category": "category", "title": "label"}
    observations = []
    for field, kind in fields.items():
        left, right = _field_value(before, field), _field_value(after, field)
        if left == right: continue
        if isinstance(left, str) and isinstance(right, str) and _words(left) == _words(right):
            kind = "formatting"
        support = {}
        for side in checks:
            support[side] = [c for c in checks[side] if c["origin"].startswith(field + "/")
                             or any(s == field or s.startswith(field + "/") for s in c["evidence"]["supports"])]
        observations.append({"field": field, "kind": kind, "before": left, "after": right,
                             "support": support, "semantic_support": "not_checked",
                             "remedy": "Review both encodings against their cited original provisions and effective intervals; do not infer precedence from retrieval dates."})
    source_ids = sorted({before.source_doc_id, after.source_doc_id}
                        | {e.doc_id for r in (before, after) for e in all_evidence(r)})
    sources = {ident: compare_sources(before_sources.get(ident), after_sources.get(ident)) for ident in source_ids}
    gaps = []
    for side, rule, snapshots in (("before", before, before_sources), ("after", after, after_sources)):
        primary = snapshots.get(rule.source_doc_id)
        if not primary or not primary.text: gaps.append(f"{side}:missing_primary_source")
        else:
            if not _identity_valid(primary, rule.source_doc_id): gaps.append(f"{side}:primary_source_identity_mismatch")
            if primary.url != rule.source_url: gaps.append(f"{side}:primary_source_url_mismatch")
            if rule.quoted_span not in primary.text: gaps.append(f"{side}:primary_quote_absent")
        if not checks[side] or any(not c["anchor_valid"] or not c["source_identity_valid"] for c in checks[side]):
            gaps.append(f"{side}:invalid_or_missing_evidence")
        if rule.review_issues: gaps.append(f"{side}:unresolved_review_issues")
        if rule.semantic_verification == "needs_review": gaps.append(f"{side}:semantic_support_needs_review")
        if rule.conflict_flag: gaps.append(f"{side}:unresolved_conflict")
        for observation in observations:
            if not observation["support"][side]: gaps.append(f"{side}:missing_field_support:{observation['field']}")
    # Review annotations affect readiness and evaluator uncertainty, but do not
    # assert a changed legal provision or require legal quotes as field support.
    for field in ("semantic_verification", "review_issues", "conflict_flag", "conflict_note"):
        left, right = getattr(before, field), getattr(after, field)
        if left != right:
            observations.append({"field": field, "kind": "review_state_change", "before": left, "after": right,
                                 "semantic_support": "not_checked",
                                 "remedy": "Inspect the recorded review issues and conflict explanations; a changed review annotation does not establish a legal amendment or independently verified support."})
    left_refs = [c["evidence"] for c in checks["before"]]
    right_refs = [c["evidence"] for c in checks["after"]]
    if left_refs != right_refs or before.quoted_span != after.quoted_span:
        observations.append({"field": "evidence", "kind": "quotation_or_offset_change", "before": left_refs,
                             "after": right_refs, "remedy": "Revalidate each quote against its own unchanged original, separately from substantive interpretation."})
    substantive = any(o["kind"] not in {"formatting", "citation_relocation", "label", "quotation_or_offset_change", "review_state_change"} for o in observations)
    return {"interface": "internal-core-comparison-v1-not-public-contract",
            "rule_ids": sorted({before.team_rule_id, after.team_rule_id}),
            "claims": {"before": before.model_dump(mode="json"), "after": after.model_dump(mode="json")},
            "rule_hashes": {"before": digest(before.model_dump(mode="json")), "after": digest(after.model_dump(mode="json"))},
            "observations": observations, "sources": sources, "evidence_checks": checks,
            "support_gaps": sorted(set(gaps)), "substantive_encoding_changed": substantive,
            "status": "unresolved" if substantive or gaps else "no_substantive_encoding_change",
            "winner": None, "legal_amendment": None, "semantic_support": "not_checked",
            "remedy": "Resolve source/anchor gaps and independently review incompatible claims, scope, authority and lifecycle before selecting a legal version."}


def compare_impacts(before_rules, after_rules, prop, resolution, as_of: date):
    """Conditional impacts of two supplied encodings through the single evaluator."""
    return {"as_of": as_of.isoformat(), "address_id": prop.address_id,
            "mode": "conditional_encoding_comparison_not_version_precedence",
            "before": [e.model_dump(mode="json") for e in evaluate_rules(before_rules, prop, resolution, as_of)],
            "after": [e.model_dump(mode="json") for e in evaluate_rules(after_rules, prop, resolution, as_of)]}
