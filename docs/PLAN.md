# Current plan: real-data change intelligence

## Current demo-delivery priority — October 4, 2026

Next Platform session follows [PLAT-13](tasks/PLAT-13.md) through
[PLAT-16](tasks/PLAT-16.md): existing deployment integration, selected snapshot assembly,
needed typed-input support, then freeze/export/rehearsal. Read [source-use decisions](DATA_SOURCE_RULES.md).
Work within the user's existing three-hour coding/build window; use focused checks and preserve
citation/date/unknown behavior. Keep the local demo available if hosting/account work stalls.

The municipal publication and official court-verification gaps remain external dependencies for
particular T2/T3/T5 conclusions. Do not block all delivery on them or invent evidence. Timebox only
concrete new leads. The participant guide prioritizes Modules A/B, then change tracking. Final
source/extraction eligibility is separate from a successful pipeline or a public website.

This section and the current board supersede historical next-task and snapshot counts below.

User-assigned next work after the October 3 readiness audit. This section supersedes the historical
planning snapshots below. Main `3b2d201` already includes Core A/B and frontend; do not rebuild them.
The signature journey is: source -> rule -> property -> useful question -> date change -> portfolio
impact -> unresolved source disagreement, with a reproducible evidence package.

| Lane | Assigned next deliverable | First independent work |
| --- | --- | --- |
| Vincent / Platform | [PLAT-06](tasks/PLAT-06.md): integrated snapshot, additive contracts, evidence package, complete launch/export acceptance | Finish active PLAT-05; prepare immutable store assembly and review local PLAT-04 continuation `11afb55` |
| Daniel / Core A | [CORE-06](tasks/CORE-06.md): T1-T5/lifecycle evidence and reusable source comparisons | Review saved evidence and prioritize missing support; the stopped provider run is not automatically resumed |
| Oliver / Core B | [CORE-07](tasks/CORE-07.md): actionable uncertainty, change/conflict explanations, real-case planner benchmark | Improve existing-interface explanations and prepare fixed benchmark harness |
| Frontend/UX / Claude | [UX-04](tasks/UX-04.md): portfolio timeline, disagreement view, evidence download, judge journey | Extend current changes UI with readable labels and drill-down using current contracts |

## Gate 1: one honest, usable dataset (P0)

Combine Daniel's saved rules and Platform's 491/500 geography only after ID/source/provenance checks.
Baseline source evidence remains incomplete: 15/54 captured documents processed; 140 review-needed rules;
16 exportable; 124 unresolved temporal projections. T2-T5 were blocked in the saved Core report.
Do not conflate these reported counts with a new run. Missing or contradictory source support must
remain visible, and 500 output IDs alone do not establish coverage.

Prioritize the five required change cases and consequential lifecycle gaps, then expand the corpus.
The user previously stopped extraction; saved-source review and software can proceed, while new
provider calls require a human resumption decision and a recorded budget. No synthetic replacements.

## Gate 2: integrated feature contracts (P0/P1)

Platform releases the smallest shared types/examples needed by the four lanes. Prefer existing
ChangeResult, EvidenceReport, SourceSpan, Uncertainty and rendered-rule structures. A disagreement
must retain both supported observations, authority/version/date, affected field/rules and remedy.
Core A owns what changed and why; Core B owns faithful explanations/questions; UX owns presentation.
Schema additions are plans until implemented, generated and checked through actual HTTP integration.

## Gate 3: signature demonstration (P1)

- Portfolio: timeline, jurisdiction/category summaries and property labels; drill down to source-backed
  changed provisions. Existing impact counts are already implemented and should be reused.
- Disagreements: compare claims and preserve unresolved conclusions. A moved citation or new source
  formatting is distinct from a substantive requirement, exemption or effective-date change.
- Evidence package: facts/answer provenance, dates, quotes, remaining uncertainty and code/data hashes.
- Real-case evaluation: quantify useful questions, missed facts, unnecessary questions, incorrect
  certainty and latency against fixed baselines, with author/reviewer and denominators disclosed.

Organizer open-question priority:

| Case | Priority / reason |
| --- | --- |
| NJ FAIR Act and local ordinances | First: also supports required T3; possible conflict/preemption needs source-backed treatment |
| Berkeley effective-date claims | Second: reuse disagreement mechanism; preserve source authority and missing adoption/effectiveness evidence |
| Los Angeles RSO date claims | Third: demonstrate the same mechanism across jurisdictions |
| California screening-fee cap | Optional later: dated formula and missing inputs; no invented definitive annual figure |

These are investigation targets, not facts to hard-code from the participant guide.
English/Spanish explanations are the first optional UX stretch after required flows pass, with
original quotes/dates retained and translation reviewed. Defer a new jurisdiction, generic chat,
notification systems, broad scraping and framework changes until the supplied scope is usable.

## Gate 4: release, evidence and submission

Use one reviewed code/data snapshot for the real browser journey, all 500 address exports and T1-T5.
Resolve critical blockers or explicitly document accepted partial scope; passing software checks is
not legal accuracy or an official score. Verify the complete frontend/API launch; the existing Docker
candidate packages only the backend and its runtime remains unverified at the audit checkpoint.

Prepare the organizer's rules.json, lookups.json, changes.json, live demo and one-page method note.
The supplied no-hour16 pack has five cases and no surprise document requirement. Confirm any conflicting
organizer logistics; do not add historical T6/video/scorer requirements without that confirmation.

Planning assumption remains October 4, 09:00 America/New_York, not a verified organizer deadline.
Reserve the final 90-120 minutes for feature freeze, fresh-session rehearsal, exports, method note,
backup recording and submission buffer. Public deployment/submission use applicable human authority.

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
