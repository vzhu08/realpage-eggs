# CORE-03 — P0/P1 evaluator trace and residual AST

## Current four-developer assignment (supersedes historical claims below)

- Lane / human owner: Core A / Rules & Evaluation — Daniel, explicitly reassigned by the user in this session.
- State: Implementation and written Core B producer handoff complete; locally verified.
- Read first: AGENTS, current four-developer playbook, OWNERSHIP, ASSIST_CONTRACT, existing candidate handoff.
- Existing candidate: PR #3 head `3cf0361`; combined integration tracked in [COORD-03](COORD-03.md).
  Existing author checkout: /Users/danny/Documents/ChatGPT/RealPage/core-backend. Preserve it and its commits.
- Current branch/checkout/base/result: `codex/core-backend`, `/Users/danny/Documents/ChatGPT/RealPage/core-backend`, merged main `3b1ef06`, runtime result `9ac58ba`.
- Exclusive allowed paths for this task: navigator/engine.py, predicates.py; tests/test_engine.py; optional new tests/test_traces.py; docs/core_rules/**; this card.
- Reserved: the other Core lane's runtime/tests/cards, frontend, Platform APIs/services, models/contracts,
  dependencies, tests/conftest.py and shared docs/board. Core B exclusively owns core_assist.py.
- Dependency: Existing shared models and Platform contracts; keep the trace checkpoint independent of live extraction.
- Next bounded action: Core B can consume the preserved rule_traces/evaluate_rules boundary; retain its target-context gating and existing planner/renderer implementation.
- Checks (checkout Python): python -m pytest tests/test_engine.py tests/test_change_adapters.py -q; include test_traces.py if added.
- Acceptance: retain the task's behavioral acceptance below; preserve one evaluator and evidence uncertainty.
  Platform must test actual combined HTTP/exports before marking integration verified.
- Non-goals: rewriting delivered features, changing another owner's files, model-authored legal certainty.
- Handoff: actual commit, paths, exact checks/results, remaining dependencies and whether combined integration ran.
- Authority: user-authorized local commits and local branch integration only; Daniel pushes manually. No remote merge, deployment or teammate contact.

## Current Daniel continuation — 2026-10-03 local / 2026-10-04 UTC

The user explicitly assigns this session to Core A and requests local branch integration.
Human: Daniel. Sole writer: Codex /root, session 01a103d0-b88b-7090-97aa-f9d5eec55d45.
Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend`; branch `codex/core-backend`.
Fetched merged-main base: `3b1ef06`; local integration: `3eced75`; final runtime candidate: `9ac58ba`.
Read-only helpers reviewed Core A behavior; they made no edits. The prior task's extraction remains stopped.
Daniel releases future writes to the planner, renderer, core_assist adapter, their tests and CORE-04/05
to Core B under OWNERSHIP. No shared-board edit or teammate contact was made.

The existing producer remains `engine.rule_traces(rule, prop, resolution, as_of) -> list[PredicateTrace]`. Six synthetic regressions showed interaction scopes retained relevance for inactive source rules. `eef489e` gates all trace roots/scopes after assembly on false coverage, wrong jurisdiction or inactive lifecycle. Seven new Core A-owned tests in `tests/test_traces.py` verify those cases plus unknown-source retention, stable paths, copied evidence and immutability. Core B’s existing consumer already compensated for the defect; its target-rule gating remains necessary.

Raw exemption truth, original grouping/paths, three-valued results, residual pruning, numeric bounds and actual partial occupancy dates are preserved. Construction year never establishes certificate or occupancy facts. No duplicate evaluator, new schema/API, planner/renderer rewrite, or Core B file edit was made.

Core A focused tests: 93 passed. Disposable-copy full suite including the new producer tests: 200 passed. The unchanged historical verifier’s focused subset reports 125 passed; compileall/contracts/diff pass and working artifacts remain intact. The written producer/consumer handoff and actual integrated HTTP evidence are in `docs/core_rules/CORE_A_HANDOFF.md` and `saved_store_closeout.json`. Human allocation of the new Core B session remains Platform-owned; this session has released those write paths.

Final local integration: actual lookup and assist both HTTP 200 on A0001 / 2026-10-01, with unresolved geography and bounded analysis preserved. Partial export contains 16 representable rules, retains all 500 input IDs, and has no broken lookup/override references. Validation's 124 unknown-temporal projection errors remain explicit; all 140 internal rules are retained and review-needed. These in-process checks do not constitute Platform release approval or independent legal review.

## Daniel author record — preserved from PR #3 head 3cf0361

The following is Daniel's complete task record at the imported commit, including historical
claims and checks. The current lane assignment above controls future work. His newer live
evidence is in `docs/core/CORE01_LIVE_REVIEW.md`; COORD-03 records combined Platform verification.

# CORE-03 — P0/P1 evaluator trace and residual AST

State: Review (local). Human owner: Daniel. Session: Codex /root, 01a103d0-b88b-7090-97aa-f9d5eec55d45.
Branch: codex/core-backend. Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend`.
Base: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`. Result: `49ac41ff2fb9fd2526438f929aa949a0acc0ebcb`.
Dependencies: COORD-01.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/engine.py, predicates.py; tests/test_engine.py, test_question_planner.py; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: Stable predicate paths and true/false/unknown trace tree expose only relevant residual facts.
Acceptance: Short circuit irrelevant fields; correlated predicates; review legacy year-built proxy so actual occupancy facts are not silently established; decisive versus irrelevant fact removal.
Checks (use project .venv Python): python -m pytest tests/test_engine.py tests/test_question_planner.py -q.
Next action: Vincent reviews this Core candidate through the existing merge queue; CORE-04 implemented locally.
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

Final combined candidate: `0c32ec447e1e9f3d352702a252493843c7871682`; 82 focused and 96 full-suite tests passed; compileall, contracts generation (disposable copy), and diff check passed. See docs/core/CORE_HANDOFF.md.
