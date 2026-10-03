# PLAT-05 — P1 targeted inventory and semantic review

State: Ready. Human owner Vincent; current Codex session. Branch codex/research-platform.
Checkout C:\Users\vzhu0\PycharmProjects\realpage-eggs; base 5ef1de1d6f1dd089c07c855bcb7e544198cde2a5. Result commit pending.
Dependencies: PLAT-03; live prerequisite OPENAI_API_KEY/OPENAI_MODEL.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/semantic_review.py, source_inventory.py, CLI wiring; Platform evidence tests/report; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: Selected sources expose unmapped units; selected rules get bounded context-grounded semantic judgments.
Acceptance: Cache by exact rule/source/verifier version; spans must exist; missing dependencies prevent certainty; fixture/live/replay distinct; no claim of human review.
Checks (use project .venv Python): python -m pytest tests/test_evidence.py tests/test_retrieval.py -q; targeted source-inventory CLI.
Next action / blocker: Implement offline path/provider boundary; do not edit Core extraction.py.
Non-goals: extra evaluator/provider/database, copied unlicensed code, taking another lane's task.
Handoff: actual commit, changed files, tests, limitations, contract requests and dependency status in this card.
Integration: single ordered queue, recheck combined code; local commits allowed, no push/merge/deploy authority.

