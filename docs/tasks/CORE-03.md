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


## Daniel's Core implementation claim — 2026-10-03

Human owner: Daniel. Sole writing agent: Codex /root, session 01a103d0-b88b-7090-97aa-f9d5eec55d45.
Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend` (dedicated clone; no pre-existing changes).
Branch: `codex/core-backend`. Base: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`.
The user assigns this session to Core; earlier unallocated metadata is superseded by this claim.
Claimed paths: the exact allowed implementation/tests/card above, plus `docs/core/**` and ignored `data/core-session/**` for evidence.
Work is serialized CORE-03 -> CORE-04 -> CORE-05 -> focused CORE-02; adapter changes have one writer.
State: Running
No push, merge, deployment, external messages or submission authorized.

### Local result — Review
Implemented the canonical trace in the predicate evaluation traversal; existing result shapes remain unchanged.
Stable original AST paths, grouping, evidence, relevant residuals and exemption truth are preserved.
Removed the legacy construction-year occupancy fallback; actual partial occupancy dates retain uncertainty.
Checks: `.venv/bin/python -m pytest tests/test_engine.py tests/test_question_planner.py -q`: 26 passed.
Baseline full suite in a disposable copy with the actual pack: 44 passed, one existing deprecation warning.
Intentional expectation change: year_built=1977 no longer proves certificate<=1978 cutoff.
Platform should update the legacy proxy sentence in docs/CONTRACTS.md; no schema change needed.
Result: see the local commit containing this card; integration remains pending.
