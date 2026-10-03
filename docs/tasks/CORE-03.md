# CORE-03 — P0/P1 evaluator trace and residual AST

State: Ready, unclaimed. Human owner Core developer (name pending); session, branch, checkout, base and result commit unallocated.
Allocate from the released follow-up contract commit before writing.
Dependencies: COORD-01.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/engine.py, predicates.py; tests/test_engine.py, test_question_planner.py; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: Stable predicate paths and true/false/unknown trace tree expose only relevant residual facts.
Acceptance: Short circuit irrelevant fields; correlated predicates; review legacy year-built proxy so actual occupancy facts are not silently established; decisive versus irrelevant fact removal.
Checks (use project .venv Python): python -m pytest tests/test_engine.py tests/test_question_planner.py -q.
Next action / blocker: Allocate human claim/isolated checkout, then implement for CORE-04.
Non-goals: extra evaluator/provider/database, copied unlicensed code, taking another lane's task.
Handoff: actual commit, changed files, tests, limitations, contract requests and dependency status in this card.
Integration: single ordered queue, recheck combined code; local commits allowed, no push/merge/deploy authority.

