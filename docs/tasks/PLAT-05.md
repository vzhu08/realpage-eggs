# PLAT-05 — P1 targeted inventory and semantic review

## Current continuation

State: Verified implementation and bounded live review; integration tracked by PR #10.
Human owner Vincent; current Codex session. Branch `codex/platform-review`.
Checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs`.
Base: `3b2d2011de3d0319f96702bbeddb6ec72323dc27` (merged Core A/B and frontend integration).
Integrated main: `ad0881a15d3828a7ecc3bedb83167d6416912371`; tested merge `e81c3f4`.
User requested completing, pushing and merging this task. PLAT-04 remains preserved
separately at local `11afb55`; this continuation does not include that branch.

Claimed paths: `navigator/semantic_review.py`, `navigator/source_inventory.py`,
`tests/test_evidence.py`, `tests/test_retrieval.py`, this card, `docs/TASKS.md`,
`docs/evidence/plat05_review.json`, and the semantic-review section of `README.md`.
Outcome: verifier/model-aware cache replay, truthful partial replay manifests and exact
inventory span validation; targeted source inventory and all offline acceptance checks.
Checks: evidence/retrieval tests, full suite and generated contracts in an isolated copy,
targeted original D001 inventory, explicit missing-provider failure and labeled fixture replay.

The user supplied Daniel's internal `rules (1).json`: 140 schema-valid rules, with the same
canonical digest recorded in Core A's saved-store closeout. All 541 evidence instances and
54 captured source hashes validate. Original files remain unchanged; private input copies
are in `data/plat05-internal-input`. The earlier 23-rule export is preserved separately.
Local `.env.local` provides the key and `gpt-6.1-sol`; no secret values are recorded.
The user explicitly approved sending one D001 rule and 4,940 source characters to OpenAI.
No property/address records were included, and no corpus extraction was restarted.

Software result: cache replay requires the requested provider mode/model and verifier version;
live CLI review cannot silently consume a fixture cache. Exact live caches remain usable offline.
Replay manifests preserve partial decisions and their original provenance. Inventory v2 validates
both quote offsets before mapping evidence and invalidates prior inventory caches.
Four regressions failed before these repairs; the initial baseline passed 26 focused and 226 full tests.
Contracts regenerate with all four schemas unchanged. Targeted D001 inventory ran on an isolated
copy of original text: 15 unresolved units, then exact cache replay; source inputs unchanged.
The authored missing-exception review and its replay both remain partial. The CLI rejects absent
provider configuration even when a fixture review is cached. One existing Starlette/httpx warning remains.
Evidence: `docs/evidence/plat05_review.json`; detailed offline artifacts: `artifacts/plat05-offline`.
Latest combined verification after PR #11: 26 focused tests; 259 full-suite tests plus one
organizer-pack test run separately with its explicit local path (260 unique tests pass).
All four generated schemas are byte-identical. The internal D001 inventory maps 5 of 15
units and leaves 10 unresolved; exact replay passes and all copied inputs are unchanged.
The board conflict preserves current four-lane assignments and the separate PLAT-04 continuation.
Live verification: rule `r-12c99cf95c4f2cd2242e`, D001; run `98f8619f5cf541e8b84a5179c3be93b3`
used one model call in 66.042 seconds (5,647 input / 4,809 output tokens). Eight field decisions
were supported within the supplied original passages; every cited span passed validation.
Replay `b369e559619b4545ab168f26f8be645d` returned identical decisions with zero calls, with
provider construction forbidden. Both manifests report success and retain live/replay provenance.
Inputs remain byte-identical; human_reviewed remains false. This verifies the targeted workflow,
not legal accuracy, full-corpus completeness or the 10 unmapped source units.
Detailed live artifacts: `artifacts/plat05-live-check`; curated hashes and manifests are in the
evidence JSON. Next integration action is the user-authorized push/merge of PR #10; subsequent
Platform work is PLAT-06 and its separate PLAT-04 reconciliation, as assigned in the board.

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
