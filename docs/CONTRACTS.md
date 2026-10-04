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
| POST `/api/v1/changes/summary` | the same `ChangeRequest` | unchanged Core result plus property/rule labels and jurisdiction/category groups |
| GET `/api/v1/source-comparisons` | none | Core-authored claim observations, both original spans and source identities, missing support and unresolved remedies |

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

Numeric bounds, fact-definition minimum/maximum and expression numeric values must be finite.
NaN and positive/negative infinity are rejected at model validation; null endpoints remain unbounded.
Frontend generated-contract digests/checks normalize CRLF to LF; meaningful contract changes still fail.

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

Change summaries preserve Core's result exactly; grouping never recomputes legal truth. A property
can occur in multiple groups and in both definite and uncertain sets, so group counts are not additive.
Empty groups retain the underlying partial/blocked status and notes. Optional offline `change_cache/`
records are bound to the full prepared rules, facts, resolutions, request, scenario definitions,
selectors, evaluator code and Python/Pydantic versions. Changed inputs or result hashes trigger Core
recalculation. GET/POST never populate that cache or write to the served store.

Source comparisons read `source_comparisons.json` from the selected snapshot. Platform passes Core's
authored values/spans back through `compare_claims` against the current original sources; saved
`anchor_valid` labels are not trusted. `status=unavailable` explicitly reports absent annotations.
The public claim envelope retains the field, affected rule IDs, both values/support lists, source URL,
authority, retrieval time and identity hashes, classification, unresolved status and remedy.
Dates encoded in claims retain their original precision. `semantic_support=not_checked`,
`winner=null` and `legal_amendment=null` remain distinct from successful source/anchor checks.
Internal rule-version/conditional-impact records are listed in response notes rather than presented
as claim observations. This endpoint creates no rules and changes no coverage decision.
Synthetic examples: `evidence_examples/claim_comparison.json` and `change_summary.json`.
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

## Property evidence package (PLAT-06 independent increment)

`POST /api/v1/lookup/evidence-package` accepts `EvidencePackageRequest`: a saved `address_id`,
explicit/default as-of date and the same request-local answers, supplemental facts, scenario ID
and limits as assist. Structured custom addresses are not supported by this endpoint. It returns
`EvidencePackage` as JSON with an attachment filename and `Cache-Control: no-store`.
It follows lookup's 404/422/503 and Core's 502/503 errors. No model or geocoder call is made.

The package contains one original property, its geography, the normalized request, the actual
assist response, all stored rules/source texts needed for deterministic retrieval/planning, extraction
index and consumed semantic-review records. Other properties, environment files, local pack paths
and provider credentials are excluded. Exact text, offsets, URLs, retrieval dates, partial dates,
answer provenance and remaining uncertainty are retained. Original source/fact stores are unchanged.

`input_sha256` identifies these replay inputs, not the entire 500-address release snapshot.
`response_sha256` and `package_sha256` bind the returned content. Code identity records normalized
LF file hashes, Python and runtime dependency versions; hashes are not authenticity signatures.
Replay requires the matching application version and lock/environment, calls the existing assist
service and evaluator, and compares the complete response. It never executes code from the package.
Missing Core capabilities stay explicitly unavailable during replay. A hash match alone does not
count as reproduced output. Source gaps/stale evidence remain in the replayed result.

Labels are `SYNTHETIC_NOT_FOR_SUBMISSION` or `RESEARCH_EVIDENCE_NOT_LEGAL_VALIDATION`.
Successful replay does not establish legal accuracy, corpus completeness or submission readiness.
Competition rules/lookups/changes formats are unchanged. Generated schemas and synthetic examples
are under `contracts/`; UX-04 must regenerate its derived types before using the new endpoint.
