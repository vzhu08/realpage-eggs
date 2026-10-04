# Task board and merge queue

October 4 Platform update: the user authorized parallel agents in isolated checkouts, pushes and
merges of completed tasks. PLAT-06 is in [PR #14](https://github.com/vzhu08/realpage-eggs/pull/14).
PLAT-07/08/09 run in disjoint scopes; root also owns PLAT-10 automated integration checks.
Current assignments are in OWNERSHIP and task cards. Other human lanes retain their paths.

Current assignment: October 3, 2026 readiness follow-up. This board supersedes older
status summaries in task cards; preserve their historical evidence. Four existing lanes:
Vincent / Platform, Daniel / Core A, Oliver / Core B, and Frontend/UX using Claude
(Oliver is the recorded UX human coordinator). No extra writing agents are assigned.

The user assigned COORD-04's two fixes and the next four cards below. Assigning a card
is not a claim that its remote session started. Each developer records actual checkout,
branch, base SHA and private data directory before writing. See [OWNERSHIP](OWNERSHIP.md)
and the dependency gates in [PLAN](PLAN.md).

Audited merged baseline: `3b2d201` (PR #9), including Core A PR #8 at `0ccaa1a`.
Fresh baseline checks: 221 backend tests, 79 frontend unit tests, 72 browser tests passed;
12 browser tests skipped. Browser tests use fixtures/API doubles. Real-data browser/API,
Docker runtime and public deployment are not verified by those checks.

## Active and next work

| ID | Owner | State | Deliverable / dependency |
| --- | --- | --- | --- |
| [COORD-04](tasks/COORD-04.md) | Vincent / current readiness session | Verified software; [integration PR #11](https://github.com/vzhu08/realpage-eggs/pull/11) | Fix LF/CRLF contract checks and non-finite model inputs; assign next work. Isolated branch `codex/readiness-fixes-and-plan`, base `3b2d201`. |
| [PLAT-05](tasks/PLAT-05.md) | Vincent / existing Platform session | Verified software and bounded live review | [PR #10](https://github.com/vzhu08/realpage-eggs/pull/10), tested merge `e81c3f4` includes main `ad0881a`; 260 unique backend tests pass and schemas match. One D001 live review passes, replay makes zero calls; 140-rule inputs unchanged. This is not full-corpus/legal acceptance. |
| [PLAT-06](tasks/PLAT-06.md) | Vincent / Platform | Platform software complete; local integration review ready; corpus release partial | Integrated Daniel's saved store and approved Census reconciliation: 500 addresses, 487 resolved, 140 review-needed rules. Shared APIs, evidence replay, immutable local frontend/API release and backup verified on `codex/platform-release`; 342 backend / 90 frontend unit / 80 browser-suite tests pass (14 browser skips). Real browser, seven-file export replay and rollback pass. T1 partial; T2-T5 blocked; Core evidence/review and UX-04 controls remain. See `docs/evidence/plat06_release.json`. |
| [PLAT-07](tasks/PLAT-07.md) | Platform evidence agent | Verified; included in PR #14 | Fixed concurrent output overwrite and unchecked cache/rule behavior. 45 focused tests pass; real assembly preserves 804 input files and snapshot ID. Combined PLAT-06/07 suite: 351 passed. |
| [PLAT-08](tasks/PLAT-08.md) | Platform deployment agent | Running | Complete frontend/API container candidate and unattended verification; local Docker engine is stopped. |
| [PLAT-09](tasks/PLAT-09.md) | Platform handoff agent | Running | Hash-verified private export handoff and method note, preserving partial/blocked status. |
| PLAT-10 | Root Platform | Running after PLAT-08 | Automated backend/contracts, frontend/browser and Linux container checks on GitHub PRs. |
| [CORE-06](tasks/CORE-06.md) | Daniel / Core A | Assigned; saved review Ready | T1-T5 evidence, lifecycle gaps and source comparisons. Corpus provider run remains paused pending explicit human resumption. |
| [CORE-07](tasks/CORE-07.md) | Oliver / Core B | Assigned; existing-interface work Ready | Actionable uncertainty, faithful change/conflict explanations and reviewed real-case planner benchmark. Real acceptance needs CORE-06/PLAT-06. |
| [UX-04](tasks/UX-04.md) | Frontend/UX / Claude | Assigned; existing-contract UI Ready | Portfolio timeline/drill-down, disagreement view, evidence download and real-data judge demo. New payloads depend on PLAT-06. |

## Existing delivery status

| ID | State at audited baseline | Evidence / remaining limit |
| --- | --- | --- |
| BOOT-01 | Baseline integrated; real-data acceptance incomplete | Initial bootstrap is historical; do not recreate it. |
| COORD-01/02 | Coordination superseded | Current four-lane assignments and releases are in OWNERSHIP and these new cards. |
| COORD-03 | Merged | PR #3 at `3b1ef06`; preserved Daniel's implementation/history. |
| PLAT-01 | Merged | PR #5 at `9a96fda`; 491/500 municipalities in separate recovery store; nine remain unresolved. |
| PLAT-02 | Merged packaging | PR #6 at `e0cd133`; native HTTP/export replay verified; Docker/public deployment still unverified. |
| PLAT-03 | Merged | PR #7 at `c57107a`; bounded source context and evidence checks. |
| PLAT-04 | Baseline merged; continuation local | Assist API baseline is integrated; additional request-isolation fix/checks at local `11afb55` require integration review. PLAT-06 carries this forward. |
| CORE-01 | Software merged; corpus partial | Latest stopped store: 15/54 captured documents, 140 rules, 16 exportable, all review-needed. T2-T5 blocked. CORE-06 continues evidence work. |
| CORE-02/03 | Merged | Latest date/trace repairs in PR #8; current full backend baseline passes 221 tests. |
| CORE-04/05 | Merged | Oliver's planner/renderer continuation integrated in PR #9. Daniel released future Core B paths in CORE_A_HANDOFF. |
| UX-01/02/03 | Merged software | PR #9 includes full frontend and request-race fix; UX-01/02 are subflows. Real-data acceptance remains for PLAT-06/UX-04. |

## Integration order and release gates

1. Review COORD-04 on its isolated branch. Preserve active PLAT-05 changes; when merging,
   retain the owner's latest runtime/card/evidence rather than replacing them with older status text.
2. Finish PLAT-05 and reconcile PLAT-04 `11afb55`; record the exact combined reviewed base.
3. PLAT-06 publishes the common snapshot and minimum contracts. CORE-06/07 and UX-04 can
   do independent work beforehand; do not invent production payloads or duplicate the evaluator.
4. Integrate Core evidence/comparison, explanations, API wiring and UX increments with affected checks.
5. Release only after the real browser/API path, official-format exports, T1-T5 disposition,
   method note and backup demo are checked against one recorded code/data version.

States: Assigned -> Ready -> Running -> Review -> Queued -> Merged -> Verified;
Blocked states name their dependency. Merged software is distinct from verified data and deployment.
Local commits are allowed; use applicable human authority for push, merge, deployment, external
messages and submission. No teammate has been contacted by this assignment update.
