# PLAT-02: reproducible service/export packaging

- Human owner: Platform/API owner, name/claim pending. Tool/session: unallocated.
- Branch/checkout/base/result commit: unallocated. Dependencies: BOOT-01; real-rule quality depends on CORE-01.
- Allowed: newly claimed deployment/scripts paths, launch docs, requirements lock only as steward; exact list before writing.
- Reserved: extraction/evaluator, frontend, raw inputs and other active claims.
- Read first: AGENTS, README, CONTRACTS, DECISIONS, DEMO_AND_SUBMISSION.
- Outcome: fresh environment can launch API and reproduce labeled exports; concrete deployment plan/config for approval.
- Acceptance: install lock in clean venv, missing-key behavior, local smoke checks, preserved artifacts and no secret exposure.
  Public deployment/auth decision must be concrete and reviewed; no deployment implied by this task.
- Checks: `python -m pytest -q`, `python -m navigator validate`, local `/api/v1/health`, export replay comparison.
- Non-goals: infrastructure expansion or an unauthenticated billable ingestion endpoint. Target 30–50 minutes.
- Handoff: exact setup commands, tested environment, deployment candidate and limitations in this card.
- Integration authority: user/Platform reviewer; merge and deploy require explicit authority.
