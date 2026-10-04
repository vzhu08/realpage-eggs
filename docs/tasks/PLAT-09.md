# PLAT-09: reproducible release handoff bundle

Owner: Platform handoff agent, delegated by the current user-authorized Platform run.
State: Assigned. Base: PLAT-06 `798b7d3` plus the parallel-assignment commit.
Branch: `codex/platform-handoff`.
Checkout: `C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/platform-handoff`.

Prepare a repeatable private handoff from an already verified release/export run: the seven exact
export payloads, original run manifest, a concise method note and a hash manifest with code/data IDs.
Validate source report/files and preserve partial/blocked statuses. Never promote a partial corpus
to submission-ready. Reject missing/tampered inputs and existing outputs; no re-evaluation or new legal logic.
Provide a command and meaningful rejection/replay tests. Run against PLAT-06's immutable saved outputs
in a new private output directory, without changing source artifacts or publishing the private bundle.
Exclusive writes: `scripts/prepare_handoff.py`, `tests/test_handoff.py`, `docs/METHOD.md`,
`docs/RELEASE_HANDOFF.md`, this card, `docs/evidence/plat09_handoff.json`.

Read AGENTS, OWNERSHIP, CONTRACTS, TASKS, playbook, PLAN and PLAT-06. Verify branch/base.
Use shared Python venv; no providers. Root owns merge and board. Handoff commit, checks and limitations.
