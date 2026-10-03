# Shared follow-up contract (Platform steward)

Canonical specification: `docs/reference/RealPage_Codex_Research_Followup_Prompt.txt`.
Canonical types remain in `navigator/models.py`; no second AST. Existing competition projection is unchanged.
This document establishes the interface for parallel implementation; it does not claim every service is implemented.
Core and UX may consume these files immediately in an allocated checkout. Platform owns all schema/route/fixture changes.

## Core / Platform service boundary

Core supplies `navigator/core_assist.py` with these synchronous, deterministic functions:

```python
def plan_questions(context: AssistContext) -> QuestionPlan: ...
def render_rule(rule: Rule) -> EncodedRuleRendering: ...
```

Platform passes request-local validated facts, bound/provenance data, legal geography, as-of day, all
prepared rules, evaluations, separate evidence reports, fact definitions and explicit analysis limits.
Core uses `navigator.engine.evaluate_rules` for every hypothetical probe and actual evaluation.
No model calls in the planner or renderer. Keep correlated predicates on one field tied to one value.
The canonical AST remains `Expression`; trace nodes reference AST paths, not a duplicate rule language.
Stable predicate IDs: `<team_rule_id>:<JSON-pointer-without-leading-slash>`, such as
`r-abc:coverage_conditions/args/1`. IDs survive repeated evaluation and property changes; an AST edit
may change paths. Expose the expression hash for version comparison, not a promise of identity across rewrites.

QuestionPlan has complete/partial/unavailable status, questions, residual traces, non-question remedies,
limits/evaluations_used/limits_hit and an explicit exhaustive flag. Default budgets: 5 questions, 8 fields,
64 evaluations, at most 3 jointly explored fields. Platform validates request ceilings. Rank by a documented
heuristic using fact answer-effort weights in `navigator/fact_inputs.py`, deterministic tie breaks.
Alternatives are hypothetical `probe_facts` plus evaluator outputs and remaining uncertainty; never persist probes.
Numeric/date partitions must preserve endpoint inclusion and partial-date precision. Do not expose internal
representatives as newly known property facts. Occupancy/certificate date is distinct from year_built.

Rule renderer returns encoded-rule text, expression hash, renderer version and unresolved nodes.
It is distinct from the property-specific Evaluation.explanation and is not legal verification.
Render comparison operators, grouping, dates, exemption structure, unsupported nodes and effective boundaries.

## Proposed API additions / implementation status

- `POST /api/v1/lookup/assist`: AssistRequest -> AssistResponse. Platform wires lookup, questions,
  evidence and rendering. Missing Core module returns an explicit unavailable plan/capability, never a mock plan.
- `GET /api/v1/rules/{id}/evidence`: EvidenceReport. Separate availability, source identity, citation
  anchor, exact quote, semantic and dependency checks; not one confidence score.
- `GET /api/v1/sources/{id}/context`: bounded original text around exact source offsets, plus references.
- `GET /api/v1/facts`: allowed fact definitions and answer forms.

At initial contract release these endpoints are planned; see FRONTEND_HANDOFF and OpenAPI after Platform implementation.
Existing `/lookup`, `/rules`, `/sources`, `/changes` and export schemas remain compatible.

AssistRequest extends LookupRequest with `answers`, optional request-local `scenario_id`, and limits.
Each answer: field, scalar value or null, provenance user_provided/demo and optional note. Duplicate
fields (including overlap with supplemental_facts) are 422. Do not accept client assertions of verified
provenance; verified benchmark facts retain existing assessor provenance. Demo answers require a synthetic
dataset. Answers are ephemeral, never mutate stored benchmark facts, and are echoed with provenance.
All accumulated answers must be resent on each stateless request. Null explicitly means unknown.
Core receives already-applied answers and must preserve bounds and any remaining uncertainty.

Input validation is Platform-owned; Core imports FACT_DEFINITIONS. Booleans must be JSON booleans;
counts positive/nonnegative integers as defined, dates YYYY/YYYY-MM/YYYY-MM-DD (precision preserved),
enum values exact. Unknown supplemental field names get 422 until a shared definition is added.
This tightens formerly unvalidated inputs, without changing valid existing unit/date requests.

Unknown legal coverage is 200; invalid requests 422; missing IDs 404; absent data/extraction 503;
Core service failures 503, malformed Core output 502. An unimplemented planner is visible in a 200
assist response so evidence/lookup can still work. Semantic verification is CLI-only (billable), never implicit in GET/POST.

## Immediate fixtures

`contracts/research.schema.json`, `contracts/research_examples/*.json` are schema-valid synthetic examples:
decisive_question, irrelevant_missing_fact, two_unresolved_exemptions, unresolved_source_coverage,
bounded_partial_analysis. Their plans are authored expectations, not implemented Core behavior.
Alternative evaluation records are produced by the existing evaluator. The modified-rule examples are
algorithmic fixtures, not source-verified legal interpretations. Core must replace assumptions with tested
planner output; UX can build loading/partial/unavailable/answered states now.
Renderer/source-comparison and evidence-failure examples will be supplied by Platform's evidence task.

Platform is the sole writer of models, contracts generator/generated artifacts, API routes, fact registry,
and shared coordination docs. Core owns its implementation/tests/card; UX owns frontend/tests/card.
Request a contract change with consumer impact; do not edit another lane's files directly.
