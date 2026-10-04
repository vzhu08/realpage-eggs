import pytest
from fastapi.testclient import TestClient

from navigator.api import create_app
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


def test_inventory_rejects_quote_with_mismatched_end_offset(demo):
    source = next(iter(demo.sources().values()))
    rule = next(iter(demo.rules().values()))
    # Same verbatim quote, but the supplied end no longer selects that quote.
    for item in rule.evidence:
        item.end += 1
    rule.status_events = []
    rule.interactions = []
    demo.save_collection("rules", {rule.team_rule_id: rule})
    result = inventory_source(demo, source.doc_id)
    assert result["counts"]["mapped"] == 0
    assert result["counts"]["unresolved"] == result["counts"]["units"]


@pytest.mark.parametrize("position", [0, 2500, 4990])
@pytest.mark.parametrize("budget", [100, 1200])
def test_small_context_budget_preserves_anchor_and_original_offsets(demo, position, budget):
    source = source_with(demo, "éΩ文🙂 " * 1000)
    anchor = span(source, position, position + 10)
    context = ContextRetriever({source.doc_id: source}).context([anchor], max_chars=budget)
    assert context.status == "partial" and "section_windowed" in context.limits_hit
    assert len(context.spans) == 1
    window = context.spans[0]
    assert window.start <= anchor.start < anchor.end <= window.end
    assert window.text == source.text[window.start:window.end]
    assert window.source_hash == source.sha256
    assert len(window.text) <= budget
    assert not context.semantic_verification


def test_repeated_anchors_in_window_do_not_spend_budget_again(demo):
    source = source_with(demo, "Section 1. Coverage\n" + "Synthetic provision. " * 300)
    retriever = ContextRetriever({source.doc_id: source})
    first = span(source, 2500, 2510)
    contained = span(source, 2510, 2520)
    original = retriever.context([first], max_chars=100, max_spans=1)
    repeated = retriever.context([first, first, contained], max_chars=100, max_spans=1)
    assert original.spans
    assert repeated == original


def test_anchor_larger_than_budget_is_explicitly_unretrieved(demo):
    source = source_with(demo, "Synthetic provision. " * 100)
    anchor = span(source, 800, 901)
    context = ContextRetriever({source.doc_id: source}).context([anchor], max_chars=100)
    assert not context.spans
    assert "max_chars" in context.limits_hit
    assert context.status != "available"


def test_http_context_returns_late_quote_under_small_budget(demo):
    quote = "Synthetic late exception; see section 99."
    source = source_with(demo, "Section 1. Coverage\n" + "Ordinary synthetic text. " * 300 + quote)
    demo.save_collection("sources", {source.doc_id: source})
    original = demo.read("sources.json")
    start = source.text.index(quote)
    with TestClient(create_app(demo.root)) as client:
        response = client.get(f"/api/v1/sources/{source.doc_id}/context", params={
            "start": start, "end": start + len(quote), "max_chars": 100,
        })
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "partial"
    assert any(quote in item["text"] for item in body["spans"])
    assert sum(len(item["text"]) for item in body["spans"]) <= 100
    assert any(item["status"] == "missing" and item["target_section"] == "99" for item in body["dependencies"])
    assert not body["semantic_verification"]
    assert demo.read("sources.json") == original
