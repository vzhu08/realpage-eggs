# CORE-02: independent temporal and interaction review

- Human owner: Core owner, name/claim pending. Tool/session: unallocated.
- Branch/checkout/base/result commit: unallocated. Dependency: BOOT-01 contracts and tests (available).
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
