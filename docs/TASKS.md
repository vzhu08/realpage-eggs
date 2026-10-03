# Task board and merge queue

Board steward: Platform/API owner (provisional role). Other lanes edit only their own cards.
States: Planned -> Ready -> Running -> Review -> Queued -> Merged -> Verified; Blocked names
an explicit dependency. Ready means technically ready, not a human claim or permission to start.
No future session has a branch/checkout allocation or human assignment yet.

| ID | Lane | State | Outcome / dependency |
| --- | --- | --- | --- |
| BOOT-01 | User / bootstrap | Review | Backend and integration baseline locally checked; live extraction acceptance blocked on local provider configuration |
| UX-01 | UX owner | Ready, unclaimed | Address/date/evidence UI using generated contracts and labeled fixtures |
| UX-02 | UX owner | Ready, unclaimed | Change view with definite/uncertain/blocked/hypothetical states |
| PLAT-01 | Platform/API owner | Ready, unclaimed | Evidence-based recovery of remaining 21 unresolved municipalities |
| PLAT-02 | Platform/API owner | Ready, unclaimed | Reproducible launch/export/deployment package; deployment itself awaits authority |
| CORE-01 | Core owner | Blocked, unclaimed | First live source + corpus run/review; OPENAI_API_KEY and OPENAI_MODEL required |
| CORE-02 | Core owner | Ready, unclaimed | Independent review of temporal/interactions and extraction omissions; prioritize unresolved lifecycle linking |

Cards: `docs/tasks/<ID>.md`. Shared stewards and exact paths: OWNERSHIP.
Merge queue currently empty. Local tests do not mark BOOT-01 Merged or deployment Verified.
For each candidate: owner reviews diff/scope -> steward orders dependencies -> update clean candidate
against current main -> rerun required checks -> human-authorized merge -> verify main -> separately
verify deployed demo. Never rebase an active writer. Preserve user work and actual base SHA.
