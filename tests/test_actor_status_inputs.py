"""Synthetic input/HTTP regression tests, not independent legal validation."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from navigator.api import create_app
from navigator.engine import evaluate_rule
from navigator.models import Evidence, Expression


PERSON = "person_under_bpc_16702"
CONSUMER = "end_consumer_of_product_or_service"
FIELDS = {PERSON, CONSUMER}
REQUEST = {
    "address_id": "SYNTH-001", "as_of": "2026-11-15",
    "limits": {"max_questions": 2, "max_fields": 2, "max_evaluations": 12, "max_joint_fields": 2},
}


@pytest.fixture
def actor_store(demo):
    # Exercise the two independent inputs through the real planner/evaluator and
    # evidence preparation, using explicitly fictional source text and property.
    source = next(iter(demo.sources().values()))
    source.text = (
        "Synthetic actor-input fixture, not actual law. Effective November 15, 2026. "
        "The fictional obligation covers the identified person and exempts an end consumer."
    )
    from navigator.store import digest
    source.sha256 = digest(source.text.encode("utf-8"))
    source.manifest_sha256 = None
    rule = next(iter(demo.rules().values()))
    rule.title = "Synthetic actor-input obligation"
    rule.requirement = "Perform the fictional fixture obligation."
    rule.citation = "Synthetic actor-input fixture"
    rule.quoted_span = source.text
    rule.coverage_conditions = Expression(op="eq", fact=PERSON, value=True)
    rule.exemption_conditions = Expression(op="eq", fact=CONSUMER, value=True)
    rule.status_events = []
    rule.evidence = [Evidence(doc_id=source.doc_id, quote=source.text,
                             supports=["requirement", "coverage_conditions", "exemption_conditions", "effective_date", "lifecycle"])]
    demo.save_collection("sources", {source.doc_id: source})
    demo.save_collection("rules", {rule.team_rule_id: rule})
    demo.write("extraction_index.json", {})
    return demo


def answer(field, value):
    return {"field": field, "value": value, "provenance": "user_provided"}


def test_actor_status_inputs_are_visible_and_not_inferred_from_property_facts(actor_store):
    snapshot = {p.relative_to(actor_store.root): p.read_bytes() for p in actor_store.root.rglob("*.json")}
    with TestClient(create_app(actor_store.root)) as client:
        definitions = client.get("/api/v1/facts").json()
        assert all(definitions[f]["data_type"] == "boolean" for f in FIELDS)
        response = client.post("/api/v1/lookup/assist", json={**REQUEST,
            "supplemental_facts": {"owner_type": "corporation"}})
        assert response.status_code == 200
        body = response.json()
        assert body["lookup"]["evaluations"][0]["result"] == "unknown"
        assert FIELDS.isdisjoint(body["lookup"]["address"]["facts"])
        assert {q["fact"]["field"] for q in body["question_plan"]["questions"]} == FIELDS
        assert not any(u["kind"] == "interpretation" and u.get("field") in FIELDS
                       for u in body["question_plan"]["remaining_uncertainty"])
    assert {p.relative_to(actor_store.root): p.read_bytes() for p in actor_store.root.rglob("*.json")} == snapshot


def test_explicit_actor_answers_resolve_only_request_local_coverage(actor_store):
    original = actor_store.read("addresses.json")
    with TestClient(create_app(actor_store.root)) as client:
        covered = client.post("/api/v1/lookup/assist", json={**REQUEST,
            "answers": [answer(PERSON, True), answer(CONSUMER, False)]})
        assert covered.status_code == 200
        body = covered.json()
        assert body["lookup"]["evaluations"][0]["result"] == "applies"
        assert body["question_plan"]["questions"] == []
        for field in FIELDS:
            assert body["lookup"]["address"]["provenance"][field] == "User-supplied supplemental fact (not independently verified)"
        # The plain route consumes the same registered facts and canonical evaluator.
        plain = client.post("/api/v1/lookup", json={"address_id": REQUEST["address_id"],
            "as_of": REQUEST["as_of"], "supplemental_facts": {PERSON: True, CONSUMER: False}})
        assert plain.status_code == 200
        assert plain.json()["evaluations"][0]["result"] == "applies"
        for facts in ({PERSON: True, CONSUMER: True}, {PERSON: False, CONSUMER: False}):
            excluded = client.post("/api/v1/lookup/assist", json={**REQUEST, "supplemental_facts": facts})
            assert excluded.status_code == 200
            assert excluded.json()["lookup"]["evaluations"] == []
        for answers in ([], [answer(PERSON, None), answer(CONSUMER, None)],
                        [answer(PERSON, True), answer(CONSUMER, None)]):
            reset = client.post("/api/v1/lookup/assist", json={**REQUEST, "answers": answers})
            assert reset.status_code == 200
            body = reset.json()
            assert body["lookup"]["evaluations"][0]["result"] == "unknown"
            assert CONSUMER not in body["lookup"]["address"]["facts"]
    assert actor_store.read("addresses.json") == original


@pytest.mark.parametrize("field", sorted(FIELDS))
@pytest.mark.parametrize("value", ["true", "false", 1, 0, [], {}])
def test_actor_status_inputs_reject_non_boolean_values(actor_store, field, value):
    with TestClient(create_app(actor_store.root)) as client:
        for endpoint in ("lookup", "lookup/assist"):
            response = client.post(f"/api/v1/{endpoint}", json={
                "address_id": REQUEST["address_id"], "supplemental_facts": {field: value},
            })
            assert response.status_code == 422
            assert f"{field} requires a JSON boolean" in response.text
        assert client.post("/api/v1/lookup/assist", json={**REQUEST,
            "answers": [answer(field, value)]}).status_code == 422


def test_registration_preserves_review_gates_and_unregistered_input_rejection(actor_store):
    rule = next(iter(actor_store.rules().values()))
    prop = actor_store.addresses()[REQUEST["address_id"]]
    prop.facts.update({PERSON: True, CONSUMER: False})
    rule.review_issues = ["Unresolved source meaning"]
    result = evaluate_rule(rule, prop, actor_store.resolutions()[prop.address_id], date(2026, 11, 15))
    assert result.coverage.value == "true" and result.result == "unknown"
    with TestClient(create_app(actor_store.root)) as client:
        response = client.post("/api/v1/lookup/assist", json={**REQUEST,
            "answers": [answer("used_as_tenant_dwelling", True)]})
        assert response.status_code == 422
        assert "Unsupported supplemental fact" in response.text
