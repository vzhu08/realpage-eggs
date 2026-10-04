# Native integration review — October 4, 2026

Three actual Claude workers completed visual design, API integration and independent
judge-journey QA in separate worktrees. Their commits were combined at `55eda48`, then
imported into `codex/hackathon-ux-review` on the Mac. Main through `e766237` merged without
conflicts. The PR changes only `frontend/**` and the UX-04 handoff card.

## Final checks

- `npm run verify`: passed with the installed project dependencies and Node 22.23.2.
  Contract digest `3a71126e3e2733d4` (51 models), TypeScript, 229 unit tests and Vite 7.3.6
  production build all passed. The lazy synthetic-recording chunk retains Vite's size warning.
- `SCREENSHOTS=1 DEMO_BACKUP=1 npm run test:e2e -- --workers=2`: 273 passed, 3 intentionally
  skipped, 2 failed on the same outdated conflict-text assertion (desktop and mobile).
  The assertion expected a redundant standalone reason, now already contained in the two
  complete version-specific planner statements. It was replaced with checks that every
  recorded statement remains present once and is visible when expanded.
- Final `npm run typecheck` and `npm run test:e2e -- uncertainty.spec.ts --workers=2`: passed,
  all 8 affected tests. Across the full run and this correction, all 275 enabled checks pass.
  The 3 skips are the desktop run of a phone-only evidence-sheet check, the mobile run of
  the desktop-only keyboard journey, and the mobile run of the desktop backup recorder.
- All documentation captures and the 13-frame synthetic backup were regenerated. The local,
  ignored `docs/demo-backup/synthetic-walkthrough.webm` was regenerated from the same run.
- Visual review covered the native desktop start/result/answer/claim-comparison flow and
  fresh Pixel 7 screenshots of result, evidence and property-by-property impact. Browser
  regressions also cover 390px wrapping, navigation, focus and stale requests.

The final review additionally fixed source-reference deduplication: identical document IDs
and offsets no longer collapse distinct source hashes, quotes or sections. A regression
test covers all three distinctions and keeps exact duplicates collapsed.

## Actual API verification during integration

A disposable fictional 14-property, 6-rule, 6-source store was created through the backend's
ingestion/extraction path. At checkpoint `2c833eb`, native HTTP requests and browser use
verified assisted lookup, `POST /changes/summary`, `GET /source-comparisons`, and
`POST /lookup/evidence-package`. The corresponding API adapters did not change after that
checkpoint; final browser tests cover their UI integration and error/race handling.

- Source comparisons correctly showed unavailable before annotations existed, then 2
  different-claim observations, 1 same-claim observation and 1 missing-support observation.
- Owner-occupancy answers changed the request-local result while preserving unresolved
  source conflicts when still applicable.
- The evidence package downloaded as `evidence-package-62c445877340.json`, labeled
  `SYNTHETIC_NOT_FOR_SUBMISSION`, and backend replay reported `reproduced`.
- The Oct 1, 2026 → Jan 15, 2027 comparison retained the backend's overlapping counts:
  11 definitely affected, 10 uncertain, 10 conflict-flagged properties, across 42 rows.
- Fresh backend-generated demo output matched all 42 recorded assisted lookups, 12 change
  recordings and 4 claim comparisons after excluding only random extraction-run UUID fields.

These are software checks on fictional data, not real-corpus or legal acceptance.

## Remaining limits

Real-snapshot rehearsal and its checked examples remain a separate acceptance gate; the
real-data table in `DEMO_SCRIPT.md` is intentionally unfilled. No paid provider calls or
public deployment were performed in this integration.

The minor chooser error-detail item F19 from `QA_HACKATHON.md` remains: malformed address
responses are refused, but the chooser's message does not expose the failing field. Dialogs
trap keyboard focus and restore it; marking the surrounding page `inert` is still a possible
accessibility refinement. F12's joined labels and F15's repeated authority/source label
were verified improved in the final source-comparison capture. The older audit describes
the checkpoint, not the final native build.
