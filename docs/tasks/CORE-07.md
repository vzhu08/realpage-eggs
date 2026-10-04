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
