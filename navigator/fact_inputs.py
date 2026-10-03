"""Platform input contract; Core consumes definitions without duplicating validation."""
import math

from .models import FactDefinition, date_bounds


FACT_DEFINITIONS = {
    name: FactDefinition(field=name, meaning=meaning, data_type=kind, unit=unit, minimum=minimum, answer_effort=effort)
    for name, meaning, kind, unit, minimum, effort in [
        ("units", "Number of dwelling units in this building", "integer", "dwelling units", 1, 1),
        ("year_built", "Assessor construction year; not an occupancy or certificate date", "integer", "calendar year", 1, 2),
        ("owner_total_units", "Total dwelling units owned by this owner", "integer", "dwelling units", 0, 3),
        ("owner_total_properties", "Number of residential properties owned by this owner", "integer", "properties", 0, 3),
        ("certificate_of_occupancy", "Date on the property's certificate of occupancy, not the year built", "date", "ISO date", None, 3),
        ("first_occupancy_date", "Actual first occupancy date when that is the encoded legal trigger", "date", "ISO date", None, 3),
        ("tenancy_start", "Start date of the tenancy being evaluated", "date", "ISO date", None, 1),
    ]
}
for field, meaning in {
    "residential": "Whether this property is used for residential rental housing",
    "owner_occupied": "Whether the owner occupies the property",
    "subsidized": "Whether the rental is subject to a housing subsidy",
    "condominium": "Whether this property is a condominium",
    "exemption_filed": "Whether the relevant exemption filing exists (a factual filing, not a legal conclusion)",
    "exempt_notice": "Whether the required exemption notice was delivered",
    "tenant_opt_in": "Whether the tenant made the relevant documented opt-in",
}.items():
    FACT_DEFINITIONS[field] = FactDefinition(field=field, meaning=meaning, data_type="boolean", answer_effort=2)
FACT_DEFINITIONS["owner_type"] = FactDefinition(field="owner_type", meaning="Documented form of ownership; do not infer from a name", data_type="enum", allowed_values=["individual", "corporation", "llc", "partnership", "trust", "government", "nonprofit"], answer_effort=3)


def validate_facts(facts, definitions=None):
    definitions = definitions or FACT_DEFINITIONS
    for name, value in facts.items():
        definition = definitions.get(name)
        if definition is None:
            raise ValueError(f"Unsupported supplemental fact '{name}'; request a shared fact definition")
        if value is None:
            continue  # Explicit unknown removes the request-local fact, never supplies certainty.
        kind = definition.data_type
        if kind == "boolean" and type(value) is not bool:
            raise ValueError(f"{name} requires a JSON boolean")
        if kind in {"integer", "number"}:
            valid_type = type(value) is int if kind == "integer" else type(value) in (int, float)
            if not valid_type or not math.isfinite(value): raise ValueError(f"{name} requires a finite {kind}")
            if definition.minimum is not None and value < definition.minimum: raise ValueError(f"{name} is below its valid minimum")
            if definition.maximum is not None and value > definition.maximum: raise ValueError(f"{name} exceeds its valid maximum")
        if kind == "date":
            if not isinstance(value, str): raise ValueError(f"{name} requires an ISO date string")
            date_bounds(value)
            if not definition.allow_partial_date and len(value) != 10: raise ValueError(f"{name} requires day precision")
        if kind == "enum" and value not in definition.allowed_values:
            raise ValueError(f"{name} must be one of: {', '.join(definition.allowed_values)}")
        if kind == "string" and (not isinstance(value, str) or len(value) > 500):
            raise ValueError(f"{name} requires a string of at most 500 characters")
    return facts
