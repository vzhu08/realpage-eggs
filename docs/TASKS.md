# Task board and merge queue

Board steward: Platform/API owner (provisional role). Other lanes edit only their own cards.
States: Planned -> Ready -> Running -> Review -> Queued -> Merged -> Verified; Blocked names
an explicit dependency. Ready means technically ready, not a human claim or permission to start.
Four human lanes: Platform/API, Core A (Rules & Evaluation), Core B (Questions & Rendering), Frontend/UX.
Daniel's existing Core candidate is fetched at c92ad8f; Core A retains evaluator/extraction ownership.
Core B is a new human assignment and requires the existing writer's path handoff before new edits.
Only this documentation session is currently claimed here; no remote writer was interrupted or contacted.

| ID | Lane | State | Outcome / dependency |
| --- | --- | --- | --- |
| BOOT-01 | User / bootstrap | Review | Backend and integration baseline locally checked; live extraction acceptance blocked on local provider configuration |
| UX-01 | UX owner | Ready, unclaimed | Address/date/evidence UI using generated contracts and labeled fixtures |
| UX-02 | UX owner | Ready, unclaimed | Change view with definite/uncertain/blocked/hypothetical states |
| PLAT-01 | Platform/API owner | Ready, unclaimed | Evidence-based recovery of remaining 21 unresolved municipalities |
| PLAT-02 | Platform/API owner | Ready, unclaimed | Reproducible launch/export/deployment package; deployment itself awaits authority |
| CORE-01 | Core A / Daniel | Review software; live Blocked | Repairs exist on Core candidate; credentials/model still required for real extraction |
| CORE-02 | Core A / Daniel | Review candidate | Date/interaction repairs on c92ad8f; combined integration pending |
| COORD-01 | Vincent / Platform | Review P0 | Original shared contract checkpoint 3349851; historical three-lane staffing superseded |
| COORD-02 | Vincent / Platform | Review P0 | Four-developer playbook, exclusive Core split, candidate-aware cards and starters |
| PLAT-03 | Vincent / Platform | Review P0/P1 | Implemented evidence/context checks; targeted inventory verified; 12 focused tests pass |
| PLAT-04 | Vincent / Platform | Review P1 | Answers/API implemented; 17 focused tests pass; full flow depends CORE-04/05 |
| PLAT-05 | Vincent / Platform | Review P1 | Inventory/verifier implemented; fixture/replay verified; live mode blocked by key/model |
| CORE-03 | Core A / Daniel | Review candidate P0/P1 | Existing rule_traces and actual occupancy semantics; hand off stable boundary to Core B |
| CORE-04 | Core B / new human pending | Review candidate P1; handoff required | Continue existing planner; production integration depends Core A trace/evaluator candidate |
| CORE-05 | Core B / new human pending | Review candidate P1; handoff required | Continue existing renderer; review independent of live extraction |
| UX-03 | UX / Claude | Ready P1, unclaimed | Entire frontend including questions and evidence; contracts/fixtures ready |

Cards: `docs/tasks/<ID>.md`. Shared stewards and exact paths: OWNERSHIP.
Core candidate c92ad8f is awaiting coordinated review/integration; it is not marked Queued or Merged here.
Platform a034e2b and the four-developer docs also need remote publication/authorized integration.
Main already contains the earlier bootstrap and contract commits through 354089f; that does not establish deployment verification.
For each candidate: owner reviews diff/scope -> steward orders dependencies -> update clean candidate
against current main -> rerun required checks -> human-authorized merge -> verify main -> separately
verify deployed demo. Never rebase an active writer. Preserve user work and actual base SHA.

UX-01/02 are subflows of UX-03, not competing implementations. PLAT-01/02 remain ready after
evidence/API work. CORE-01 keeps extraction ownership in Core A. Core B alone owns planner/renderer and core_assist.py. Priorities: P0 correctness/configuration and
contracts; P1 bounded useful-question/evidence journey; P2 broader references, ranking and reviewed benchmarks.
