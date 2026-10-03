# CORE-04 — P1 bounded useful-question planner

State: Planned, unclaimed. Human owner Core developer (name pending); session, branch, checkout, base and result commit unallocated.
Allocate from the released follow-up contract commit before writing.
Dependencies: CORE-03 + COORD-01.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/core_assist.py (coordinate one Core writer), question_planner.py; tests/test_question_planner.py; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: plan_questions(AssistContext)->QuestionPlan at the shared boundary.
Acceptance: Bounds, correlated variables, inclusive date/numeric partitions, joint materiality, deterministic ranks/budgets and partial status; all probes reproduce via evaluate_rules; occupancy answer with two exemptions remains unknown.
Checks (use project .venv Python): python -m pytest tests/test_question_planner.py -q; fixed-set unnecessary-question/incorrect-certainty counts versus baselines.
Next action / blocker: Begin after traces; no API/schema/frontend edits.
Non-goals: extra evaluator/provider/database, copied unlicensed code, taking another lane's task.
Handoff: actual commit, changed files, tests, limitations, contract requests and dependency status in this card.
Integration: single ordered queue, recheck combined code; local commits allowed, no push/merge/deploy authority.

