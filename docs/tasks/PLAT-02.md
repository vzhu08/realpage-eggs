# PLAT-02: reproducible service/export packaging

- State: Review. Human owner: Vincent / Platform/API. Tool/session: current Codex session, user-assigned October 3, 2026.
- Branch: `codex/platform-packaging`; checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs`.
- Base: `9a96fda205c75536d81b17d7d1baf5b3c0ced0e6`, the verified PLAT-01 merge from PR #5; clean starting tree.
- Result: local checkpoint `Package reproducible Platform launch and export checks` (exact SHA in chat handoff and Git history).
- Dependencies: BOOT-01; real-rule quality depends on CORE-01.
- Claimed paths: `scripts/platform_ops.py`, `deploy/Dockerfile`, `deploy/compose.yaml`, `.dockerignore`,
  `docs/PLATFORM_RUNBOOK.md`, `docs/evidence/plat02_packaging.json`, `README.md`, this card,
  PLAT-01 merge handoff and shared `docs/TASKS.md` status. `requirements.lock` only if clean-install evidence requires a steward repair.
- Private environments, generated smoke stores and reports: `artifacts/plat02-*`; originals and default data remain preserved.
- Reserved: extraction/evaluator, frontend, raw inputs and other active claims.
- Read first: AGENTS, README, CONTRACTS, DECISIONS, DEMO_AND_SUBMISSION.
- Outcome: fresh environment can launch API and reproduce labeled exports; concrete deployment plan/config for approval.
- Acceptance: install lock in clean venv, missing-key behavior, local smoke checks, preserved artifacts and no secret exposure.
  Public deployment/auth decision must be concrete and reviewed; no deployment implied by this task.
- Checks: `python -m pytest -q`, `python -m navigator validate`, local `/api/v1/health`, export replay comparison.
- Non-goals: infrastructure expansion or an unauthenticated billable ingestion endpoint. Target 30–50 minutes.
- Handoff: exact setup commands, tested environment, deployment candidate and limitations in this card.
- Integration authority: user/Platform reviewer; merge and deploy require explicit authority.

Four-developer coordination: use the current playbook and OWNERSHIP. Core A owns extraction/evaluator/traces;
Core B owns planner/renderer. Existing Core candidate c92ad8f awaits combined review/integration; do not duplicate it.
Platform stewards shared contracts and UX owns the entire frontend. Prior task results remain historical evidence.

## Implementation handoff

Delivered a fresh-environment bootstrap, explicit loopback API launch, and an offline smoke/export
runner in `scripts/platform_ops.py`. Checks create new output directories, copy optional real input,
blank provider credentials, and preserve snapshots, reports and both export passes. Existing output
or environment paths are refused. No model, API, application runtime, lock or dependency change.

`deploy/Dockerfile`, `deploy/compose.yaml` and `.dockerignore` provide a local container candidate:
UID 10001, loopback publication, read-only filesystem/data mount, no credentials in the image/context.
[Runbook](../PLATFORM_RUNBOOK.md) includes exact install/launch/check/export commands, data modes,
readiness semantics, reviewable public-access proposal, rollback and explicit verification limits.
README links this workflow. PLAT-01's card and the board record the authorized merge and next task.

Checks actually run:

- Clean venv `artifacts/plat02-venv` with Python 3.12.14 on Windows; installed all **29 pinned packages**
  from `requirements.lock` (downloaded wheel cache reused); `pip check` passes; each installed version matches.
- `artifacts/plat02-venv/Scripts/python.exe -m pytest -q`: **96 passed**, one existing Starlette/httpx warning.
  This also checks the production code merged through PR #5. Removed only the existing fixture test's
  generated random run-ID changes after inspecting them; tracked contracts remain unchanged.
- `artifacts/plat02-venv/Scripts/python.exe scripts/platform_ops.py smoke --output artifacts/plat02-smoke-clean --real-data data/plat01-recovery`:
  passes real loopback HTTP checks, missing-key exit 2, validation and export replay. All seven payloads
  are byte-identical between passes for both stores; distinct manifests keep matching input hashes.
- Native `serve --data-dir data/plat01-recovery --port 8011`: HTTP health 200, partial, 500 addresses,
  491 municipalities, zero rules. Temporary server stopped after verification.
- Existing venv/output and absent launch-store refusals: expected exit 2; prior output bytes preserved.
- `docker compose -f deploy/compose.yaml config --quiet`: passes; expanded settings confirm loopback
  binding, read-only data/root, and no provider credentials.
- `git diff --check`: passes. Original real store hashes unchanged after snapshot checks.

Evidence: [plat02_packaging.json](../evidence/plat02_packaging.json). Full generated outputs and clean
environment are ignored under `artifacts/plat02-*`. Software checks do not establish legal accuracy.

Limits: Docker engine was stopped; **image build and Linux/container runtime are unverified**.
The base image tag floats and lock has no wheel hashes; no reproducible-image claim. No public deployment,
authentication or TLS is implemented. Real readiness remains false: zero rules, 33 missing source texts,
nine unresolved municipalities. No Core or UX files were modified.

Next action: review this local checkpoint. With Docker available, verify build and container behavior
before deployment approval. A public host/domain/authentication choice needs separate authority and scope.
The user's push/merge instruction was fulfilled for PLAT-01 through PR #5; PLAT-02 remains local for review.
