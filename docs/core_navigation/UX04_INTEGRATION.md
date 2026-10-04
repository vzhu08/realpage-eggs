# Core B and UX-04 integration — October 4, 2026

User request: push Oliver's Core B work and Claude's frontend work, and resolve merge
errors. Codex /root is the integration writer; Claude's task was inspected and finished
before this checkout was changed. This scope authorizes the bounded frontend/backend
compatibility repairs below. No additional writer or provider extraction was started.

Checkout: `/Users/oliverchen/Documents/random shi/realpage-eggs-core-b-ux04-integration`.
Branch: `codex/core-b-ux04-integration`.

## Inputs and preservation

- Final main: `607dce32ae690c8b9276fbfa53c23c4d104ed07c`, including Daniel’s CORE-06
  PR #13 and Vincent’s Platform release PR #14. Initial integration used `84c2887`.
- Core B: `codex/core-b-explanations`, `0161b95`; implementation `5a8e1cd`.
- Claude: `codex/frontend-change-demo`, `43fa402`; implementation `49de1a1`.
- Local merge commits: `cfd76f7`, `c7395d6`, and Platform integration `e5966b2`;
  all merged without text conflicts.
- Integration runtime/test fixes: `af14cd883ec05d7c233bd423127f386072432a9d`.

The original author checkouts and branch histories are preserved. The old Core B
handoff's local `.riv` edit and Claude's untracked `Claude outputs/` folder are untouched.
The combined PR carries both histories and the integration fixes; the two source
branches are retained separately for reference.

## Compatibility repairs

1. Core B retains the affected field on an interpretation uncertainty. The UI honors
   Core's classification for that rule/field instead of recreating an unsupported legal
   classification as a property question. A backend regression and rendered-UI regression
   cover the boundary.
2. An imprecise property date keeps its factual remedy. The frontend no longer adds a
   contradictory interpretation row when Core has classified the same field. The summary
   of unchanged unknown results no longer asserts that no factual answer could help.
3. CORE-06 preserves equal-status, unresolved results as possible impacts. Portfolio
   labels now describe comparison results rather than claiming every row definitely
   changed. Timeline/source/category/filter expectations include those uncertain rows.
   In the development headline there are 42 rows, five sources and six rule records;
   definite/uncertain/conflict property counts remain 11/10/10 (overlapping sets).
4. Both demo recordings were regenerated with the actual combined backend at `e5966b2`.
   They remain explicitly fictional, including the separate proposed disagreement shape.
   The original judge backup frames are labeled historical; they are not a recording of
   the integrated or real-data build.

The integration fixes introduce no shared schema, route, dependency or evaluator-contract changes. The added uncertainty
field uses the existing optional field. No Platform/Core A runtime was edited during
integration. Shared generated examples remain Platform-owned; the verifier records their
drift in a disposable copy instead of silently rewriting them. Frontend derived contracts
were regenerated from Platform’s released schemas (digest `3a71126e3e2733d4`, 51 models).
The disposable verifier now includes Platform scripts and the lockfile required by the
new release/evidence-package tests.

## Verification

Backend evidence: `ux04_integration_validation/verification.json`,
`benchmark_results.json`, and `planner_evaluation.json`. The verifier records source
SHA-256 values, checks a disposable copy, and preserves working contracts/stores.

- Python 3.12.14, matching `requirements.lock`: 358 backend tests passed, one skipped
  because the organizer pack is absent. Compileall and contract generation pass.
- New benchmark: 17/17 alternatives reproduce through actual assist HTTP handlers;
  no incorrect certainty in the fixed software expectations. Original eight cases
  retain 11 questions versus 14 for the baseline. Human review is still unassigned.
- Installed macOS Node 22.23.2 toolchain: `npm ci --no-audit --no-fund`, then
  `npm run verify`: generated contracts, TypeScript, 118 unit tests, Vite build pass.
- `CI=1 npm run test:e2e -- --workers=2`: 114 passed, 22 skipped, zero failures
  against the production Vite build, desktop Chromium and Pixel 7. Skips are 18 opt-in
  screenshot captures, two opt-in backup captures, and two viewport-specific cases.
- Existing warnings: Starlette/httpx deprecation and large bundled demo-data chunk.

Frontend checks use synthetic recordings/API doubles. They do not establish real-data
browser acceptance or legal accuracy. Backend HTTP tests use the actual FastAPI handlers.

## Remaining feature gates

Daniel's partial Core store is now available on main in
`docs/core_rules/snapshots/core-store.zip`; the earlier Core B statement that original
sources were unavailable describes its original verification checkout. This integration
does not assemble that snapshot with Platform's geography or reopen the paused provider
run. CORE-07's fixed real-source cases still need supplied/reviewed expectations and a
named human review; UX-04 still needs the integrated real browser/API rehearsal.

PLAT-06’s source-comparison, change-summary and evidence-package contracts are now released
on main. This integration keeps the existing frontend flows working and regenerates their
derived types; adopting the additive routes/downloads remains UX follow-up work. Platform’s
reported private assembled snapshot has not been installed or rehearsed in this checkout.
The working JSON export is still accurately labeled as not the reproducible evidence
package. No deployment, organizer submission or production/legal acceptance is claimed.
