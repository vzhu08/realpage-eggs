"""Evidence checks are recomputed against current snapshots, separately from legal evaluation."""
import re

from .config import DISCLAIMER
from .models import EvidenceCheck, EvidenceReport, SemanticReview, SourceContext
from .retrieval import ContextRetriever, section_key, span
from .store import digest
from .source_policy import rule_source_issues, source_use


def rule_hash(rule):
    return digest(rule.model_dump(mode="json", exclude={"extraction_run_id", "evidence_mode", "semantic_verification", "review_issues"}))


def semantic_key(rule, sources, version="semantic-v1"):
    # All source versions matter: a previously missing referenced source may arrive.
    return digest([version, rule_hash(rule), sorted((k, s.sha256, digest(s.text.encode("utf-8"))) for k, s in sources.items())])


def all_evidence(rule):
    return rule.evidence + [e for event in rule.status_events for e in event.evidence] + [e for interaction in rule.interactions for e in interaction.evidence]


def check_rule(rule, sources, retriever=None, semantic=None):
    retriever = retriever or ContextRetriever(sources)
    checks, anchors, blocking = [], [], []
    primary = sources.get(rule.source_doc_id)
    if primary:
        use = source_use(primary)
        checks.append(EvidenceCheck(kind="source_eligibility", status="pass" if use.operative_allowed else "insufficient",
                                    message=f"{primary.doc_id}: {use.reason}", field="source_doc_id"))
    for issue in rule_source_issues(rule, sources):
        blocking.append(issue)
        checks.append(EvidenceCheck(kind="source_eligibility", status="insufficient", message=issue))
    evidence = all_evidence(rule)
    source_ids = sorted({rule.source_doc_id} | {e.doc_id for e in evidence})
    for ident in source_ids:
        source = sources.get(ident)
        if not source or not source.text:
            checks.append(EvidenceCheck(kind="source_availability", status="missing", message=f"{ident}: no available source text; this is a coverage gap, not a fabrication verdict"))
            blocking.append(f"missing_source:{ident}")
            continue
        checks.append(EvidenceCheck(kind="source_availability", status="pass", message=f"{ident}: snapshot available"))
        actual = digest(source.text.encode("utf-8"))
        valid = actual == source.sha256 and (ident != rule.source_doc_id or rule.source_url == source.url)
        checks.append(EvidenceCheck(kind="source_identity", status="pass" if valid else "fail", message=f"{ident}: current text hash and recorded source URL {'match' if valid else 'do not match'}"))
        if not valid: blocking.append(f"source_identity_mismatch:{ident}")
        if source.manifest_sha256 and source.manifest_sha256 != actual:
            checks.append(EvidenceCheck(kind="source_identity", status="ambiguous", message=f"{ident}: organizer-declared hash differs from delivered snapshot; basis requires clarification"))
    if primary and primary.text:
        start = primary.text.find(rule.quoted_span)
        checks.append(EvidenceCheck(kind="quote_presence", status="pass" if start >= 0 else "fail", message="Primary quoted_span occurs verbatim" if start >= 0 else "Primary quoted_span is absent from current snapshot", field="quoted_span", spans=[span(primary, start, start+len(rule.quoted_span))] if start >= 0 else []))
        if start >= 0: anchors.append(span(primary, start, start+len(rule.quoted_span)))
        else: blocking.append("primary_quote_absent")
    if not rule.evidence:
        checks.append(EvidenceCheck(kind="quote_presence", status="fail", message="Rule has no supporting evidence records"))
        blocking.append("no_supporting_evidence")
    for evidence_item in evidence:
        source = sources.get(evidence_item.doc_id)
        if not source or not source.text: continue
        start = evidence_item.start if evidence_item.start is not None else source.text.find(evidence_item.quote)
        end = evidence_item.end if evidence_item.end is not None else start + len(evidence_item.quote)
        valid = start >= 0 and end == start + len(evidence_item.quote) and source.text[start:end] == evidence_item.quote
        match = span(source, start, end) if valid else None
        checks.append(EvidenceCheck(kind="quote_presence", status="pass" if valid else "fail", message="Exact original span found; meaning is a separate check" if valid else "Supporting span/offset no longer matches current snapshot", field=",".join(evidence_item.supports), spans=[match] if match else []))
        if match: anchors.append(match)
        else: blocking.append(f"supporting_quote_absent:{source.doc_id}")
    citation_sections = re.findall(r"(?i)(?:section|sec\.?|§)\s*(\d[\w.()\-]*)", rule.citation)
    if primary and citation_sections:
        for number in citation_sections:
            candidates = [(label, a, b) for label, a, b in retriever.section_index.get(primary.doc_id, []) if label == section_key(number)]
            checks.append(EvidenceCheck(kind="citation_anchor", status="pass" if len(candidates) == 1 else "ambiguous" if candidates else "not_checked", message=f"Citation section {number}: " + ("unique heading located; authority/meaning not established" if len(candidates) == 1 else "no unique structured section anchor in this snapshot"), spans=[span(primary, a, b, label) for label, a, b in candidates[:2]]))
    else:
        checks.append(EvidenceCheck(kind="citation_anchor", status="not_checked", message="No supported section identifier parsed from citation; quote presence does not validate citation identity"))
    context = retriever.context(anchors)
    gaps = [d for d in context.dependencies if d.status != "resolved"]
    checks.append(EvidenceCheck(kind="dependencies", status="insufficient" if gaps or context.status != "available" else "pass", message="Missing, ambiguous, cyclic or bounded context remains" if gaps or context.status != "available" else "Recognized explicit references resolved within bounded snapshot context; not exhaustive legal reference coverage"))
    blocking.extend(f"cross_reference:{d.reference}:{d.status}" for d in gaps)
    if context.limits_hit: blocking.append("context_incomplete:" + ",".join(context.limits_hit))
    review = None
    if semantic:
        review = SemanticReview.model_validate(semantic)
        fresh = review.rule_id == rule.team_rule_id and review.rule_hash == rule_hash(rule) and review.source_hashes == {k:s.sha256 for k,s in sources.items()}
        fresh = fresh and all(item.doc_id in sources and item.source_hash == sources[item.doc_id].sha256 and sources[item.doc_id].text[item.start:item.end] == item.text for decision in review.decisions for item in decision.spans)
        if not fresh:
            checks.append(EvidenceCheck(kind="semantic_support", status="stale", message="Semantic review does not match the current rule/source version"))
            blocking.append("stale_semantic_review")
            review = None
        else:
            for decision in review.decisions:
                checks.append(EvidenceCheck(kind="semantic_support", status=decision.status, message=decision.explanation, field=decision.field, spans=decision.spans))
                if decision.status != "supported": blocking.append(f"semantic_{decision.status}:{decision.field}")
    if review is None:
        checks.append(EvidenceCheck(kind="semantic_support", status="not_checked", message="Exact quote/retrieval is not semantic verification. Extraction's model_reviewed label is not this separate review."))
    return EvidenceReport(rule_id=rule.team_rule_id, rule_hash=rule_hash(rule), checks=checks, context=context, semantic_review=review, blocking_issues=sorted(set(blocking)), disclaimer=DISCLAIMER)


def prepare_rules(store):
    sources, rules = store.sources(), store.rules()
    extraction_index = store.read("extraction_index.json", {})
    retriever = ContextRetriever(sources)
    reports, prepared = {}, {}
    for ident, rule in rules.items():
        cached = store.read(f"semantic_reviews/{semantic_key(rule, sources)}.json")
        report = check_rule(rule, sources, retriever, cached)
        source = sources.get(rule.source_doc_id)
        extracted_hash = extraction_index.get(rule.source_doc_id, {}).get("sha256")
        if source and extracted_hash and extracted_hash != source.sha256:
            report.checks.append(EvidenceCheck(kind="source_identity", status="stale", message="Rule extraction used an older source snapshot; re-extract/review before relying on the current encoding"))
            report.blocking_issues.append("extraction_source_version_stale")
        reviewed = rule.model_copy(deep=True)
        reviewed.review_issues = sorted(set(reviewed.review_issues + [f"evidence_check:{issue}" for issue in report.blocking_issues]))
        if report.blocking_issues: reviewed.semantic_verification = "needs_review"
        prepared[ident], reports[ident] = reviewed, report
    return prepared, reports


class EvidenceStoreView:
    """Request-local prepared rules; no mutation of corpus or original stored rules."""
    def __init__(self, store, prepared): self.store, self.prepared = store, prepared
    def rules(self): return self.prepared
    def __getattr__(self, name): return getattr(self.store, name)
