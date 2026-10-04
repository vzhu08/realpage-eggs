# PLAT-08: complete container launch candidate

Owner: Platform deployment agent, delegated by the current user-authorized Platform run.
State: Local candidate verified; Linux container execution pending PLAT-10 CI. Root continues the agent's isolated work after handoff.
Base: PLAT-06 `798b7d3` plus the parallel-assignment commit.
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

## Implementation and local verification

The image now builds the existing frontend in a separate Node stage and serves its production
assets through the API. Official Node/Python manifests are pinned, the source commit is recorded,
and the build context excludes local stores, credentials, dependencies and Git metadata.
Compose retains non-root/read-only execution and loopback publication. The verifier uses a unique
project, explicit empty environment file, immutable input checks and private-path/write-denial probes.

21 deployment tests pass, including real same-origin HTTP checks and privilege/mount rejection.
The exact frontend npm lock installed in a disposable copy; generation, typecheck, all 90 unit tests
and production build pass. The first sandboxed build hit an esbuild directory-access restriction;
the approved build completed successfully. No authored frontend or Core file changed.

Compose configuration validates and retains the snapshot. The local Docker engine is stopped,
so no image/runtime success is claimed locally. `--build-and-run` is ready for the Linux CI runner;
the native PLAT-06 bundle stays available on port 8016. No public deployment occurs.
See `docs/CONTAINER_RUNBOOK.md` and `docs/evidence/plat08_container.json` for commands and evidence.
