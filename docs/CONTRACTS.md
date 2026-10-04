# API and data contracts

Authoritative internal schema: `navigator/models.py` (Pydantic, extra fields forbidden).
Generated outputs: `contracts/openapi.json`, `domain.schema.json`, `competition_rule.schema.json`,
`examples/{normal,empty,unknown,errors}.json`. Examples are synthetic. Regenerate via
`.\.venv\Scripts\python.exe -m navigator contracts`; never maintain an independent frontend schema.
Frontend can generate TypeScript types from OpenAPI using its chosen tooling.

| Endpoint | Input | Result |
| --- | --- | --- |
| GET `/api/v1/health` | none | service availability, dataset readiness, counts, last extraction outcome |
| GET `/api/v1/addresses` | `q`, `offset>=0`, `1<=limit<=100` | searchable page of property facts and jurisdiction resolutions |
| POST `/api/v1/lookup` | exactly one `address_id` or structured `address`; `as_of`; optional scalar `supplemental_facts` | rule evaluations, records, exact evidence, source metadata, warnings and run metadata |
| GET `/api/v1/rules/{id}` | stable team rule ID | full rule, related temporal versions, embedded evidence/interactions |
| GET `/api/v1/sources/{id}` | document ID | original text, metadata, hashes, capture issues |
| POST `/api/v1/changes` | `test_id` OR `before`+`after`, optional rule IDs and `actual`/`if_enacted` | definite/uncertain sets, conflicts, per-address diffs, mapping and complete/partial/blocked status |

Date default is fixed at 2026-10-01, never the machine date. API query dates are ISO days.
Extracted dates retain year/month/day precision; the evaluator uses intervals and may return unknown
inside an uncertain effective boundary. Effective day is inclusive; end_date is exclusive.
Pending never auto-enacts. Status events control historical queries; an undated snapshot does not
establish arbitrary history. A hypothetical enacts only selected pending rules for that comparison.

Rule lookup results: applies, unknown, superseded, not_yet_effective, pending. Internal audit additionally
uses inapplicable and failed; those are excluded from lookup/export lists, retained in rule history.
Do not render applicability as a violation or legal-compliance certificate. Every presentation includes
`disclaimer`, as-of date, source URL, retrieval timestamp, exact quote and unresolved reasons.

Evidence offsets are zero-based Python Unicode character offsets `[start,end)` into the unchanged
decoded UTF-8 original, including headers. They are not byte offsets. Lookup includes evidence and
source metadata; retrieve source detail for full text. Original and declared manifest hashes remain distinct.

Facts: unit counts are numeric dwelling units; ages are whole calendar years; dates use ISO strings.
Explicit textual unit bounds have provenance. Unexplained assessor abbreviations are not decoded.
Construction year does not establish certificate/occupancy facts; actual supplied dates retain their precision. Supplemental facts are
user-supplied, unverified, apply to one request and cannot override geography; raw inputs remain stored.
Custom addresses reuse an exact existing normalized address when available; otherwise state is from
the supplied address and local geography is unresolved (no automatic external/billable HTTP jobs).

The expression operators and shapes are in OpenAPI: all/any/not, comparisons, in, date_before,
date_on_or_before, age_at_least, literal, unsupported. No executable code. Three-valued logic discards
irrelevant missing facts after a decisive branch. Interactions need explicit direction, scope and evidence.

Errors: 404 unknown ID, 422 invalid input (FastAPI validation detail or `{code,message}`), 503 absent
dataset or no completed extraction. Successful legal unknown is 200. Empty address searches and
valid no-applicable-rule lookups are 200. A failed pipeline does not generate a successful empty dataset.
Change results may be `blocked` with 200: missing reference extraction is represented in the response.
Provider failure is a CLI error; no public ingestion/job endpoint is exposed.

Single-writer atomic JSON persistence is local and replayable. Cache hits retain originating run IDs.
Live provider output, real replay, local processing and synthetic fixture modes are distinct.
Schema changes go through the Platform steward, with consumer impact, regenerated fixtures and
coordinated migration before affected tasks resume. Keep unrelated tasks moving.

## Follow-up additions (Platform implemented)

See ASSIST_CONTRACT for complete types and Core function signatures. Generated research.schema.json
and OpenAPI include POST /lookup/assist, GET /facts, GET /rules/{id}/evidence and
GET /sources/{id}/context. Existing official competition record shapes are unchanged.
Source context accepts zero-based start/end, max_depth 0..4, max_chars 100..48000,
max_spans 1..24; unresolved references and bounded windows stay explicitly partial.

Supplemental field names/types are now validated against /facts. JSON booleans, integer counts,
ISO dates with preserved precision, and exact enumerations are required. Unknown fields are 422.
Null removes a request-local value/bound and restores unknown; all answers must be resent per request.
Client provenance is user_provided or demo; verified cannot be asserted by the client.
Demo answers only work in a synthetic dataset. No original property facts are modified.

Rule evidence is recomputed for lookup, assist, batch, changes, validation and exports. Missing or
changed support attaches review issues before the existing evaluator runs. Semantic review is an
explicit CLI operation; HTTP requests never call a model. evidence_checks.json is a companion export,
not an extra field in official rules/lookups/changes. Cached semantic review binds to rule/source versions.
A source reformat may invalidate evidence anchors without constituting a substantive legal amendment.

Daniel's CORE-03 evaluator now requires actual occupancy facts; combined tests include construction-year
non-inference and partial-date handling. The input registry never creates a
certificate/occupancy answer from construction year; it asks for the actual defined field.

Ownership is now four lanes: Platform stewards canonical schemas and routes; Core A produces rule_traces
and evaluate_rules; Core B owns plan_questions/render_rule and the adapter; UX owns the frontend.
ASSIST_CONTRACT defines the existing candidate boundary. This staffing change does not change schemas.
