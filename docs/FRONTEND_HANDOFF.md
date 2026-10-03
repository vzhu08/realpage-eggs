# Frontend handoff

UX/Claude Code owns all frontend work. No frontend implementation is included.
Start backend from repository root with:

```powershell
.\.venv\Scripts\python.exe -m uvicorn navigator.api:app --host 127.0.0.1 --port 8000
```

Base URL `http://127.0.0.1:8000/api/v1`; Swagger `/docs`; runtime OpenAPI `/openapi.json`.
Checked-in contract: `contracts/openapi.json`. CORS allows localhost:3000 and localhost:5173 by default.
Use `NAVIGATOR_CORS_ORIGINS` for other origins. No frontend environment variable name is prescribed.

1. Address flow: list/search `/addresses`, choose an ID and explicit date, POST `/lookup`.
   Render jurisdiction method/quality separately from property missing facts. Supplemental facts
   must be labeled user-supplied and sent only in that lookup request.
2. Evidence flow: show rule requirement, evaluation result, source URL, retrieval date, quote,
   missing facts, uncertainty reasons, source detail and temporal versions. Show the query date
   and not-legal-advice disclaimer on the answer.
3. Changes flow: POST `{"test_id":"T1"}` or `{"before":"2026-10-01","after":"2027-07-02"}`.
   Keep definite and uncertain sets separate. T4 says if-enacted; show conflicts and before/after
   evidence. A blocked scenario is not a verified empty affected set.

Required states: loading, transport failure, 422 invalid request, 404 stale selection, 503 unavailable
dataset/extraction, empty search, empty valid lookup, legal unknown, source gaps, unresolved city,
partial extraction, provider failure and blocked change scenario. Never hide a partial-data banner.
Live/replay/synthetic mode labels come from metadata; synthetic fixtures require a conspicuous banner.

The real dataset currently lists 500 properties, with 479 resolved cities. It has no extracted rules
until the user configures OpenAI. Expect real lookup 503 and T1–T5 blocked. Do not invent answers.
For immediate UI integration use `contracts/examples/` or the separate synthetic data store:

```powershell
.\.venv\Scripts\python.exe -m navigator --data-dir data/synthetic demo
$env:NAVIGATOR_DATA_DIR='data/synthetic'
.\.venv\Scripts\python.exe -m uvicorn navigator.api:app --host 127.0.0.1 --port 8001
```

Synthetic date 2026-11-15: SYNTH-001 applies, SYNTH-002 empty, SYNTH-003 unknown units.
Before 2026-11-15 the covered rule is not yet effective. Restore NAVIGATOR_DATA_DIR to `data`
before running the real backend. New-address live geocoding, production auth and deployed URL are
not available. UI should not offer capabilities absent from this contract.
