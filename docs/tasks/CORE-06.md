# CORE-06: real change-case evidence and source disagreements

Priority: P0 T1-T5 and lifecycle support; P1 reusable source comparison.
State: Partial; independent software and saved-evidence review complete. Missing sources
and independent human review block full acceptance. Platform's geography assembly and public claim
comparison contract are now merged. Live extraction remains paused until the
human explicitly resumes the stopped run with an agreed budget. This card starts no provider job.
Owner: Daniel / Core A, Rules & Evaluation.
Reported checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend`; verify its state first.
Suggested next branch: `codex/core-a-change-evidence`; record actual session/checkout/base
from reviewed main containing `3b2d201` and accepted COORD-04 validation fixes.

Read: OWNERSHIP, PLAN, CONTRACTS, ASSIST_CONTRACT, `docs/core_rules/CORE_A_HANDOFF.md`,
`saved_store_closeout.json`, organizer guide/change cases and PLAT-06. Preserve earlier evidence.
Baseline: 15/54 captured documents processed, 140 review-needed rules, only 16 exportable,
124 unresolved temporal statuses, T2-T5 blocked. These are reported saved-store results.

Allowed paths: Core A runtime/tests/data from OWNERSHIP; new `navigator/source_comparison.py`,
`tests/test_source_comparison.py`; `docs/core_rules/**` and this card. Platform alone assembles
stores, retrieves/imports new source snapshots and changes shared models/API/export formats.

Deliver in order:

1. Give Platform the saved store and its manifest through a user-approved transfer, with
   rules, sources, extraction metadata, facts and provenance. Do not overwrite either store.
2. Triage the 124 temporal projection failures by missing evidence; distinguish adoption,
   enactment, effective date, repeal and observed status. Resolve only what quoted sources support.
3. Prioritize real T1-T5 dependencies before a blind sequential corpus pass: finish D022's
   review; inspect D069 (NJ), D045-D047 (MA bills/history), and D048 plus actual failed-ballot
   evidence. Hoboken/Jersey City ordinances and failed-ballot evidence need targeted source
   acquisition through Platform. These document IDs are work priorities, not encoded legal answers.
4. Resolve state/local interactions with direction, scope and evidence; test geographic
   boundaries, dates, pending hypotheticals and failed changes using the single evaluator.
   Never turn the organizer's expected_behavior text into extraction evidence or address sets.
5. Implement reusable comparison of source-backed claims/encoded rule versions. Distinguish
   requirement, exemption, coverage and lifecycle differences from moved quotes/reformatted text.
   Preserve incompatible claims and missing support instead of automatically declaring a winner.
6. First disagreement case: possible NJ state/local conflict (also T3). Next: Berkeley date
   claims, then LA RSO dates. Screening-fee formulas are optional after these and the required cases.
   Use a Platform-agreed result model before exposing the comparison across lanes.

Acceptance:

- Each T1-T5 result is traceable through extracted rules to unchanged source spans.
- Boundary dates, city exclusion, hypothetical enactment and the failed-proposal empty set
  have evidence-backed checks; unestablished results remain blocked/unknown, never guessed.
- A source update can be classified without equating formatting drift with legal amendment.
- An unresolved disagreement retains both claims and an actionable source/review remedy.
- A prioritized remaining-corpus queue states source gaps, projected impact and actual budget;
  run/cost/cache reports distinguish fresh calls, replay and unobserved timeout usage.

Checks: engine/change/extraction/trace tests; new comparison regressions with labeled synthetic
fixtures; saved-store validation and export through existing APIs; source/offset immutability.
Have a human independently inspect consequential real cases before labeling them reviewed.

Handoff: commit, exact source/run evidence, T1-T5 statuses, corrected versus unresolved temporal
counts, comparison examples, provenance and remaining input requests. No full-corpus/legal-accuracy
claim from software tests. Do not edit Core B planner/renderer or UX files.

## Current follow-up execution claim — October 4, 2026

Daniel / Codex /root, session `01a10555-b81d-7281-95f5-c06399af8238`; sole writer.
The user requested Daniel's next task. The existing offline delivery and snapshot are now
merged through PR #13. This bounded CORE-06 follow-up checks comparison integrity on that base.
Branch: `codex/core-a-comparison-integrity`.
Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-a-change-evidence` (prior session idle, clean).
Base: `84c2887dee0d56c523d4fca8c0bd47de79546c2e` (fetched main, PR #13).
Claimed writes: `navigator/source_comparison.py`, `tests/test_source_comparison.py`, this card,
and `docs/core_rules/comparison_integrity/**`; read-only helper review only.
Acceptance: invalid primary/evidence source identities and unresolved review/conflict state cannot
produce an unqualified comparison; review-state changes stay separate from substantive legal encoding.
Baseline focused checks: 113 passed. Full checks run in a disposable copy; real stores stay read-only.
No provider resumption is implied. Platform's public claim-comparison contract is now available;
the rule-version helper remains internal and does not change that public envelope.

Follow-up delivered at `8ea65dab22335f79ea926ea372b9dc90985026cd`: source identity and review-state
repairs, 11 reproduced regression failures fixed, 124 focused and 291 full-suite tests passed.
The immutable 140-rule snapshot retains all unresolved review state; no provider calls or store edits.
Local review handoff: [comparison integrity](../core_rules/comparison_integrity/HANDOFF.md).

User subsequently authorized retaining the fix and creating/merging completed PRs, with a stop
when another developer is needed. Fetched main `1109d4a` (PR #14/#15) is integrated at `ef71e5a`.
Combined verification: **370 passed**, compilation/contracts passed, zero schema changes, and both
fresh evidence packages reproduced. See the handoff's latest integration section and report.
After integration, wait for Vincent/Platform's missing T1 source texts, then local ordinances;
do not bypass source acquisition or the stopped provider run to fill the remaining cases.

## Previous execution claim

Daniel / Codex /root, session 01a103d0-b88b-7090-97aa-f9d5eec55d45; sole writer.
Branch: `codex/core-a-change-evidence`. Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-a-change-evidence`.
Base: `ad0881a15d3828a7ecc3bedb83167d6416912371` (current fetched main, accepted COORD-04).
Immutable input: `/Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session`.
Private working copy: `/Users/danny/Documents/ChatGPT/RealPage/core-a-change-evidence/data/core06-working`.
Claims: assigned Core A runtime/tests as needed, source_comparison.py/test_source_comparison.py, docs/core_rules/** and this card. Core B, Platform, frontend and board paths stay reserved.
The latest direct user message authorizes pushing completed code commits, superseding the attachment’s manual-push restriction. It does not authorize provider work, uploads of the saved store, merges, deployments or teammate contact.
PLAT-06 comparison contract is not released at this base; implement an internal comparison proposal on canonical types, with no new public schema or endpoint.

## Offline delivery

Implementation commit `b33af14dbd46bbad0ffafd795916bb503795a89b`; evidence and final handoff follow on this branch. See [CORE-06 handoff](../core_rules/core06/HANDOFF.md) for commands, file manifest, hashes, runs and dependencies.

- Internal source/rule comparisons implemented; public contract remains Platform-owned. Change-reporting defects repaired with focused regressions.
- 113 focused tests; disposable runner 275 full-suite tests; compile/contracts/diff passed. Shared generated artifacts and docs/core historical reports preserved.
- Guarded offline validation/evaluation/export/lookup and actual-data assist HTTP 200 completed; zero provider/network attempts. All 500 IDs and exported references verified.
- Reproduced140 review-needed rules,16 exportable,124 unresolved temporal results,0 corrections,0 resolved municipalities. T1 partial (250 uncertain,0 definite); T2–T5 blocked. Export explicitly partial.
- D022 agent source review finished; D069/MA histories/D048 reviewed; all 124 temporal cases triaged. No independent human review claimed.
- Original 182-file store unchanged;94-file precise transfer manifest stays local. Platform destination/assembly and missing legal sources remain dependencies.
- Paid queue proposed, not executed; explicit resume and budget required. User authorized branch push only; no store upload/merge/deploy/teammate contact.
