# CORE-07: actionable uncertainty, explanations and real-case planner evaluation

Priority: P1; begin independently while Platform/Core A complete the real snapshot.
State: Assigned; existing-interface work Ready. New disagreement fields await PLAT-06.
Owner: Oliver / Core B, Questions & Rendering.
Reported checkout: `/Users/oliverchen/Documents/random shi/realpage-eggs-core`.
Suggested branch: `codex/core-b-explanations`; verify actual session/checkout/base before writing.
Use reviewed main containing `3b2d201` plus accepted COORD-04 fixes, not the old Core-only base.
Daniel's path release is recorded in `docs/core_rules/CORE_A_HANDOFF.md`.

Read: OWNERSHIP, PLAN, ASSIST_CONTRACT, Core B HANDOFF, planner_evaluation.json,
CORE-06, PLAT-06 and UX-04. Existing planner/renderer are implemented; continue them.

Allowed paths: `navigator/question_planner.py`, `rule_renderer.py`, `core_assist.py`,
their two test files, `tests/fixtures/core_navigation/**`, `docs/core_navigation/**`, this card.
Request shared types/fact definitions from Platform and truth/trace changes from Core A.

Deliver:

1. Make each remaining uncertainty tell the user what is missing, why it affects this result,
   and whether the next action is a factual answer, geography evidence, source acquisition,
   interpretation review or more analysis. Do not ask property questions to resolve missing law.
2. Render change/conflict/effective-date explanations from actual Core outputs and source refs.
   Preserve each encoded rule's meaning, date precision and unresolved branches; no second evaluator.
   New output shapes follow the shared PLAT-06 contract; rendering work can use existing inputs first.
3. Preserve request-local answers and correlated alternatives. Every displayed outcome must
   reproduce through actual assist HTTP calls using the same evaluator, with remaining exemptions,
   source gaps and limits intact. Never offer a hypothetical probe as a verified property fact.
4. Build a small fixed real-source benchmark with a named human reviewer and recorded expected
   useful questions/remedies. Cover a decisive fact, an irrelevant fact, two unresolved exemptions,
   partial occupancy dates, source gaps and conflicts; include cases outside the chosen demo.
   Label unreviewed/agent-authored cases accurately while review is pending.
5. Compare with ask-every-missing-fact and generic-unknown baselines. Report denominators for
   question count, unnecessary questions, useful facts missed, incorrect certainty, evaluator
   calls and observed latency. Preserve the original eight synthetic cases for comparison.

Acceptance: answers reproduce all displayed alternatives; unresolved legal/source issues survive
property answers; explanation text cites the correct rule/version/date and identifies the next
action; no regressions in numeric partitions, endpoint inclusion, bounds or analysis budgets.
Benchmark claims state who authored/reviewed expectations and never imply an official legal score.

Checks: planner/renderer tests; actual Core/API integration; deterministic repeatability;
fixed benchmark runner saved under `docs/core_navigation/`. Full-suite integration goes through Platform.

Handoff: commit, renderer/planner versions, before/after examples, actual benchmark metrics,
reviewer status, contract requests and limitations. No provider calls in planner/renderer.
Dependencies: CORE-06 evidence-backed cases and PLAT-06 snapshot for real-data acceptance;
independent rendering, remedy and benchmark-harness work can start immediately.

## Oliver / Core B execution — October 4, 2026

State: existing-interface implementation verified locally; real-snapshot/human-review
acceptance and new disagreement-contract integration remain pending CORE-06/PLAT-06.
Sole writer: Codex /root, session `01a103bd-84d1-7c50-bd19-1fe9267bc139`.
Actual checkout: `/Users/oliverchen/Documents/random shi/realpage-eggs-core-explanations`.
Branch: `codex/core-b-explanations`; base: `0c441df4896cca844b9199597093267e1d4519a4`.
Mutable data: private temporary `core07-benchmark-*` and `realpage-core-b-validation-*`
directories, automatically cleaned after checks. Original Core B and Claude checkouts
are preserved; Claude is separately implementing UX-04 on the user's instruction.

Delivered: actionable fact/geography/source/interpretation/analysis remedies with dated
rule/version references; exact recorded source quotes in rendering; missing effective
dates remain unresolved despite a dated snapshot; Core result/change text helpers;
request-local HTTP probe replay and fixed, honestly labeled benchmark cohorts.
Planner `correlated-partitions-v3`; renderer `encoded-rule-v3`. Shared schemas unchanged.
See `docs/core_navigation/CORE07_HANDOFF.md` for checks, metrics and integration requests.

Checks: 59 focused tests; 267 full backend tests passed, 1 skipped (organizer pack absent);
compileall/contracts succeeded in a disposable copy. All 17 new software alternatives
reproduce through actual assist HTTP handlers. Original eight synthetic cases preserved.
No complete corpus/legal score or human review is claimed. Named human reviewer was
requested from Oliver and is unassigned until a response; do not fabricate a review.

Local implementation checkpoint: `5a8e1cd`; runtime/tests match the recorded verification.

## Combined integration follow-up — October 4, 2026

The user authorized pushing both branches and fixing integration errors. Codex combined
Core B `0161b95` and finished Claude UX-04 `43fa402` with main `84c2887` in the isolated
`codex/core-b-ux04-integration` checkout. Original author checkouts are preserved.
Compatibility fixes are at `af14cd8`; current checks, snapshot availability, and remaining
acceptance gates are recorded in [the combined handoff](../core_navigation/UX04_INTEGRATION.md).
This follow-up supersedes earlier toolchain-unavailable statements for the integrated build;
the original task evidence above remains historical.

PR #15 also includes main `607dce3` (Platform release PR #14) via clean merge `e5966b2`.
Released additive contracts are available; frontend types are regenerated. New endpoint
adoption and real-snapshot rehearsal remain follow-up acceptance work.
