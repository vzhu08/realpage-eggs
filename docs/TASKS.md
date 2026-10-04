# Task board and merge queue

## Active PLAT-13/14 preparation — October 4

Claimed by session `01a1060f-0c12-7a41-a29e-c2de9377f99f` in the isolated
`artifacts/platform-demo-prep` checkout, branch `codex/platform-demo-prep`, base `e766237`.
PLAT-13 preparation is verified: PR #22 head `b77ae3a` has four passing checks; its writer's
completed handoff reports live basic lookup/cached scenarios and assisted lookup at ~59 seconds
against the UI's 20-second timeout.
Preserve that writer's files and branch until release. PLAT-14 preparation is verified: exact
input manifest, baseline assembly replay, full pilot lineage audit, fresh output reservations,
local fallback HTTP and saved-export handoff checks pass. Reviewed Core admission and a new
demo snapshot remain gates. See [DEMO_PREPARATION](DEMO_PREPARATION.md). This status supersedes
the unallocated next-chat language below; no paid run or dataset promotion occurred.

## Next Platform chat: demo delivery

The user will continue these tasks in a new chat. Start with
[the Platform starter](starters/PLATFORM_API.md), then PLAT-13 and PLAT-14 preparation.
The current assignment is to finish the smallest useful code/build work within the existing
three-hour window, then freeze for the demo. Do not reset that window when changing chats.

| Priority | Task | Ready now / dependency |
| --- | --- | --- |
| 1 | [PLAT-13: deployment integration](tasks/PLAT-13.md) | Review existing Render PR #22 and coordinate its writer; four PR checks passed at handoff. Hosted setup remains pending. |
| 2 | [PLAT-14: demo snapshot](tasks/PLAT-14.md) | Prepare input manifest and release now; final integration uses selected reviewed automated Core output and cleared source use. |
| 3, when needed | [PLAT-15: typed Core inputs](tasks/PLAT-15.md) | Act on concrete Core field requests; no speculative schema expansion. |
| 4 | [PLAT-16: freeze/export/rehearse](tasks/PLAT-16.md) | Prepare now; finish against one recorded snapshot and code version, with local fallback. |

Prioritize these delivery tasks over another broad search for municipal publication and official
court records. PLAT-11/12 retains those gaps; only timebox a concrete new lead needed for the
selected demo. Unknown/blocked results remain explicit. The guide prioritizes automated
extraction, geography and citations before change tracking when time is short.

[Data-source rules](DATA_SOURCE_RULES.md): the frozen live release uses only supplied corpus
texts for its 140 rules, and the D069 pilot also uses a supplied document. Census/public assessor
inputs are explicitly allowed. Supplemental California captures, publisher access terms and the
third-party court mirror require the stated review before submission promotion. Public access
is not blanket clearance; hand-authored review Drafts are not automated extraction records.

No new execution session was started by this board edit. Claim checkout/branch/base/paths first.

October 4 pilot handoff: the user completed the $5 D069 pilot successfully (seven new
rules, two API requests, no errors). [Daniel's next steps](CORE_NEXT_STEPS.md) and a committed
D069-only evidence bundle unblock offline predicate work after merged Core source-review
PR #23. Six rules still have uncompiled coverage; all seven need review. Missing municipal
publication/operative records and official court verification remain Platform dependencies
for specific conclusions. The full paid corpus remains paused; the live store is unchanged.
Current priority: finish the smallest useful code/build increments within the user's three-hour
demo-preparation window, use focused checks, and retain explicit unknowns for unavailable records.

October 4 source-acquisition correction: Platform's software completion did not fulfill Daniel's
T1-T5 acquisition request. [PLAT-11](tasks/PLAT-11.md) now delivers 21 captured documents and a
per-case handoff under `docs/platform_sources/2026-10-04/`. Municipal publication/effective-date
evidence and official verification of the T5 court mirror remain Platform obligations. Core A
owns interpretation/extraction after delivery; the paid corpus run remains paused.

October 4 Platform update: the user authorized parallel agents in isolated checkouts, pushes and
merges of completed tasks. PLAT-06/07 are merged in [PR #14](https://github.com/vzhu08/realpage-eggs/pull/14)
and PLAT-09 in [PR #16](https://github.com/vzhu08/realpage-eggs/pull/16). PLAT-08/10 are verified in [PR #17](https://github.com/vzhu08/realpage-eggs/pull/17):
complete frontend/API image and automated backend/browser/Linux container checks.
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
| [PLAT-06](tasks/PLAT-06.md) | Vincent / Platform | Merged in PR #14; corpus release partial | Integrated Daniel's saved store and approved Census reconciliation: 500 addresses, 487 resolved, 140 review-needed rules. Shared APIs, evidence replay, immutable local frontend/API release and backup verified on `codex/platform-release`; 342 backend / 90 frontend unit / 80 browser-suite tests pass (14 browser skips). Real browser, seven-file export replay and rollback pass. T1 partial; T2-T5 blocked; Platform acquisition, Core interpretation/review and UX-04 controls remain. See `docs/evidence/plat06_release.json`. |
| [PLAT-07](tasks/PLAT-07.md) | Platform evidence agent | Merged in PR #14 | Fixed concurrent output overwrite and unchecked cache/rule behavior. 45 focused tests pass; real assembly preserves 804 input files and snapshot ID. Combined PLAT-06/07 suite: 351 passed. |
| [PLAT-08](tasks/PLAT-08.md) | Platform deployment agent / root integration | Verified in PR #17 | Complete frontend/API image and unattended verifier; 21 local deployment tests and full Linux container build/runtime pass. Local Docker engine remains stopped. |
| [PLAT-09](tasks/PLAT-09.md) | Platform handoff agent / root integration | Merged in PR #16 | Hash-verified private export handoff and method note; stale assembly identity rejected. 25 focused tests pass, one Windows symlink test skips; two real 14-file bundles match exactly. |
| [PLAT-10](tasks/PLAT-10.md) | Root Platform | Verified in PR #17 | 405 backend tests (one skip), 118 frontend unit tests, 114 browser tests (22 skips), and full Linux container smoke pass. Windows pack verification also passes with UTF-8. Includes merged Core B/UX PR #15. |
| [PLAT-11](tasks/PLAT-11.md) | Vincent / Platform | 21 captures verified; residual acquisition gaps open | Original source bodies, separately derived text, additive SourceDocuments and per-case handoff for Daniel. Municipality publication/operative dates and official T5 docket verification remain unverified. No existing store changed. |
| [PLAT-12](tasks/PLAT-12.md) | Vincent / Platform | Pilot completed; offline handoff ready; external gaps open | Seven D069 candidates and original provider evidence are committed for Core review. Two successful calls; no new calls during handoff. Publication/court gaps remain Platform-owned. |
| [PLAT-13](tasks/PLAT-13.md) | Vincent / demo-prep session | Preparation verified; Render writer retains deployment ownership | PR #22 has four passing checks; hosted assist takes ~59s per writer handoff. Pinned local fallback passes fresh HTTP smoke. |
| [PLAT-14](tasks/PLAT-14.md) | Vincent / demo-prep session | Preparation verified; final Core admission pending | Baseline assembly/input hashes, 147-rule pilot lineage and saved-export handoff verify; selected new release awaits Core. |
| [PLAT-15](tasks/PLAT-15.md) | Vincent / Platform | Conditional: concrete Core request | Small typed-input/API changes with source meaning and focused consumer checks. |
| [PLAT-16](tasks/PLAT-16.md) | Vincent / next Platform chat | Prep ready; freeze after selected integration | One code/data version, exact exports, fresh-browser demo and local backup. |
| [CORE-06](tasks/CORE-06.md) | Daniel / Core A | Ready: offline D069 predicate follow-up; acceptance partial | PR #23 source review is merged. Follow CORE_NEXT_STEPS.md to reconcile the paid pilot, compile supported conditions and test unknowns without waiting for Platform records. No additional paid run authorized. |
| [CORE-07](tasks/CORE-07.md) | Oliver / Core B | Software merged in PR #15; real/human review pending | Actionable uncertainty, faithful change/conflict explanations and reviewed real-case planner benchmark. Real acceptance needs CORE-06/PLAT-06. |
| [UX-04](tasks/UX-04.md) | Frontend/UX / Claude | Software merged in PR #15; additive API/real acceptance pending | Portfolio timeline/drill-down, disagreement view, evidence download and real-data judge demo. New payloads depend on PLAT-06. |

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
