# Current plan — four developers

The user's October 3 staffing update supersedes the historical three-lane plan below. Read the current
playbook, OWNERSHIP and four starter prompts. The Git fix/pull is complete: current branch tracks
origin/main, merge 1f12f5b preserves Platform a034e2b. Existing Core candidate c92ad8f is separate.

| Lane | First independent work | Next dependency / acceptance |
| --- | --- | --- |
| Platform / Vincent | Coordinate Core B path release and review the existing Core candidate; keep APIs/exports stable | After authorized integration, actual Core HTTP answers/rendering and official exports pass; refresh shared fixtures |
| Core A / existing author Daniel | Review existing extraction/date/trace repairs; prepare real D001 extraction | Key/model for live run; stable rule_traces/evaluate_rules for Core B; no invented occupancy or lifecycle |
| Core B / new human pending | Read/review delivered planner/renderer and comparison; write after handoff | Isolated checkout + path release; planner uses Core A traces and one evaluator; bounded correlated alternatives reproduce |
| Frontend / Claude | Entire UI with working calls and labeled fixtures | Consume actual integrated planner/renderer; verify unknown -> question -> answer plus still-unknown case |

Existing Core features must be reviewed and continued, not implemented a second time. Remote candidate
reports 96 tests; local Platform's last software suite has 74. Neither number is a combined integration
result. Current checkout still lacks the Core module until coordinated integration. Model credentials,
missing source material and independent legal review remain separate blockers.

Order: P0 real extraction/source/schema/export correctness and candidate integration; P1 handoff/complete
question-renderer-frontend integration; P2 independently reviewed boundaries and broader source/reference
coverage. Core A owns legal/evaluator cases; Core B owns the planner comparison and rendering fidelity;
Platform stewards the candidate manifest/shared reports. Keep richer ranking/translations/features later.
Names and actual checkouts beyond the evidenced existing author are not invented; Vincent records them.

## Historical planning snapshots

The material below records earlier assumptions and checkpoints; the current four-lane plan above controls.

# Plan from actual clock

## Follow-up at October 3, 17:32 ET

Approximately 15h28m remain before the planning deadline. Canonical follow-up lives in docs/reference/;
execution is lane-scoped, not a request for one session to build every feature. Vincent/Platform owns this session.
Shared additions are in ASSIST_CONTRACT and contracts/research.schema.json; lane prompts are in docs/starters/.

| Capability at follow-up baseline 5ef1de1 | Classification / evidence | Owner / next step |
| --- | --- | --- |
| Bounded AST, three-valued/date/interaction evaluator | Verified software baseline: 42 tests pass | Core preserves and adds trace |
| Actual corpus extraction / legal T1–T5 outcomes | Blocked: no key/model, zero rules | CORE-01; no synthetic substitutes |
| 500-address ingestion / 479 Census municipalities | Verified real-data baseline | PLAT-01 retains 21 unresolved |
| Typed supplemental facts | Partial: scalars accepted without domain typing | PLAT-04 P0 input validation |
| Predicate tree/residual IDs / question planner | Missing; flat matched/unresolved lists exist | CORE-03/04 |
| Encoded-rule renderer | Missing; property explanation already exists | CORE-05 |
| Literal quotes and bounded model extraction review | Implemented, live model review unverified | CORE-01 retains extractor |
| Distinct source/anchor/semantic/dependency checks | Partial/missing; stale removed support not consistently guarded in API | PLAT-03 P0 |
| Context/reference retrieval and source-unit inventory | Missing | PLAT-03/05 |
| Frontend | Missing, entirely UX-owned | UX-03 can start with contracts/fixtures |
| Official export formatting | Verified synthetic/partial tests; legal submission blocked | Preserve formats in PLAT-04 |

No pre-existing software test failures reproduced. Blocking demo dependencies are provider configuration,
source gaps and missing Core assist services. They do not block UX fixtures or local evidence work.
Sequencing: contracts/ownership release -> PLAT-03 local evidence -> PLAT-04 answers/API -> PLAT-05 targeted review.
Core traces/planner and compact renderer proceed in its own checkout; UX builds the entire frontend in its checkout.
Target integrated journey remains unverified until actual Core services land. An injected fixture test is not live integration.

Initial inspection: October 3, 2026 16:41 America/New_York (20:41 UTC).
Planning deadline: October 4, 2026 09:00 America/New_York (13:00 UTC), approximately 16h19m
remaining at inspection. This is the team's assumption, not a confirmed organizer update.
At 17:00 October 3, approximately 16h remain. Benchmark date remains 2026-10-01.

Implemented: ingestion/provenance, constrained coverage engine, temporal handling, evidence validation,
provider boundary and review/cache, Census integration, API/CLI, T1–T5 adapters, exact export projections,
synthetic generalization demo and machine-readable frontend contracts. Real laws await provider setup.

| Target (ET) | Exit criterion |
| --- | --- |
| Oct 3, 18:00 | User configures provider; first real source produces reviewed evidence, lookup and export |
| Oct 3, 21:00 | Full captured corpus run, targeted omission review, real overlapping-rule demo; UX integrated |
| Oct 3, 23:00 | Architecture freeze; resolve source/version/scorer questions, review unresolved city recovery |
| Oct 4, 03:00 | Authorized integrated deployment, actual T1–T5 evidence, quality/error review |
| Oct 4, 06:00 | Feature freeze; no stack swaps or broad schema changes |
| Oct 4, 07:30 | Rehearsal, backup recording, method note and required videos ready |
| Oct 4, 08:15 | Submission/upload buffer starts; final fresh-session verification |
| Oct 4, 08:45 | Submit under human authority and verify receipt, leaving 15 minutes |

Core path: actual source -> automated rules -> verified property jurisdiction -> explicit query date ->
evidence-backed coverage -> changed address sets. Differentiator: each unknown explains the exact
missing fact, unsupported condition, legal conflict or geography limit; hypothetical enactment never
mutates actual law. Current synthetic example proves software behavior, not corpus accuracy.

Biggest risks: absent provider configuration; source gaps; no official key/scorer; unresolved legal
semantics; 21 unresolved addresses; contradictory challenge versions; no deployed UI yet.
Core first task is live evidence/omission review, Platform is geocode recovery, UX is contract integration.
Use 60–90 minute real demo checkpoints and one ordered merge queue.

Cut until required pipeline is credible: graph visualization, Spanish, extra jurisdictions, production
authentication, broad scraping, database/queue infrastructure expansions. Do not cut citation,
uncertainty, date behavior or partial/failure labeling. Public deployment still needs access controls
appropriate to its surface; no billable ingestion endpoint exists in this baseline.

## Follow-up implementation checkpoint

Planning and minimal contract release complete locally (3349851); Platform implementation complete
for review, with 74 passing tests. PLAT-03/04/05 are Review, not merged/deployed. Live semantic review
remains unverified because credentials/model and real rules are absent. Core/UX have no claimed run.

Ready next: Core CORE-03 + CORE-05, UX UX-03 entire frontend from fixtures/working Platform calls.
CORE-04 follows trace work. Full question/renderer integration is blocked on those implementations.
Core CORE-01 remains P0: configure OpenAI locally, extract/review D001, then selectively expand.
Keep submission/export failures ahead of richer ranking, acquisition, translations or product extras.

Follow-up acceptance owners: Core-02/04 + human reviewer complete the 12-case ordinary/boundary candidate
manifest into an independently reviewed benchmark and measure planner versus both simple baselines;
UX verifies complete question/evidence/change flows; Platform reruns combined API/official projection
checks after Core lands. Remaining geocode recovery PLAT-01 and packaging PLAT-02 stay ready but unclaimed.
