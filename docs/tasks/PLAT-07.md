# PLAT-07: snapshot and evidence integrity review

Owner: Platform evidence agent, delegated by the current user-authorized Platform run.
State: Review. Implementation and offline real-input verification complete; root owns integration.
Base: parallel-assignment commit `b335857`, including PLAT-06 `798b7d3`.
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

## Result — October 4, 2026

Implementation: `808f05a3e1163e528fd6784d0c24ad3cbd6d1cfe`. Two concrete defects were
reproduced before repair:

- Evidence creation checked that an output was absent before running the planner, then replaced
  that path. Work written by another process during computation was silently lost. Publication
  now stages complete bytes and atomically creates the destination without replacing an existing
  file. This uses same-filesystem hard links; unsupported filesystems fail without an overwrite.
- Assembly established only that a reviewed cache existed for a rule's run/document. A changed
  predicate, requirement or date was accepted even when absent from that cache. Assembly now
  compares Core's existing substantive representation with that run/document's reviewed drafts.
  Core's existing cache validator runs on in-memory copies, preserving legitimate legacy fact
  guards and every original source/cache byte. This is provenance verification, not legal review.

Five focused regressions cover publication races, three rule mutations, and a legitimate legacy
fact guard. All 45 evidence-package/snapshot tests pass with the organizer pack, with one existing
Starlette/httpx deprecation warning. The four defect regressions failed before the repairs.

Offline real-input verification at that implementation commit reassembles 500 addresses, 140
rules, 87 sources and 487 resolved municipalities. All 804 input files (97 Core and 707 geography)
retain their exact hashes. Snapshot ID remains
`8c0a2b50e0eda0839cf881cfb251b2762583840d1bec2f36454f77a63c7ae165`.
The A0001 / 2026-10-01 evidence package publishes and reproduces offline. No network request or
provider call occurred. Private outputs live under this checkout's `artifacts/plat07/`; the public
summary is `docs/evidence/plat07_integrity.json`.

Changed paths: `navigator/evidence_package.py`, `scripts/assemble_snapshot.py`, their two assigned
test files, this card and the evidence summary. No API/schema, evaluator, frontend, original data,
environment dependency or legal-content change. Existing partial coverage and review gates remain.

Root next action: review and integrate, regenerate exact-code evidence examples and rerun combined
checks. The user authorizes pushes/merges, but this delegate has not performed either operation.
