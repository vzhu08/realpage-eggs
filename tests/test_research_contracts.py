from navigator.engine import evaluate_rules
from navigator.models import AssistResponse, AssistRequest
from navigator.research_fixtures import generate_research_fixtures
import pytest
from pydantic import ValidationError


def test_required_examples_validate_and_probes_reproduce():
    fixtures = generate_research_fixtures()
    assert len(fixtures) == 5
    for fixture in fixtures.values():
        response = AssistResponse.model_validate(fixture["response"])
        assert response.mode == "contract_fixture"
        for question in response.question_plan.questions:
            for alternative in question.alternatives:
                prop = response.lookup.address.model_copy(deep=True)
                prop.facts.update(alternative.probe_facts)
                prop.provenance.update({k: "Hypothetical fixture probe; not a property fact" for k in alternative.probe_facts})
                assert evaluate_rules(response.lookup.rules, prop, response.lookup.jurisdiction, response.lookup.as_of) == alternative.evaluations
    unresolved = fixtures["two_unresolved_exemptions"]["response"]["question_plan"]["questions"][0]["alternatives"][0]
    assert unresolved["evaluations"][0]["result"] == "unknown"
    assert {u["field"] for u in unresolved["remaining_uncertainty"]} == {"owner_occupied", "exemption_filed"}
    assert fixtures["irrelevant_missing_fact"]["response"]["question_plan"]["questions"] == []


def test_duplicate_answers_and_untrusted_verified_provenance_rejected():
    with pytest.raises(ValidationError):
        AssistRequest(address_id="X", supplemental_facts={"units": 10}, answers=[{"field": "units", "value": 12}])
    with pytest.raises(ValidationError):
        AssistRequest(address_id="X", answers=[{"field": "units", "value": 12, "provenance": "verified"}])


def test_evidence_ui_examples_keep_renderer_expectation_separate():
    from navigator.config import ROOT
    from navigator.store import read_json
    from navigator.models import EncodedRuleRendering, EvidenceReport
    failure = AssistResponse.model_validate(read_json(ROOT / "contracts/evidence_examples/missing_support.json")["response"])
    assert failure.lookup.evaluations[0].result == "unknown"
    assert failure.evidence_reports[0].blocking_issues
    comparison = read_json(ROOT / "contracts/evidence_examples/source_comparison.json")
    EvidenceReport.model_validate(comparison["evidence"])
    rendering = EncodedRuleRendering.model_validate(comparison["encoded_rule"])
    assert rendering.renderer_version == "authored-fixture-not-Core-output"
