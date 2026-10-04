# Navigator frontend

Research workspace for the Rental Housing Law Navigator API: which rental rules reach a
property on a given date, what is still unknown, and the exact source text behind each
result. React + TypeScript + Vite. **Not legal advice.**

Owned by the UX lane (`frontend/**`, cards `docs/tasks/UX-0{1,2,3}.md`). Backend, models and
`contracts/` belong to their own lanes; this app only consumes them.

## Run

Node 20.19+ (22 recommended). From `frontend/`:

```bash
npm install
npm run dev          # http://localhost:5173, live API mode
npm run dev:demo     # same app, starting in the labeled synthetic demo
```

`npm run dev` proxies `/api` to the backend at `http://127.0.0.1:8000`
(`python -m uvicorn navigator.api:app --host 127.0.0.1 --port 8000` from the repository root),
so no CORS setup is needed on any port. To point at the synthetic backend from
`docs/FRONTEND_HANDOFF.md`:

```bash
NAVIGATOR_API_ORIGIN=http://127.0.0.1:8001 npm run dev        # macOS/Linux
$env:NAVIGATOR_API_ORIGIN='http://127.0.0.1:8001'; npm run dev # PowerShell
```

The API base URL can also be changed at runtime from the status button in the header.
See `.env.example` for all settings; none are secret.

With no backend running, live mode says the service is unreachable and offers the synthetic
demo as an explicit choice. It never switches by itself.

## Checks

```bash
npm run generate:check   # generated types/schemas match contracts/
npm run typecheck        # tsc --noEmit
npm run test:unit        # node:test via tsx — contracts, adapters, replay, parsing, contrast
npm run build            # production build to dist/
npm run verify           # the four above, in order

npx playwright install chromium   # once per machine
npm run test:e2e         # complete flows at desktop and Pixel 7 widths, against the build
npm run verify:all       # verify + test:e2e
```

Backend regression (repository root, project interpreter): `python -m pytest -q`.

`SCREENSHOTS=1 npm run screenshots` regenerates `docs/screenshots/`.

## Data modes

| Mode | What it talks to | Labeling |
| --- | --- | --- |
| **Live API** (default) | The Navigator backend, through its implemented routes. A capability the backend reports as unavailable (planner, renderer, evidence) is stated as unavailable. | Dataset mode, rule evidence modes and partial-data flags come from response metadata. |
| **Synthetic demo** | Nothing. Replays checked-in contract examples and recorded backend output. | Permanent banner, a synthetic tag on every result, and the source file of each payload. |

The mode is always a visible, explicit choice (header switch, `?mode=` in the URL, or
`VITE_DATA_MODE`). A failed live request is shown as a failure; it is never answered from
synthetic data.

### What the demo replays

- `contracts/examples/*.json` — the API's own assisted-lookup example (`assist.json`: ranked
  question, interval alternatives, evidence reports, rendering, traces), the normal, empty and
  unknown lookups, and the error bodies (imported directly from the Platform-owned directory).
- `contracts/research_examples/*.json` — the five assist fixtures, each explorable from the
  property list: decisive question, irrelevant missing fact, two unresolved exemptions,
  unresolved source coverage, bounded partial analysis.
- `contracts/evidence_examples/*.json` — the missing-source-support case (a result held at
  unknown because its source text is not in the dataset) and the source comparison record.
- `src/demo/recorded/synthetic-replay.json` — verbatim backend output for the fictional Maple
  Harbor store: `assist()` responses (the function behind `POST /lookup/assist`) on four
  dates, rule detail, source text, date comparisons, and the published scenarios T1–T5
  against a store with no extracted rules (blocked). Regenerate from the repository root with
  `.venv/bin/python frontend/scripts/record_demo.py`.

The demo evaluates nothing. An answer changes a result only when the payload already holds
the evaluator's recorded output for that value: an exact recorded probe, or a number inside
an interval the planner itself declared for an alternative. Anything else is labeled "not
evaluated". A date or comparison with no recording is refused with the recorded options.

## How it is put together

```
scripts/generate-contract-types.mjs   contracts/ → src/api/generated (types, schemas, defaults)
scripts/record_demo.py                backend functions → src/demo/recorded
src/api/         generated contract types · runtime payload validation · errors
                 live.ts (HTTP) and demo.ts (replay) behind one DataSource interface
src/demo/        fixture imports and the replay rules (no evaluator)
src/state/       lookup session (answers are request-local and resent in full), hash routing
src/lib/         dates, labels, expression display, answer parsing, diffs — pure functions
src/features/    shell · property · lookup · questions · evidence · changes
src/styles/      tokens.css (design tokens), base.css, app.css
tests/unit/      node:test       tests/e2e/   Playwright
docs/UI.md       design system, state inventory, decisions, contract requests
```

Types are **generated** from `contracts/openapi.json` and `contracts/research.schema.json`
(`npm run generate`); there is no hand-maintained API schema. Every live response is
validated against those schemas before it is rendered: a missing or mistyped field is a
visible contract error, an unexpected extra field is reported as drift.

The UI contains no legal rules, thresholds or outcomes. Defaults that matter come from the
contract: the query date default (`LookupRequest.as_of`), the disclaimer, and the list of
implemented routes.

## Endpoints

| Route | Use |
| --- | --- |
| `GET /health` | Service state, dataset mode, capabilities, last extraction outcome. |
| `GET /addresses` | Property search and selection. |
| `POST /lookup/assist` | The lookup. Every accumulated answer is resent; returns the lookup, question plan, evidence reports, renderings, traces and remaining uncertainty. `capabilities` in the response decides what the UI offers. |
| `POST /lookup` | Used only when a backend has no assist route, and said so on screen; answers go as `supplemental_facts`. |
| `GET /facts` | Fact definitions (type, unit, allowed values) for supplying a fact when no question was planned. |
| `GET /rules/{id}`, `GET /rules/{id}/evidence` | Rule versions and status events; the evidence report when the lookup did not carry one. |
| `GET /sources/{id}` | Source record and text for quotes, offsets and surrounding context. |
| `POST /changes` | Date comparison and published scenarios. |
| `GET /sources/{id}/context` | Implemented by the backend; not called yet (context is cut from `GET /sources/{id}`). See `docs/UI.md`. |

Errors handled by code: 404 `unknown_id`, 422, 503 `dataset_unavailable`, 503 `core_unavailable`,
502 `core_contract_error`, plus transport, timeout and contract mismatch.
