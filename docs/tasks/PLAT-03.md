# PLAT-03 — P0/P1 evidence and bounded context retrieval

State: Review. Human owner Vincent; current Codex session. Branch codex/research-platform.
Checkout C:\Users\vzhu0\PycharmProjects\realpage-eggs; base 5ef1de1d6f1dd089c07c855bcb7e544198cde2a5. Result commit: codex/research-platform implementation checkpoint (see final handoff / branch HEAD).
Dependencies: COORD-01.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/evidence.py, retrieval.py, source_inventory.py; tests/test_evidence.py, test_retrieval.py; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: Separate quote, identity, anchor, semantic and dependency checks using original spans.
Acceptance: Missing/changed support, opposite interpretation, missing exceptions, cycles and long-section tails remain honest; lexical score is never verification.
Checks (use project .venv Python): python -m pytest tests/test_evidence.py tests/test_retrieval.py -q.
Next action / blocker: Core/UX consume implementation; expand references only against consequential reviewed cases.
Non-goals: extra evaluator/provider/database, copied unlicensed code, taking another lane's task.
Handoff: actual commit, changed files, tests, limitations, contract requests and dependency status in this card.
Integration: single ordered queue, recheck combined code; local commits allowed, no push/merge/deploy authority.

Local result: Evidence/context implemented; 12 focused evidence/retrieval tests passed; D001 inventory 15 unresolved units across 8,000 snapshot characters. Full suite: 74 passed. No merge/deployment claimed.

Four-developer coordination: use the current playbook and OWNERSHIP. Core A owns extraction/evaluator/traces;
Core B owns planner/renderer. Existing Core candidate c92ad8f awaits combined review/integration; do not duplicate it.
Platform stewards shared contracts and UX owns the entire frontend. Prior task results remain historical evidence.
