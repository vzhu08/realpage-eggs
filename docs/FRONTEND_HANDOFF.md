# Frontend handoff

## PLAT-06 evidence-package consumer handoff

Independent API increment: POST `/api/v1/lookup/evidence-package` with a saved `address_id` and
the current assist date, answers, supplemental facts, scenario ID and limits. Save the JSON response
as a download. The response's `Content-Disposition` uses a safe hash-based filename; frontend clients
can also choose a fixed `evidence-package.json` filename. Display its artifact label and disclaimer.
The original property is `inputs.original_property`; the answered result is `response.lookup`;
`response.answers_applied` retains answer provenance. Exact sources are in `inputs.sources`.
Do not substitute a prior assist response from a different answer/date state.

The additive Pydantic/OpenAPI/research models and normal/missing-source examples are Platform-owned.
UX-04 owns running `npm run generate` in its checkout and adding the download control; no frontend
file is changed by this Platform increment. Existing assist/change payloads remain compatible.
Software replay can be checked independently with labeled synthetic inputs; full real-data UI and
release acceptance still depend on the missing Core transfer and geography reconciliation.

UX/Claude Code owns all frontend work. No frontend implementation is included.
Start backend from repository root with:

```powershell
.\.venv\Scripts\python.exe -m uvicorn navigator.api:app --host 127.0.0.1 --port 8000
```

Base URL `http://127.0.0.1:8000/api/v1`; Swagger `/docs`; runtime OpenAPI `/openapi.json`.
Checked-in contract: `contracts/openapi.json`. CORS allows localhost:3000 and localhost:5173 by default.
Use `NAVIGATOR_CORS_ORIGINS` for other origins. No frontend environment variable name is prescribed.

1. Address flow: list/search `/addresses`, choose an ID and explicit date, POST `/lookup`.
   Render jurisdiction method/quality separately from property missing facts. Supplemental facts
   must be labeled user-supplied and sent only in that lookup request.
2. Evidence flow: show rule requirement, evaluation result, source URL, retrieval date, quote,
   missing facts, uncertainty reasons, source detail and temporal versions. Show the query date
   and not-legal-advice disclaimer on the answer.
3. Changes flow: POST `{"test_id":"T1"}` or `{"before":"2026-10-01","after":"2027-07-02"}`.
   Keep definite and uncertain sets separate. T4 says if-enacted; show conflicts and before/after
   evidence. A blocked scenario is not a verified empty affected set.

Required states: loading, transport failure, 422 invalid request, 404 stale selection, 503 unavailable
dataset/extraction, empty search, empty valid lookup, legal unknown, source gaps, unresolved city,
partial extraction, provider failure and blocked change scenario. Never hide a partial-data banner.
Live/replay/synthetic mode labels come from metadata; synthetic fixtures require a conspicuous banner.

The original local ingest checkpoint listed 500 properties with 479 resolved cities; PLAT-01's
separate recovery store reached 491/500. Source/extraction readiness depends on the selected store:
read `/health` and actual lookup responses instead of assuming rules exist. A store without completed
extraction returns lookup 503 and blocked change scenarios. Do not invent answers.
For immediate UI integration use `contracts/examples/` or the separate synthetic data store:

```powershell
.\.venv\Scripts\python.exe -m navigator --data-dir data/synthetic demo
$env:NAVIGATOR_DATA_DIR='data/synthetic'
.\.venv\Scripts\python.exe -m uvicorn navigator.api:app --host 127.0.0.1 --port 8001
```

Synthetic date 2026-11-15: SYNTH-001 applies, SYNTH-002 empty, SYNTH-003 unknown units.
Before 2026-11-15 the covered rule is not yet effective. Restore NAVIGATOR_DATA_DIR to `data`
before running the real backend. New-address live geocoding, production auth and deployed URL are
not available. UI should not offer capabilities absent from this contract.

## Follow-up ready for the entire frontend

Start with docs/starters/FRONTEND_CLAUDE.md and UX-03. Main at `c57107a` contains the Platform
services, Daniel's actual Core planner/renderer, and PLAT-03's bounded-context fix. The PLAT-04
continuation on `codex/platform-assist` verifies the answer/export boundary and fixes empty-ID
handling. Use a separate checkout and private mutable data store.

Implemented calls (prefix /api/v1):

| Call | Purpose / expected state |
| --- | --- |
| GET /facts | Fact meaning, unit, JSON type and acceptable answers |
| POST /lookup/assist | Lookup + evidence + answers + Core capability state |
| GET /rules/{id}/evidence | Separate identity, anchor, quote, semantic and dependency statuses |
| GET /sources/{id}/context?start=0&max_depth=2 | Bounded original source context and explicit references |

First synthetic request: {"address_id":"SYNTH-003","as_of":"2026-11-15"}.
Then resend with "answers":[{"field":"units","value":8,"provenance":"demo"}] and an optional
"scenario_id":"browser-scenario-1". Unknown changes to applies through the production evaluator.
No server scenario state exists; keep answer history in the UI and resend all accumulated answers.
Null means unknown. Show remaining uncertainty, never imply one answered question settles every rule.
Use source character offsets (Python Unicode code points, not JavaScript UTF-16 indices) or returned
span text; convert code points before slicing source strings containing supplementary characters.

Core is integrated: the synthetic SYNTH-003 request returns an actual `units` question and encoded
rule rendering, with both capabilities `implemented`. When a Core function is absent in another
build, its capability is `dependency_unavailable`; a missing planner has status `unavailable`
and no questions, while a missing renderer produces no encoded rules. This successful partial
capability response is distinct from a crashing Core service (503) or malformed output (502).
The actual service never supplies authored fixture plans as a fallback.

On the PLAT-04 continuation, an empty `address_id` produces 404 `unknown_id` on both lookup
routes; absent selectors or both selectors produce 422. A valid structured address still works.
An optional `scenario_id` is echoed but stores no server-side answers: omitting prior answers
on the next request restores the original unknown state. Demo provenance and notes are echoed;
booleans cannot stand in for integer unit counts. All seven export payloads remain unchanged
after the synthetic answer flow; export-run IDs/timestamps belong to separate run manifests.

| Fixtures | Status |
| --- | --- |
| contracts/examples/assist.json | Actual synthetic Platform/Core response with implemented planner and renderer |
| contracts/research_examples/decisive_question.json | Authored Core question expectation; alternatives reproduce via evaluator |
| contracts/research_examples/two_unresolved_exemptions.json | Occupancy answer still unknown; algorithmic modified rule, not legal evidence |
| contracts/research_examples/irrelevant_missing_fact.json | No useful question expected |
| contracts/research_examples/unresolved_source_coverage.json | Source remedy, not a renter legal question |
| contracts/research_examples/bounded_partial_analysis.json | Partial plan / explicit exploration budget |
| contracts/evidence_examples/missing_support.json | Actual synthetic missing-source evidence failure and unknown result |
| contracts/evidence_examples/source_comparison.json | Actual evidence report plus authored expected rendering; use assist for actual Core rendering |

Integration verified through the API: strict answer types, actual Core question -> labeled answer
-> reevaluation, two exemptions that stay unknown, budget/source gaps, renderer capability,
request isolation and unchanged export payloads. These are synthetic software checks, not an
independent legal review. Browser UI integration remains the UX owner's verification task.
Keep fixture and synthetic mode visibly labeled while developing those UI states.
PLAT-04 verification: 28 focused API/export tests and 179 full tests passed; schemas unchanged.
Exact request/outcome observations and export hashes: `docs/evidence/plat04_assist.json`.

## Four-developer ownership update

Use docs/Hackathon_Development_Playbook.txt and OWNERSHIP. Frontend remains one developer's entire lane.
Core A (existing author Daniel) owns extraction/evaluator/traces; Core B (new human pending) owns planner,
renderer and core_assist.py. Platform remains the API/schema/generated-fixture steward. Route question/UI
behavior issues to Core B, truth/source issues to Core A and contract requests to Platform.
Daniel's Core services merged through PR #3 at `3b1ef06`; no new Core work is required for
the current API journey. Missing-service states above remain supported failure paths.
Do not ask either Core developer to rebuild the merged features. Future Core edits still require
the ownership handoff recorded in OWNERSHIP.
# PLAT-06 additive API and local release handoff — October 4

Platform now supplies `/api/v1/changes/summary`, preserving the existing `ChangeResult` and adding
property/rule labels and jurisdiction/category groups. Use `result.status` and `result.notes` even
when groups are empty; group counts overlap. Existing `/changes` and official exports are unchanged.
`GET /api/v1/source-comparisons` exposes Core's saved claim annotations after fresh source/anchor checks.
Both claims, exact spans, authority, dates, hashes, unresolved status and remedies are retained.
Semantic support is explicitly not checked and no winner or legal amendment is selected.
See CONTRACTS and the two new synthetic `claim_comparison`/`change_summary` fixtures.

The earlier property evidence download/replay contract remains available. UX-04 owns the comparison
view, summary adoption and download control; the existing UI remains usable with its current endpoints.
Run `npm run generate` in the UX checkout before adopting the additive models. The Platform build
regenerates only inside its disposable verification copy; no frontend source or generated file is
edited in this task checkout. The native release serves that verified build and the API on one origin.

Real-data handoff: 500 addresses, 140 rules, 87 sources, 487 resolved municipalities and 13 unresolved.
All rules remain review-needed. Use actual request results for examples; factual answers cannot cure
missing legal evidence. Current portfolio computation is expensive, so rehearsal uses validated
offline caches for published scenarios, bound to the exact code/data. Cache misses are recalculated
and can exceed the UI's existing 20-second timeout. Detailed acceptance results follow in the release
evidence report; this is not a claim that UX-04 or legal review is complete.
