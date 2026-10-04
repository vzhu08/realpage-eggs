# PLAT-06: integrated snapshot, evidence package and runnable release

Priority: P0 data/release, then P1 evidence package.
State: Assigned; preparation Ready, execution follows PLAT-05 in Vincent's lane.
Owner: Vincent / Platform/API. No new session has been started or messaged.
Starting base: current reviewed main containing `3b2d201`, plus accepted COORD-04 fixes
and the eventual PLAT-05 result. Review local PLAT-04 continuation `11afb55` for inclusion.
Suggested branch: `codex/platform-release`; record actual checkout, session, starting SHA
and private data directory before writing. Do not repurpose the active PLAT-05 checkout.

Read: OWNERSHIP, PLAN, CONTRACTS, ASSIST_CONTRACT, PLATFORM_RUNBOOK, CORE_A_HANDOFF,
and cards PLAT-05 / CORE-06 / CORE-07 / UX-04. Baseline real stores are separate:
Daniel reports 140 rules; Platform's `data/plat01-recovery` has 491 resolved municipalities.

Allowed paths: Platform runtime/tests from OWNERSHIP; `scripts/assemble_snapshot.py`,
`navigator/evidence_package.py`, `tests/test_snapshot_assembly.py`,
`tests/test_evidence_package.py`, `deploy/**`, `scripts/platform_ops.py`;
shared models/contracts/docs/dependencies through this single Platform writer.
Core truth/source comparison stays in CORE-06; frontend stays in UX-04.

Deliver in order:

1. Finish/accept PLAT-05 and reconcile `11afb55` without dropping its request-isolation
   fix or evidence. Publish a reviewed code/data starting point for the four lanes.
2. Assemble a NEW private snapshot from saved rules/sources and proven geography.
   Verify all 500 IDs, normalized addresses, source bytes/hashes, rule references,
   extraction indexes and cache provenance before combining. Reject mismatches;
   preserve both input stores. Keep nine unresolved municipalities explicit.
3. Release the smallest shared contract needed by CORE-06/07 and UX-04: actual change
   summaries, property labels, source disagreement observations and evidence-package metadata.
   Prefer existing models; any additions are proposed until Pydantic, examples and HTTP checks land.
   A disagreement needs its field, both supported claims/spans, source authority/version/date,
   affected rule IDs, unresolved reason and remedy. No new AST or confidence percentage.
4. Wire Core-produced changes/disagreements into APIs. Group existing results without
   recomputing legal truth. Keep definite, uncertain, conflict and blocked states distinct.
5. Add a reproducible evidence package for a property/date: snapshot/code versions,
   original facts, request-local answer provenance, evaluations, exact quotes, URLs,
   retrieval dates and remaining uncertainty. Preserve official competition JSON shapes.
6. Verify the real browser-to-backend launch, exports and chosen deployment candidate.
   Docker runtime is currently unverified; the existing image serves only the API.
   Prepare the complete frontend/API launch and a known-good snapshot/rollback path.

Acceptance:

- Inputs remain byte-identical; output manifest identifies every input and result hash.
- All 500 address IDs survive evaluation/export, with no dangling rule/source references.
- T1-T5 run from the SAME snapshot as the UI. Report precise blockers instead of fabricated
  empty sets; final release readiness requires resolving critical blockers or explicitly
  accepting disclosed partial scope. Internal test success is not an official score.
- Real property -> question -> answer/reset -> evidence -> change drill-down works in a fresh browser.
- An evidence package can reproduce its result offline; no credentials or unlabeled fixtures.
- Host/deployment/publication require the applicable human authorization; this card prepares
  and validates the release but does not assert that a public deployment already exists.

Checks: full pytest; `python -m navigator contracts`; frontend generated/type/unit/build
checks after schema changes; snapshot preservation/rejection tests; actual HTTP/export smoke;
fresh browser flow against the real backend. Record Docker and public checks separately.

Handoff: commit, changed paths, immutable snapshot location/hash, commands and exit codes,
T1-T5 statuses, unresolved coverage, frontend API URL, launch instructions and next action.
Dependencies: saved Core store/configuration for live PLAT-05; CORE-06 for evidence-backed
legal changes; UX-04 for complete browser acceptance. Continue contract/launch prep meanwhile.
