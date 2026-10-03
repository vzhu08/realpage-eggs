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
