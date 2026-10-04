# PLAT-04 — P1 supplemental answers and assist API

## Current continuation

State: Review. Human owner Vincent; current Codex session.
Branch: `codex/platform-assist`; checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs`.
Base: `c57107a53f74f4cfcfa21d25bf21ae1e72d995be` (PLAT-03 PR #7 merged).
COORD-01, PLAT-03 and actual CORE-04/05 are present on main. The original integration
blocker below is historical; no new teammate code or ownership transfer is required.

Claimed paths: `navigator/service.py`, `tests/test_assist_api.py`, this card,
`docs/TASKS.md`, `docs/FRONTEND_HANDOFF.md`, `docs/evidence/plat04_assist.json`.
Outcome: consistent lookup/assist handling for an empty address ID; verified stateless
answer/scenario behavior with unchanged stored facts and official export payloads;
frontend handoff updated to the actual merged Core capability state.
Checks: `python -m pytest tests/test_assist_api.py tests/test_api_exports.py -q`,
the full suite, and `python -m navigator contracts` in an isolated validation copy.
User authorized starting the next independent task. Local commits only; no new push,
PR, merge, live provider call, frontend edit, or deployment is claimed.

Result: empty IDs now return 404 `unknown_id` through lookup and assist; selector presence
matches the existing request contract. Missing/both selectors remain 422 and valid structured
addresses still work. The real Core answer journey is stateless even when `scenario_id` repeats:
unknown -> labeled answer -> applies -> omitted answer -> unknown, with no stored JSON changes.
All seven export payloads are byte-identical before and after the HTTP journey.
The frontend handoff now identifies merged Core capabilities and preserves missing-service cases.

Checks: two empty-ID regressions failed with HTTP 500 before the fix. After the fix,
28 assigned API/export tests and 179 full tests passed. Contract generation passed with all
four schemas byte-identical. Full verification ran in `artifacts/plat04-assist-check`.
One existing Starlette/httpx deprecation warning remains. Exact HTTP observations, export hashes
and check evidence are in `docs/evidence/plat04_assist.json`.
Changed paths: the six paths claimed above. Result checkpoint: the local continuation commit
on `codex/platform-assist` containing this card. No model/dependency change or Core edit was needed.
Next action: review the local continuation. Browser integration belongs to UX; live source
and legal-quality review remain separate from these synthetic software checks.

## Original implementation record

State: Review. Human owner Vincent; current Codex session. Branch codex/research-platform.
Checkout C:\Users\vzhu0\PycharmProjects\realpage-eggs; base 5ef1de1d6f1dd089c07c855bcb7e544198cde2a5. Result commit: codex/research-platform implementation checkpoint (see final handoff / branch HEAD).
Dependencies: COORD-01 + PLAT-03; live questions/rendering require CORE-04/05.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/api.py, service.py, assist_service.py, fact_inputs.py, export.py, cli.py; tests/test_assist_api.py; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: Stateless labeled factual answers use the existing evaluator with current evidence checks.
Acceptance: Strict types/units/dates; originals unchanged; decisive versus still-unknown cases; missing Core explicitly unavailable; official exports unchanged.
Checks (use project .venv Python): python -m pytest tests/test_assist_api.py tests/test_api_exports.py -q; python -m navigator contracts.
Next action / blocker: Re-run combined integration when actual Core services land; UX can start now.
Non-goals: extra evaluator/provider/database, copied unlicensed code, taking another lane's task.
Handoff: actual commit, changed files, tests, limitations, contract requests and dependency status in this card.
Integration: single ordered queue, recheck combined code; local commits allowed, no push/merge/deploy authority.


Local result: Answers/API implemented; 17 focused API tests passed; full Core planner/renderer integration remains blocked on CORE-04/05. Full suite: 74 passed. No merge/deployment claimed.

Four-developer coordination: use the current playbook and OWNERSHIP. Core A owns extraction/evaluator/traces;
Core B owns planner/renderer. Existing Core candidate c92ad8f awaits combined review/integration; do not duplicate it.
Platform stewards shared contracts and UX owns the entire frontend. Prior task results remain historical evidence.
