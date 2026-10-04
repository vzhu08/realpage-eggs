"""Validate offline correction provenance without treating it as legal certification."""
from .models import Rule, SourceReviewRecord
from .retrieval import REFERENCES
from .source_policy import TEMPORAL_FIELDS, evidence_source_allowed
from .store import digest


class SourceReviewError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise SourceReviewError(message)


def rule_evidence(rule):
    return [*rule.evidence, *(item for event in rule.status_events for item in event.evidence),
            *(item for interaction in rule.interactions for item in interaction.evidence)]


def check_span(item, sources):
    source = sources.get(item.doc_id)
    require(source is not None and source.text, f"Source review evidence source missing: {item.doc_id}")
    require(item.start is not None and item.end == item.start + len(item.quote)
            and source.text[item.start:item.end] == item.quote,
            f"Source review evidence offsets/quote mismatch: {item.doc_id}")


def source_review_original(store, rule, sources):
    """Return the validated pinned original; accepts Store or offline PackageStore.

    original_rule_sha256 = store.digest(manifest['original_rule']) BEFORE model
    defaults. amended_rule_sha256 = digest(current_rule.model_dump(mode='json')),
    including source_review. Assembly separately verifies the original cache.
    """
    try:
        return _source_review_original(store, rule, sources)
    except (ValueError, KeyError, TypeError, AttributeError, OSError) as exc:
        if isinstance(exc, SourceReviewError):
            raise
        raise SourceReviewError(f"Invalid source review provenance: {rule.team_rule_id}: {exc}") from exc


def _source_review_original(store, rule, sources):
    # Also validate caller-constructed models and forbid disallowed changed fields.
    rule = Rule.model_validate(rule.model_dump(mode="json"))
    review = rule.source_review
    require(review is not None, f"Rule has no source review: {rule.team_rule_id}")
    name = f"source_reviews/{review.review_id}.json"
    raw = store.read(name)
    require(raw is not None, f"Missing source review manifest: {rule.team_rule_id}")
    manifest = SourceReviewRecord.model_validate(raw)
    require(manifest.rule_id == rule.team_rule_id, f"Source review manifest identity mismatch: {name}")
    require(digest(manifest.original_rule) == review.original_rule_sha256,
            f"Source review original rule hash mismatch: {name}")
    original = Rule.model_validate(manifest.original_rule)
    require(original.source_review is None, f"Nested source review is not supported: {name}")
    require(manifest.amended_rule_sha256 == digest(rule.model_dump(mode="json")),
            f"Source review amended rule hash mismatch: {name}")
    before = original.model_dump(mode="json", exclude={"source_review"})
    after = rule.model_dump(mode="json", exclude={"source_review"})
    changed = {field for field in before if before[field] != after[field]}
    require(changed == set(review.changed_fields), f"Source review changed fields mismatch: {name}")
    require(original.extraction_run_id == review.original_extraction_run_id,
            f"Source review original extraction mismatch: {name}")
    require(review.review_scope == "complete_rule" or original.semantic_verification != "needs_review"
            or rule.semantic_verification == "needs_review",
            "Selected-field review cannot clear the original semantic review gate")
    references = [item for decision in review.context_reference_decisions
                  for item in [decision.origin, *decision.target_spans]]
    evidence = [*rule_evidence(original), *rule_evidence(rule), *review.evidence, *review.context_scope, *references]
    required_sources = {rule.source_doc_id} | {item.doc_id for item in evidence}
    require(required_sources <= review.source_hashes.keys(), f"Source review omitted source hashes: {name}")
    for ident, expected in review.source_hashes.items():
        source = sources.get(ident)
        require(source is not None and source.sha256 == expected
                and digest(source.text.encode("utf-8")) == expected,
                f"Source review source hash mismatch: {ident}")
    primary = sources[rule.source_doc_id]
    for version in (original, rule):
        require(version.source_url == primary.url and version.quoted_span in primary.text,
                f"Source review primary quote/URL mismatch: {version.team_rule_id}")
    for item in evidence:
        check_span(item, sources)
    # Notes explain metadata changes; they cannot replace source evidence for a
    # corrected behavioral field or any field included in a complete review.
    metadata = {"evidence", "review_issues", "semantic_verification"}
    for field in (changed | set(review.reviewed_fields)) - metadata:
        require(any(field in item.supports and evidence_source_allowed(
                    sources.get(item.doc_id), temporal=field in TEMPORAL_FIELDS)
                    for item in review.evidence),
                f"Source review missing eligible field evidence: {field}")
    if review.context_scope:
        for item in [*rule_evidence(rule), *review.evidence, *references]:
            require(any(scope.doc_id == item.doc_id and scope.start <= item.start
                        and item.end <= scope.end for scope in review.context_scope),
                    f"Reviewed context omits cited rule/review evidence: {item.doc_id}")
        # The primary quote is also a live retrieval anchor, even if not repeated
        # in the structured field evidence. Preserve its actual occurrence.
        start = primary.text.find(rule.quoted_span)
        require(any(scope.doc_id == primary.doc_id and scope.start <= start
                    and start + len(rule.quoted_span) <= scope.end for scope in review.context_scope),
                "Reviewed context omits the primary rule quote")
        recognized = {(scope.doc_id, scope.start + match.start(), scope.start + match.end(), match.group())
                      for scope in review.context_scope for match in REFERENCES.finditer(scope.quote)}
        decided = set()
        for decision in review.context_reference_decisions:
            origin = decision.origin
            key = (origin.doc_id, origin.start, origin.end, origin.quote)
            require(key in recognized, "Reference decision origin is not an exact recognized in-scope reference")
            require(key not in decided, "Duplicate source review reference decision")
            decided.add(key)
    return original
