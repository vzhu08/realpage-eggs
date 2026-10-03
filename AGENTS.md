# Shared project instructions

Read [docs/OWNERSHIP.md](docs/OWNERSHIP.md), your card under `docs/tasks/`,
[docs/CONTRACTS.md](docs/CONTRACTS.md), and [docs/TASKS.md](docs/TASKS.md).
Read the current four-developer playbook: `docs/Hackathon_Development_Playbook.txt`.
Original three-developer documents in `docs/reference/` remain historical inputs.
The user's four-developer revision supersedes their staffing/ownership instructions.

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
Core A (Rules & Evaluation) owns extraction, predicates, evaluator, traces and changes.
Core B (Questions & Rendering) owns the planner, renderer and core_assist adapter.
UX owns the entire frontend. These are four human lanes, not additional agent sessions.
See the exact file map in OWNERSHIP. Board/merge queue steward: Platform/API owner (provisional role).
BOOT-01 is checkpointed at `5ef1de1`. Follow-up coordinator: Vincent / Platform/API.
Current session claims COORD-02 (four-developer coordination) on `codex/research-platform`.
COORD-01 and PLAT-03/04/05 are in Review at the recorded checkpoints.
Read `docs/ASSIST_CONTRACT.md` and `docs/starters/` for the additive contract and lane boundaries.
Core A retains extraction/evaluator/change/validation internals and owns rule_traces.
Core B consumes that boundary and exclusively owns navigator/core_assist.py.
Existing Core candidate: origin/codex/core-backend at c92ad8f, authored by Daniel. Preserve it;
record the release of Core B paths before a new writer starts. See OWNERSHIP and the Core cards.
Platform adds separate evidence/retrieval/input services and wires routes; no extraction transfer occurred.
Use one evaluator for probes and actual answers. Source identity, quote presence, anchor validity,
semantic support and dependency gaps are separate; lexical retrieval never proves legal support.
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
