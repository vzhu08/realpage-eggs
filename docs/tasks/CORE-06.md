# CORE-06: real change-case evidence and source disagreements

Priority: P0 T1-T5 and lifecycle support; P1 reusable source comparison.
State: Assigned; saved-evidence review Ready. Live extraction remains paused until the
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
