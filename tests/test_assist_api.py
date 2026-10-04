from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from navigator.api import create_app
from navigator.config import ROOT
from navigator.models import QuestionPlan, Rule
from navigator.rule_renderer import RENDERER_VERSION
from navigator.store import read_json

REQUEST = {"address_id": "SYNTH-003", "as_of": "2026-11-15"}


def test_unimplemented_core_is_explicit_and_source_services_work(demo):
    with TestClient(create_app(demo.root, SimpleNamespace())) as client:
        response = client.post("/api/v1/lookup/assist", json=REQUEST)
        assert response.status_code == 200
        body = response.json()
        assert body["question_plan"]["status"] == "unavailable"
        assert body["capabilities"]["question_planner"] == "dependency_unavailable"
        assert body["question_plan"]["questions"] == [] and body["encoded_rules"] == []
        assert body["lookup"]["evaluations"][0]["result"] == "unknown"
        ident = body["evidence_reports"][0]["rule_id"]
        assert client.get(f"/api/v1/rules/{ident}/evidence").json() == body["evidence_reports"][0]
        assert client.get("/api/v1/rules/absent/evidence").status_code == 404
        source = next(iter(demo.sources().values()))
        context = client.get(f"/api/v1/sources/{source.doc_id}/context").json()
        assert context["spans"][0]["text"] == source.text
        assert not context["semantic_verification"]
        assert client.get(f"/api/v1/sources/{source.doc_id}/context?start=999999").status_code == 422
        assert client.get(f"/api/v1/sources/{source.doc_id}/context?max_chars=999999").status_code == 422
        assert client.get("/api/v1/facts").json()["units"]["data_type"] == "integer"


@pytest.mark.parametrize("facts", [
    {"units": True}, {"units": "8"}, {"units": 0}, {"units": 1.5},
    {"owner_occupied": "false"}, {"owner_total_units": -1},
    {"certificate_of_occupancy": "2021-02-29"}, {"certificate_of_occupancy": 2020},
    {"owner_type": "unknown-owner-form"}, {"jurisdiction": "CA"}, {"random": 1},
])
def test_both_lookup_routes_reject_bad_fact_types(demo, facts):
    with TestClient(create_app(demo.root)) as client:
        for endpoint in ("lookup", "lookup/assist"):
            assert client.post(f"/api/v1/{endpoint}", json={**REQUEST, "supplemental_facts": facts}).status_code == 422


def test_answer_provenance_null_partial_dates_and_request_isolation(demo):
    original = demo.read("addresses.json")
    with TestClient(create_app(demo.root)) as client:
        answered = client.post("/api/v1/lookup/assist", json={**REQUEST, "scenario_id": "renter-local", "answers": [{"field": "units", "value": 8, "provenance": "demo"}, {"field": "certificate_of_occupancy", "value": "2020-06"}]}).json()
        assert answered["lookup"]["evaluations"][0]["result"] == "applies"
        assert answered["lookup"]["address"]["facts"]["certificate_of_occupancy"] == "2020-06"
        assert "Demo answer" in answered["lookup"]["address"]["provenance"]["units"]
        assert answered["scenario_id"] == "renter-local"
        removed = client.post("/api/v1/lookup/assist", json={**REQUEST, "address_id": "SYNTH-001", "answers": [{"field": "units", "value": None}]}).json()
        assert removed["lookup"]["evaluations"][0]["result"] == "unknown"
        assert "units" in removed["lookup"]["address"]["missing_facts"]
        irrelevant = client.post("/api/v1/lookup/assist", json={**REQUEST, "address_id": "SYNTH-001", "answers": [{"field": "owner_type", "value": None}]}).json()
        assert irrelevant["lookup"]["evaluations"][0]["result"] == "applies"
        for answers in ([{"field": "units", "value": 8, "provenance": "verified"}], [{"field": "units", "value": 8}, {"field": "units", "value": 9}]):
            assert client.post("/api/v1/lookup/assist", json={**REQUEST, "answers": answers}).status_code == 422
        demo.write("dataset.json", {"mode": "real"})
        assert client.post("/api/v1/lookup/assist", json={**REQUEST, "answers": [{"field": "units", "value": 8, "provenance": "demo"}]}).status_code == 422
    assert demo.read("addresses.json") == original


def test_injected_contract_question_then_answer_uses_production_evaluator(demo):
    fixture = read_json(ROOT / "contracts/research_examples/decisive_question.json")
    expected_plan = QuestionPlan.model_validate(fixture["response"]["question_plan"])

    def authored_fixture(context):
        plan = expected_plan.model_copy(deep=True)
        plan.limits = context.limits
        if "units" in context.property.facts: plan.questions = []
        return plan

    with TestClient(create_app(demo.root, SimpleNamespace(plan_questions=authored_fixture))) as client:
        body = client.post("/api/v1/lookup/assist", json=REQUEST).json()
        question = body["question_plan"]["questions"][0]
        for alternative in question["alternatives"]:
            answered = client.post("/api/v1/lookup/assist", json={**REQUEST, "supplemental_facts": alternative["probe_facts"]}).json()
            expected = [e["result"] for e in alternative["evaluations"] if e["result"] not in {"inapplicable", "failed"}]
            assert [e["result"] for e in answered["lookup"]["evaluations"]] == expected
            assert answered["question_plan"]["questions"] == []


def test_occupancy_answer_still_unknown_with_two_exemptions(demo):
    fixture = read_json(ROOT / "contracts/research_examples/two_unresolved_exemptions.json")["response"]
    rule = Rule.model_validate(fixture["lookup"]["rules"][0])
    demo.save_collection("rules", {rule.team_rule_id: rule})
    with TestClient(create_app(demo.root)) as client:
        body = client.post("/api/v1/lookup/assist", json={**REQUEST, "supplemental_facts": {"units": 12, "certificate_of_occupancy": "2020-06-30"}}).json()
        assert body["lookup"]["evaluations"][0]["result"] == "unknown"
        assert set(body["lookup"]["evaluations"][0]["missing_facts"]) == {"owner_occupied", "exemption_filed"}
        assert body["capabilities"]["question_planner"] == "implemented"
        assert {q["fact"]["field"] for q in body["question_plan"]["questions"]} == {"owner_occupied", "exemption_filed"}


def test_core_failure_malformed_output_and_budget_violation_are_distinct(demo):
    def fails(context): raise RuntimeError("internal service detail")
    def overshoots(context):
        plan = QuestionPlan.model_validate(read_json(ROOT / "contracts/research_examples/decisive_question.json")["response"]["question_plan"])
        plan.evaluations_used = 100000
        return plan
    for fn, status in [(fails, 503), (lambda c: {"status": "fiction"}, 502), (overshoots, 502)]:
        with TestClient(create_app(demo.root, SimpleNamespace(plan_questions=fn))) as client:
            response = client.post("/api/v1/lookup/assist", json=REQUEST)
            assert response.status_code == status
            assert "internal service detail" not in response.text


def test_absent_dataset_and_unknown_selection_remain_distinct(tmp_path, demo):
    with TestClient(create_app(tmp_path)) as client:
        assert client.post("/api/v1/lookup/assist", json=REQUEST).status_code == 503
    with TestClient(create_app(demo.root)) as client:
        assert client.post("/api/v1/lookup/assist", json={**REQUEST, "address_id": "absent"}).status_code == 404


def test_real_core_questions_reproduce_through_http_without_persisting_probes(demo):
    original = demo.read("addresses.json")
    with TestClient(create_app(demo.root)) as client:
        response = client.post("/api/v1/lookup/assist", json=REQUEST)
        assert response.status_code == 200
        body = response.json()
        assert body["capabilities"]["question_planner"] == "implemented"
        assert body["capabilities"]["rule_renderer"] == "implemented"
        assert body["lookup"]["evaluations"][0]["result"] == "unknown"
        assert body["encoded_rules"][0]["renderer_version"] == RENDERER_VERSION
        assert body["encoded_rules"][0]["rule_id"] == body["lookup"]["rules"][0]["team_rule_id"]
        question, = body["question_plan"]["questions"]
        assert question["fact"]["field"] == "units" and question["alternatives"]
        for alternative in question["alternatives"]:
            answered = client.post("/api/v1/lookup/assist", json={**REQUEST, "supplemental_facts": alternative["probe_facts"]})
            assert answered.status_code == 200
            actual = answered.json()
            expected = [(e["team_rule_id"], e["result"]) for e in alternative["evaluations"] if e["result"] not in {"inapplicable", "failed"}]
            assert [(e["team_rule_id"], e["result"]) for e in actual["lookup"]["evaluations"]] == expected
            assert actual["question_plan"]["questions"] == []
            assert "User-supplied" in actual["lookup"]["address"]["provenance"]["units"]
        removed = client.post("/api/v1/lookup/assist", json={**REQUEST, "answers": [{"field": "units", "value": None}]}).json()
        assert removed["lookup"]["evaluations"][0]["result"] == "unknown"
        assert [q["fact"]["field"] for q in removed["question_plan"]["questions"]] == ["units"]
    assert demo.read("addresses.json") == original


def test_real_core_budget_and_missing_support_stay_explicit_through_http(demo):
    with TestClient(create_app(demo.root)) as client:
        bounded = client.post("/api/v1/lookup/assist", json={**REQUEST, "limits": {"max_evaluations": 1}})
        assert bounded.status_code == 200
        plan = bounded.json()["question_plan"]
        assert plan["status"] == "partial" and not plan["exhaustive"]
        assert plan["evaluations_used"] <= 1 and plan["limits_hit"]
        sources = demo.sources()
        for source in sources.values():
            source.text = ""
        demo.save_collection("sources", sources)
        missing = client.post("/api/v1/lookup/assist", json={**REQUEST, "supplemental_facts": {"units": 8}})
        assert missing.status_code == 200
        body = missing.json()
        assert body["lookup"]["evaluations"][0]["result"] == "unknown"
        assert body["evidence_reports"][0]["blocking_issues"]
        assert body["question_plan"]["remaining_uncertainty"]
