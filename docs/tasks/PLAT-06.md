# PLAT-06: integrated snapshot, evidence package and runnable release

Priority: P0 data/release, then P1 evidence package.
State: Evidence-package increment verified and ready for review; real snapshot remains blocked on the Core store.
Owner: Vincent / Platform/API; current Codex session `01a104f0-cfea-7820-ac83-0bb1fb8349c5`.
Claimed checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs\artifacts\platform-release`.
Branch: `codex/platform-release`; starting SHA: `a7f9447815b53860c0f4a644dc0e00ca776139a1`
(PR #10 merged, including PLAT-05 and accepted COORD-04). Original PLAT-05 checkout stays unchanged.
Private data/cache: this checkout's ignored `data/plat06/`; verification artifacts: `artifacts/plat06/`.
The current user requested beginning the next Platform task. No additional agents are assigned.
Initial input gap: the transferred `data/plat05-internal-input` contains rules/sources only;
the full Core store (facts, extraction index, run manifests and caches) is required before real assembly.

## Independent work authorized October 4

The user requested useful Platform work that does not depend on the missing Core transfer.
This same writer/check-out now claims `navigator/evidence_package.py`,
`tests/test_evidence_package.py`, additive models/API/CLI/contracts and shared handoff docs.
Deliver a property/date evidence download and deterministic offline replay using existing
assist/evaluator services. Verify with labeled synthetic fixtures; real corpus acceptance stays blocked.
No Core implementation, frontend file, input store, provider job or deployment is part of this increment.

### Independent increment result

Implemented `POST /api/v1/lookup/evidence-package`, `navigator evidence-package` and
`navigator replay-evidence-package`. A saved property/date/answer state produces a self-contained
JSON download with original facts, request-local answers, complete assist output, exact source text,
evidence/uncertainty, code/runtime hashes and input/output/package hashes. Offline replay uses the
existing Core services, rejects changed content/code or non-reproducing output, and needs no original
store. Hashes provide integrity checks, not authenticity or legal acceptance. No competition format changed.

Current checks: 303 full backend tests pass (including the organizer-pack check); 16 focused package
tests pass; contract generation succeeds and the two new synthetic package examples replay exactly.
Actual Uvicorn HTTP shows unknown -> answered applies -> reset unknown; downloaded JSON replays
in a fresh process with a nonexistent data directory. The input store remains byte-identical.
One existing Starlette/httpx deprecation warning remains.

In a disposable frontend copy, generated types/schema checks, typecheck, 80 unit tests and build pass.
The unmodified frontend's generated files are intentionally stale until UX runs `npm run generate`.
Windows regeneration also changed older fixtures' source offsets relative to UX's recorded LF text;
the published source/offset pairs were retained, with only additive schemas/new examples copied back.
The sandbox initially blocked esbuild parent-directory reads; the same build passed with approved
escalation. No authored or generated `frontend/**` file in the task checkout was changed.

Changed paths for this increment: `navigator/{api,cli,contracts,models,evidence_package}.py`,
`tests/test_evidence_package.py`, `contracts/{openapi,research.schema}.json`, the two new package
examples under `contracts/evidence_examples/`, shared contract/runbook/frontend-handoff/board docs,
this card and `docs/evidence/plat06_evidence_package.json`. Earlier snapshot/PLAT-04 changes remain
in the same local branch. Result checkpoint: the local commit on `codex/platform-release` containing
this handoff. No push or remote integration occurred.

Next action: review the Platform increment; UX-04 regenerates its derived types and adds the download
control using the documented endpoint. The pending Core transfer, geography reconciliation,
Core-produced source comparisons and real browser/release acceptance remain separate dependencies.
Detailed commands, hashes, limitations and results: `docs/evidence/plat06_evidence_package.json`.

## Earlier paused checkpoint

The user confirmed the remaining Core files are not available and requested waiting.
Changes are saved locally in this isolated checkout; no push, merge, extraction or deployment occurred.
PLAT-04's `11afb55` service fix, regressions, card, evidence and frontend handoff are reconciled;
its stale task-board text was not imported. Snapshot assembly and geography-only audit tooling
are in `scripts/assemble_snapshot.py`, with synthetic checks in `tests/test_snapshot_assembly.py`.
No shared API schema or frontend file changed.

Verification before pause: focused API/export checks 27 passed / 1 skipped (pack path absent in
that invocation); isolated full suite with the explicit organizer-pack path 286 passed; contracts
generation exit 0. The final snapshot tests, including the subsequently added legacy-range/audit
regression, passed 24 tests. The full suite preceded the final audit helper; it was not rerun after
the pause request. One existing Starlette/httpx deprecation warning remains.

Real input audit: assembly rejects the incomplete Core transfer before creating output.
Geography-only audit finds 432 of the 491 recorded resolved addresses reproduce exactly under
current cached Census checks. Another 59 need reconciliation: 58 encounter house-number mismatches
and missing retry caches; one resolves with different method/response provenance. The nine originally
unresolved addresses remain unchanged. These are structural software checks, not legal verification.
Both input stores remain unchanged; no external geocoder or model requests were made.
Reports are preserved in `artifacts/plat06/input-audit.json` and
`artifacts/plat06/geography-audit/geography_audit.json`; isolated checks are in
`artifacts/plat06/verification`. No combined real snapshot or release readiness is claimed.

Resume only when the user is ready: obtain the complete Core store, reconcile the saved geography
in a new private candidate, then assemble/verify the common snapshot. Additive contracts,
evidence packages and the real browser/release journey remain subsequent PLAT-06 work.
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
