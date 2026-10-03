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
| **Live API** (default) | The Navigator backend. Uses the implemented routes; probes the planned assist/evidence routes and says so when they are absent. | Dataset mode, rule evidence modes and partial-data flags come from response metadata. |
| **Synthetic demo** | Nothing. Replays checked-in contract examples and recorded backend output. | Permanent banner, a synthetic tag on every result, and the source file of each payload. |

The mode is always a visible, explicit choice (header switch, `?mode=` in the URL, or
`VITE_DATA_MODE`). A failed live request is shown as a failure; it is never answered from
synthetic data.

### What the demo replays

- `contracts/examples/*.json` — normal, empty, unknown lookups and error bodies (imported
  directly from the Platform-owned directory).
- `contracts/research_examples/*.json` — the five assist fixtures, each explorable from the
  property list: decisive question, irrelevant missing fact, two unresolved exemptions,
  unresolved source coverage, bounded partial analysis.
- `src/demo/recorded/synthetic-replay.json` — verbatim backend output for the fictional Maple
  Harbor store: lookups on four dates, rule detail, source text, date comparisons, and the
  published scenarios T1–T5 against a store with no extracted rules (blocked). Regenerate
  from the repository root with `.venv/bin/python frontend/scripts/record_demo.py`.

The demo evaluates nothing. An answer changes a result only when the fixture already holds
the evaluator's recorded output for exactly that value; anything else is labeled "not
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

| Route | Status at this contract | Use |
| --- | --- | --- |
| `GET /health`, `GET /addresses`, `POST /lookup`, `GET /rules/{id}`, `GET /sources/{id}`, `POST /changes` | Implemented | Used directly. |
| `POST /lookup/assist` | Planned (`docs/ASSIST_CONTRACT.md`) | Tried first; on a missing route the app says the planner is unavailable and uses `POST /lookup` with request-local `supplemental_facts`. |
| `GET /rules/{id}/evidence` | Planned | Tried; when missing, the six evidence checks show "not checked by the service". |
| `GET /sources/{id}/context`, `GET /facts` | Planned, request/response shape not yet specified | Not called. Context is shown from `GET /sources/{id}`. |
