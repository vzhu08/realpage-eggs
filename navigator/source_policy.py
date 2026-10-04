"""Separate source inventory, extraction candidates and operative authority.

This conservative gate is not legal validation. Source roles are recorded metadata,
not inferred from a URL or government hostname. Preserve contextual documents for
research; primary text still needs evidence, semantic and temporal review.
"""
from dataclasses import dataclass


POLICY_VERSION = "source-use-v2"


@dataclass(frozen=True)
class SourceUse:
    status: str
    extraction_allowed: bool
    operative_allowed: bool
    reason: str


def source_use(source, source_kind=None):
    if source is None:
        return SourceUse("access_blocked", False, False, "Supporting source record is missing")
    authority = source.authority.strip().casefold()
    kind = (source_kind if source_kind is not None else source.source_type).strip().casefold()
    if source.capture_status == "terms_review":
        return SourceUse("access_blocked", False, False, "Source access terms still require review")
    if authority.startswith("secondary") or kind in {"secondary", "news", "commentary"}:
        return SourceUse("context_only", False, False, "Secondary reporting is a research lead; obtain the primary legal instrument")
    if not source.text or source.capture_status in {"link_only", "failed"}:
        return SourceUse("access_blocked", False, False, "No permitted captured source text is available")
    if source.capture_status == "synthetic":
        return SourceUse("synthetic", True, True, "Fictional fixture only; not actual legal authority")
    official = authority in {"official", "official city-linked policy"}
    if not official:
        return SourceUse("needs_review", False, False, "Publisher authority and permission need review before rule extraction")
    if kind in {"status_record", "landing_page", "summary"}:
        return SourceUse("context_only", False, False, "Status records and summaries provide context, not the substantive legal provision")
    if kind == "legal_text" and authority == "official":
        return SourceUse("eligible_primary", True, True, "Official primary-text candidate; legal meaning, version and effective dates still require review")
    return SourceUse("needs_review", True, False, "Guidance or unclassified material needs the primary legal instrument or a reviewed instrument classification")


TEMPORAL_FIELDS = {"lifecycle", "effective_date", "end_date", "status_as_of", "status_events"}
SUBSTANTIVE_FIELDS = {"requirement", "key_value", "coverage_conditions", "exemption_conditions", "exemptions",
                      "penalties", "jurisdiction", "level", "interactions", "conflict_flag", "conflict_note"}


def evidence_source_allowed(source, *, temporal=False):
    if source_use(source).operative_allowed:
        return True
    # Official status evidence may establish dates/lifecycle without becoming the
    # substantive provision. Access restrictions still apply to that evidence.
    return bool(temporal and source is not None and source.text
                and source.authority.strip().casefold() == "official"
                and source.source_type.strip().casefold() == "status_record"
                and source.capture_status in {"supplied", "supplementary"})


def rule_source_issues(rule, sources):
    """Check recorded roles for each declared claim, not just the primary URL.

    This is authority gating, not a new semantic or missing-field validator.
    Secondary corroboration is retained when an eligible source also supports
    the same field; explicit background/context is never promoted to authority.
    """
    primary = source_use(sources.get(rule.source_doc_id))
    issues = []
    if not primary.operative_allowed:
        issues.append(f"source_eligibility:primary:{rule.source_doc_id}:{primary.status}: {primary.reason}")
    claims = {}
    for evidence in rule.evidence:
        for field in evidence.supports:
            root = field.split("/", 1)[0].split(".", 1)[0].split("[", 1)[0]
            if root in TEMPORAL_FIELDS | SUBSTANTIVE_FIELDS:
                temporal, cited = claims.setdefault(field, (root in TEMPORAL_FIELDS, set()))
                cited.add(evidence.doc_id)
    # Structural evidence cannot bypass checks by declaring itself background.
    for index, event in enumerate(rule.status_events):
        claims[f"status_events/{index}"] = (True, {e.doc_id for e in event.evidence})
    for index, interaction in enumerate(rule.interactions):
        claims[f"interactions/{index}/scope"] = (False, {e.doc_id for e in interaction.evidence})
    for field, (temporal, cited) in sorted(claims.items()):
        if not any(evidence_source_allowed(sources.get(ident), temporal=temporal) for ident in cited):
            issues.append(f"source_eligibility:{field}: no eligible authority among cited sources ({', '.join(sorted(cited))})")
    return issues


def source_counts(sources, rules):
    """Counts describe provenance, never the number of legally accepted rules."""
    rows = list(rules.values()) if isinstance(rules, dict) else list(rules)
    return {
        "captured_sources": sum(bool(s.text) for s in sources.values()),
        "rule_sources": len({r.source_doc_id for r in rows}),
        "primary_source_rules": sum(source_use(sources.get(r.source_doc_id)).status == "eligible_primary" for r in rows),
        "context_only_sources": sum(source_use(s).status == "context_only" for s in sources.values()),
        "source_review_rules": sum(bool(rule_source_issues(r, sources)) for r in rows),
    }
