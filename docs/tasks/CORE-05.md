# CORE-05 — P1 deterministic encoded-rule renderer

State: Ready, unclaimed. Human owner Core developer (name pending); session, branch, checkout, base and result commit unallocated.
Allocate from the released follow-up contract commit before writing.
Dependencies: COORD-01 Rule/Expression contract.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/rule_renderer.py; tests/test_rule_renderer.py; renderer export in core_assist.py coordinated with CORE-04; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: render_rule(Rule)->EncodedRuleRendering without a model.
Acceptance: Preserve operators/grouping/thresholds/precision/exemptions/unsupported nodes/effective dates; stable hash; distinct from property explanation and legal verification.
Checks (use project .venv Python): python -m pytest tests/test_rule_renderer.py -q.
Next action / blocker: Allocate isolated claim; this compact task does not depend on planner.
Non-goals: extra evaluator/provider/database, copied unlicensed code, taking another lane's task.
Handoff: actual commit, changed files, tests, limitations, contract requests and dependency status in this card.
Integration: single ordered queue, recheck combined code; local commits allowed, no push/merge/deploy authority.

