# Platform launch and export runbook

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

## Deployment candidate for review

`deploy/Dockerfile` installs the same lock, copies only application/config/contracts/synthetic fixtures,
runs as UID/GID 10001, and launches the existing API. `.dockerignore` excludes secrets, private stores,
participant inputs, Git history and caches. `deploy/compose.yaml` requires an explicitly selected
read-only host snapshot, makes the container filesystem read-only, and publishes port 8000 to host
loopback only. No provider credentials or production authentication are configured.

Validate configuration without starting a service:

```powershell
$env:NAVIGATOR_DATA_PATH = (Resolve-Path data/plat01-recovery).Path
docker compose -f deploy/compose.yaml config --quiet
```

After deployment authority and with Docker running, the proposed local launch is:

```powershell
docker compose -f deploy/compose.yaml build
docker compose -f deploy/compose.yaml up -d
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
# Stop the service while preserving the host snapshot:
docker compose -f deploy/compose.yaml down
```

The host snapshot must be readable by container UID 10001 on Linux. The image's health check tests
HTTP liveness, not dataset completeness. The Python base image is a floating `3.12-slim` tag; after a
successful approved build, record/pin its digest and the built image ID before claiming reproducible
deployment. Python dependencies are version-pinned but the current lock does not include wheel hashes.

Public access is a separate decision: the API has no production authentication. The concrete proposal
is to keep this backend loopback-only and place a reviewed HTTPS reverse proxy with access control in
front of it on an approved host. Host/domain, authentication provider and data-publication rights have
not been selected. Do not expose port 8000 publicly by changing the binding alone. Production ingress,
TLS and authentication configuration are outside this local packaging task and require a named claim.
No new billable endpoint is introduced.

Rollback is to stop the candidate, select the prior reviewed code/image and its matching immutable
data snapshot, then repeat health and smoke checks before use. Preserve both prior exports and run
manifests. There is no known-good deployed version yet.

## Verified evidence

See [PLAT-02 evidence](evidence/plat02_packaging.json) and [task handoff](tasks/PLAT-02.md).
Windows/Python 3.12 clean installation and native HTTP/export behavior are tested. Compose syntax and
expanded settings are validated. Docker's engine was stopped during verification, so no image build,
Linux runtime, public deployment or authentication behavior is claimed. Real extraction and combined
Core/UX integration remain separate tasks.
