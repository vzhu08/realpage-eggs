# PLAT-06: integrated snapshot, evidence package and runnable release

Priority: P0 data/release, then P1 evidence package.
State: Platform software merged in PR #14; full release acceptance remains partial pending Platform source acquisition, Core evidence/review and additive UX adoption.

October 4 correction: missing T1-T5 source acquisition was incorrectly grouped into Core's
remaining work. Platform owns those captures. [PLAT-11](PLAT-11.md) delivers 21 new documents
with original response bodies and provenance; municipal publication/effectiveness evidence and
official verification of the T5 court mirror remain explicit Platform gaps. This does not update
the frozen release or make the saved T1-T5 evaluation results complete.

Integration follow-up: [PR #14](https://github.com/vzhu08/realpage-eggs/pull/14) includes the
PLAT-07 integrity fixes and unreadable-cache fallback. Combined backend verification passes
351 tests with the organizer pack; all four contract schemas match and regenerated package
examples replay. See `docs/evidence/plat06_integration.json`. The previously verified real-002
bundle remains immutable at its recorded runtime commit and retains its original acceptance evidence.
Owner: Vincent / Platform/API; current Codex session `01a104f0-cfea-7820-ac83-0bb1fb8349c5`.
Claimed checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs\artifacts\platform-release`.
Branch: `codex/platform-release`; starting SHA: `a7f9447815b53860c0f4a644dc0e00ca776139a1`
(PR #10 merged, including PLAT-05 and accepted COORD-04). Original PLAT-05 checkout stays unchanged.
Private data/cache: this checkout's ignored `data/plat06/`; verification artifacts: `artifacts/plat06/`.
The current user requested beginning the next Platform task. No additional agents are assigned.
The initial transfer gap is resolved by Daniel's archive merged in PR #13. Its archive hash and all
96 archived files (94 checkpoint files plus transfer notes/checksums) verify. PR #12 and #13 are
integrated locally without modifying another lane's authored code or checkout.

## Resumed completion — October 4

The user requested finishing PLAT-06 and explicitly approved sending the 59 failing geography
records to the official Census geocoder. That approval followed automatic review blocking the
initial live request for missing specific egress authorization. The approved check ran only in a
new private copy. Of those 59, 55 now reproduce; four are ambiguous (A0071, A0242, A0311, A0344).
The original nine unresolved records remain byte-identical. Total: 487 resolved / 13 unresolved.
The original Core checkpoint, sources, facts and geography input remain unchanged. No paid model
call, extraction resumption, public deployment, remote push or teammate contact occurred.

Runtime checkpoint: `5145f1b2c421ac2f5e6a12c5a4b0027ee9749855`, following integration of main
`84c2887` and the additive API/launch commit `761f05b`. Platform now exposes Core claim observations
with refreshed anchor checks and grouped change results with property/rule labels. No evaluator,
AST, planner, renderer or official competition shape was replaced. UX-04 still owns adoption of
the additive endpoints and evidence-download control; this task verifies the existing UI flows.

The new native frontend/API release serves one origin and checks all code/data/asset hashes before
launch. A real browser revealed concurrent portfolio work could exceed the UI's 20-second timeout.
Offline published-scenario caching now retains Core's exact result and invalidates on input,
selector, evaluator/runtime or payload drift; HTTP remains read-only. Uncached ad hoc portfolio
requests can still be slow and should be precomputed before rehearsal.

Shared snapshot: `data/plat06/integrated-release`, ID
`8c0a2b50e0eda0839cf881cfb251b2762583840d1bec2f36454f77a63c7ae165`.
It retains all 500 addresses, 140 rules, 87 sources and full transfer/geography provenance.
`data/plat06/integrated-serving` is a separate copy with validated derived scenario caches.
Runnable bundle: `artifacts/plat06/releases/real-002`; backup: `artifacts/plat06/releases/known-good-backup`.
Both are private local artifacts, with identical manifest hash
`08e95c386914a570cd159000da4799c616100ffe059a727f5702648517910d5b`.
The selected deployment candidate is the native loopback launch; Docker/public hosting remain unverified.

Current software checks: 342 backend tests pass with the organizer pack; contracts generate;
frontend generation/typecheck, 90 unit tests and production build pass in a disposable copy;
the existing fixture/API-double desktop/mobile suite has 80 passing tests and 14 skips.
Fresh real browser checks cover question, temporary unverified answer, reset, exact source and
separate evidence checks, desktop/mobile layouts, T1 partial impacts and property/date drill-down.
The published T1-T5 HTTP requests now take about 0.6-1.1 seconds, preserving available uncached outputs.
Backup launch reproduces health, HTML, a real lookup and T1 exactly. The final real-data runner
passes: all 500 addresses paginate/export, lookup references resolve, a downloaded package replays
offline, and all seven export payloads match byte-for-byte across two separate runs. Both export
commands return exit 1 with the explicit partial label because corpus validation still has errors;
the runner records this and does not relabel the corpus as valid. Served files remain unchanged.
The earlier real-001 run was superseded after its performance issue, not accepted as a successful release.

Legal/corpus release gate stays explicit: all 140 rules need review; only 16 currently project to
the official rule schema, with 124 unresolved temporal projections. T1 is partial (250 uncertain
properties); T2-T5 are blocked by absent extracted support/lifecycle evidence. Platform owns
missing source acquisition; Core owns interpretation, extraction and rule review. Independent
human review also remains required. No final judge readiness or accepted partial scope is asserted.

Handoff evidence: `docs/evidence/plat06_release.json`; detailed local report:
`artifacts/plat06/real-acceptance-verified/report.json`. Runtime code is frozen at `5145f1b`;
the final handoff commit also records the partial-export verification correction and these notes.
Changed Platform paths span `navigator/{api,service,store,export,models,contracts,evidence_package,cli}.py`,
`scripts/{assemble_snapshot,platform_ops}.py`, `deploy/**`, Platform tests, generated contracts,
and shared handoff/evidence/card/board docs. Integrated Core/frontend changes retain their owners' commits.

Local UI/API: `http://127.0.0.1:8016`. Restart from this checkout with the existing project venv:

```powershell
& C:/Users/vzhu0/PycharmProjects/realpage-eggs/.venv/Scripts/python.exe scripts/platform_ops.py serve-release --release artifacts/plat06/releases/real-002 --port 8016
```

Next action (updated after merge): Platform delivers missing sources through PLAT-11; Core A
reviews the captured evidence and lifecycle interpretation; UX-04 owns adoption of additive controls.
The immutable local artifacts are not included in Git and must be retained for the release handoff.

## Historical independent increment — October 4

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
