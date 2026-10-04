"""Fictional source shapes distinguish retained context from traversal cycles."""
import pytest

from navigator.models import SourceDocument
from navigator.retrieval import ContextRetriever, DEFAULT_CONTEXT_CHARS, span
from navigator.store import digest


def source(text):
    return SourceDocument(doc_id='FICTIONAL_1', jurisdictions=['ZZ'],
        url='https://example.invalid/fictional', retrieved_at='2026-10-04',
        text=text, sha256=digest(text.encode()), capture_status='synthetic',
        authority='official', source_type='legal_text')


def context(text, quote, **limits):
    doc = source(text)
    start = text.index(quote)
    return ContextRetriever({doc.doc_id: doc}).context(
        [span(doc, start, start + len(quote))], **limits)


@pytest.mark.parametrize('max_depth', [0, 2])
def test_notice_reference_to_own_retained_section_does_not_create_cycle(max_depth):
    text = '1946.2.\nFictional notice: “See Section 1946.2 for more information.”\n'
    result = context(text, 'Fictional notice', max_depth=max_depth)
    assert result.status == 'available' and not result.limits_hit
    assert len(result.spans) == 1 and result.spans[0].text == text
    assert len(result.dependencies) == 1
    dependency = result.dependencies[0]
    assert dependency.status == 'resolved'
    assert dependency.spans == result.spans
    assert dependency.origin.text == 'See Section 1946.2'
    assert not result.semantic_verification


def test_self_reference_keeps_missing_external_dependency_and_real_cycle():
    text = ('Section 1.\nSee section 1. See section 2. See section 9.\n'
            'Section 2.\nSubject to section 1.\n')
    result = context(text, 'See section 1.')
    assert result.status == 'partial'
    by_origin = {dependency.origin.text: dependency for dependency in result.dependencies}
    assert by_origin['See section 1.'].status == 'resolved'
    assert by_origin['See section 2.'].status == 'resolved'
    assert by_origin['Subject to section 1.'].status == 'cycle'
    assert by_origin['See section 9.'].status == 'missing'


def test_self_reference_does_not_accept_duplicate_section_identity():
    result = context('Section 1.\nSee section 1.\nSection 1.\nOther version.\n', 'See section 1.')
    assert result.status == 'partial'
    assert result.dependencies[0].status in {'ambiguous', 'cycle'}
    assert not result.dependencies[0].spans


def test_windowed_self_reference_stays_incomplete_when_whole_section_does_not_fit():
    result = context('Section 1.\nSee section 1.\n' + 'Fictional provision. ' * 100,
                     'See section 1.', max_chars=100)
    assert result.status == 'partial'
    assert 'section_windowed' in result.limits_hit
    assert result.dependencies[0].status == 'budget_limit'
    assert not result.dependencies[0].spans
    assert sum(len(item.text) for item in result.spans) <= 100


def test_default_budget_retains_complete_medium_section_and_header():
    # Similar size to retained statutory pages; their full text exceeds the old
    # 24k budget. More local text is scanned, without dropping tail exceptions.
    text = 'Fictional source header.\nSection 1.\n' + 'Fictional provision. ' * 1300 + '\nSee section 99.\n'
    assert 24000 < len(text) < DEFAULT_CONTEXT_CHARS
    doc = source(text)
    anchor = span(doc, text.index('Fictional provision.'), text.index('Fictional provision.') + 10)
    header = span(doc, 0, 9)
    retriever = ContextRetriever({doc.doc_id: doc})
    result = retriever.context([anchor, header])
    assert not result.limits_hit
    assert sum(len(item.text) for item in result.spans) == len(text)
    assert result.limits['max_chars'] == DEFAULT_CONTEXT_CHARS
    assert result.status == 'partial'  # The newly included genuine reference stays unresolved.
    assert result.dependencies[0].target_section == '99'
    assert result.dependencies[0].status == 'missing'
    bounded = retriever.context([anchor, header], max_chars=24000)
    assert 'section_windowed' in bounded.limits_hit and bounded.status == 'partial'
    assert sum(len(item.text) for item in bounded.spans) <= 24000


def test_default_budget_still_marks_larger_sources_incomplete():
    result = context('Section 1.\n' + 'Fictional provision. ' * 2000,
                     'Fictional provision.')
    assert result.status == 'partial'
    assert 'section_windowed' in result.limits_hit
    assert sum(len(item.text) for item in result.spans) <= DEFAULT_CONTEXT_CHARS
