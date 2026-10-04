"""Reject non-JSON numeric sentinels before they reach legal evaluation."""
import json
import math

import pytest
from pydantic import ValidationError

from navigator.models import Bound, Expression, FactDefinition, PropertyFacts, Rule


@pytest.mark.parametrize("value", [math.inf, -math.inf, math.nan, "Infinity", "NaN"])
@pytest.mark.parametrize("field", ["lower", "upper"])
def test_property_bounds_reject_nonfinite_endpoints(prop, value, field):
    payload = prop.model_dump()
    payload["bounds"] = {"units": {field: value, "provenance": "Synthetic invalid input"}}
    with pytest.raises(ValidationError, match="finite"):
        PropertyFacts.model_validate(payload)


@pytest.mark.parametrize("value", [math.inf, -math.inf, math.nan, "Infinity", "NaN"])
@pytest.mark.parametrize("field", ["minimum", "maximum"])
def test_fact_definitions_reject_nonfinite_limits(value, field):
    with pytest.raises(ValidationError, match="finite"):
        FactDefinition(field="units", meaning="Dwelling units", data_type="integer", **{field: value})


@pytest.mark.parametrize("op", ["gte", "eq", "in", "age_at_least"])
@pytest.mark.parametrize("value", [math.inf, -math.inf, math.nan])
def test_stored_rules_reject_nonfinite_thresholds(rule, op, value):
    payload = rule.model_dump(mode="json")
    payload["coverage_conditions"] = {
        "op": "all", "args": [{"op": op, "fact": "units", "value": [1, value] if op == "in" else value}]
    }
    with pytest.raises(ValidationError, match="finite"):
        Rule.model_validate_json(json.dumps(payload))


def test_overflowing_json_number_is_rejected():
    with pytest.raises(ValidationError, match="finite"):
        Expression.model_validate_json('{"op":"gte","fact":"units","value":1e999}')


def test_finite_numbers_null_endpoints_and_other_fact_types_are_preserved():
    assert Bound(lower=0, provenance="Synthetic range").upper is None
    assert Bound(upper=8, provenance="Synthetic range").lower is None
    assert FactDefinition(field="amount", meaning="Amount", data_type="number", maximum=1.5).minimum is None
    # Do not convert integers to floats: exact large integers are valid planner thresholds.
    for value in [0, 1.5, 2**60 + 1, 10**400, True, "individual", "2026-10"]:
        assert Expression(op="eq", fact="example", value=value).value == value
