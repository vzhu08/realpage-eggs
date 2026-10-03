# Shared project instructions

Read [docs/OWNERSHIP.md](docs/OWNERSHIP.md), your card under `docs/tasks/`,
[docs/CONTRACTS.md](docs/CONTRACTS.md), and [docs/TASKS.md](docs/TASKS.md).
The original team playbook is `docs/reference/Hackathon_Development_Playbook.txt`.

1. Read these instructions, your task card, contracts, fixtures and relevant code first.
2. Verify your allocated checkout, branch, base SHA and existing changes. Preserve others' work.
3. Write only claimed paths. UX exclusively owns `frontend/**`; bootstrap supplies no frontend.
4. Follow the Pydantic models in `navigator/models.py`; regenerate `contracts/` after agreed changes.
5. Route changes outside your task scope to its human owner and the relevant steward; continue independent work.
6. One writer per file. Concurrent writers need human assignment, disjoint scope, separate branch and checkout.
   This repository does not authorize spawning additional writing agents. Serialize when isolation is unavailable.
7. Deliver the smallest complete behavior; retain exact evidence, uncertainty and date semantics.
8. Run assigned checks and report actual results. Do not claim legal accuracy from passing software tests.
9. Keep secrets in ignored `.env`; never log keys. Synthetic fixtures and partial outputs must stay labeled.
10. Local task commits are allowed. Push, merge, deploy, contact teammates/organizers and event submission require human authority.
11. Handoff includes task/status, branch/commit, changed paths, checks, decisions, limitations and next action.

Platform stewards models, API contracts, dependencies, environment configuration, persistence and exports.
Core owns extraction, predicates, evaluator and change computation. UX owns frontend and visual design.
See the exact file map in OWNERSHIP. Board/merge queue steward: Platform/API owner (provisional role).
The user is accountable for BOOT-01; current bootstrap is its only writer, on `codex/realpage-bootstrap`.
Do not switch/rebase another active writer's checkout. Use the `codex/` branch prefix.

PowerShell setup: `py -3.12 -m venv .venv`, then
`.\.venv\Scripts\python.exe -m pip install -r requirements.lock`.
Checks: `.\.venv\Scripts\python.exe -m pytest -q` and
`.\.venv\Scripts\python.exe -m navigator contracts`.
API: `.\.venv\Scripts\python.exe -m uvicorn navigator.api:app --host 127.0.0.1 --port 8000`.
Full commands, source location and data modes: README. No production authentication is implemented.

Never hard-code corpus laws, thresholds, address outcomes or change-test answer sets.
Test descriptions and schema examples are not legal evidence. Do not infer city from postal_city,
units from unexplained assessor codes, occupancy day from year_built, or enactment from a proposed date.
Never execute provider-generated code. Keep original source snapshots unchanged.
