"""Separate source inventory, extraction candidates and operative authority.

This conservative gate is not legal validation. Source roles are recorded metadata,
not inferred from a URL or government hostname. Preserve contextual documents for
research; primary text still needs evidence, semantic and temporal review.
"""
from dataclasses import dataclass


POLICY_VERSION = "source-use-v1"


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


def source_counts(sources, rules):
    """Counts describe provenance, never the number of legally accepted rules."""
    rows = list(rules.values()) if isinstance(rules, dict) else list(rules)
    return {
        "captured_sources": sum(bool(s.text) for s in sources.values()),
        "rule_sources": len({r.source_doc_id for r in rows}),
        "primary_source_rules": sum(source_use(sources.get(r.source_doc_id)).status == "eligible_primary" for r in rows),
        "context_only_sources": sum(source_use(s).status == "context_only" for s in sources.values()),
        "source_review_rules": sum(not source_use(sources.get(r.source_doc_id)).operative_allowed for r in rows),
    }
