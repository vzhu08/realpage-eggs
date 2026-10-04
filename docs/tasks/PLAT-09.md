# PLAT-09: reproducible release handoff bundle

Owner: Platform handoff agent, delegated by the current user-authorized Platform run.
State: Verified locally; ready for root integration review. Corpus remains partial and not submission-ready.
Base: `b3358579256706a4c1c6f4af30c1273feb5e0933` (PLAT-06 plus parallel assignments).
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

## Completed local handoff — October 4

Implemented `scripts/prepare_handoff.py prepare` and `verify`, using only the Python standard
library. Preparation requires independently retained hashes for the saved software report and
both original export run manifests. It verifies every frozen release file, all seven export
hashes, separate replay identity, logical input hashes, dates/counts/references and preserved
partial/blocked statuses. It copies exact bytes into a new private directory, includes the
original provenance manifests and a concise rendered method note, then verifies the result.
No evaluator, provider, network call or fresh legal conclusion is involved.

The recipient verifies with an independently retained `handoff.json` hash, without original
absolute paths or pipeline dependencies. Identical input/script/template bytes reproduce every
bundle byte. Missing, changed or extra files, failed reports, bad pins, inconsistent runs,
submission promotion, links/junctions, existing outputs and overlapping trees are rejected.
Interrupted copying retains an incomplete marker; no existing output is deleted or overwritten.

Real exercise reads PLAT-06's immutable `real-acceptance-verified/report.json`, both export
directories and `releases/real-002`. Both full source trees remain byte-identical. New private
outputs are `artifacts/plat09/verified-handoff` and `artifacts/plat09/verified-handoff-replay`
inside this checkout; all 14 files match between them. Their common manifest hash is
`1044a73180048c6bd21b9304eb2c1035d65563e95a9e81c6512fa204bbec7ce1`.
The initial `real-handoff` experiment is retained separately and superseded by these verified
outputs after the final path guard update. No private bundle is tracked or published.

Checks: `python -m pytest tests/test_handoff.py -q` reports **23 passed, 1 skipped**; the skip
is the Windows host's missing symlink-creation privilege. Ordinary-file and ancestor link/junction
rejection is implemented, but that OS integration case was not exercised here. Real preparation
twice, independent recipient verification twice and explicit CLI verification all pass. Input
preservation, original payload/run-manifest bytes and deterministic bundle files were checked.
`git diff --check` passes. Root runs combined integration checks and owns push/merge.

Changed paths: the six exclusive paths listed above. No runtime/API/schema/Core/frontend changes.
Commands and trust-pin guidance: `docs/RELEASE_HANDOFF.md`; detailed hashes/counts:
`docs/evidence/plat09_handoff.json`. Runtime release commit remains `5145f1b`; this task packages
its saved results rather than replacing that code/data snapshot.

Limits: 500 addresses remain represented; 13 municipalities remain unresolved; 140 rules need
review and 124 temporal projections have errors. T1 stays partial and T2–T5 blocked. The bundle
does not contain the full runnable release or original provider/geocoder store. Full source/legal
review, UX acceptance and release/submission approval remain separate work. Next action: root
reviews the bounded implementation and integrates it; retain the private bundles and external pin.
