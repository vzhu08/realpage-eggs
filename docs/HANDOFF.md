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
