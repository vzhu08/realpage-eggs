# Task board and merge queue

Board steward: Platform/API owner (provisional role). Other lanes edit only their own cards.
States: Planned -> Ready -> Running -> Review -> Queued -> Merged -> Verified; Blocked names
an explicit dependency. Ready means technically ready, not a human claim or permission to start.
Four human lanes: Platform/API, Core A (Rules & Evaluation), Core B (Questions & Rendering), Frontend/UX.
Daniel's PR #3 is merged at 3b1ef06; Core A retains evaluator/extraction ownership.
Core B is a new human assignment and requires the existing writer's path handoff before new edits.
PLAT-02 PR #6 is merged at `e0cd133`. The current user-assigned Platform session is resolving
the task-board conflict and checking PLAT-03 PR #7 against that main for its authorized merge.
PLAT-03's contracts and baseline code are already available; no new Core/UX code is required.

| ID | Lane | State | Outcome / dependency |
| --- | --- | --- | --- |
| BOOT-01 | User / bootstrap | Review | Backend and integration baseline locally checked; live extraction acceptance blocked on local provider configuration |
| UX-01 | UX owner | Ready, unclaimed | Address/date/evidence UI using generated contracts and labeled fixtures |
| UX-02 | UX owner | Ready, unclaimed | Change view with definite/uncertain/blocked/hypothetical states |
| PLAT-01 | Vincent / Platform | Merged | PR #5 at 9a96fda; recovered 12/21: 491/500 in isolated store; 28 focused / 96 total tests pass; no deployment |
| PLAT-02 | Vincent / Platform | Merged | PR #6 at e0cd133; fresh lock install, native HTTP and both export replays pass; Compose validated; Docker image/runtime unverified |
| CORE-01 | Core A / Daniel | Merged software; corpus incomplete | PR #3 includes reported D001/D004 live slices and bounded resumption repairs; no local provider rerun |
| CORE-02 | Core A / Daniel | Merged | Date/interaction implementation combined with Platform; 167 total tests pass |
| COORD-01 | Vincent / Platform | Review P0 | Original shared contract checkpoint 3349851; historical three-lane staffing superseded |
| COORD-02 | Vincent / Platform | Review P0 | Four-developer playbook, exclusive Core split, candidate-aware cards and starters |
| COORD-03 | Vincent / Platform | Merged | PR #3 doc conflicts resolved with author history retained; actual Core/API verification and unchanged schemas |
| PLAT-03 | Vincent / Platform | Queued P0/P1 | PR #7 preserves exact anchors under small budgets; 21 focused / 176 full tests pass; user authorized conflict resolution and merge |
| PLAT-04 | Vincent / Platform | Review P1 | Actual Core/API integration passes 19 focused tests; synthetic alternatives and answers reproduce through HTTP |
| PLAT-05 | Vincent / Platform | Review P1 | Inventory/verifier implemented; fixture/replay verified; live mode blocked by key/model |
| CORE-03 | Core A / Daniel | Merged | rule_traces and actual occupancy semantics verified in combined suite; future lane handoff remains required |
| CORE-04 | Core B / new human pending | Merged; future writer handoff required | Daniel's planner works through Platform HTTP; no new writer allocated |
| CORE-05 | Core B / new human pending | Merged; future writer handoff required | Daniel's renderer works through Platform HTTP; no new writer allocated |
| UX-03 | UX / Claude | Ready P1, unclaimed | Entire frontend including questions and evidence; contracts/fixtures ready |

Cards: `docs/tasks/<ID>.md`. Shared stewards and exact paths: OWNERSHIP.
PR #3 merged as 3b1ef06 after user-authorized conflict resolution 5eefae0; COORD-03 records exact checks.
Main already contains Platform and four-developer docs through PR #4 and PLAT-01 through PR #5 at 9a96fda.
PLAT-02 merged through PR #6 at e0cd133. PLAT-03 PR #7 is updated against that main. No deployment is verified.
For each candidate: owner reviews diff/scope -> steward orders dependencies -> update clean candidate
against current main -> rerun required checks -> human-authorized merge -> verify main -> separately
verify deployed demo. Never rebase an active writer. Preserve user work and actual base SHA.

UX-01/02 are subflows of UX-03, not competing implementations. PLAT-01 is merged;
PLAT-02 is merged through PR #6. CORE-01 keeps extraction ownership in Core A. Core B alone owns planner/renderer and core_assist.py. Priorities: P0 correctness/configuration and
contracts; P1 bounded useful-question/evidence journey; P2 broader references, ranking and reviewed benchmarks.
