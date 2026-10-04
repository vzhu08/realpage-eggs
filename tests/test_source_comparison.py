"""Synthetic software checks; fixture claims are not legal evidence."""
from datetime import date

import pytest

from navigator.models import Expression, Interaction
from navigator.retrieval import span
from navigator.source_comparison import compare_claims, compare_impacts, compare_rule_versions, compare_sources
from navigator.store import digest


def changed_source(source, text):
    return source.model_copy(update={"text": text, "sha256": digest(text.encode("utf-8"))}, deep=True)


def test_formatting_only_still_invalidates_old_offsets(demo, rule):
    source = demo.sources()[rule.source_doc_id]
    revised = changed_source(source, "\n" + source.text)
    result = compare_rule_versions(rule, rule, {source.doc_id: source}, {source.doc_id: revised})
    assert result["sources"][source.doc_id]["classification"] == "formatting_only"
    assert not result["substantive_encoding_changed"]
    assert "after:invalid_or_missing_evidence" in result["support_gaps"]
    assert not result["evidence_checks"]["after"][0]["anchor_valid"]
    assert result["evidence_checks"]["after"][0]["exact_quote_positions"]
    assert result["winner"] is None and result["legal_amendment"] is None


def test_reanchored_evidence_is_distinct_from_changed_requirement(demo, rule):
    source = demo.sources()[rule.source_doc_id]
    revised = changed_source(source, "\n" + source.text)
    updated = rule.model_copy(deep=True)
    for item in updated.evidence + [e for event in updated.status_events for e in event.evidence]:
        item.start += 1
        item.end += 1
    before = rule.model_dump()
    result = compare_rule_versions(rule, updated, {source.doc_id: source}, {source.doc_id: revised})
    assert not result["support_gaps"] and not result["substantive_encoding_changed"]
    assert [o["kind"] for o in result["observations"]] == ["quotation_or_offset_change"]
    assert rule.model_dump() == before and revised.text.startswith("\n")


@pytest.mark.parametrize('field,value,kind', [
    ('requirement', 'A different synthetic obligation.', 'requirement'),
    ('key_value', 'two months', 'threshold'),
    ('coverage_conditions', Expression(op='gte', fact='units', value=9), 'coverage'),
    ('exemption_conditions', Expression(op='eq', fact='owner_occupied', value=True), 'exemption'),
    ('effective_date', '2026-12-01', 'effective_date'),
    ('end_date', '2027-01', 'end_date'),
    ('lifecycle', 'pending', 'lifecycle'),
])
def test_changed_encodings_retain_both_claims_without_semantic_endorsement(demo, rule, field, value, kind):
    updated = rule.model_copy(deep=True)
    setattr(updated, field, value)
    result = compare_rule_versions(rule, updated, demo.sources(), demo.sources())
    assert result['substantive_encoding_changed'] and result['status'] == 'unresolved'
    assert any(o['field'] == field and o['kind'] == kind for o in result['observations'])
    assert result['claims']['before'][field] != result['claims']['after'][field]
    assert result['semantic_support'] == 'not_checked' and result['winner'] is None


def test_citation_relocation_and_whitespace_are_not_legal_amendments(demo, rule):
    updated = rule.model_copy(update={'citation': 'Synthetic renumbered section 3', 'requirement': rule.requirement.replace(' ', '  ')}, deep=True)
    result = compare_rule_versions(rule, updated, demo.sources(), demo.sources())
    assert {'formatting', 'citation_relocation'} <= {o['kind'] for o in result['observations']}
    assert not result['substantive_encoding_changed'] and result['legal_amendment'] is None


def test_supported_interaction_scope_change_is_not_automatic_precedence(demo, rule):
    updated = rule.model_copy(deep=True)
    updated.interactions = [Interaction(kind='supersedes', target_citation='Synthetic target', target_jurisdiction='CA',
        category=rule.category, scope=Expression(op='eq', fact='residential', value=True),
        evidence=rule.evidence, note='Synthetic conditional scope')]
    result = compare_rule_versions(rule, updated, demo.sources(), demo.sources())
    assert any(o['kind'] == 'interaction' for o in result['observations'])
    assert result['status'] == 'unresolved' and result['winner'] is None


def test_missing_source_and_fabricated_quote_remain_explicit(demo, rule):
    updated = rule.model_copy(update={'quoted_span': 'This invented quotation cannot validate source meaning.'}, deep=True)
    result = compare_rule_versions(rule, updated, demo.sources(), {})
    assert 'after:missing_primary_source' in result['support_gaps']
    result = compare_rule_versions(rule, updated, demo.sources(), demo.sources())
    assert 'after:primary_quote_absent' in result['support_gaps']
    assert result['status'] == 'unresolved'


def test_different_claims_and_retrieval_recency_do_not_choose_a_winner(demo, rule):
    source = demo.sources()[rule.source_doc_id]
    newer = source.model_copy(update={'retrieved_at': '2030-01-01'}, deep=True)
    evidence = rule.evidence[0]
    ref = span(source, evidence.start, evidence.end)
    result = compare_claims('effective_date', '2026-11-15', '2026-12-01', [ref], [ref],
                            {source.doc_id: source}, {source.doc_id: newer}, rule_ids=[rule.team_rule_id])
    assert result['classification'] == 'different_claims' and result['status'] == 'unresolved'
    assert result['winner'] is None and result['semantic_support'] == 'not_checked'
    assert result['after']['support'][0]['source']['retrieved_at'] == '2030-01-01'
    result = compare_claims('effective_date', None, '2026-12-01', [], [ref], {}, {source.doc_id: source})
    assert result['classification'] == 'missing_support'


def test_matching_quote_with_wrong_source_hash_fails_identity(demo, rule):
    source = demo.sources()[rule.source_doc_id]
    ref = span(source, rule.evidence[0].start, rule.evidence[0].end)
    stale = source.model_copy(update={'sha256': '0' * 64}, deep=True)
    result = compare_claims('requirement', 'same', 'same', [ref], [ref], {source.doc_id: source}, {source.doc_id: stale})
    assert result['classification'] == 'missing_support'
    assert not result['after']['support'][0]['anchor_valid']


@pytest.mark.parametrize('corruption', ['hash', 'document_id'])
def test_primary_identity_is_checked_when_evidence_uses_another_source(demo, rule, corruption):
    source = demo.sources()[rule.source_doc_id]
    secondary = source.model_copy(update={'doc_id': 'SECONDARY'}, deep=True)
    before = rule.model_copy(deep=True)
    for evidence in before.evidence + [e for event in before.status_events for e in event.evidence]:
        evidence.doc_id = secondary.doc_id
    originals = {source.doc_id: source, secondary.doc_id: secondary}
    changed = {'sha256': '0' * 64} if corruption == 'hash' else {'doc_id': 'UNRELATED'}
    snapshots = {**originals, source.doc_id: source.model_copy(update=changed, deep=True)}

    result = compare_rule_versions(before, before, originals, snapshots)

    assert result['status'] == 'unresolved'
    assert 'after:primary_source_identity_mismatch' in result['support_gaps']
    assert all(c['source_identity_valid'] for c in result['evidence_checks']['after'])
    assert not result['substantive_encoding_changed']


def test_evidence_source_map_cannot_substitute_another_document(demo, rule):
    source = demo.sources()[rule.source_doc_id]
    secondary = source.model_copy(update={'doc_id': 'SECONDARY'}, deep=True)
    updated = rule.model_copy(deep=True)
    updated.evidence[0].doc_id = secondary.doc_id
    originals = {source.doc_id: source, secondary.doc_id: secondary}
    snapshots = {**originals, secondary.doc_id: secondary.model_copy(update={'doc_id': 'UNRELATED'})}

    result = compare_rule_versions(updated, updated, originals, snapshots)

    assert result['status'] == 'unresolved'
    assert 'after:invalid_or_missing_evidence' in result['support_gaps']
    check = result['evidence_checks']['after'][0]
    assert check['anchor_valid']  # Matching bytes do not establish source identity.
    assert not check['source_identity_valid'] and check['remedy']


@pytest.mark.parametrize('field,value,gap', [
    ('semantic_verification', 'needs_review', 'semantic_support_needs_review'),
    ('review_issues', ['Synthetic unresolved interpretation'], 'unresolved_review_issues'),
    ('conflict_flag', True, 'unresolved_conflict'),
])
@pytest.mark.parametrize('changed', [False, True])
def test_review_state_remains_unresolved_without_a_legal_encoding_change(demo, rule, field, value, gap, changed):
    after = rule.model_copy(update={field: value}, deep=True)
    before = rule if changed else after.model_copy(deep=True)
    result = compare_rule_versions(before, after, demo.sources(), demo.sources())

    assert result['status'] == 'unresolved'
    assert f'after:{gap}' in result['support_gaps']
    if not changed:
        assert f'before:{gap}' in result['support_gaps']
    else:
        observation = next(o for o in result['observations'] if o['field'] == field)
        assert observation['kind'] == 'review_state_change'
        assert observation['before'] != observation['after']
    assert not result['substantive_encoding_changed']
    assert not any('missing_field_support' in item for item in result['support_gaps'])
    assert result['semantic_support'] == 'not_checked'
    assert result['winner'] is None and result['legal_amendment'] is None


def test_resolving_review_state_retains_the_before_gap_and_evaluator_difference(demo, rule, prop, resolution):
    before = rule.model_copy(update={'semantic_verification': 'needs_review'}, deep=True)
    result = compare_rule_versions(before, rule, demo.sources(), demo.sources())
    impacts = compare_impacts([before], [rule], prop, resolution, date(2026, 11, 15))

    assert impacts['before'][0]['result'] == 'unknown'
    assert impacts['after'][0]['result'] == 'applies'
    assert 'before:semantic_support_needs_review' in result['support_gaps']
    assert result['status'] == 'unresolved' and not result['substantive_encoding_changed']
    assert result['observations'][0]['field'] == 'semantic_verification'


def test_conflict_explanation_change_is_preserved_as_review_state(demo, rule):
    before = rule.model_copy(update={'conflict_flag': True, 'conflict_note': 'Synthetic first conflict'}, deep=True)
    after = before.model_copy(update={'conflict_note': 'Synthetic revised conflict'}, deep=True)
    result = compare_rule_versions(before, after, demo.sources(), demo.sources())

    observation = next(o for o in result['observations'] if o['field'] == 'conflict_note')
    assert observation['kind'] == 'review_state_change'
    assert observation['before'] == before.conflict_note and observation['after'] == after.conflict_note
    assert result['status'] == 'unresolved' and not result['substantive_encoding_changed']


def test_source_regions_preserve_original_text_and_bound_long_diffs(demo, rule):
    source = demo.sources()[rule.source_doc_id]
    a = changed_source(source, 'first\nshared\nthird\nshared\nfifth\n')
    b = changed_source(source, 'one\nshared\nthree\nshared\nfive\n')
    result = compare_sources(a, b, max_spans=1)
    assert result['classification'] == 'text_changed' and result['truncated']
    for side, current in [('before_span', a), ('after_span', b)]:
        ref = result['changes'][0][side]
        assert current.text[ref['start']:ref['end']] == ref['text']
    with pytest.raises(ValueError): compare_sources(a, b, max_spans=0)


def test_impact_comparison_uses_existing_evaluator_and_preserves_inputs(demo, rule, prop, resolution, monkeypatch):
    from navigator import source_comparison
    from navigator.engine import evaluate_rules
    calls = []
    def evaluate(*args):
        calls.append(args)
        return evaluate_rules(*args)
    monkeypatch.setattr(source_comparison, 'evaluate_rules', evaluate)
    updated = rule.model_copy(update={'effective_date': '2026-12-01'}, deep=True)
    before = (rule.model_dump(), updated.model_dump(), prop.model_dump(), resolution.model_dump())
    result = compare_impacts([rule], [updated], prop, resolution, date(2026, 11, 15))
    assert len(calls) == 2 and result['before'][0]['result'] == 'applies'
    assert result['after'][0]['result'] == 'not_yet_effective'
    assert before == (rule.model_dump(), updated.model_dump(), prop.model_dump(), resolution.model_dump())
