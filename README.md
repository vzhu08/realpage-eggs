# RealPage Rental Housing Law Navigator

FastAPI backend and CLI for evidence-backed rule extraction, jurisdiction resolution,
three-valued coverage, date comparisons and competition-format exports. **Not legal advice.**
Frontend implementation is reserved for the UX / Claude Code owner.

## RealPage submission files

**[Download the saved three-file JSON archive (.zip)](submission/submission.zip?raw=true)**
— saved October 4, 2026; query date **2026-10-01**.

**Source-eligibility revalidation is pending.** This archive's validation report
does not record a check against the `source-use-v2` safeguards in
[PR #35](https://github.com/vzhu08/realpage-eggs/pull/35).
Supplied-corpus membership alone does not establish operative legal authority.
Regenerate from the original frozen Store with the current exporter before treating this
archive as an export validated under the current source policy.

The ZIP contains `rules.json` (174 schema-valid corpus-backed records), `lookups.json`
(all 500 supplied addresses), and `changes.json` (T1–T5). These are **partial results**:
T1/T3 are partial and T2/T4/T5 are blocked; empty affected sets do not establish no impact.
Supplemental link-only citations are excluded. See the [submission notes](submission/README.md)
and [validation report](submission/submission_report.json) for omissions, uncertainty and hashes.

## Historical bootstrap baseline

The original bootstrap ingested 87 manifest rows, 54 text files and 500 properties.
Census initially resolved 479 legal municipalities; 21 remained unresolved. That bootstrap
had not run live legal extraction, and its exports were explicitly partial with zero rules;
those historical empty arrays did not mean no laws applied. These counts are superseded by
the saved submission linked above. Configure `OPENAI_API_KEY` and `OPENAI_MODEL` in local
`.env` when running new extraction.
PLAT-01's isolated `data/plat01-recovery/` store resolves 491/500 municipalities; the original default
store and historical counts are preserved. See the [Platform runbook](docs/PLATFORM_RUNBOOK.md)
for fresh locked setup, explicit snapshot launch, offline HTTP/export checks and the deployment candidate.

## Setup

Python 3.11+ (tested with 3.12). Run from the repository root, in PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.lock
Copy-Item .env.example .env
# Set OPENAI_API_KEY and OPENAI_MODEL in .env locally.
```

The current checkout already has `.venv`. Other shells can use `.venv/bin/python`.
The lock records the installed dependency versions; no global Python changes are needed.
No package installation is required beyond the lock: `python -m navigator` works from the root.

Input directory (preserved, ignored by Git):
`MIT-hackathon-PARTICIPANT-PACK-CLEAN-NO-HOUR16/participant-final-no-hour16`.
Set `NAVIGATOR_PACK` or pass `ingest --pack PATH` if it moves. `NAVIGATOR_DATA_DIR`
selects the atomic JSON store (default `data/`); the CLI also accepts `--data-dir` before the command.

## Real-data pipeline

```powershell
.\.venv\Scripts\python.exe -m navigator ingest
.\.venv\Scripts\python.exe -m navigator resolve --workers 4
.\.venv\Scripts\python.exe -m navigator extract --doc-id D001
# After reviewing the first real result, run all captured documents (resumable):
.\.venv\Scripts\python.exe -m navigator extract
.\.venv\Scripts\python.exe -m navigator evaluate --as-of 2026-10-01
.\.venv\Scripts\python.exe -m navigator validate
.\.venv\Scripts\python.exe -m navigator export --as-of 2026-10-01 --allow-partial
```

`extract` uses the OpenAI Responses API with JSON output, runtime validation, exact quotes,
a separate semantic/omission review and one repair attempt. It is serial (bounded concurrency 1),
with up to three transport attempts per request. It caches by source/config/schema/chunk hash.
It never substitutes synthetic rules after an error. Review model-checked interpretations;
model agreement and exact quotations alone do not establish legal correctness.

`export` without `--allow-partial` refuses incomplete data. Missing corpus text means the current
pack cannot establish complete coverage. Output is `artifacts/submission/{rules,lookups,changes}.json`,
plus validation, detailed uncertain impacts, inventory and a run manifest. Synthetic exports require
`--synthetic` too. Records whose temporal status cannot be represented by the competition enum,
or whose quotes fail, are omitted and reported. All input address IDs remain present.

The original bootstrap ran ingestion/geocoding and the provider-unavailable path, and used
`--allow-partial` for batch/export. Later saved extraction/export results are documented in
the submission notes above. Legal outcomes remain unverified.

## API and checks

```powershell
.\.venv\Scripts\python.exe -m uvicorn navigator.api:app --host 127.0.0.1 --port 8000
# In another terminal:
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m navigator contracts
```

Swagger: <http://127.0.0.1:8000/docs>. Routes cover health, addresses, lookup/assist, facts,
rule detail/evidence, source detail/context and changes, all under `/api/v1`. See [frontend handoff](docs/FRONTEND_HANDOFF.md)
and generated [OpenAPI](contracts/openapi.json). CORS defaults to localhost ports 3000 and 5173;
configure `NAVIGATOR_CORS_ORIGINS` as comma-separated origins. No billable ingestion HTTP route.

Legal `unknown` is HTTP 200. Missing data/extraction is 503, unknown IDs 404, invalid requests 422.
Changes may return 200 with `status: blocked` when the dataset exists but legal evidence does not.
CLI errors return 2; failed pipeline outcomes return 1. Partial outcomes return 0 with an explicit
`outcome`, `status` or validation label: callers must inspect it. Queries default to **2026-10-01**.

## Synthetic integration demo

The independent fictional Maple Harbor ordinance exercises ingestion, the provider boundary,
validation, rule storage, lookups, effective dates, changes and exports. A deterministic fixture
stands in for the provider; this is **not a live LLM extraction or an organizer held-out test**.

```powershell
.\.venv\Scripts\python.exe -m navigator --data-dir data/synthetic demo
.\.venv\Scripts\python.exe -m navigator --data-dir data/synthetic lookup SYNTH-001 --as-of 2026-11-15
.\.venv\Scripts\python.exe -m navigator --data-dir data/synthetic lookup SYNTH-003 --as-of 2026-11-15
.\.venv\Scripts\python.exe -m navigator --data-dir data/synthetic changes --before 2026-11-14 --after 2026-11-15
.\.venv\Scripts\python.exe -m navigator --data-dir data/synthetic export --as-of 2026-11-15 --allow-partial --synthetic --output artifacts/synthetic
```

For an API demo use `NAVIGATOR_DATA_DIR=data/synthetic` and a separate server port, then restore
the real data setting afterward. `SYNTH-001` applies on the effective day; `SYNTH-002` is excluded;
`SYNTH-003` needs units. `contracts/examples/` contains their labeled responses.

## New documents and change cases

```powershell
.\.venv\Scripts\python.exe -m navigator ingest-document --file PATH.txt --doc-id NEW-001 --jurisdiction "City, ST" --url "https://official.example/document" --retrieved-at "2026-10-03T21:00:00Z"
.\.venv\Scripts\python.exe -m navigator extract --doc-id NEW-001
.\.venv\Scripts\python.exe -m navigator changes --test-id T1 --output artifacts/T1.json
.\.venv\Scripts\python.exe -m navigator changes --before 2026-10-01 --after 2027-07-02
.\.venv\Scripts\python.exe -m navigator resolve --retry-unresolved
```

Use a new document ID for an amended snapshot. T1–T5 selectors only map identifiers to extracted
citations/jurisdictions/categories; no address sets or legal thresholds are encoded. T4 is explicitly
hypothetical and never mutates stored law. Definite and uncertain change sets remain separate;
the required export includes definite IDs only, pending organizer clarification.

Run manifests, source hashes, raw provider outputs, usage and Census responses are in ignored `data/`.
Generated exports are ignored in `artifacts/`; curated bootstrap evidence is in `docs/evidence/`.
One CLI writer per data directory; the read-only API sees atomic files. There is no multi-file transaction,
so restart/reload consumers after a completed pipeline and do not run two writers against one store.

Planning deadline assumption: October 4, 2026, 09:00 America/New_York.
See [evaluation](docs/EVALUATION.md), [decisions](docs/DECISIONS.md), [tasks](docs/TASKS.md),
and [handoff](docs/HANDOFF.md) for evidence, missing inputs, ownership and next work.

## Follow-up / frontend start

The entire frontend belongs to Claude/UX: [starter prompt](docs/starters/FRONTEND_CLAUDE.md).
Use the [four-developer playbook](docs/Hackathon_Development_Playbook.txt) and separate checkouts:
[Core A — Rules & Evaluation](docs/starters/CORE_RULES.md) owns extraction/evaluator/traces;
[Core B — Questions & Rendering](docs/starters/CORE_NAVIGATION.md) owns planner/renderer.
Platform/Vincent owns API/evidence and shared contracts. Daniel's Core implementation already exists
on candidate origin/codex/core-backend at c92ad8f; hand it off and continue it rather than rebuilding.
See [current handoff](docs/HANDOFF.md), [assist contract](docs/ASSIST_CONTRACT.md) and generated OpenAPI.

```powershell
.\.venv\Scripts\python.exe -m navigator source-inventory D001 --output artifacts/D001-inventory.json
.\.venv\Scripts\python.exe -m navigator review-rule YOUR_EXTRACTED_RULE_ID --output artifacts/semantic-review.json
```

Review is explicit and may call the configured OpenAI API; an existing exact-version review replays
without a call. Replay requires matching verifier version, provider mode and the selected model;
a fixture cache cannot stand in for a CLI live review. An existing live cache can replay offline
when no model is configured, and partial decisions remain partial in the replay manifest.
--refresh requests a fresh review. No model calls occur on lookup/evidence HTTP routes.
GET /api/v1/facts defines accepted supplemental inputs. POST /api/v1/lookup/assist accepts typed,
request-local answers and reports missing Core capabilities explicitly. The full suite has 74 passing
tests at a034e2b; live legal extraction and combined Core/UX integration remain unverified.
The Git upstream was repaired to origin/main and pulled locally; remote feature branches may be deleted
after merge. See HANDOFF for actual commits and the existing Core candidate.
