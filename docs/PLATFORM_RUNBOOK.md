# Platform launch and export runbook

## Complete local frontend/API release (PLAT-06)

The native release packages the existing frontend build, application code and read-only serving
inputs together. It runs on one loopback origin with hash-based frontend navigation and `/api/v1`.
This is the selected local launch candidate; Docker and public hosting are separate, unverified gates.
No frontend source is changed by packaging. UX runs its generator/verification before supplying a build.

Build with the default `VITE_API_BASE_URL=/api/v1` and live data mode. A production build made with
another API URL retains that URL; packaging does not rewrite JavaScript. From the frontend checkout:

```powershell
npm.cmd run generate
npm.cmd run verify
```

For a disposable build copy, preserve the published fixture/source-offset pairs while regenerating
types. Backend fixture generation on Windows can produce different line endings; do not replace a
fixture's offsets independently of its original source text. The final PLAT-06 checks use an isolated
frontend copy; no generated or authored frontend file in another lane is overwritten.

Prepare once against a quiet snapshot, using a new output each time:

```powershell
# Optional but recommended for the published 500-property scenarios:
.\.venv\Scripts\python.exe scripts/platform_ops.py cache-changes --data-dir data/reviewed-snapshot --output artifacts/change-cache-001
# Copy the reviewed snapshot into a NEW serving directory, then copy the completed cache
# into its change_cache/ directory. Keep the original snapshot and cache report unchanged.
.\.venv\Scripts\python.exe scripts/platform_ops.py prepare-release --data-dir data/serving-copy --frontend-dist frontend/dist --output artifacts/releases/release-001 --code-revision <full-code-commit>
.\.venv\Scripts\python.exe scripts/platform_ops.py verify-release --release artifacts/releases/release-001
.\.venv\Scripts\python.exe scripts/platform_ops.py serve-release --release artifacts/releases/release-001 --port 8000
```

Use `--synthetic` only for a synthetic store; its label is retained. Real bundles remain
`RESEARCH_RELEASE_NOT_VALIDATED`, with `ready_for_submission=false`. Preparing a bundle does not
establish corpus completeness. A pending `ASSEMBLY_INCOMPLETE.json` prevents packaging/launch.
The serving copy includes exact runtime JSON and semantic reviews; acquisition caches, provider
outputs and historical runs remain in the original full snapshot. Every bundled file is hashed.
The operator-supplied source commit is informational; hashes identify the actual copied bytes.

The launcher checks all hashes and file membership before starting the bundled code, disables dotenv,
provider credentials and bytecode writes, and keeps private data outside the static frontend root.
Unknown `/api` routes remain JSON errors. The HTML entry point revalidates on reload, including after
rollback. Install the bundled `runtime/requirements.lock` into Python 3.12 separately; the environment
is not bundled. Hashes detect accidental drift, not authenticity. Do not edit a running release.

Published-scenario caching avoids repeated expensive Core portfolio evaluation during the demo.
Each cache key includes all consumed prepared records, scenario selectors and evaluator code/runtime;
the stored result has an integrity hash. A stale/missing cache falls back to the existing evaluator.
Uncached portfolio requests can exceed the current frontend's 20-second timeout and should be
precomputed before rehearsal. No request populates the cache, no legal result is manufactured, and
blocked/partial results remain blocked/partial. The same cached results are usable by exports.

Check the running release through actual HTTP, answer/reset, evidence replay and repeated exports:

```powershell
.\.venv\Scripts\python.exe deploy/verify_release.py --release artifacts/releases/release-001 --url http://127.0.0.1:8000 --output artifacts/release-check-001
```

This runner uses an explicitly unverified planner probe to test answer mechanics on a real property.
It saves the probe's provenance, restores the original result, and checks release files remain unchanged.
Exports run against a separate working copy, never the immutable served data. Reports retain T1-T5
blocker notes and actual validation status. A software pass is not legal or submission acceptance.
The existing CLI returns exit 1 when the validation report contains errors, even when
`--allow-partial` successfully writes all exports. The verification runner records that exit and
requires the explicit `PARTIAL_NOT_JUDGE_READY` label; exit 2 or missing/different payloads fail.

Rollback: stop the current process, run `verify-release` against the prior saved known-good directory,
then `serve-release` with that directory on the same port. Reload the browser and check health/counts,
an ordinary lookup and a published scenario. Never overwrite the prior release with a new candidate.
For the first release, preserve a separately verified backup copy of that same code/data/assets bundle.

The October 4 snapshot has 500 addresses, 140 review-needed rules and 87 sources. Census reconciliation
retains 487 reproducible municipalities and 13 unresolved records, including the original nine.
New legal extraction remains paused. The exact release paths, checks and remaining legal/UX gates
are recorded in `docs/evidence/plat06_release.json` and the PLAT-06 card.

## Independent property evidence download and offline replay

PLAT-06 adds a property evidence package that works with any existing lookup-ready store,
including the labeled synthetic demo. It does not require the pending combined Core/geography
snapshot to verify its software behavior. Real-data acceptance remains a separate release gate.
API consumers POST the same answers/date/limits as assist, using a saved property ID, to
`/api/v1/lookup/evidence-package` and save the JSON attachment. See CONTRACTS for the exact boundary.

For a CLI check, save a request such as this in a separate artifact directory:

```json
{"address_id":"SYNTH-003","as_of":"2026-11-15","answers":[{"field":"units","value":8,"provenance":"demo"}]}
```

```powershell
.\.venv\Scripts\python.exe -m navigator --data-dir data/synthetic evidence-package --request artifacts/package-request.json --output artifacts/property-evidence.json
.\.venv\Scripts\python.exe -m navigator replay-evidence-package artifacts/property-evidence.json
```

Choose a new output file outside the input store; existing output files are preserved. Replay needs
no original store or network access, but it does need the recorded code file hashes, Python version
and dependency versions. Use the existing locked environment, and restart the API after code edits.
Exit 0 with `status=reproduced` means the complete assist response matched. Changed content, a
different runtime, or an output that cannot be reproduced returns exit 2. A package carries source
material and the selected property's facts/answers, so share it only with its intended recipient.
The package contains data only; replay never executes bundled/provider-generated code.

Synthetic inputs stay labeled. Missing source support, unavailable services, unverified answers
and bounded analysis remain visible even when replay succeeds. This is not an official competition
export or independent legal review. No provider job is resumed by either command.

PLAT-02 provides a repeatable local API and export check. It does not deploy the application.
All commands below run from the repository root. Use Python 3.12 and an explicit data directory.
The checked-in lock is the installation source; no editable/package install is needed.

## Install in a fresh environment

```powershell
python scripts/platform_ops.py bootstrap --venv .venv
```

Use `py -3.12` in place of `python` if that launcher is configured. An existing environment is
preserved: choose a different destination such as `artifacts/clean-venv` for a clean-install check.
The bootstrap creates the environment, installs `requirements.lock` from PyPI, runs `pip check`,
and records the lock hash in `<venv>/platform-install.json`. It may reuse pip's downloaded wheel
cache; it does not inherit installed packages. Installation requires network access to PyPI.
On POSIX use `<venv>/bin/python` instead of `<venv>/Scripts/python.exe` below.

## Launch an explicit snapshot

```powershell
.\.venv\Scripts\python.exe scripts/platform_ops.py serve --data-dir data/plat01-recovery --port 8000
```

This runs one Uvicorn worker on `127.0.0.1`, disables dotenv loading and removes OpenAI key/model
values from the child environment. CORS can still be supplied through `NAVIGATOR_CORS_ORIGINS`.
Stop with Ctrl+C. Startup does not ingest data, recover geography, extract rules or export artifacts.
`GET http://127.0.0.1:8000/api/v1/health` reports availability and separate dataset readiness.
A 200 health response is compatible with `absent` or `partial` data; it is not a ready-for-submission check.
Swagger is at `/docs`.

The default historical `data/` store has 479 resolved municipalities. The ignored PLAT-01 recovery
store has 491/500, with nine unresolved, zero real extracted rules and missing source text. These stores
are local artifacts, not part of Git. A fresh clone can build the labeled synthetic demo without the
participant pack; real use requires the original pack plus a reviewed pipeline snapshot. Keep real
and synthetic stores separate. Only one CLI writer may modify a store; serve a stable copy during checks.

## Reproduce smoke checks and exports

```powershell
# Fully synthetic check, works without the participant pack or any provider key:
.\.venv\Scripts\python.exe scripts/platform_ops.py smoke --output artifacts/platform-smoke-001

# Include a copied real store; original data remains unchanged:
.\.venv\Scripts\python.exe scripts/platform_ops.py smoke --output artifacts/platform-smoke-002 --real-data data/plat01-recovery
```

Each output directory must be new. The command leaves its reports, snapshots and exports intact,
including after failure. It starts temporary Uvicorn servers on OS-assigned loopback ports and stops
them afterward. It verifies absent-data 503, synthetic applies/unknown results, 404/422 failures,
explicit synthetic provenance, missing-key exit 2, and two export passes. Provider credentials are
blanked and dotenv is disabled; no geocoder or model call is made by these checks.

The real store is copied before validation and export. A full file-hash comparison verifies that the
source did not change. Do not run another writer against that source during the copy/check.
Two export passes must produce identical bytes for `rules.json`, `lookups.json`, `changes.json`,
`validation.json`, `change_details.json`, `evidence_inventory.json`, and `evidence_checks.json`.
`run_manifest.json` keeps distinct run IDs, timestamps and artifact paths; its input hashes must agree.
Both passes use the fixed default as-of date **2026-10-01**. Synthetic HTTP checks additionally use
the fixture's effective day, 2026-11-15. No new legal expectation or corpus answer set is introduced.

Read `<output>/report.json` for actual readiness and `*_exports` payload hashes. Synthetic artifacts
are labeled `SYNTHETIC_NOT_FOR_SUBMISSION`; incomplete real artifacts are `PARTIAL_NOT_JUDGE_READY`.
Exit 0 from the smoke tool means the software checks passed, not that legal extraction is complete.
CLI errors fail the check. Running against a source with synthetic rules as `--real-data` is rejected
by the existing exporter. Schema/example tests are not legal evidence.

Other checks and explicit export commands:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m navigator --data-dir data/plat01-recovery validate --output artifacts/recovery-validation.json
.\.venv\Scripts\python.exe -m navigator --data-dir data/plat01-recovery export --as-of 2026-10-01 --allow-partial --output artifacts/recovery-export-001
```

The direct export command writes run metadata into its selected store and can overwrite its output
directory; use a new output path and a private store. The smoke wrapper enforces new outputs and copies
real input automatically. The existing research-fixture pytest test regenerates random run IDs in
`contracts/research_examples`; inspect and discard only that generated noise after a test run.

## Complete frontend/API container

PLAT-08 replaces the earlier backend-only Docker candidate with a multi-stage frontend/API image.
Use [CONTAINER_RUNBOOK](CONTAINER_RUNBOOK.md) for the current commands, required source revision,
explicit empty Compose environment, pinned base images and isolated build/runtime verification.
The older PLAT-02 launch commands are superseded. The local engine is stopped; PLAT-10 runs the
full synthetic Linux build/smoke in GitHub Actions. See its recorded results before claiming runtime
acceptance. The native PLAT-06 release remains the verified local fallback.

A container check verifies software behavior and read-only local execution. It does not approve
incomplete legal evidence or establish production authentication, TLS, public hosting or submission.
Public ingress still needs its own named scope and human authorization. Keep the original source
store, frozen release and previous image/data pair for rollback.

## Private export handoff

Use [RELEASE_HANDOFF](RELEASE_HANDOFF.md) to package a previously verified partial export with exact
payloads, original manifests, method note and independently retained hashes. PLAT-09 preserves blocked
scenarios and validates the assembly identity against included serving files; it performs no legal
re-evaluation. Keep the private output separate from Git and retain the original full release/store.

## Recorded evidence

For direct Python checks on Windows, set `$env:PYTHONUTF8='1'` before launching Python.
The Platform subprocess helper and CI set this explicitly. The integrated Core benchmark reads
a UTF-8 fixture using the process default encoding; a CP1252 default fails before evaluation.
Explicit UTF-8 reads in that Core-owned benchmark remain an owner follow-up. Do not rewrite source
bytes to make an environment-specific decoder accept them.

The earlier [PLAT-02 evidence](evidence/plat02_packaging.json) remains historical installation and
native HTTP/export evidence. Current release/integrity records are [PLAT-06](evidence/plat06_release.json),
[combined integration](evidence/plat06_integration.json), [PLAT-07](evidence/plat07_integrity.json),
[PLAT-08](evidence/plat08_container.json) and [PLAT-09](evidence/plat09_handoff.json).
