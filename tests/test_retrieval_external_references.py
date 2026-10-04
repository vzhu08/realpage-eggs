"""Chapter-qualified references must not borrow an unrelated section identity."""
import pytest

from navigator.models import SourceDocument
from navigator.retrieval import ContextRetriever, span
from navigator.store import digest


def document(ident, text):
    return SourceDocument(doc_id=ident, jurisdictions=['ZZ'], url='https://example.invalid/' + ident,
                          retrieved_at='2026-10-04', text=text, sha256=digest(text.encode()),
                          capture_status='synthetic', authority='official', source_type='legal_text')


def anchor(source, text):
    start = source.text.index(text)
    return span(source, start, start + len(text))


@pytest.mark.parametrize('chapter', ['27B', '512', 'XIV'])
def test_different_chapter_same_section_is_missing_not_a_cycle(chapter):
    reference = f'under section 4 of chapter {chapter}'
    source = document('PRIMARY_1', f'Chapter 8\nSection 4.\nRemedy {reference}; scope unchanged.\n')
    context = ContextRetriever({source.doc_id: source}).context([anchor(source, reference)])
    assert context.status == 'partial'
    assert len(context.dependencies) == 1
    dependency = context.dependencies[0]
    assert dependency.status == 'missing' and dependency.target_doc_id is None
    assert dependency.target_section == '4' and not dependency.spans
    assert dependency.reference == reference
    assert 'chapter' in dependency.explanation and chapter.casefold() in dependency.explanation


@pytest.mark.parametrize('cited_support', [False, True])
def test_same_numbered_foreign_section_does_not_establish_chapter_identity(cited_support):
    reference = 'see section 7 of chapter 81'
    primary = document('PRIMARY_1', f'Section 1.\nObligation {reference}.\n')
    support = document('SUPPORT_2', 'Chapter 81\nSection 7.\nA separately retained provision.\n')
    anchors = [anchor(primary, reference)]
    if cited_support:
        anchors.append(anchor(support, 'A separately retained provision.'))
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context(anchors)
    dependency = context.dependencies[0]
    assert dependency.status == 'missing' and not dependency.spans
    assert dependency.target_doc_id is None
    assert context.status == 'partial'


def test_ordinary_local_reference_still_resolves_and_true_cycle_remains():
    source = document('PRIMARY_1', 'Section 1.\nSee section 2.\nSection 2.\nSubject to section 1.\n')
    context = ContextRetriever({source.doc_id: source}).context([anchor(source, 'See section 2.')])
    assert {(d.target_section, d.status) for d in context.dependencies} == {('2', 'resolved'), ('1', 'cycle')}
    assert all(d.target_doc_id == source.doc_id for d in context.dependencies)
    assert context.status == 'partial'


def test_explicit_document_reference_keeps_document_identity():
    primary = document('PRIMARY_1', 'Section 4.\nSee SUPPORT_2 section 4. See MISSING_3 section 4.\n')
    support = document('SUPPORT_2', 'Section 4.\nExplicitly identified foreign provision.\n')
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context([
        anchor(primary, 'See SUPPORT_2 section 4.')])
    assert {(d.target_doc_id, d.status) for d in context.dependencies} == {
        ('SUPPORT_2', 'resolved'), ('MISSING_3', 'missing')}
    resolved = next(d for d in context.dependencies if d.status == 'resolved')
    assert resolved.spans[0].doc_id == support.doc_id


def test_explicit_document_does_not_discard_an_unverified_chapter_qualifier():
    reference = 'see SUPPORT_2 section 4 of chapter 27B'
    primary = document('PRIMARY_1', f'Section 4.\nRemedy {reference}; other conditions remain.\n')
    support = document('SUPPORT_2', 'Chapter 19\nSection 4.\nDifferent chapter.\n')
    context = ContextRetriever({s.doc_id: s for s in (primary, support)}).context([anchor(primary, reference)])
    dependency = context.dependencies[0]
    assert dependency.status == 'missing' and dependency.target_doc_id == support.doc_id
    assert dependency.reference == reference and not dependency.spans


@pytest.mark.parametrize('reference', [
    'under section 4 of chapter 27B',
    'pursuant to section 12(a) of the chapter 18',
    'as defined in sec. 305.2 of ch. 41',
    'subject to § 7 of chapter XIV',
])
def test_whole_qualified_reference_preserves_exact_source_offsets(reference):
    primary = document('PRIMARY_1', f'Unicode preface éΩ.\nSection 4.\nRemedy {reference}; next clause.\n')
    context = ContextRetriever({primary.doc_id: primary}).context([anchor(primary, reference)])
    dependency = context.dependencies[0]
    assert dependency.reference == dependency.origin.text == reference
    assert dependency.origin.start == primary.text.index(reference)
    assert dependency.origin.end == dependency.origin.start + len(reference)
    assert primary.text[dependency.origin.start:dependency.origin.end] == reference
    assert dependency.origin.source_hash == primary.sha256
    assert dependency.status == 'missing'
