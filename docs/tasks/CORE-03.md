# CORE-03 — P0/P1 evaluator trace and residual AST

## Current four-developer assignment (supersedes historical claims below)

- Lane / future owner: Core A / Rules & Evaluation. Existing author Daniel; Vincent confirms continued session/base before edits.
- State: Review for existing candidate; trace handoff to Core B pending.
- Read first: AGENTS, current four-developer playbook, OWNERSHIP, ASSIST_CONTRACT, existing candidate handoff.
- Existing candidate: origin/codex/core-backend at c92ad8f; tested candidate reported as 0c32ec4.
  Existing author checkout: /Users/danny/Documents/ChatGPT/RealPage/core-backend. Preserve it and its commits.
- Future branch/absolute checkout/base/result commit: record at handoff; do not assume current main includes this candidate.
- Exclusive allowed paths for this task: navigator/engine.py, predicates.py; tests/test_engine.py; optional new tests/test_traces.py; docs/core_rules/**; this card.
- Reserved: the other Core lane's runtime/tests/cards, frontend, Platform APIs/services, models/contracts,
  dependencies, tests/conftest.py and shared docs/board. Core B exclusively owns core_assist.py.
- Dependency: Existing shared models and Platform contracts; keep the trace checkpoint independent of live extraction.
- Next bounded action: Hand off existing engine.rule_traces and preserved predicate semantics to Core B; no new trace API or duplicate implementation.
- Checks (checkout Python): python -m pytest tests/test_engine.py tests/test_change_adapters.py -q; include test_traces.py if added.
- Acceptance: retain the task's behavioral acceptance below; preserve one evaluator and evidence uncertainty.
  Platform must test actual combined HTTP/exports before marking integration verified.
- Non-goals: rewriting delivered features, changing another owner's files, model-authored legal certainty.
- Handoff: actual commit, paths, exact checks/results, remaining dependencies and whether combined integration ran.
- Authority: local task commits; no push, merge, deployment, external messages or new agents implied.

## Prior author record — preserved from c92ad8f

The following records Daniel's earlier single-Core work and reported checks. Its broad or Running claims
are historical; the current scope/state above controls future work. Remote-reported tests were not rerun by
this documentation pass, and the candidate is not merged into this checkout.

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
