# PLAT-07: snapshot and evidence integrity review

Owner: Platform evidence agent, delegated by the current user-authorized Platform run.
State: Assigned. Base: PLAT-06 `798b7d3` plus the parallel-assignment commit.
Branch: `codex/platform-evidence-integrity`.
Checkout: `C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/platform-evidence-integrity`.

Review snapshot assembly and offline evidence replay for concrete correctness/integrity defects.
Fix reproduced defects with focused regressions; do not expand the evaluator or legal scope.
Exclusive writes: `navigator/evidence_package.py`, `scripts/assemble_snapshot.py`,
`tests/test_evidence_package.py`, `tests/test_snapshot_assembly.py`, this card,
`docs/evidence/plat07_integrity.json`. Report defects in other paths to root.

Read AGENTS, OWNERSHIP, CONTRACTS, TASKS, the playbook and PLAT-06 before work. Verify branch/base.
Use the shared existing Python venv, private test outputs, disabled dotenv and no live providers.
Run affected tests; hand off commit, findings, checks and remaining limits. Root owns merge and board.
