"""Registered-fact payloads and one bounded repair, using fictional local output only."""
from copy import deepcopy
import json

import pytest

from navigator import extraction
from navigator.demo import SyntheticProvider, synthetic_bundle
from navigator.fact_inputs import FACT_DEFINITIONS
from navigator.store import digest


class ScriptedProvider(SyntheticProvider):
    model = 'synthetic-fact-contract-fixture-not-an-LLM'

    def __init__(self, source, *outputs):
        super().__init__(source)
        self.outputs = outputs
        self.requests = []

    def generate(self, instruction, payload):
        super().generate(instruction, payload)  # Refuse non-fixture source material.
        self.requests.append((instruction, deepcopy(payload)))
        return deepcopy(self.outputs[min(len(self.requests) - 1, len(self.outputs) - 1)])


def fixture_bundle(demo):
    source = next(iter(demo.sources().values()))
    return source, synthetic_bundle(source)


def invalid_enum(bundle):
    bundle['rules'][0]['coverage_conditions'] = {
        'op': 'eq', 'fact': 'owner_type', 'value': 'natural_person'}
    return bundle


def remove_binding(bundle):
    for span in bundle['rules'][0]['evidence']:
        span['supports'] = [name for name in span['supports'] if name != 'exemption_conditions']
    return bundle


def test_fact_table_losslessly_preserves_every_registered_definition():
    contract = extraction.registered_fact_contract()
    assert contract['columns'] == ['field', 'type', 'meaning_prefix', 'meaning', 'allowed_values']
    assert [row[0] for row in contract['fields']] == sorted(FACT_DEFINITIONS)
    for field, kind, prefix, meaning, allowed in contract['fields']:
        definition = FACT_DEFINITIONS[field]
        assert kind == definition.data_type
        assert contract['meaning_prefixes'][prefix] + meaning == definition.meaning
        assert allowed == definition.allowed_values
    owner_row = next(row for row in contract['fields'] if row[0] == 'owner_type')
    owner_row[-1].append('not-a-registered-value')
    assert 'not-a-registered-value' not in FACT_DEFINITIONS['owner_type'].allowed_values
    assert 'Never automatically alias near-synonyms' in extraction.SYSTEM
    assert 'Distinct source-defined facts remain allowed' in extraction.SYSTEM


def test_exact_fact_payload_reaches_all_passes_and_preserves_legal_issues(demo):
    source, reviewed = fixture_bundle(demo)
    invalid_enum(reviewed)
    reviewed['issues'] = ['A genuine source-wide qualification remains unresolved.']
    reviewed['rules'][0]['review_issues'] = ['The source leaves a genuine actor-scope ambiguity.']
    repaired = deepcopy(reviewed)
    # This explicit mock-provider correction stands for new reviewed output; no alias
    # is performed by the pipeline or inferred by the test from the source semantics.
    repaired['rules'][0]['coverage_conditions']['value'] = 'individual'
    repaired['issues'] = repaired['rules'][0]['review_issues'] = []
    provider = ScriptedProvider(source, reviewed, reviewed, repaired)
    run = extraction.extract(demo, provider=provider)
    assert run.outcome == 'success' and len(provider.requests) == 3
    expected = extraction.registered_fact_contract()
    for _, payload in provider.requests:
        assert payload['fact_contract'] == expected
        assert payload['fact_contract_sha256'] == digest(expected)
    assert run.config['fact_contract_sha256'] == digest(expected)
    assert run.config['repair_attempts'] == 1
    repair_instruction, repair_payload = provider.requests[-1]
    assert repair_instruction == extraction.REPAIR_INSTRUCTIONS
    assert 'Fact contract mismatch at coverage_conditions' in repair_payload['validation_error']
    assert repair_payload['draft'] == reviewed  # Guard must not mutate raw provider output.
    rule = next(iter(demo.rules().values()))
    assert rule.coverage_conditions.value == 'individual'
    assert set(rule.review_issues) == {*reviewed['issues'], *reviewed['rules'][0]['review_issues']}
    assert demo.read('extraction_index.json')[source.doc_id]['status'] == 'review'
    raw = next((demo.root / 'provider_outputs' / run.run_id).glob('*-review.json'))
    assert json.loads(raw.read_text()) == reviewed


def test_missing_required_binding_gets_one_source_grounded_repair(demo):
    source, repaired = fixture_bundle(demo)
    reviewed = remove_binding(deepcopy(repaired))
    provider = ScriptedProvider(source, reviewed, reviewed, repaired)
    run = extraction.extract(demo, provider=provider)
    assert run.outcome == 'success' and len(provider.requests) == 3
    assert 'Missing field-level evidence for exemption_conditions' in provider.requests[-1][1]['validation_error']
    rule = next(iter(demo.rules().values()))
    assert not rule.review_issues
    assert any('exemption_conditions' in span.supports for span in rule.evidence)
    assert all(source.text[span.start:span.end] == span.quote for span in rule.evidence)


@pytest.mark.parametrize('defect', [invalid_enum, remove_binding])
def test_unresolved_contract_issue_is_retained_after_single_repair(demo, defect):
    source, bundle = fixture_bundle(demo)
    defect(bundle)
    provider = ScriptedProvider(source, bundle)
    run = extraction.extract(demo, provider=provider)
    assert run.outcome == 'success' and len(provider.requests) == 3
    rule = next(iter(demo.rules().values()))
    assert rule.review_issues
    assert demo.read('extraction_index.json')[source.doc_id]['status'] == 'review'
    if defect is invalid_enum:
        assert rule.coverage_conditions.op == 'unsupported'
        assert any('Fact contract mismatch' in issue for issue in rule.review_issues)
    else:
        assert 'Missing field-level evidence for exemption_conditions' in rule.review_issues


def test_genuine_or_preexisting_issues_do_not_trigger_mechanical_repair(demo):
    source, bundle = fixture_bundle(demo)
    invalid_enum(bundle)
    # An already flagged issue is not newly detected and cannot spend the repair slot.
    guarded = extraction.validate_bundle(
        extraction.ExtractionBundle.model_validate(bundle), demo.sources(), source.doc_id)
    bundle['rules'][0]['review_issues'] = [*guarded.rules[0].review_issues, 'Genuine interpretation uncertainty.']
    provider = ScriptedProvider(source, bundle)
    extraction.extract(demo, provider=provider)
    assert len(provider.requests) == 2
    assert next(iter(demo.rules().values())).review_issues == sorted(bundle['rules'][0]['review_issues'])


def test_custom_source_defined_fact_remains_possible_without_alias_or_repair(demo):
    source, bundle = fixture_bundle(demo)
    bundle['rules'][0]['coverage_conditions'] = {
        'op': 'eq', 'fact': 'source_specific_owner_definition', 'value': 'natural_person'}
    bundle['rules'][0]['review_issues'] = ['Source-defined ownership qualification needs interpretation.']
    provider = ScriptedProvider(source, bundle)
    extraction.extract(demo, provider=provider)
    assert len(provider.requests) == 2
    rule = next(iter(demo.rules().values()))
    assert rule.coverage_conditions.fact == 'source_specific_owner_definition'
    assert rule.coverage_conditions.value == 'natural_person'
    assert rule.review_issues == bundle['rules'][0]['review_issues']


def test_structural_repair_and_contract_repair_share_one_slot(demo):
    source, bundle = fixture_bundle(demo)
    invalid_enum(bundle)
    provider = ScriptedProvider(source, {'rules': 'invalid-schema'}, {'rules': 'invalid-schema'}, bundle)
    run = extraction.extract(demo, provider=provider)
    assert run.outcome == 'success' and len(provider.requests) == 3
    rule = next(iter(demo.rules().values()))
    assert rule.coverage_conditions.op == 'unsupported'
    assert any('Fact contract mismatch' in issue for issue in rule.review_issues)


@pytest.mark.parametrize('change', ['omit_rule', 'rename_rule', 'invalid_schema'])
def test_mechanical_repair_cannot_discard_reviewed_rule_identity(demo, change):
    source, bundle = fixture_bundle(demo)
    invalid_enum(bundle)
    repaired = deepcopy(bundle)
    if change == 'omit_rule':
        repaired['rules'] = []
    elif change == 'rename_rule':
        repaired['rules'][0]['provision_key'] = 'different-rule'
    else:
        repaired['rules'] = 'invalid-schema'
    before = demo.read('rules.json')
    provider = ScriptedProvider(source, bundle, bundle, repaired)
    run = extraction.extract(demo, provider=provider)
    assert run.outcome == 'failed' and len(provider.requests) == 3
    assert demo.read('rules.json') == before
    assert demo.read('extraction_index.json')[source.doc_id]['status'] == 'failed'
    if change != 'invalid_schema':
        assert 'changed rule identities' in run.errors[0]


def test_same_prompt_registry_change_invalidates_cache_and_draft_lineage(demo, monkeypatch):
    source, bundle = fixture_bundle(demo)
    provider = ScriptedProvider(source, bundle)
    old_run = extraction.extract(demo, provider=provider)
    prior_files = {p: p.read_bytes() for folder in ('extraction_cache', f'provider_outputs/{old_run.run_id}')
                   for p in (demo.root / folder).glob('*.json')}
    definition = FACT_DEFINITIONS['owner_type'].model_copy(deep=True)
    definition.meaning += ' Additional explicit fictional fixture qualification.'
    monkeypatch.setitem(FACT_DEFINITIONS, 'owner_type', definition)
    new_run = extraction.extract(demo, provider=provider)
    assert len(provider.requests) == 4
    assert old_run.config['prompt_version'] == new_run.config['prompt_version']
    assert old_run.config['fact_contract_sha256'] != new_run.config['fact_contract_sha256']
    assert new_run.counts['cache_hits'] == new_run.counts['draft_replays'] == 0
    assert next(iter(demo.rules().values())).extraction_run_id == new_run.run_id
    assert all(path.read_bytes() == data for path, data in prior_files.items())


def test_previous_prompt_cache_remains_untouched(demo, monkeypatch):
    source, bundle = fixture_bundle(demo)
    provider = ScriptedProvider(source, bundle)
    with monkeypatch.context() as previous:
        previous.setattr(extraction, 'PROMPT_VERSION', 'extract-v4-applicability-and-review-notes')
        old_run = extraction.extract(demo, provider=provider)
    prior_files = {p: p.read_bytes() for folder in ('extraction_cache', f'provider_outputs/{old_run.run_id}')
                   for p in (demo.root / folder).glob('*.json')}
    new_run = extraction.extract(demo, provider=provider)
    assert len(provider.requests) == 4
    assert new_run.config['prompt_version'].startswith('extract-v5-')
    assert new_run.config['prompt_version'] != old_run.config['prompt_version']
    assert new_run.counts['cache_hits'] == new_run.counts['draft_replays'] == 0
    assert all(path.read_bytes() == data for path, data in prior_files.items())
