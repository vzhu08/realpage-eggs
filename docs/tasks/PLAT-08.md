# PLAT-08: complete container launch candidate

Owner: Platform deployment agent, delegated by the current user-authorized Platform run.
State: Assigned. Base: PLAT-06 `798b7d3` plus the parallel-assignment commit.
Branch: `codex/platform-container`.
Checkout: `C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/platform-container`.

Complete the existing container candidate so it can serve the built frontend and API together.
Keep loopback publication, read-only snapshot/root, non-root runtime and no embedded private data/secrets.
Use existing UX source without editing it. Prefer reproducible build stages and explicit source revision.
Check Docker availability; actually build/run if available without installing or launching a desktop app.
If runtime is unavailable, preserve a concrete tested candidate and disclose the exact limitation.
Exclusive writes: `deploy/Dockerfile`, `deploy/compose.yaml`, `.dockerignore`,
`deploy/verify_container.py`, `tests/test_deployment.py`, `docs/CONTAINER_RUNBOOK.md`, this card,
`docs/evidence/plat08_container.json`. Do not edit other scripts, API, frontend or shared docs.

Read AGENTS, OWNERSHIP, CONTRACTS, TASKS, playbook, PLAT-02 and PLAT-06. Verify branch/base.
Use shared Python venv and private outputs. No public hosting/provider calls. Root owns merge and board.
Handoff includes commit, commands, actual results, runtime limits and next action.
