from datetime import date

import pytest

from navigator.evidence import check_rule, prepare_rules, semantic_key
from navigator.extraction import ProviderFailure, ProviderUnavailable, merge_rules
from navigator.models import LookupRequest
from navigator.semantic_review import review_rule
from navigator.service import lookup
from navigator.store import digest


class FixtureVerifier:
    mode = "fixture"
    model = "authored-semantic-fixture-not-a-model"
    usage = []

    def __init__(self, contradict=False, bad_span=False):
        self.calls = 0
        self.contradict, self.bad_span = contradict, bad_span

    def generate(self, instruction, payload):
        self.calls += 1
        support = payload["context"]["spans"][0].copy()
        if self.bad_span: support["start"], support["end"] = 900000, 900000 + len(support["text"])
        return {"decisions": [{"field": field, "status": "contradicted" if self.contradict and field == "coverage_conditions" else "supported", "explanation": "Authored fixture: opposite operator to supplied provision" if self.contradict else "Authored fixture support, not legal review", "spans": [support]} for field in payload["required_fields"]]}


def test_exact_quote_does_not_verify_opposite_meaning(demo):
    rule = next(iter(demo.rules().values()))
    # Retain verbatim evidence but reverse the threshold.
    rule.coverage_conditions.args[1].op = "lt"
    demo.save_collection("rules", {rule.team_rule_id: rule})
    report = check_rule(rule, demo.sources())
    assert all(c.status == "pass" for c in report.checks if c.kind == "quote_presence")
    assert any(c.kind == "semantic_support" and c.status == "not_checked" for c in report.checks)
    review = review_rule(demo, rule.team_rule_id, FixtureVerifier(contradict=True))
    report = check_rule(rule, demo.sources(), semantic=review)
    assert "semantic_contradicted:coverage_conditions" in report.blocking_issues
    assert review.mode == "fixture" and not review.human_reviewed


@pytest.mark.parametrize("mutation", ["absent_record", "empty_text", "removed_quote"])
def test_removing_only_support_never_leaves_verified_result(demo, mutation):
    request = LookupRequest(address_id="SYNTH-001", as_of=date(2026,11,15))
    assert lookup(demo, request).evaluations[0].result == "applies"
    sources = demo.sources()
    source = next(iter(sources.values()))
    if mutation == "absent_record": sources = {}
    else:
        source.text = "" if mutation == "empty_text" else "This source no longer contains the supporting passage."
        source.sha256 = digest(source.text.encode("utf-8"))
    demo.save_collection("sources", sources)
    answer = lookup(demo, request)
    assert answer.evaluations[0].result == "unknown"
    _, reports = prepare_rules(demo)
    assert next(iter(reports.values())).blocking_issues
    assert answer.warnings


def test_missing_referenced_exception_blocks_support(demo):
    sources = demo.sources()
    source = next(iter(sources.values()))
    source.text += "\nExcept as provided in section 99.\n"
    source.sha256 = digest(source.text.encode("utf-8"))
    demo.save_collection("sources", sources)
    rule = next(iter(demo.rules().values()))
    report = check_rule(rule, sources)
    assert any(d.status == "missing" and d.target_section == "99" for d in report.context.dependencies)
    review = review_rule(demo, rule.team_rule_id, FixtureVerifier())
    assert any(d.field == "dependencies" and d.status == "insufficient" for d in review.decisions)
    assert demo.read("latest_semantic_review.json")["outcome"] == "partial"


def test_review_replay_and_changed_snapshot_invalidate_cache(demo):
    rule = next(iter(demo.rules().values()))
    verifier = FixtureVerifier()
    original = review_rule(demo, rule.team_rule_id, verifier)
    assert verifier.calls == 1
    replay = review_rule(demo, rule.team_rule_id, verifier)
    assert verifier.calls == 1 and replay.mode == "replay"
    sources = demo.sources()
    oldkey = semantic_key(rule, sources)
    source = next(iter(sources.values()))
    source.text += "\n"
    source.sha256 = digest(source.text.encode("utf-8"))
    assert semantic_key(rule, sources) != oldkey
    report = check_rule(rule, sources, semantic=original)
    assert "stale_semantic_review" in report.blocking_issues
    demo.save_collection("sources", sources)
    _, reports = prepare_rules(demo)
    assert "extraction_source_version_stale" in reports[rule.team_rule_id].blocking_issues


def test_semantic_replay_preserves_partial_outcome_and_origin_mode(demo):
    rule = next(iter(demo.rules().values()))
    verifier = FixtureVerifier(contradict=True)
    original = review_rule(demo, rule.team_rule_id, verifier)
    replay = review_rule(demo, rule.team_rule_id, verifier)
    assert replay.mode == "replay" and replay.decisions == original.decisions
    assert verifier.calls == 1
    manifest = demo.read("latest_semantic_review.json")
    assert manifest["mode"] == "replay" and manifest["outcome"] == "partial"
    assert manifest["config"]["origin_mode"] == "fixture"
    assert manifest["counts"]["model_calls"] == 0


def test_changed_verifier_model_cannot_replay_previous_model(demo):
    rule = next(iter(demo.rules().values()))
    first = FixtureVerifier()
    review_rule(demo, rule.team_rule_id, first)
    second = FixtureVerifier(contradict=True)
    second.model = "different-authored-fixture-not-a-model"
    revised = review_rule(demo, rule.team_rule_id, second)
    assert second.calls == 1 and revised.mode == "fixture"
    assert revised.model == second.model
    assert any(d.status == "contradicted" for d in revised.decisions)
    assert review_rule(demo, rule.team_rule_id, second).mode == "replay"
    assert second.calls == 1


def test_default_live_review_does_not_replay_fixture_cache(demo, monkeypatch):
    rule = next(iter(demo.rules().values()))
    review_rule(demo, rule.team_rule_id, FixtureVerifier())
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    with pytest.raises(ProviderUnavailable):
        review_rule(demo, rule.team_rule_id)
    assert demo.read("latest_semantic_review.json")["outcome"] == "failed"


def test_live_cache_replays_offline_but_respects_configured_model(demo, monkeypatch):
    # In-process provider stub exercises provenance routing; no API request occurs.
    first = FixtureVerifier()
    first.mode = "live"
    rule = next(iter(demo.rules().values()))
    review_rule(demo, rule.team_rule_id, first)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_MODEL", raising=False)
    def unexpected_provider():
        raise AssertionError("Exact cache replay must not construct a provider")
    monkeypatch.setattr("navigator.semantic_review.OpenAIProvider", unexpected_provider)
    assert review_rule(demo, rule.team_rule_id).mode == "replay"
    assert demo.read("latest_semantic_review.json")["config"]["origin_mode"] == "live"
    second = FixtureVerifier(contradict=True)
    second.mode, second.model = "live", "different-transport-stub-not-a-model"
    monkeypatch.setenv("OPENAI_MODEL", second.model)
    monkeypatch.setattr("navigator.semantic_review.OpenAIProvider", lambda: second)
    changed = review_rule(demo, rule.team_rule_id)
    assert second.calls == 1 and changed.model == second.model
    assert any(d.status == "contradicted" for d in changed.decisions)


def test_bad_verifier_spans_exhaust_bounded_repair_without_cache(demo):
    rule = next(iter(demo.rules().values()))
    verifier = FixtureVerifier(bad_span=True)
    with pytest.raises(ProviderFailure): review_rule(demo, rule.team_rule_id, verifier)
    assert verifier.calls == 2
    assert not demo.path(f"semantic_reviews/{semantic_key(rule,demo.sources())}.json").exists()
    assert demo.read("latest_semantic_review.json")["outcome"] == "failed"


def test_whitespace_only_evidence_change_does_not_duplicate_legal_rule(demo):
    rule = next(iter(demo.rules().values()))
    revised = rule.model_copy(deep=True)
    revised.evidence[0].quote += "\n"
    # Core's existing merge semantics; Platform does not rewrite its engine.
    merged = merge_rules({rule.team_rule_id: rule}, [revised])
    assert len(merged) == 1
    assert merged[rule.team_rule_id].coverage_conditions == rule.coverage_conditions
