# Actual evaluation evidence

Internal software/data validation only. No official scorer or answer key was supplied; no official
score or hidden-key legal accuracy is claimed. Base commit: 0066cb3fd2378aaa35df88373ce7d48141ee056f.
Execution date: October 3, 2026. Python 3.12 virtual environment; pinned installed versions in requirements.lock.

| Check | Actual result |
| --- | --- |
| Raw ingestion | 87 manifest records; 54 original text files; 500 sample properties |
| Capture inventory | 23 link-only, 9 terms-review, 1 failed capture (D056); no fabricated snapshots |
| Integrity | All 54 delivered file hashes differ from manifest hashes; both retained and source warnings emitted |
| Census | 479 resolved legal municipalities, 21 unresolved; no failed HTTP cases in the completed run |
| OpenAI extraction attempt | Explicit provider-unavailable failure; zero real rules; no .env/key/model configured |
| Synthetic end-to-end | 1 independently authored fictional ordinance, 3 properties, exact evidence anchors, all stages executed |
| Software tests | 42 passed; one non-failing Starlette/httpx deprecation warning; pack-absent portability run: 41 passed, 1 expected skip |
| Real batch/export | All 500 IDs present, no dangling rule references; zero extracted rules, explicitly partial |
| T1–T5 | Adapter behavior passed on synthetic fixtures; actual corpus scenarios BLOCKED pending extraction/evidence |
| HTTP server | health/addresses/source/OpenAPI 200; absent real extraction 503; changes return blocked |

Counts are not legal accuracy percentages. Zero real quote/schema failures reflects **zero real rules tested**.
The synthetic export has one schema-valid, quote-valid record; no failed exact-quote checks.

Executed commands (PowerShell, repository root; `python` below is `.\.venv\Scripts\python.exe`):

```text
python -m compileall -q navigator tests
python -m navigator ingest
python -m navigator resolve --workers 6
python -m navigator extract --doc-id D001
python -m navigator evaluate --allow-partial
python -m navigator validate --output artifacts/validation.json
python -m navigator export --allow-partial
python -m navigator contracts
python -m navigator --data-dir data/synthetic demo
python -m navigator --data-dir data/synthetic changes --before 2026-11-14 --after 2026-11-15
python -m navigator --data-dir data/synthetic export --as-of 2026-11-15 --allow-partial --synthetic --output artifacts/synthetic
python -m pytest -q --junitxml=artifacts/test-results.xml
python -m uvicorn navigator.api:app --host 127.0.0.1 --port 8000
```

The first D001 attempt used the same `extract(Store(...), doc_ids=['D001'])` implementation directly;
the CLI command was also executed and returned the same explicit missing-configuration failure.
No live legal extraction occurred. The portability run set NAVIGATOR_PACK to a nonexistent directory;
all independent tests passed and the actual-pack test was correctly skipped.
The first full Census pass exposed a range parsing bug; fixed and resumed against saved responses.
The interrupted run is retained as failed, with exact finishing time unavailable, not a successful run.
Completed resume processed 149 remaining properties in 3.844 seconds with substantial cache reuse;
this is not the full uncached geocoding latency. Ingestion took 0.111 seconds. See run manifests for timings.

Source input hashes:

- Manifest: `a5e2a29265d5c29f8cb033c360fdb8d4d9604efc21774f4ed9162ee07ca40dae`.
- Sample addresses: `0a5ebe8cd9c422f5999831f668cc787da5a22f3ca78ba94cb941a801e68af95d`.
- Synthetic source: `7b69c9b441ab9fd2af38ecdf6cdf78fac7c7b909b13d18c892c8b55f91a796f5`.

Evidence files: `docs/evidence/real_validation.json`, `synthetic_validation.json`, `geocode_summary.json`,
`ingest_run.json`, `geocode_run.json`, `provider_unavailable_run.json`, `export_run.json`, `test-results.xml`.
Full raw Census replies, source snapshots, run manifests and generated outputs remain in ignored data/artifacts.
Geocode counts: LA 80, SF 72, SD 49, Berkeley 40, Jersey City 49, Hoboken 39, Newark 47, Boston 55, Cambridge 48.
These come from returned legal geography, not expected city totals.

Spot checks: A0001 resolves to Los Angeles GEOID 0644000; A0002 to Hoboken 3432250; A0003 to Newark
3451000 after ZIP omission; A0009 retains ambiguous matches. Their raw/cached identifiers are in the summary.
Synthetic ordinance manual check: the source explicitly says eight units and November 15, 2026;
12 units applies on that day, 2 units does not, missing units stays unknown. The date comparison
produces SYNTH-001 definite and SYNTH-003 uncertain. Source text is not an organizer law.

Unverified: actual model output quality, corpus omissions, legal semantic correctness, real T1–T5 sets,
T6 (not supplied), official scoring, frontend, deployed behavior and submission. Highest-value next work:
configure OpenAI, run/review D001 then the corpus, obtain consequential missing legal/status text legitimately,
review unresolved geocodes and cross-document status/interaction linking. See CORE-01, PLAT-01 and UX-01 cards.
