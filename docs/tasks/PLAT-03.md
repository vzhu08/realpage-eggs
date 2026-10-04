# PLAT-03 — P0/P1 evidence and bounded context retrieval

## Current continuation

State: Review. Human owner Vincent; current Codex session.
Branch: `codex/platform-evidence`; checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs`.
Base: `3b1ef065a69c832daf92740a910bd3f33d8b150b` (current merged main).
The original PLAT-03 implementation and COORD-01 contracts are already on main.
No unmerged PLAT-02 work, new Core code, credentials, or frontend changes are required.

Claimed paths for this continuation: `navigator/retrieval.py`, `tests/test_retrieval.py`,
this card, `docs/TASKS.md`, and `docs/evidence/plat03_context.json`.
Outcome: a bounded source-context request retains its exact anchor whenever that anchor
fits the remaining character budget, with truthful partial/limit markers and original offsets.
Repeated anchors within an already returned window must not consume the budget again.
Oversized anchors and referenced sections remain explicitly bounded, never silently truncated.
Checks: assigned evidence/retrieval suite, an HTTP context regression, and the full combined suite.
User authorized starting this independent task on a new branch, then publishing its PR
after checking completion. Review/merge remain separate from software acceptance.

Result: source windows now fit the remaining character budget around the complete anchor;
already returned windows satisfy repeated/contained anchors without another budget charge.
Unicode offsets, source hashes, late missing-exception references and partial markers are retained.
The regression suite reproduced six failures before the fix. After the fix: 21 focused
evidence/retrieval checks and 176 combined tests passed, including the HTTP context regression.
Full tests and `python -m navigator contracts` ran in `artifacts/plat03-context-check`;
all four generated schemas are byte-identical to main. One existing Starlette/httpx warning remains.
Exact request/response and check evidence: `docs/evidence/plat03_context.json`.
Changed paths: the five paths claimed above. Models, routes, dependencies, Core and UX are unchanged.
Implementation commit: `a9537ae2730f763c9fb7321ef0011175e69b9889` on `codex/platform-evidence`.
Acceptance review: missing/changed support, opposite interpretation, unresolved exceptions,
cycles, long-section tails and lexical-versus-semantic distinctions are covered by the
passing evidence/retrieval suite. The bounded-context continuation is also complete.
Fetched main remains `3b1ef06`; runtime/tests and schemas match the verified copy.
Next action: review the requested PR; no teammate artifact is needed. Cross-reference
recognition remains heuristic and software checks do not establish legal accuracy.

## Original implementation record

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
