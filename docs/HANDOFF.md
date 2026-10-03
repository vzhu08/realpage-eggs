# Current follow-up handoff

Planning complete; Platform implementation complete for local review; full Core/frontend integration
pending. Branch codex/research-platform; base 5ef1de1; shared contract checkpoint 3349851. Implementation
commit is the branch HEAD reported in the final chat handoff. No merge, push, deployment or submission.

| Human lane | Ownership / ready starter |
| --- | --- |
| Vincent / Platform (this session) | API, validated answers, evidence/context/review/inventory, exports and shared contracts; docs/starters/PLATFORM_API.md |
| Core developer (unclaimed) | Existing extraction/evaluator plus traces, bounded question planner and deterministic renderer; docs/starters/CORE_BACKEND.md |
| Claude / UX (unclaimed) | Entire frontend/**, design/state/tests; docs/starters/FRONTEND_CLAUDE.md |

Shared specification: docs/reference/RealPage_Codex_Research_Followup_Prompt.txt.
Contract: docs/ASSIST_CONTRACT.md, navigator/models.py, contracts/openapi.json, contracts/research.schema.json.
Fixtures: contracts/research_examples/ (five authored plans), contracts/evidence_examples/ (actual evidence,
authored renderer expectation), contracts/examples/assist.json (actual Platform response).
Tasks/claims: docs/TASKS.md, docs/OWNERSHIP.md, docs/tasks/COORD-01.md, PLAT-03/04/05.md,
CORE-03/04/05.md and UX-03.md. Ongoing shared-document steward: Platform/Vincent.

Implemented: four additive routes, strict field/type/provenance validation, ephemeral answers, current
source/quote/anchor/dependency checks before evaluator use, bounded reference retrieval and whole-snapshot
lexical search, selective source inventory, explicit bounded semantic-review CLI/cache, companion evidence
exports, honest missing Core capability responses and prepared developer prompts. No frontend/Core internals
were implemented in this lane. Independent TF-IDF and research design ideas only; no third-party code copied.

Verification: 74 passing tests, one existing dependency warning; both synthetic and real partial exports
retain valid official shapes and all address IDs. Three missing-support mutations return unknown; both
authored decisive alternatives reproduce; occupancy plus two unresolved exemptions stays unknown.
D001 inventory accounts for all 8,000 supplied characters in 15 unresolved units. Full evidence in EVALUATION.

Ready immediately: UX-03 full frontend using working calls/fixtures; Core-03 traces and Core-05 renderer,
then Core-04 planner. For integration supply navigator.core_assist.plan_questions/render_rule exactly as
ASSIST_CONTRACT specifies. No teammate was contacted or claimed started by this session.

P0 blockers: OpenAI key/model and actual reviewed extraction (zero real rules), source gaps, official
scorer/brief clarification. P1: Core planner/renderer + UX integration. P2: broader references, reviewed
12-case benchmark (0/12 reviewed), planner baseline comparison, then richer ranking/features.
Platform's injected fixture tests do not certify actual planner behavior, legal accuracy, or human review.

The original bootstrap handoff below is historical; current scope/status above takes precedence.

# BOOT-01 handoff

Status: **Review**. Backend baseline locally verified; real extraction acceptance blocked on local
OpenAI configuration. Not merged, deployed or submitted.
Branch: `codex/realpage-bootstrap`. Base: `0066cb3fd2378aaa35df88373ce7d48141ee056f`.
Checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs`.
Result commit: see the final chat handoff / branch HEAD; no commit is represented as merged.

Changed areas: `navigator/**`, `tests/**`, `fixtures/**`, `config/**`, `contracts/**`, documentation,
AGENTS/CLAUDE instructions, environment example, Python manifest/lock and Git ignores. Original inputs
remain unchanged. No frontend implementation was added.

Delivered: 6 versioned API endpoints, CLI commands for ingestion/extraction/geocoding/evaluation/changes/
validation/export, exact quote anchoring, semantic review boundary, resumable provider/Census caches,
three-valued predicates, lifecycle/date intervals, scoped interactions/conflicts, T1–T5 adapters,
all-address competition projection and explicitly synthetic integration demo. Frontend contracts/examples
and bounded task cards are ready. Explanations derive from evaluated facts, not a second model call.

Verified: 42 tests passed; actual 87-record/54-text/500-address ingestion; 479 municipalities resolved
from Census; 21 retained unresolved. API health, address search, source and OpenAPI return 200;
unavailable real lookup returns 503. Synthetic ordinance goes through the same validation/storage/
evaluation/export path. Real exports include all 500 IDs but **zero real extracted rules** and are labeled
PARTIAL_NOT_JUDGE_READY. T1–T5 software tests pass; actual legal results are blocked. See EVALUATION.

Environment: Python 3.12 virtualenv in this checkout; exact dependency versions in requirements.lock.
OpenAI Responses API selected by the user. Set OPENAI_API_KEY and OPENAI_MODEL in ignored local .env.
Neither is configured at handoff. Server startup and pipeline commands are in README. No credentials logged.

Remaining limitations: 33 absent source texts (including terms-review publishers and failed capture);
all delivered source hashes differ from manifest declarations; no official scorer/dev key; brief conflicts
about T6/videos/scoring; unresolved legal precedence/omission accuracy needs live review; local JSON store
is single-writer and not multi-file transactional; no production auth, frontend or deployment.

Next bounded tasks:

- UX owner / Claude Code: `docs/tasks/UX-01.md`, address/date/evidence UI from generated fixtures.
- Platform/API owner: `docs/tasks/PLAT-01.md`, 21 unresolved geocodes with preserved provenance.
- Core owner: `docs/tasks/CORE-01.md`, configure locally and verify first real source, then full corpus.

Urgent organizer question (prepared, not sent): which brief governs; where are scorer/key/T6 if required;
what is the source-manifest hash basis; should uncertain impacts be included in the scored affected set?
The user must authorize external messages, pushing, merging, deployment and submission.

Bootstrap releases its temporary backend/shared-file claim at this handoff. Future human names/checkouts
remain unallocated. Platform stewards contracts/models/dependencies/env/board/queue; Core stewards
extraction/evaluation; UX exclusively owns frontend. Establish each claim and isolated checkout before writing.
