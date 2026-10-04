# COORD-04: readiness fixes and four-lane next assignments

State: Verified software; integration is tracked in [PR #11](https://github.com/vzhu08/realpage-eggs/pull/11). Human coordinator: Vincent. Session: current readiness-audit chat.
User assignment: fix the two audit findings regardless of the usual lane boundaries,
then assign the proposed next work to the four existing developer lanes in the docs.
This exception is limited to these fixes and coordination; it does not add writers.

Base: `3b2d2011de3d0319f96702bbeddb6ec72323dc27` (merged PR #9).
Branch: `codex/readiness-fixes-and-plan`.
Checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs\artifacts\readiness-fixes-and-plan`.
The active `codex/platform-review` checkout and its PLAT-05 edits are preserved.
Initial implementation made no live provider calls, extraction restart, teammate messages,
push, merge or deployment. The user subsequently authorized publishing and merging these
fixes/task assignments. PLAT-05 remains a separate open PR #10 and is not included.

Claimed paths: `navigator/models.py`, `tests/test_numeric_contracts.py`, the existing
planner/renderer defensive tests, `frontend/scripts/generate-contract-types.mjs`,
`frontend/tests/unit/generator-portability.test.ts`; generated contracts if regeneration
changes their content; `AGENTS.md`, shared coordination docs and starters, and new cards
COORD-04, PLAT-06, CORE-06, CORE-07, UX-04. No PLAT-05 runtime/card edits.

Acceptance:

- LF and CRLF checkouts produce the same frontend contract digest and pass the check;
  a real contract change still fails the check.
- Stored numeric bounds, fact-definition limits and expression thresholds reject
  NaN and both infinities before evaluation; null endpoints and exact integers remain valid.
- Keep existing planner/renderer defensive behavior tested by explicitly bypassing validation.
- Assign one next card to each lane, with scope, dependencies, checks and release gates.
- Preserve the explicit corpus pause and distinguish merged software from incomplete evidence.

Pre-fix evidence: 33 numeric rejection cases fail; the finite-input control passes.
The isolated LF/CRLF generator regression also fails. Post-fix focused verification:
85 numeric/planner/renderer tests pass and the generator regression/check pass.
Final full-suite and documentation validation are recorded below before handoff.

Integration note: the audit found PLAT-04's baseline in main, but continuation `11afb55`
is still local. PLAT-06 must reconcile that continuation with PLAT-05 and this branch;
do not describe the additional PLAT-04 fixes as already merged.

## Final verification

- Full backend suite in a disposable copy: **255 passed**, one existing Starlette/httpx warning.
- `python -m navigator contracts`: passed in that copy; all four canonical schemas are
  structurally unchanged, so no generated-schema or random example-run-ID churn is committed.
- `npm run verify`: generated check, strict TypeScript, **80 unit tests** and production build pass.
  The new portability test covers LF/CRLF combinations and rejects actual contract changes.
- Existing defensive planner/renderer checks still pass with deliberately invalid constructed inputs.
- Updated document links and task-card acceptance/check/handoff fields validate; diff check passes.
- No new browser run was needed for these model/generator-only changes. The prior audited
  baseline had 72 browser tests passed and 12 skips; it used fixtures/API doubles.

Evidence: [coord04_readiness.json](../evidence/coord04_readiness.json).
Limitations: stricter ingress rejects previously accepted non-finite stored values; absent bounds
must use null. No model calls, original-store writes, new feature implementation or remote operations.
Next action after PR #11 merges: execute the assigned cards from that common base and
reconcile PLAT-05 separately when ready. Preserve local PLAT-04 continuation `11afb55`.

## Authorized integration

The user requested merging the fixes and task assignments. Fresh fetch confirms main remains
`3b2d201`, the exact tested base; the six runtime/test fingerprints match the passing evidence.
PLAT-05 has a separate open PR #10 at `c0b3be3`; it is preserved and not merged by this task.
Only docs/status metadata changes follow the verified fixes. Resolve the shared TASKS board
against its latest owner status when PLAT-05 later integrates. The primary checkout remains
on its Platform branch; this operation uses only the isolated readiness checkout.
