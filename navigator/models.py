"""Canonical internal contracts; competition records are projections of Rule."""
from __future__ import annotations

import calendar
import re
from datetime import date
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Category = Literal["rent_increase_limits", "just_cause_eviction", "security_deposits", "application_screening_fees", "screening_restrictions", "algorithmic_rent_setting"]
CATEGORIES = list(Category.__args__)
Truth = Literal["true", "false", "unknown"]
Result = Literal["applies", "unknown", "superseded", "not_yet_effective", "pending", "inapplicable", "failed"]


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid")


def date_bounds(value: str) -> tuple[date, date]:
    if not re.fullmatch(r"\d{4}(-\d{2}(-\d{2})?)?", value):
        raise ValueError("Use YYYY, YYYY-MM, or YYYY-MM-DD")
    parts = [int(p) for p in value.split("-")]
    year = parts[0]
    month = parts[1] if len(parts) > 1 else 1
    start = date(year, month, parts[2] if len(parts) > 2 else 1)
    end_month = month if len(parts) > 1 else 12
    end = date(year, end_month, parts[2] if len(parts) > 2 else calendar.monthrange(year, end_month)[1])
    return start, end


class Expression(Model):
    op: Literal["all", "any", "not", "eq", "ne", "lt", "lte", "gt", "gte", "in", "date_before", "date_on_or_before", "age_at_least", "literal", "unsupported"]
    args: list[Expression] = Field(default_factory=list)
    fact: str | None = None
    value: Any = None
    reason: str | None = None

    @model_validator(mode="after")
    def shape(self):
        if self.op in {"all", "any"}:
            if not self.args or self.fact is not None:
                raise ValueError("all/any require nonempty args and no fact")
        elif self.op == "not":
            if len(self.args) != 1:
                raise ValueError("not requires exactly one argument")
        elif self.op == "literal":
            if type(self.value) is not bool or self.args:
                raise ValueError("literal requires a boolean")
        elif self.op == "unsupported":
            if not self.reason:
                raise ValueError("unsupported requires an explanation")
        else:
            if not self.fact or self.args or self.value is None:
                raise ValueError("comparison requires fact and value, without args")
            if self.op == "in" and not isinstance(self.value, list):
                raise ValueError("in requires a list")
            if self.op.startswith("date_"):
                date_bounds(str(self.value))
            if self.op == "age_at_least" and (type(self.value) not in (int, float) or self.value < 0):
                raise ValueError("age_at_least requires nonnegative years")
        return self


class Evidence(Model):
    doc_id: str
    quote: str = Field(min_length=20)
    start: int | None = Field(default=None, ge=0)
    end: int | None = Field(default=None, ge=0)
    supports: list[str] = Field(min_length=1)


class SourceDocument(Model):
    doc_id: str = Field(pattern=r"^[A-Za-z0-9_-]+$")
    jurisdictions: list[str]
    url: str
    retrieved_at: str | None
    text: str = ""
    sha256: str
    manifest_sha256: str | None = None
    capture_status: Literal["supplied", "link_only", "failed", "terms_review", "supplementary", "synthetic"]
    authority: str
    source_type: str = "unclassified"
    issues: list[str] = Field(default_factory=list)
    duplicate_of: str | None = None


class Bound(Model):
    lower: float | None = None
    upper: float | None = None
    provenance: str

    @model_validator(mode="after")
    def ordered(self):
        if self.lower is None and self.upper is None:
            raise ValueError("At least one bound required")
        if self.lower is not None and self.upper is not None and self.lower > self.upper:
            raise ValueError("Reversed bounds")
        return self


class RawAddress(Model):
    street_address: str = Field(min_length=1, max_length=200)
    postal_city: str = Field(min_length=1, max_length=100)
    state: str = Field(pattern=r"^[A-Z]{2}$")
    zip: str = Field(default="", pattern=r"^([0-9]{5}(-[0-9]{4})?)?$")


class PropertyFacts(Model):
    address_id: str
    raw_address: RawAddress
    normalized_address: str
    facts: dict[str, Any] = Field(default_factory=dict)
    bounds: dict[str, Bound] = Field(default_factory=dict)
    missing_facts: list[str] = Field(default_factory=list)
    provenance: dict[str, str] = Field(default_factory=dict)


class JurisdictionResolution(Model):
    address_id: str
    state: str | None = None
    county: str | None = None
    municipality: str | None = None
    identifiers: dict[str, str] = Field(default_factory=dict)
    method: str = "assessor_state_only"
    match_quality: Literal["resolved", "unresolved", "ambiguous", "failed"] = "unresolved"
    benchmark: str | None = None
    vintage: str | None = None
    retrieved_at: str | None = None
    response_hash: str | None = None
    unresolved: list[str] = Field(default_factory=lambda: ["Legal municipality not resolved"])
    attempts: list[dict[str, Any]] = Field(default_factory=list)


class StatusEvent(Model):
    status: Literal["enacted", "pending", "failed", "repealed"]
    on: str
    evidence: list[Evidence] = Field(min_length=1)

    @model_validator(mode="after")
    def dates(self):
        date_bounds(self.on)
        return self


class Interaction(Model):
    kind: Literal["supersedes", "conflicts_with"]
    target_citation: str
    target_jurisdiction: str
    category: Category
    scope: Expression
    evidence: list[Evidence] = Field(min_length=1)
    note: str


class RuleDraft(Model):
    jurisdiction: str
    level: Literal["state", "city"]
    category: Category
    provision_key: str = Field(min_length=1, description="Stable short name for a distinct obligation within its citation")
    title: str
    requirement: str
    key_value: str | None = None
    citation: str
    quoted_span: str = Field(min_length=20)
    source_doc_id: str
    source_url: str
    coverage_conditions: Expression
    exemption_conditions: Expression = Field(default_factory=lambda: Expression(op="literal", value=False))
    exemptions: str | None = None
    lifecycle: Literal["enacted", "pending", "failed", "unknown"]
    effective_date: str | None = None
    end_date: str | None = None
    # Date at which the source establishes lifecycle when enactment history is unavailable.
    status_as_of: str | None = None
    status_events: list[StatusEvent] = Field(default_factory=list)
    evidence: list[Evidence] = Field(min_length=1)
    interactions: list[Interaction] = Field(default_factory=list)
    penalties: str | None = None
    review_issues: list[str] = Field(default_factory=list)
    conflict_flag: bool = False
    conflict_note: str | None = None

    @model_validator(mode="after")
    def validate_dates_and_place(self):
        for value in (self.effective_date, self.end_date, self.status_as_of):
            if value is not None:
                date_bounds(value)
        if self.effective_date and self.end_date and date_bounds(self.end_date)[1] < date_bounds(self.effective_date)[0]:
            raise ValueError("end_date precedes effective_date")
        pattern = r"[A-Z]{2}" if self.level == "state" else r".+, [A-Z]{2}"
        if not re.fullmatch(pattern, self.jurisdiction):
            raise ValueError("jurisdiction must be ST or City, ST")
        return self


class Rule(RuleDraft):
    team_rule_id: str
    evidence_mode: Literal["live", "synthetic", "replay"]
    extraction_run_id: str
    semantic_verification: Literal["model_reviewed", "needs_review", "synthetic_fixture"]


class NegativeFinding(Model):
    jurisdiction: str
    category: Category
    statement: str
    evidence: list[Evidence] = Field(min_length=1)


class ExtractionBundle(Model):
    source_kind: Literal["legal_text", "status_record", "agency_guidance", "secondary", "unclassified"] = "unclassified"
    rules: list[RuleDraft]
    negative_findings: list[NegativeFinding] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)


class PredicateResult(Model):
    value: Truth
    matched: list[str] = Field(default_factory=list)
    unresolved: list[str] = Field(default_factory=list)
    missing_facts: list[str] = Field(default_factory=list)
    supporting_facts: dict[str, Any] = Field(default_factory=dict)


class Evaluation(Model):
    team_rule_id: str
    result: Result
    jurisdiction: Truth
    coverage: PredicateResult
    temporal_status: str
    missing_facts: list[str] = Field(default_factory=list)
    uncertainty_reasons: list[str] = Field(default_factory=list)
    applied_interactions: list[str] = Field(default_factory=list)
    explanation: str
    conflict_flag: bool = False
    evidence: list[Evidence]


class RunManifest(Model):
    run_id: str
    operation: str
    mode: Literal["live", "replay", "synthetic", "local"]
    started_at: str
    finished_at: str | None = None
    elapsed_seconds: float | None = None
    outcome: Literal["running", "success", "partial", "failed"] = "running"
    input_hashes: dict[str, str] = Field(default_factory=dict)
    config: dict[str, Any] = Field(default_factory=dict)
    versions: dict[str, str] = Field(default_factory=dict)
    counts: dict[str, int] = Field(default_factory=dict)
    errors: list[str] = Field(default_factory=list)
    artifacts: list[str] = Field(default_factory=list)


class LookupRequest(Model):
    address_id: str | None = None
    address: RawAddress | None = None
    as_of: date = date(2026, 10, 1)
    supplemental_facts: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def one_address(self):
        if (self.address_id is None) == (self.address is None):
            raise ValueError("Supply exactly one of address_id or address")
        return self


class LookupResponse(Model):
    address: PropertyFacts
    as_of: date
    jurisdiction: JurisdictionResolution
    evaluations: list[Evaluation]
    rules: list[Rule]
    sources: list[SourceDocument]
    warnings: list[str]
    metadata: dict[str, Any]
    disclaimer: str


class ChangeRequest(Model):
    test_id: str | None = None
    before: date | None = None
    after: date | None = None
    rule_ids: list[str] = Field(default_factory=list)
    scenario: Literal["actual", "if_enacted"] = "actual"

    @model_validator(mode="after")
    def comparison(self):
        if self.test_id is None and (self.before is None or self.after is None):
            raise ValueError("Supply test_id or both before and after")
        if self.test_id and (self.before or self.after or self.rule_ids or self.scenario != "actual"):
            raise ValueError("test_id uses its published dates and scenario; do not combine overrides")
        return self


class ChangeResult(Model):
    test_id: str | None = None
    scenario: str
    status: Literal["complete", "partial", "blocked"]
    before: date
    after: date
    affected_address_ids: list[str]
    uncertain_address_ids: list[str]
    conflict_flag_address_ids: list[str]
    differences: dict[str, Any]
    mapped_rule_ids: dict[str, list[str]] = Field(default_factory=dict)
    notes: list[str]
    disclaimer: str


class AddressItem(Model):
    property: PropertyFacts
    resolution: JurisdictionResolution


class AddressPage(Model):
    total: int
    offset: int
    limit: int
    items: list[AddressItem]
    disclaimer: str


class RuleDetail(Model):
    rule: Rule
    versions: list[Rule]
    disclaimer: str


class HealthResponse(Model):
    status: Literal["ok"]
    version: str
    dataset_readiness: Literal["absent", "partial", "available"]
    sources: int
    rules: int
    addresses: int
    resolved_municipalities: int
    last_extraction_outcome: str | None
    disclaimer: str
