"""Use an explicitly reviewed proposition scope after provenance validation.

This is never the default retriever. Every recognized reference within the
declared scope still requires an exact, recorded review decision.
"""
from .models import SourceContext, SourceDependency
from .retrieval import REFERENCES, section_key, span


def reviewed_context(review, sources):
    def as_span(item):
        return span(sources[item.doc_id], item.start, item.end)

    spans = [as_span(item) for item in review.context_scope]
    decisions = {(d.origin.doc_id, d.origin.start, d.origin.end, d.origin.quote): d
                 for d in review.context_reference_decisions}
    dependencies, seen = [], set()
    for item in spans:
        for match in REFERENCES.finditer(item.text):
            key = (item.doc_id, item.start + match.start(), item.start + match.end(), match.group())
            if key in seen:
                continue
            seen.add(key)
            decision = decisions.get(key)
            targets = [as_span(target) for target in decision.target_spans] if decision else []
            dependencies.append(SourceDependency(
                reference=match.group(), origin=span(sources[item.doc_id], key[1], key[2]),
                status=decision.status if decision else "missing",
                target_doc_id=targets[0].doc_id if targets else match.group("doc"),
                target_section=section_key(match.group("section")), spans=targets,
                explanation=("Recorded AI source review: " + decision.explanation) if decision else
                "Reference within reviewed scope has no exact recorded decision; remains unresolved",
            ))
    partial = any(d.status not in {"resolved", "not_applicable"} for d in dependencies)
    return SourceContext(
        spans=spans, dependencies=dependencies, status="partial" if partial else "available",
        limits={"reviewed_spans": len(spans), "reviewed_chars": sum(len(s.text) for s in spans)},
        limits_hit=[], retrieval_method="pinned_AI_source_review_scope_not_exhaustive_legal_validation",
    )
