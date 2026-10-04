from navigator.retrieval import ContextRetriever, source_units, span
from navigator.source_inventory import inventory_source
from navigator.store import digest


def source_with(demo, text):
    original = next(iter(demo.sources().values()))
    return original.model_copy(update={"text": text, "sha256": digest(text.encode("utf-8"))})


def test_every_character_including_late_exception_is_searchable(demo):
    source = source_with(demo, "Section 1. Coverage\n" + "Ordinary provision. "*300 + "\nExcept submarine rental buildings.")
    units = source_units(source)
    assert "".join(s.text for s in units) == source.text
    retrieved = ContextRetriever({source.doc_id: source}).search("submarine")
    assert "submarine" in retrieved["items"][0]["span"]["text"]
    assert not retrieved["semantic_verification"]
    last = span(source, len(source.text)-20, len(source.text))
    bounded = ContextRetriever({source.doc_id: source}).context([last], max_chars=1200)
    assert "section_windowed" in bounded.limits_hit
    assert bounded.status == "partial" and any("submarine" in s.text for s in bounded.spans)


def test_missing_exception_cycle_depth_and_ambiguity_are_visible(demo):
    source = source_with(demo, "Section 1. Coverage\nExcept as provided in section 2. See section 9.\nSection 2. Exceptions\nSee section 1.\n")
    index = ContextRetriever({source.doc_id: source})
    context = index.context([span(source, 0, 10)])
    assert {d.status for d in context.dependencies} == {"resolved", "missing", "cycle"}
    assert context.status == "partial"
    limited = index.context([span(source, 0, 10)], max_depth=0)
    assert "max_depth" in limited.limits_hit
    duplicate = source_with(demo, source.text + "Section 2. Duplicate\n")
    assert any(d.status == "ambiguous" for d in ContextRetriever({duplicate.doc_id: duplicate}).context([span(duplicate,0,10)]).dependencies)


def test_budget_does_not_silently_prefix_truncate_reference(demo):
    source = source_with(demo, "Section 1. Coverage\nSee section 2.\nSection 2. Exception\n" + "word "*500)
    context = ContextRetriever({source.doc_id: source}).context([span(source,0,10)], max_chars=200)
    assert any(d.status == "budget_limit" and not d.spans for d in context.dependencies)
    assert context.status == "partial" and sum(len(s.text) for s in context.spans) <= 200
    # Several evidence anchors in an already retrieved section spend its budget once.
    complete = ContextRetriever({source.doc_id: source}).context([span(source, 60, 65), span(source, 70, 75)], max_chars=2600)
    assert complete.status == "available" and len(complete.spans) == 1


def test_inventory_is_versioned_non_exhaustive_and_replays(demo):
    source = next(iter(demo.sources().values()))
    first = inventory_source(demo, source.doc_id)
    assert "".join(row["span"]["text"] for row in first["units"]) == source.text
    assert first["counts"]["mapped"] > 0
    assert not first["complete_legal_coverage"] and not first["human_reviewed"]
    assert inventory_source(demo, source.doc_id)["cache_mode"] == "replay"
    changed = source_with(demo, source.text + "\nSection 9. Unmapped exemption\n" + "unknown "*400)
    demo.save_collection("sources", {changed.doc_id: changed})
    revised = inventory_source(demo, source.doc_id)
    assert revised["cache_mode"] == "fresh" and revised["counts"]["unresolved"] > 0
