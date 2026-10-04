"""Fictional code compilations exercise scoped context, not legal correctness."""
import pytest

from navigator.models import SourceDocument
from navigator.retrieval import ContextRetriever, sections, source_units, span
from navigator.store import digest


def document(ident, text):
    return SourceDocument(doc_id=ident, jurisdictions=['CA'], url='https://example.invalid/' + ident,
                          retrieved_at='2026-10-04', text=text, sha256=digest(text.encode()),
                          capture_status='synthetic', authority='official', source_type='legal_text')


def quote(source, text):
    start = source.text.index(text)
    return span(source, start, start + len(text))


@pytest.fixture
def compilation():
    primary = document('PRIMARY_1',
        'Fictional compilation header.\n'
        '16720.\nUnrelated motor-carrier provision. See section 34601.\n'
        '16729.\nCovered persons are as defined in section 16702.\n'
        'An independently quoted obligation applies to those persons.\n'
        '(Added by a fictional measure. Effective January 1, 2026.)\n'
        '16730.\nUnrelated later provision pursuant to section 13703.\n')
    support = document('SUPPORT_2',
        'Fictional definitions.\n16701.\nUnrelated definition. See section 999.\n'
        '16702.\nPerson includes the fictional class expressly described here.\n'
        '16703.\nUnrelated final definition.\n')
    anchors = [quote(primary, 'An independently quoted obligation applies to those persons.'),
               quote(primary, '(Added by a fictional measure. Effective January 1, 2026.)'),
               quote(support, 'Person includes the fictional class expressly described here.')]
    return primary, support, anchors


def test_statutory_headings_exclude_unquoted_sections_and_resolve_cited_definition(compilation):
    primary, support, anchors = compilation
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context(anchors)
    assert context.status == 'available' and not context.semantic_verification
    assert [(d.target_doc_id, d.target_section, d.status) for d in context.dependencies] == [
        (support.doc_id, '16702', 'resolved')]
    assert {(s.doc_id, s.section) for s in context.spans} == {
        (primary.doc_id, '16729'), (support.doc_id, '16702')}
    assert all('34601' not in s.text and '13703' not in s.text and '999' not in s.text for s in context.spans)
    assert ''.join(s.text for s in source_units(primary)) == primary.text


@pytest.mark.parametrize('newline', ['\n', '\r\n'])
def test_short_inline_and_indented_numbered_lists_are_not_statutory_headings(newline):
    source = document('LIST_1', '16729.\nFictional statutory body.\n'
        '1. Ordinary inline item.\n2.\nOrdinary short standalone item.\n'
        '123. Ordinary longer inline item.\n 456.\nIndented list continuation.\n'
        '16729.5.\nA distinct decimal statutory heading.\n')
    source = document(source.doc_id, source.text.replace('\n', newline))
    assert [label for label, _, _ in sections(source)] == ['16729', '16729.5']
    assert ''.join(s.text for s in source_units(source)) == source.text


def test_missing_reference_in_an_actually_quoted_section_still_blocks(compilation):
    primary, support, _ = compilation
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context([
        quote(primary, 'Unrelated motor-carrier provision.')])
    assert [(d.target_section, d.status) for d in context.dependencies] == [('34601', 'missing')]
    assert context.status == 'partial'


@pytest.mark.parametrize('budget', [24000, 75])
def test_boundary_crossing_anchor_expands_only_intersected_sections_and_stays_whole(budget):
    source = document('CROSS_1', 'Section 1.\nUnrelated see section 999.\n'
        'Section 2.\nLead material. Boundary-start\n'
        'Section 3.\nBoundary-end. Tail material.\n'
        'Section 4.\nUnrelated see section 888.\n')
    start, end = source.text.index('Boundary-start'), source.text.index('Boundary-end') + len('Boundary-end')
    anchor = span(source, start, end)
    context = ContextRetriever({source.doc_id: source}).context([anchor], max_chars=budget)
    assert len(context.spans) == 1 and not context.dependencies
    window = context.spans[0]
    assert window.start <= start < end <= window.end
    assert window.text == source.text[window.start:window.end]
    assert '999' not in window.text and '888' not in window.text
    assert len(window.text) <= budget
    if budget == 24000:
        assert context.status == 'available'
        assert window.start == source.text.index('Section 2.')
        assert window.end == source.text.index('Section 4.')
    else:
        assert context.status == 'partial' and 'section_windowed' in context.limits_hit


def test_uncited_matching_source_and_unanchored_section_cannot_resolve_reference(compilation):
    primary, support, anchors = compilation
    retriever = ContextRetriever({s.doc_id: s for s in (primary, support)})
    for provided in [anchors[:2], [*anchors[:2], quote(support, 'Unrelated final definition.')]]:
        context = retriever.context(provided)
        dependency = next(d for d in context.dependencies if d.target_section == '16702')
        assert dependency.status == 'missing' and not dependency.spans
        assert context.status == 'partial'


def test_uncited_duplicate_is_ignored_but_two_cited_matches_remain_ambiguous(compilation):
    primary, support, anchors = compilation
    duplicate = document('OTHER_3', '16702.\nAnother fictional definition under separate authority.\n')
    retriever = ContextRetriever({s.doc_id: s for s in (primary, support, duplicate)})
    assert retriever.context(anchors).dependencies[0].status == 'resolved'
    extra = quote(duplicate, 'Another fictional definition under separate authority.')
    context = retriever.context([*anchors, extra])
    dependency = next(d for d in context.dependencies if d.target_section == '16702')
    assert dependency.status == 'ambiguous' and dependency.target_doc_id is None and not dependency.spans
    assert context.status == 'partial'


def test_duplicate_headings_in_cited_support_remain_ambiguous(compilation):
    primary, support, anchors = compilation
    support = document(support.doc_id, support.text + '16702.\nA competing version of the definition.\n')
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context([
        *anchors[:2], quote(support, 'Person includes the fictional class expressly described here.')])
    assert context.dependencies[0].status == 'ambiguous'


def test_explicit_document_reference_never_falls_back_to_another_support(compilation):
    _, support, anchors = compilation
    primary = document('PRIMARY_1', '16729.\nPerson is as defined in MISSING9 section 16702.\n')
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context([
        quote(primary, 'Person is as defined in MISSING9 section 16702.'), anchors[-1]])
    assert context.dependencies[0].status == 'missing'
    assert context.dependencies[0].target_doc_id == 'MISSING9'


def test_existing_local_target_takes_precedence_over_support(compilation):
    primary, support, anchors = compilation
    primary = document(primary.doc_id, primary.text + '16702.\nLocal fictional definition.\n')
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context([
        quote(primary, 'An independently quoted obligation applies to those persons.'), anchors[-1]])
    assert context.dependencies[0].status == 'resolved'
    assert context.dependencies[0].target_doc_id == primary.doc_id


@pytest.mark.parametrize('limit,expected', [({'max_depth': 0}, 'depth_limit'), ({'max_spans': 1}, 'budget_limit')])
def test_cross_document_resolution_preserves_depth_and_budget_limits(compilation, limit, expected):
    primary, support, anchors = compilation
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context(anchors, **limit)
    assert context.dependencies[0].status == expected and not context.dependencies[0].spans
    assert context.status == 'partial' and context.limits_hit


def test_cross_document_cycle_remains_unresolved(compilation):
    primary, support, anchors = compilation
    support = document(support.doc_id, '16702.\nDefinition is subject to section 16729.\n')
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context([
        *anchors[:2], quote(support, 'Definition is subject to section 16729.')])
    assert {d.status for d in context.dependencies} == {'resolved', 'cycle'}
    assert context.status == 'partial'


def test_stale_support_anchor_cannot_resolve_an_implicit_reference(compilation):
    primary, support, anchors = compilation
    stale = anchors[-1].model_copy(update={'source_hash': '0' * 64})
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context([*anchors[:2], stale])
    assert context.dependencies[0].status == 'missing'
    assert f'stale_anchor:{support.doc_id}' in context.limits_hit
