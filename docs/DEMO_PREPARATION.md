# PLAT-13/14 demo preparation — October 4, 2026

Preparation is verified locally on `codex/platform-demo-prep`, base
`e7662374d5b8ad7f98401aae9c1fc5192e32a583`. This does not freeze a new demo release.
The existing three-hour delivery window is not restarted. No runtime, Core, frontend, contract,
Render configuration or original input was changed. The full paid corpus remains paused.

## Deployment ownership and integration gate

[PR #22](https://github.com/vzhu08/realpage-eggs/pull/22) remains owned by RENDER-01 in
`artifacts/render-setup`, branch `codex/render-setup`, chat "Check Required Infrastructure".
At inspected head `b77ae3a9b7ac63aaf6faf81b50704085617345b2`, all four checks passed:
backend/contracts, frontend/browser flows, complete container smoke, and free-container.
It is a draft; successful checks do not release the writer's claim.

The writer's completed handoff reports that the free deployment works: all 500 properties,
basic lookup and five cached scenarios were verified there. Assisted lookup takes approximately
59 seconds, exceeding the frontend's 20-second timeout. This preparation session has not
independently verified hosted HTTP/browser behavior or cold-start timing. At inspection, the
writer had local edits in `docs/RENDER_FREE_SETUP.md` and `docs/tasks/RENDER-01.md`; preserve
that work. An idle chat does not itself transfer file ownership. The old board's
"hosting not provisioned" statement is stale.

Next: receive the writer's finished commit/URL/evidence and scope release, inspect current PR
checks and main again, then review/integrate that result under existing authority. Preserve the
two-part secret transport; do not build a competing deployment path. A local fallback remains
available while the timeout limitation is measured or resolved. No teammate message was sent.

## Verified input selection

All private paths below are relative to
`C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/platform-demo-prep`.
The machine-readable [preparation evidence](evidence/plat13_14_preparation.json) records the pins.

| Input | Disposition |
| --- | --- |
| `../platform-release/data/plat06/core-with-comparisons` | Original complete 140-rule Core store; 97 assembler inputs verified |
| `../platform-release/data/plat06/geography-reconciled` | Original 707-file geography input; 487 resolved and 13 unresolved addresses retained |
| `../platform-release/data/plat06/integrated-release` | Preserved prior snapshot; same content identity reproduced independently |
| `../platform-ci/data/extraction-pilot-d069` | Complete 147-rule private pilot audited; original 140 unchanged; seven D069 candidates match portable bundle and reviewed cache lineage; not admitted to demo |
| `docs/platform_pilots/2026-10-04-d069` | Six payload hashes, one source, seven Rules and 25 distinct exact spans verify; this subset is not a Store |
| Core manually authored RuleDrafts | Review annotations only; do not export as automated extraction or borrow provider run IDs |
| Supplemental California captures and third-party court mirror | Deferred under DATA_SOURCE_RULES; no promotion into this preparation |

The baseline uses supplied corpus text, public assessor facts and saved Census results as described
in [DATA_SOURCE_RULES](DATA_SOURCE_RULES.md). No additional source use was cleared by this audit.
The 147-rule pilot passes the existing assembler's read-only extraction provenance checks. That
does not establish independent acceptance of the seven new candidates: all seven need review,
and six retain unsupported coverage. Core's selected reproducible increment remains pending.

## Private outputs prepared

- `artifacts/demo-prep/input-manifest.json`: absolute input paths, exact per-file hashes,
  source-use decisions, candidate disposition and required Core handoff. All 2,539 files across
  seven audited trees were unchanged; this count includes separate preserved copies.
- `artifacts/demo-prep/baseline-rehearsal`: assembled through the existing script, 500 addresses,
  140 rules, 87 sources and 487 resolved municipalities. Its snapshot ID is
  `8c0a2b50e0eda0839cf881cfb251b2762583840d1bec2f36454f77a63c7ae165`, identical to the prior
  snapshot. This is a preparation replay, not a newly improved dataset.
- `artifacts/demo-prep/baseline-handoff`: exact seven saved export payloads, method note and
  provenance, prepared and independently verified with `prepare_handoff.py`. Pins were checked
  against the existing RELEASE_HANDOFF runbook. No new evaluation/export run is implied.
- `artifacts/demo-prep/fallback-smoke.json`: fresh HTTP check of frozen `real-002` using its
  bundled runtime on a temporary loopback port. Health, HTML, A0001 lookup, exact source quote,
  evidence route, blocked private-file route, T1 partial and T2 blocked all passed. Only the
  temporary process was stopped; existing demo processes were preserved.

The `selected-snapshot`, `selected-serving`, `selected-cache`, `selected-release`,
`selected-verification` and `selected-handoff` children of `artifacts/demo-prep/` are reserved in
the manifest and deliberately do not exist yet: the existing tools require fresh destinations.
No partial bundle or unreviewed edited rule was installed into a serving store.

## Resume after the selected Core handoff

Core must provide a reviewed code revision, selected rule IDs, original automated lineage, exact
source evidence, retained review flags and either a complete immutable Store or a reproducible
way to assemble one. If Core provides only annotations or edits a rule beyond its reviewed
provider cache, keep it deferred. The existing assembler intentionally rejects unmatched
substantive behavior; do not disable that check or relabel manual edits as original extraction.

From this preparation checkout, replace the two explicit placeholders with the reviewed inputs:

```powershell
$python = 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/.venv/Scripts/python.exe'
$env:PYTHON_DOTENV_DISABLED = '1'
& $python scripts/assemble_snapshot.py --core-data '<complete-reviewed-Core-store>' --geography-data '../platform-release/data/plat06/geography-reconciled' --output artifacts/demo-prep/selected-snapshot --code-revision '<full-reviewed-code-SHA>'
```

Stop if assembly rejects identity, provenance or references. On success, record the new snapshot
identity and preserve every input hash. Use `scripts/platform_ops.py cache-changes` against that
snapshot, put completed caches into a new serving copy, and use `prepare-release` with the
reviewed UX build and exact code revision. See [PLATFORM_RUNBOOK](PLATFORM_RUNBOOK.md).
Do not silently reuse `real-002`'s older frontend for a new-code freeze. Run one supported lookup,
one honest uncertainty/change case and the selected real browser path before promotion. Reuse
`deploy/verify_release.py` and `scripts/prepare_handoff.py` for the final export/replay evidence.
The selected snapshot/release and its expected changed identity have not yet been produced.

## Local fallback

The preserved `real-002` and `known-good-backup` manifests both verify at
`08e95c386914a570cd159000da4799c616100ffe059a727f5702648517910d5b`.
Their code revision remains `5145f1b2c421ac2f5e6a12c5a4b0027ee9749855`.
From this preparation checkout, use a free local port; do not stop an existing writer's server:

```powershell
& 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/.venv/Scripts/python.exe' scripts/platform_ops.py serve-release --release '../platform-release/artifacts/plat06/releases/real-002' --port 8041
```

Open `http://127.0.0.1:8041`. If that port is already occupied, choose another unused port.
The existing Render writer's newer local instance retains its own launch instructions.
All 140 baseline rules remain review-needed, 124 temporal projections remain unresolved, T1
remains partial and T2-T5 remain blocked. Passing integrity/HTTP checks is not legal validation.

## Checks performed

The commands below ran with the existing project Python 3.12 environment and no provider calls:

1. `python docs/platform_pilots/2026-10-04-d069/verify.py` — passed.
2. `python scripts/assemble_snapshot.py --core-data ../platform-release/data/plat06/core-with-comparisons --geography-data ../platform-release/data/plat06/geography-reconciled --output artifacts/demo-prep/baseline-rehearsal --code-revision e7662374d5b8ad7f98401aae9c1fc5192e32a583` — passed; baseline identity reproduced.
3. `python artifacts/demo-prep/audit_inputs.py` — passed; complete pilot cache/run checks,
   original rules/source bytes, release/backup pins and all input hashes preserved.
4. `python scripts/platform_ops.py verify-release --release ../platform-release/artifacts/plat06/releases/real-002` — passed.
5. `python scripts/prepare_handoff.py prepare` with RELEASE_HANDOFF's recorded report/run pins,
   followed by `verify --bundle artifacts/demo-prep/baseline-handoff --manifest-sha256 511d239b2d4131be74b335d12460f4b7d34c817f7ecf5bc36c65960667435c94` — both passed.
6. `python artifacts/demo-prep/check_fallback.py` — passed; pinned release unchanged.

The two private runners and their results stay in ignored artifacts. No application changes were
made, so no broad software suite or contract regeneration was needed. Final new-data acceptance,
hosted assisted-lookup performance and a fresh-browser rehearsal remain separate gates.
