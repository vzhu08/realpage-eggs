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
    "used_as_tenant_dwelling": (
        "Whether the residential property is used as the tenant's dwelling under a rental agreement. "
        "Answer for the tenancy being evaluated, using the rental agreement and actual dwelling use. "
        "Do not infer this from residential classification, unit count, year built, or an owner's name. "
        "Leave unknown if either the rental agreement or tenant dwelling use is unconfirmed. "
        "This does not establish that a deposit was collected or that any duty was violated."
    ),
    "owner_occupied": "Whether the owner occupies the property",
    "subsidized": "Whether the rental is subject to a housing subsidy",
    "condominium": "Whether this property is a condominium",
    "exemption_filed": "Whether the relevant exemption filing exists (a factual filing, not a legal conclusion)",
    "exempt_notice": "Whether the required exemption notice was delivered",
    "tenant_opt_in": "Whether the tenant made the relevant documented opt-in",
}.items():
    FACT_DEFINITIONS[field] = FactDefinition(field=field, meaning=meaning, data_type="boolean", answer_effort=2)
FACT_DEFINITIONS["owner_type"] = FactDefinition(field="owner_type", meaning="Documented form of ownership; do not infer from a name", data_type="enum", allowed_values=["individual", "corporation", "llc", "partnership", "trust", "government", "nonprofit"], answer_effort=3)


# Existing AB 325 predicates refer to these actor classifications. Registering the
# inputs supplies no actor facts or legal conclusion. Source anchors and limits:
# docs/core_navigation/property_fact_fix.md.
for field, meaning in {
    "person_under_bpc_16702": (
        "Whether the identified actor is a person within California Business and Professions Code "
        "16702. Its inclusive definition names corporations, firms, partnerships and associations "
        "existing under or authorized by California, another state's or a foreign country's laws. "
        "Use a documented classification for the same actor being evaluated; leave unknown if "
        "unsupported or disputed. Do not infer it from the property, residential use, an owner name "
        "or owner_type. This answer does not establish prohibited conduct."
    ),
    "end_consumer_of_product_or_service": (
        "Whether that same identified actor is the end consumer of the particular product or "
        "service being evaluated under California Business and Professions Code 16729(d)(5). "
        "The captured provision excludes the end consumer from its person definition but gives "
        "no further end-consumer definition. Supply an answer only when that classification is "
        "supported; leave unknown if unclear or disputed. Do not infer it from property ownership, "
        "residential use or software use, or combine different actors or products."
    ),
}.items():
    FACT_DEFINITIONS[field] = FactDefinition(
        field=field, meaning=meaning, data_type="boolean", answer_effort=3,
    )


# Source-reviewed input definitions from Core PR #28. Registration supplies no facts
# and does not approve the candidate rule interpretation. Evidence: docs/evidence/plat15_inputs.json.
ACTIVITY_FACT_DEFINITIONS = {
    definition["field"]: FactDefinition(**definition)
    for definition in [{'field': 'collected_information_nonpublic',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected qualifying information is '
             'not available to the public at no cost; a combined dataset containing such information is nonpublic '
             'even when it also contains public information. Evaluate the same dataset used by the selected '
             'activity.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'collected_information_category',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. A documented category of qualifying '
             'information in the selected dataset. Use an enumerated category only with a concrete witness. Other '
             'information is unresolved because the statutory examples are nonexhaustive. Missing categorization '
             'remains null.',
  'data_type': 'enum',
  'unit': None,
  'allowed_values': ['prices',
                     'supply_levels',
                     'security_deposits',
                     'ideal_occupancy_levels',
                     'lease_contract_termination',
                     'renewal_dates',
                     'other_information'],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'setting_information_nonpublic',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected qualifying information is '
             'not available to the public at no cost; a combined dataset containing such information is nonpublic '
             'even when it also contains public information. Evaluate the same dataset used by the selected '
             'activity.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'setting_information_category',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. A documented category of qualifying '
             'information in the selected dataset. Use an enumerated category only with a concrete witness. Other '
             'information is unresolved because the statutory examples are nonexhaustive. Missing categorization '
             'remains null.',
  'data_type': 'enum',
  'unit': None,
  'allowed_values': ['prices',
                     'supply_levels',
                     'security_deposits',
                     'ideal_occupancy_levels',
                     'lease_contract_termination',
                     'renewal_dates',
                     'other_information'],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'activity_collects_owner_information',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected actor/activity collects the '
             'selected information from the mapped owners; separate information merely used by an unrelated '
             'activity.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'collected_information_owner_count',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Distinct rental property owners '
             'represented in the selected collected information, after applying the statutory '
             'controlling-interest aggregation. Owners must directly or indirectly own rental residential '
             'dwelling units. Incomplete owner/control mapping means unknown. This is not a count of accounts, '
             'persons, legal entities, units, properties or recipients.',
  'data_type': 'integer',
  'unit': 'statutory rental property owner groups',
  'allowed_values': [],
  'minimum': 0.0,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'collection_for_automated_analysis_or_training',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The collection is for analyzing or '
             'processing that same information through an algorithm or other automated process, including '
             'training. The statutory purpose is required; completion of processing is not an added prerequisite.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'collection_process_used_to_set_or_recommend_rent_terms_or_occupancy',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The algorithm/process identified in the '
             'collection-purpose input is used to set or recommend rental prices, material lease terms, or '
             'occupancy levels for the selected activity. Rental-price or occupancy output can be determined '
             'factually. For lease-terms-only output, materiality must be supported by separate review; if '
             'unresolved, answer null. Do not infer materiality merely from software participation.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'activity_sets_rent_terms_or_occupancy',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected activity actually sets '
             'rental prices, material lease terms or occupancy levels; a recommendation alone is not this second '
             'branch. Rental-price or occupancy output can be determined factually. For lease-terms-only output, '
             'materiality must be supported by separate review; if unresolved, answer null. Do not infer '
             'materiality merely from software participation.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'setting_uses_automated_analysis_or_training',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected setting activity is '
             'pursuant to an algorithm or other automated process that analyzes/processes the same qualifying '
             'information, including training on it.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'setting_dataset_from_other_owner',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The information analyzed/processed or '
             'used for training belongs to a rental property owner other than the owner for whose setting '
             'activity it is used. Apply controlling-interest aggregation before comparing owners. The reference '
             'owner and other owner must be documented; ambiguous reference, indirect ownership or control '
             'mapping yields null. This is not a second account or merely a second person.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'activity_sets_or_recommends_rent_terms_or_occupancy',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected activity sets for or '
             'recommends to mapped recipient owners rental prices, material lease terms or occupancy levels. '
             'Rental-price or occupancy output can be determined factually. For lease-terms-only output, '
             'materiality must be supported by separate review; if unresolved, answer null. Do not infer '
             'materiality merely from software participation.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'recipient_rental_owner_count',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Distinct rental property owners '
             'receiving the selected setting/recommendation, after controlling-interest aggregation. This is a '
             'recipient count, separate from collected-information owners, persons, accounts and units. Uncertain '
             'mapping yields null.',
  'data_type': 'integer',
  'unit': 'statutory rental property owner groups',
  'allowed_values': [],
  'minimum': 0.0,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'recommendations_use_algorithm_or_automated_process',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected setting/recommendation is '
             'pursuant to an underlying algorithm or other automated process.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'same_underlying_process_for_recipients',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Documented identity of the underlying '
             'algorithm or automated process across recipients; false means identity is disproven, not that '
             'substantial similarity is disproven. Similarity remains a separate unsupported alternative.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'transaction_owner_rental_unit_count',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Rental residential dwelling units '
             'directly or indirectly owned by the relevant actor or its documented owner principal for this '
             'transaction. The selected relationship must identify the relevant owner before counting. This is '
             'not owner_total_units or a property unit count. Uncertain principal/ownership mapping yields null.',
  'data_type': 'integer',
  'unit': 'rental residential dwelling units',
  'allowed_values': [],
  'minimum': 0.0,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'receives_coordinator_candidate_services',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected actor does receive the '
             'identified service in this transaction. Service-provider qualification as a coordinator remains '
             'uncompiled and is not implied by this input. Receipt, subscription and contract are alternatives '
             'independent of consideration.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'subscribes_to_coordinator_candidate_services',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected actor does subscribe to the '
             'identified service in this transaction. Service-provider qualification as a coordinator remains '
             'uncompiled and is not implied by this input. Receipt, subscription and contract are alternatives '
             'independent of consideration.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'contracts_for_coordinator_candidate_services',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected actor does contract for the '
             'identified service in this transaction. Service-provider qualification as a coordinator remains '
             'uncompiled and is not implied by this input. Receipt, subscription and contract are alternatives '
             'independent of consideration.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'exchanges_consideration_for_coordinator_candidate_services',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. The selected actor does exchange any '
             'form of consideration in return for the use of the identified service in this transaction. '
             'Service-provider qualification as a coordinator remains uncompiled and is not implied by this '
             'input. Receipt, subscription and contract are alternatives independent of consideration.',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': [],
  'minimum': None,
  'maximum': None,
  'answer_effort': 1,
  'allow_partial_date': True},
 {'field': 'activity',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Which particular activity is being '
             'evaluated, with separate activity records for simultaneous service functions',
  'data_type': 'enum',
  'unit': None,
  'allowed_values': ['developing_estimated_rent', 'using_real_estate_brokerage_database', 'other']},
 {'field': 'actor_role',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. What documented role does the actor have '
             'in this evaluated activity',
  'data_type': 'enum',
  'unit': None,
  'allowed_values': ['rental_property_owner',
                     'owner_agent',
                     'owner_representative',
                     'owner_subcontractor',
                     'New_Jersey_Attorney_General',
                     'other']},
 {'field': 'database_available_on_equal_terms_to_subscribers',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Is the particular brokerage database '
             'available on equal terms to subscribers',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': []},
 {'field': 'database_collects_competitively_sensitive_information_to_set_or_recommend_rental_prices_material_lease_terms_or_occupancy_rates_or_levels',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Does the particular database collect '
             'competitively sensitive information for that price, term or occupancy setting or recommendation',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': []},
 {'field': 'database_lists_properties_for_rent_or_sale',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Does the particular brokerage database '
             'list properties for rent or sale',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': []},
 {'field': 'database_sets_or_recommends_rental_prices_material_lease_terms_or_occupancy_rates_or_levels',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Does the particular database set or '
             'recommend rental prices, material lease terms or occupancy rates or levels',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': []},
 {'field': 'facility_type',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. What is the documented use of the '
             'particular residential or institutional facility',
  'data_type': 'enum',
  'unit': None,
  'allowed_values': ['ordinary_residential',
                     'inpatient_medical_care',
                     'licensed_long_term_care',
                     'detention_facility',
                     'correctional_facility',
                     'other']},
 {'field': 'government_sets_or_limits_residential_prices_through_lawful_affordability_controls',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Is this evaluated government activity '
             'setting or limiting residential prices through lawful documented affordability controls',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': []},
 {'field': 'intended_primary_residence',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Is the particular unit intended as a '
             'primary residence rather than inferred from actual occupancy',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': []},
 {'field': 'rent_estimate_public_at_no_cost',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Is the estimated rent from this activity '
             'made available to the public at no cost',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': []},
 {'field': 'sensitive_information_used_solely_for_research_statistical_analysis_or_testing',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Is use of the information in this '
             'evaluated activity solely for research, statistical analysis or testing',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': []},
 {'field': 'sensitive_information_used_to_set_or_recommend_current_or_future_lease_prices_terms_fees_or_occupancy',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Is information from this evaluated '
             'activity used to set or recommend current or future lease prices, terms, fees or occupancy',
  'data_type': 'boolean',
  'unit': None,
  'allowed_values': []},
 {'field': 'actor_type',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Documented government-entity status of '
             'the actor in this single activity. Other means documented non-government status; missing or '
             'disputed status is null. This alone does not establish an affordability-control exclusion.',
  'data_type': 'enum',
  'allowed_values': ['government_entity', 'municipality', 'other']},
 {'field': 'service_provider_type',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Documented government-entity status of '
             'the identified service provider in this single activity. Other means documented non-government '
             'status; missing or disputed status is null. This alone does not establish an affordability-control '
             'exclusion.',
  'data_type': 'enum',
  'allowed_values': ['government_entity', 'other']},
 {'field': 'service_provider_sets_or_limits_residential_prices_through_lawful_affordability_controls',
  'meaning': 'Single actor/activity with documented owner, dataset, process and recipient mapping; do not combine '
             'unrelated activities. Missing or disputed facts stay null. Whether the identified service provider '
             'in this single activity sets or limits residential prices through documented lawful affordability '
             'controls. Unresolved authority or legal status is null; unrelated activities do not establish this '
             'input.',
  'data_type': 'boolean'}]
}
FACT_DEFINITIONS.update(ACTIVITY_FACT_DEFINITIONS)


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
            if not valid_type or (type(value) is float and not math.isfinite(value)): raise ValueError(f"{name} requires a finite {kind}")
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
