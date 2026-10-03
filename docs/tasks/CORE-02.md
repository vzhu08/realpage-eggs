# CORE-02: independent temporal and interaction review

## Current four-developer assignment (supersedes historical claims below)

- Lane / future owner: Core A / Rules & Evaluation. Existing author Daniel; Vincent confirms continued session/base before edits.
- State: Review for existing candidate; combined integration pending.
- Read first: AGENTS, current four-developer playbook, OWNERSHIP, ASSIST_CONTRACT, existing candidate handoff.
- Existing candidate: origin/codex/core-backend at c92ad8f; tested candidate reported as 0c32ec4.
  Existing author checkout: /Users/danny/Documents/ChatGPT/RealPage/core-backend. Preserve it and its commits.
- Future branch/absolute checkout/base/result commit: record at handoff; do not assume current main includes this candidate.
- Exclusive allowed paths for this task: navigator/engine.py, predicates.py, changes.py; tests/test_engine.py, test_change_adapters.py; docs/core_rules/**; this card.
- Reserved: the other Core lane's runtime/tests/cards, frontend, Platform APIs/services, models/contracts,
  dependencies, tests/conftest.py and shared docs/board. Core B exclusively owns core_assist.py.
- Dependency: Existing shared models and Platform contracts; keep the trace checkpoint independent of live extraction.
- Next bounded action: Review existing date/interaction repairs and serialize further evaluator edits with CORE-03.
- Checks (checkout Python): python -m pytest tests/test_engine.py tests/test_change_adapters.py -q.
- Acceptance: retain the task's behavioral acceptance below; preserve one evaluator and evidence uncertainty.
  Platform must test actual combined HTTP/exports before marking integration verified.
- Non-goals: rewriting delivered features, changing another owner's files, model-authored legal certainty.
- Handoff: actual commit, paths, exact checks/results, remaining dependencies and whether combined integration ran.
- Authority: local task commits; no push, merge, deployment, external messages or new agents implied.

## Prior author record — preserved from Core candidate 3cf0361

The following is the existing author’s record, imported without alteration.
Current four-lane scope above governs new work; candidate results remain reported evidence until rerun.

# CORE-02: independent temporal and interaction review

- Human owner: Daniel. Tool/session: Codex /root, 01a103d0-b88b-7090-97aa-f9d5eec55d45.
- Branch: codex/core-backend. Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend`.
- Base: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`. Result: `644680cbc1187e8dfb54a519af7f030518732903`. Dependency: BOOT-01 contracts and tests (available).
- Allowed: `navigator/engine.py`, `predicates.py`, `changes.py`, `tests/test_engine.py`, `test_change_adapters.py`, this card.
- Reserved: extraction writer paths, models/contracts, API/geocoder, frontend and shared board.
- Read first: AGENTS, CONTRACTS, evaluator, tests, supplied test definitions (validation only).
- Outcome: independent review identifies material lifecycle/version/interaction gaps and repairs the highest-value one.
- Acceptance: validate event intervals and historical pending/failed behavior, supported override scopes, unknown facts and cycles;
  assess cross-document lifecycle linking without assuming newer retrieval implies precedence. Keep source uncertainty explicit.
- Checks: `python -m pytest tests/test_engine.py tests/test_change_adapters.py -q`, then full suite after changes.
- Non-goals: implementation-mirroring tests or expected address sets in production. Target 30–60 minutes.
- Handoff: inspected commit, concrete issue/evidence, changes/checks, remaining gaps and result commit in this card.
- Integration authority: user/Core reviewer; shared changes via Platform steward; no direct main/deploy authority.

## Daniel's Core implementation claim — 2026-10-03

Human owner: Daniel. Sole writing agent: Codex /root, session 01a103d0-b88b-7090-97aa-f9d5eec55d45.
Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend` (dedicated clone; no pre-existing changes).
Branch: `codex/core-backend`. Base: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`.
The user assigns this session to Core; earlier unallocated metadata is superseded by this claim.
Claimed paths: the exact allowed implementation/tests/card above, plus `docs/core/**` and ignored `data/core-session/**` for evidence.
Work is serialized CORE-03 -> CORE-04 -> CORE-05 -> focused CORE-02; adapter changes have one writer.
State: Ready, reserved to this session; no concurrent writes.
No push, merge, deployment, external messages or submission authorized.

### Local result — Review
Read-only review reproduced six failing cases before repair: false-scope reverse edges caused false
cycles; false-scope priority suppressed overlapping-version conflict; same-citation links self-targeted;
month/day-overlapping and same-day lifecycle events inferred order; an undated failed snapshot asserted
arbitrary history. Repairs are confined to engine.py. No changes.py refactor was needed.
Potential interaction graph excludes false scope, inactive participants and self-targets. Definite
priority requires true scope, applicable source/target and no possible cycle. Conflict detection runs
before applying supersession. Lifecycle considers all possibly latest events and retains uncertainty
when conflicting statuses have no evidenced order. Undated pending/failed snapshots remain unknown.
Checks: `.venv/bin/python -m pytest tests/test_engine.py tests/test_change_adapters.py -q`: 34 passed.
New end-date change test preserves definite versus uncertain address sets and store immutability.
Scope/provision matching still uses the shared citation/jurisdiction/category contract; no inferred
cross-document enactment or finer-grained precedence was added. Full regression is in Core handoff.

Final adversarial regression: parallel supersedes/conflicts_with edges to the same target must retain
conflict. Reproduced failure, then required edge kind and true scope for each applied supersession.
Both interaction orders are tested. Final check totals are in docs/core/CORE_HANDOFF.md.

Final combined candidate: `0c32ec447e1e9f3d352702a252493843c7871682`; 82 focused and 96 full-suite tests passed; compileall, contracts generation (disposable copy), and diff check passed. See docs/core/CORE_HANDOFF.md.
