# Claude API adoption integration

Oliver explicitly authorized inspection, push and merge of Claude's latest work.
This follow-up integrates `codex/realpage-frontend` at `dbec391` into main
`a7f9447`, on the isolated branch `codex/claude-api-integration`.
Claude's API-adoption implementation is `6cca22f`; original commits and attribution
are preserved. The existing frontend was already merged through PR #9.

The changes consume assist/evidence/fact definitions, display all checks per evidence
kind and encoded traces, distinguish Core dependency failures, and expand labeled
synthetic replay cases. Only `docs/tasks/UX-03.md` conflicted; the resolution retains
both the merged race-fix record and Claude's latest delivery record.

Main's stale-request guards and their browser regressions, dependency lockfile,
generated contracts, and newline-normalizing generator are byte-for-byte preserved.
No backend or shared contract changes were made. The original Claude checkout and
its untracked `Claude outputs/` directory were untouched.

Verification of combined implementation `04a2de1` with locked dependencies:

- `npm ci --no-audit --no-fund`: passed.
- `npm run verify`: generated-contract and TypeScript checks, **90 unit tests**,
  and Vite production build passed with the actual installed toolchain.
- `npm run test:e2e -- --workers=2`: **80 passed, 14 skipped** (12 opt-in
  screenshot cases, 2 viewport-specific cases); includes main's race regressions.
- Full backend suite in a disposable copy: **259 passed, 1 skipped** because the
  organizer pack is not installed. Compile, disposable contracts generation,
  unchanged fixed planner comparison, and diff checks passed.
- No unresolved merge conflicts against the recorded main base.

Local verification logs are under ignored `artifacts/` in this integration checkout.
Browser checks use synthetic fixtures/API doubles; this does not claim real-corpus
legal accuracy, deployed browser/backend acceptance, or completion of UX-04.
No provider calls or deployment were performed.
