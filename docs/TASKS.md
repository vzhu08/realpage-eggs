# Task board and merge queue

Board steward: Platform/API owner (provisional role). Other lanes edit only their own cards.
States: Planned -> Ready -> Running -> Review -> Queued -> Merged -> Verified; Blocked names
an explicit dependency. Ready means technically ready, not a human claim or permission to start.
Only the current Platform follow-up session is allocated. Core/UX are ready for Vincent to assign,
not claimed started. Ready is not a claim or permission to write in another developer's checkout.

| ID | Lane | State | Outcome / dependency |
| --- | --- | --- | --- |
| BOOT-01 | User / bootstrap | Review | Backend and integration baseline locally checked; live extraction acceptance blocked on local provider configuration |
| UX-01 | UX owner | Ready, unclaimed | Address/date/evidence UI using generated contracts and labeled fixtures |
| UX-02 | UX owner | Ready, unclaimed | Change view with definite/uncertain/blocked/hypothetical states |
| PLAT-01 | Platform/API owner | Ready, unclaimed | Evidence-based recovery of remaining 21 unresolved municipalities |
| PLAT-02 | Platform/API owner | Ready, unclaimed | Reproducible launch/export/deployment package; deployment itself awaits authority |
| CORE-01 | Core owner | Blocked, unclaimed | First live source + corpus run/review; OPENAI_API_KEY and OPENAI_MODEL required |
| CORE-02 | Core owner | Ready, unclaimed | Independent review of temporal/interactions and extraction omissions; prioritize unresolved lifecycle linking |
| COORD-01 | Vincent / Platform | Review P0 | Shared contracts/5 fixtures/starter prompts released; 2 contract checks passed |
| PLAT-03 | Vincent / Platform | Running P0/P1 | Evidence identity/quote/anchor distinctions and bounded context/reference retrieval |
| PLAT-04 | Vincent / Platform | Ready P1 | Validated answers and assist API; full flow depends CORE-04/05 |
| PLAT-05 | Vincent / Platform | Ready P1 | Targeted source-unit inventory and semantic verifier; live mode blocked by key/model |
| CORE-03 | Core owner | Ready P0/P1, unclaimed | Stable trace/residual AST; factual occupancy-date semantics review |
| CORE-04 | Core owner | Planned P1, unclaimed | Bounded correlated-fact question planner; depends CORE-03 |
| CORE-05 | Core owner | Ready P1, unclaimed | Deterministic rule renderer; independent of planner |
| UX-03 | UX / Claude | Ready P1, unclaimed | Entire frontend including questions and evidence; contracts/fixtures ready |

Cards: `docs/tasks/<ID>.md`. Shared stewards and exact paths: OWNERSHIP.
Merge queue currently empty. Local tests do not mark BOOT-01 Merged or deployment Verified.
For each candidate: owner reviews diff/scope -> steward orders dependencies -> update clean candidate
against current main -> rerun required checks -> human-authorized merge -> verify main -> separately
verify deployed demo. Never rebase an active writer. Preserve user work and actual base SHA.

UX-01/02 are subflows of UX-03, not competing implementations. PLAT-01/02 remain ready after
evidence/API work. CORE-01 keeps extraction ownership. Priorities: P0 correctness/configuration and
contracts; P1 bounded useful-question/evidence journey; P2 broader references, ranking and reviewed benchmarks.
