# COORD-01 — P0 shared contracts and handoffs

State: Review; contract generator and 2 focused checks passed. Human owner Vincent; current Codex session. Branch codex/research-platform.
Checkout C:\Users\vzhu0\PycharmProjects\realpage-eggs; base 5ef1de1d6f1dd089c07c855bcb7e544198cde2a5. Result commit pending.
Dependencies: BOOT-01.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/models.py, fact_inputs.py, contracts.py, research_fixtures.py; contracts/**; shared docs/instructions; tests/test_research_contracts.py; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: Schema-valid examples and Core/Platform boundaries let teammates start immediately.
Acceptance: Five required uncertainty fixtures; proposed versus implemented labels; preserved exports; single stewards; canonical specification.
Checks (use project .venv Python): python -m navigator contracts; python -m pytest tests/test_research_contracts.py -q.
Next action / blocker: Release handoffs, then PLAT-03.
Non-goals: extra evaluator/provider/database, copied unlicensed code, taking another lane's task.
Handoff: actual commit, changed files, tests, limitations, contract requests and dependency status in this card.
Integration: single ordered queue, recheck combined code; local commits allowed, no push/merge/deploy authority.
