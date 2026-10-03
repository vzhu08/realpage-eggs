# Ownership

Human names are not yet supplied. Role labels below are provisional; no future writer is assigned.
BOOT-01 is accountable to the user. Codex is its single implementation writer in the current checkout.
After handoff, bootstrap releases its claims for the human owners to allocate.

| Lane | Paths | Steward |
| --- | --- | --- |
| UX | `frontend/**` (reserved; not created), UX-owned future tests | UX owner / Claude Code |
| Platform | `navigator/api.py`, `service.py`, `store.py`, `config.py`, `ingest.py`, `geocode.py`, `export.py`, `cli.py`, `__main__.py`, `contracts.py` | Platform/API owner |
| Core | `navigator/extraction.py`, `predicates.py`, `engine.py`, `changes.py`, `validation.py`, `demo.py`, `fixtures/**`, `config/test_rule_selectors.json` | Core owner |
| Shared | `navigator/models.py`, `contracts/**`, dependency manifests/lock, `.env.example`, `.gitignore`, root instructions, README | Platform/API owner, coordinating affected consumers |
| Coordination | `docs/TASKS.md`, merge queue, `docs/PLAN.md`, handoff | Platform/API owner |
| Deployment/migrations | No deployment or database migrations yet; any future configuration requires a claim | Platform/API owner |
| Frontend shared layout/styles | Future files under `frontend/**` | UX owner |

Tests travel with the changed behavior; claim exact test files in a card. Do not concurrently write
`tests/conftest.py`. Each lane gets an isolated checkout/branch and distinct local port.
Only the board steward edits the board. Other writers update their own cards and hand off results.
Queue one reviewed change at a time, update against current main, run affected checks, then obtain
merge/deployment authority. Local validation is separate from merged/deployed verification.
