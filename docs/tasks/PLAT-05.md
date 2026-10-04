# PLAT-05 — P1 targeted inventory and semantic review

## Current continuation

State: Software ready for review; live verification awaiting user-provided local inputs.
Human owner Vincent; current Codex session. Branch `codex/platform-review`.
Checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs`.
Base: `3b2d2011de3d0319f96702bbeddb6ec72323dc27` (merged Core A/B and frontend integration).
User requested completing, pushing and merging this task. PLAT-04 remains preserved
separately at local `11afb55`; this continuation does not include that branch.

Claimed paths: `navigator/semantic_review.py`, `navigator/source_inventory.py`,
`tests/test_evidence.py`, `tests/test_retrieval.py`, this card, `docs/TASKS.md`,
`docs/evidence/plat05_review.json`, and the semantic-review section of `README.md`.
Outcome: verifier/model-aware cache replay, truthful partial replay manifests and exact
inventory span validation; targeted source inventory and all offline acceptance checks.
Checks: evidence/retrieval tests, full suite and generated contracts in an isolated copy,
targeted original D001 inventory, explicit missing-provider failure and labeled fixture replay.

Live inputs checked without exposing secrets: local OPENAI_API_KEY and OPENAI_MODEL are
both absent. Local stores contain no real extracted rules. Daniel's merged Core A handoff
reports 140 live/replay rules in `/Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session`,
which is unavailable in this Windows checkout. The user has been asked for a local store
path and local configuration. No corpus extraction is restarted, and no fixture is called live.

Software result: cache replay requires the requested provider mode/model and verifier version;
live CLI review cannot silently consume a fixture cache. Exact live caches remain usable offline.
Replay manifests preserve partial decisions and their original provenance. Inventory v2 validates
both quote offsets before mapping evidence and invalidates prior inventory caches.
Four regressions failed before these repairs; 26 focused checks and 226 full tests now pass.
Contracts regenerate with all four schemas unchanged. Targeted D001 inventory ran on an isolated
copy of original text: 15 unresolved units, then exact cache replay; source inputs unchanged.
The authored missing-exception review and its replay both remain partial. The CLI rejects absent
provider configuration even when a fixture review is cached. One existing Starlette/httpx warning remains.
Evidence: `docs/evidence/plat05_review.json`; detailed offline artifacts: `artifacts/plat05-offline`.
Next action: accept files in `data/plat05-input`, verify their exact source spans, run one bounded
live review and a zero-call replay, then execute the user-authorized push/merge. Until that live
check succeeds, the complete task is not claimed finished.

## Original implementation record

State: Review. Human owner Vincent; current Codex session. Branch codex/research-platform.
Checkout C:\Users\vzhu0\PycharmProjects\realpage-eggs; base 5ef1de1d6f1dd089c07c855bcb7e544198cde2a5. Result commit: codex/research-platform implementation checkpoint (see final handoff / branch HEAD).
Dependencies: PLAT-03; live prerequisite OPENAI_API_KEY/OPENAI_MODEL.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/semantic_review.py, source_inventory.py, CLI wiring; Platform evidence tests/report; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: Selected sources expose unmapped units; selected rules get bounded context-grounded semantic judgments.
Acceptance: Cache by exact rule/source/verifier version; spans must exist; missing dependencies prevent certainty; fixture/live/replay distinct; no claim of human review.
Checks (use project .venv Python): python -m pytest tests/test_evidence.py tests/test_retrieval.py -q; targeted source-inventory CLI.
Next action / blocker: Core live extraction first; then explicit targeted review with configured credentials. Do not edit Core extraction.py.
Non-goals: extra evaluator/provider/database, copied unlicensed code, taking another lane's task.
Handoff: actual commit, changed files, tests, limitations, contract requests and dependency status in this card.
Integration: single ordered queue, recheck combined code; local commits allowed, no push/merge/deploy authority.


Local result: Inventory/verifier implementation and fixture/replay checks passed; live review remains blocked by absent OpenAI key/model and real rules. Full suite: 74 passed. No merge/deployment claimed.

Four-developer coordination: use the current playbook and OWNERSHIP. Core A owns extraction/evaluator/traces;
Core B owns planner/renderer. Existing Core candidate c92ad8f awaits combined review/integration; do not duplicate it.
Platform stewards shared contracts and UX owns the entire frontend. Prior task results remain historical evidence.
