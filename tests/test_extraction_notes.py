"""Review notes and prompt-version isolation use only fictional local providers."""
from copy import deepcopy
from datetime import date
import json

import pytest

from navigator.demo import SyntheticProvider, synthetic_bundle
from navigator.engine import evaluate_rule
from navigator.extraction import PROMPT_VERSION, extract
from navigator.models import ExtractionBundle


class NotesProvider(SyntheticProvider):
    model = 'synthetic-notes-fixture-not-an-LLM'

    def __init__(self, source, bundle):
        super().__init__(source)
        self.bundle = bundle
        self.calls = 0

    def generate(self, instruction, payload):
        super().generate(instruction, payload)  # Refuse non-fixture material.
        assert 'notes' in payload['schema']['properties']
        self.calls += 1
        return deepcopy(self.bundle)


def test_informational_notes_survive_extraction_and_replay_without_blocking_coverage(demo, prop, resolution):
    source = next(iter(demo.sources().values()))
    bundle = synthetic_bundle(source)
    bundle['notes'] = ['All six categories examined.', 'The date is stated expressly.', 'All six categories examined.']
    provider = NotesProvider(source, bundle)
    run = extract(demo, provider=provider)
    rule = next(iter(demo.rules().values()))
    assert run.outcome == 'success' and rule.review_issues == []
    assert evaluate_rule(rule, prop, resolution, date(2026, 11, 15)).result == 'applies'
    entry = demo.read('extraction_index.json')[source.doc_id]
    assert entry['status'] == 'complete' and entry['issues'] == []
    assert entry['notes'] == sorted(set(bundle['notes']))
    cache_path = next(p for p in (demo.root / 'extraction_cache').glob('*.json')
                      if json.loads(p.read_text())['model'] == provider.model)
    before = cache_path.read_bytes()
    assert json.loads(before)['bundle']['notes'] == bundle['notes']
    reviewed = next((demo.root / 'provider_outputs' / run.run_id).glob('*-review.json'))
    assert json.loads(reviewed.read_text())['notes'] == bundle['notes']

    class NoCalls(NotesProvider):
        def generate(self, *_):
            pytest.fail('Replaying current-version notes must not call the provider')

    replay = extract(demo, provider=NoCalls(source, bundle))
    assert replay.counts['cache_hits'] == 1 and cache_path.read_bytes() == before
    assert demo.read('extraction_index.json')[source.doc_id]['notes'] == entry['notes']
    assert next(iter(demo.rules().values())).review_issues == []


@pytest.mark.parametrize('blocking_location', ['issues', 'review_issues'])
def test_notes_never_clear_genuine_source_or_rule_blockers(demo, prop, resolution, blocking_location):
    source = next(iter(demo.sources().values()))
    bundle = synthetic_bundle(source)
    blocker = 'The supplied fixture omits a material qualification needed for coverage.'
    bundle['notes'] = ['All six categories examined.']
    if blocking_location == 'issues':
        bundle['issues'] = [blocker]
    else:
        bundle['rules'][0]['review_issues'] = [blocker]
    extract(demo, provider=NotesProvider(source, bundle))
    rule = next(iter(demo.rules().values()))
    assert blocker in rule.review_issues
    assert bundle['notes'][0] not in rule.review_issues
    assert demo.read('extraction_index.json')[source.doc_id]['status'] == 'review'
    assert evaluate_rule(rule, prop, resolution, date(2026, 11, 15)).result == 'unknown'


def test_conditional_coverage_is_preserved_instead_of_broadened(demo, prop, resolution):
    source = next(iter(demo.sources().values()))
    bundle = synthetic_bundle(source)
    bundle['notes'] = ['This fixture is a conditional obligation.']
    expected = deepcopy(bundle['rules'][0]['coverage_conditions'])
    extract(demo, provider=NotesProvider(source, bundle))
    rule = next(iter(demo.rules().values()))
    assert rule.coverage_conditions.model_dump(exclude_defaults=True) == expected
    prop.facts['units'] = 2
    assert evaluate_rule(rule, prop, resolution, date(2026, 11, 15)).result == 'inapplicable'
    prop.facts.pop('units')
    assert evaluate_rule(rule, prop, resolution, date(2026, 11, 15)).result == 'unknown'


def test_previous_prompt_cache_is_not_reused_or_rewritten(demo, monkeypatch):
    from navigator import extraction
    source = next(iter(demo.sources().values()))
    old_bundle = synthetic_bundle(source)
    old_bundle['issues'] = ['Legacy unresolved issue retained verbatim.']
    provider = NotesProvider(source, old_bundle)
    with monkeypatch.context() as legacy:
        legacy.setattr(extraction, 'PROMPT_VERSION', 'extract-v3-core-json-input')
        old_run = extract(demo, provider=provider)
    prior_files = {p: p.read_bytes() for folder in ('extraction_cache', f'provider_outputs/{old_run.run_id}')
                   for p in (demo.root / folder).glob('*.json')}
    assert provider.calls == 2

    # Explicit new extraction uses the new prompt and schema. It does not
    # reinterpret old issue strings or silently reuse old outputs as v4 evidence.
    provider.bundle = synthetic_bundle(source)
    provider.bundle['notes'] = ['New local-fixture output, not a conversion of the legacy issue.']
    new_run = extract(demo, provider=provider)
    assert new_run.config['prompt_version'] == PROMPT_VERSION != old_run.config['prompt_version']
    assert new_run.counts['cache_hits'] == new_run.counts['draft_replays'] == 0
    assert provider.calls == 4
    assert all(p.read_bytes() == raw for p, raw in prior_files.items())
    assert any(json.loads(raw).get('bundle', {}).get('issues') == old_bundle['issues'] for raw in prior_files.values())


def test_legacy_bundle_notes_default_does_not_reclassify_existing_issues(demo):
    bundle = synthetic_bundle(next(iter(demo.sources().values())))
    bundle['issues'] = ['An old observation is still a blocker until explicitly reviewed.']
    validated = ExtractionBundle.model_validate(bundle)
    assert validated.notes == [] and validated.issues == bundle['issues']
