# Four-developer ownership

## Final scope and board claim — October 4, 06:10 ET

The user confirms Daniel leads the demo/frontend redesign and requests a task-board update for
less than two hours of remaining coding. [FINAL-01](tasks/FINAL-01.md) and the top of TASKS control
current scope. Daniel coordinates the existing sole frontend writer; this does not add a second
simultaneous frontend writer. Oliver retains Core B paths. Vincent's active Platform session retains
runtime, dataset, deployment, release and existing card/runbook claims. Core A retains semantic fixes.

Documentation session `01a10660-7e93-7790-83ef-277a6ccd63f1` is the sole writer for this update of
`docs/TASKS.md`, `docs/PLAN.md`, `docs/OWNERSHIP.md`, `docs/starters/PLATFORM_API.md` and new
`docs/tasks/FINAL-01.md`, in isolated checkout
`C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/final-product-scope`, branch
`codex/final-product-scope`, clean base `4e994b0a577399e77d771af5a95960707f1de3cb` (PR #31).
Other cards, runtime files, stores and active checkouts remain with their writers. This claim ends
when integrated. Preserve these narrowed assignments during subsequent board/status merges.

## PLAT-13/14/15 integration claim — October 4

User-assigned session `01a1061b-41fb-7180-9973-b0937d2f95c9` is the sole writer in
`artifacts/platform-core-integration`, branch `codex/platform-core-integration`, base
`ebda27644ca9b1434f4a58c65943dccec25502ed` (Core PRs #28 and #29 merged).
Scope: Platform fact registry, focused input/API tests, contracts, existing assembly/release
helpers if needed, hosted verification, Platform cards/board/runbooks and new evidence.
Original stores and other checkouts remain read-only. Core Draft overlays retain separate
authorship and are not relabeled as automated extraction. User runs paid extraction separately.

## Active demo preparation — October 4

Session `01a1060f-0c12-7a41-a29e-c2de9377f99f` claims PLAT-13/14 preparation on
`codex/platform-demo-prep`, base `e7662374d5b8ad7f98401aae9c1fc5192e32a583`, in
`C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/platform-demo-prep` (clean at claim).
Root is the sole writer of its PLAT-13/14 cards, TASKS/OWNERSHIP, new DEMO_PREPARATION runbook,
`docs/evidence/plat13_14_preparation.json` and ignored `artifacts/demo-prep/` outputs.
RENDER-01 / "Check Required Infrastructure" keeps all its deployment implementation,
runbook, workflow, test and dashboard claims on `codex/render-setup`; no overlap is assigned.
Core A/B and UX retain their existing scopes. Full paid extraction stays paused.

## Current Platform delegation — October 4

The user explicitly authorized parallel Platform agents and pushing/merging completed tasks.
This bounded exception supersedes the earlier no-extra-writers instruction for the Platform lane.
Core A, Core B and UX ownership remain unchanged. Root owns integration, shared docs and the board.

| Platform work | Writer | Isolated branch / checkout suffix | Exclusive scope |
| --- | --- | --- | --- |
| PLAT-06 integration | Root | `codex/platform-release` / `artifacts/platform-release` | Existing Platform API/cache, contracts and shared coordination docs |
| PLAT-07 integrity | Evidence agent | `codex/platform-evidence-integrity` / `artifacts/platform-evidence-integrity` | Evidence package, assembler and their tests; PLAT-07 card/evidence |
| PLAT-08 container | Deployment agent | `codex/platform-container` / `artifacts/platform-container` | Dockerfile, Compose, dockerignore, container verifier/test/runbook; PLAT-08 card/evidence |
| PLAT-09 handoff | Handoff agent | `codex/platform-handoff` / `artifacts/platform-handoff` | Handoff packager/test/method/runbook; PLAT-09 card/evidence |
| PLAT-10 CI | Root | `codex/platform-ci` / `artifacts/platform-ci` | `.github/workflows/platform.yml`; PLAT-10 card/evidence |
| PLAT-11 source acquisition | Root (only writer; agents read-only) | `codex/platform-source-acquisition` / reused clean `artifacts/platform-ci`, base `445102a` | `docs/platform_sources/**`, PLAT-11 card and shared Platform board/ownership/PLAT-06 status correction |
| PLAT-12 source follow-up/manual pilot | Root (only writer; agents read-only) | `codex/platform-source-closeout` / `artifacts/platform-ci`, base `9ff4396` | `docs/platform_sources/2026-10-04-followup/**`, `docs/EXTRACTION_PILOT.md`, `scripts/extraction_pilot.py`, `tests/test_extraction_pilot.py`, PLAT-12 card and shared docs |
| PLAT-12 completed-pilot handoff | Root (sole writer; read-only review) | `codex/platform-pilot-handoff` / `artifacts/platform-ci`, base `7eef8b2` | `docs/CORE_NEXT_STEPS.md`, `docs/platform_pilots/2026-10-04-d069/**`, pilot runbook/card, shared board/ownership; user-requested coordination pointers only in CORE-06 and CORE_A_HANDOFF |

## Next Platform demo assignments

PLAT-13/14/15/16 are assigned to Vincent for the user's next chat; execution claims are not
allocated yet. Their cards define scope and dependencies. Existing PR #22 / RENDER-01 keeps its
writer and checkout until reviewed/released; the new session must coordinate before overlapping
its deployment files. Core A/B and UX path ownership remains unchanged.

This board update is root-only documentation work on `codex/platform-demo-board`, clean tracked
checkout `artifacts/platform-ci`, base `fec517db973f102c7623a22947b57eb644b2aaa5`.
Claims: docs/TASKS.md, PLAN.md, OWNERSHIP.md, DATA_SOURCE_RULES.md,
starter PLATFORM_API.md and new PLAT-13 through PLAT-16 cards. Read-only helper checks the
participant rules. No runtime, source snapshot, provider run or deployment change is claimed.

Full claimed paths and base commits are in each task card. Agents commit locally; root reviews and
publishes. Shared files remain single-writer. This exception does not resume paid extraction or
authorize public deployment, submission or teammate messages. Earlier assignments below are historical.

Current assignments: October 3, 2026 readiness follow-up, authorized by the user.
These four existing lanes continue; no additional writing agents or remote sessions were started.
The user grants the current COORD-04 session a bounded cross-lane exception for the two audit
fixes and assignment docs. Normal one-writer coordination remains for the new feature work.

| Lane | Recorded owner | Next card | Reported checkout (verify before writing) |
| --- | --- | --- | --- |
| Platform/API | Vincent | [PLAT-06](tasks/PLAT-06.md), after active PLAT-05 | `C:\Users\vzhu0\PycharmProjects\realpage-eggs` |
| Core A: Rules & Evaluation | Daniel | [CORE-06](tasks/CORE-06.md) | `/Users/danny/Documents/ChatGPT/RealPage/core-backend` |
| Core B: Questions & Rendering | Oliver | [CORE-07](tasks/CORE-07.md) | `/Users/oliverchen/Documents/random shi/realpage-eggs-core` |
| Frontend/UX | Existing Claude lane; Oliver is recorded human coordinator | [UX-04](tasks/UX-04.md) | `/Users/oliverchen/Documents/random shi/realpage-eggs` |

Core B and UX are distinct development lanes/checkouts even though Oliver coordinated both prior
handoffs. A fourth person's name has not been established; do not invent one. Confirm each current
writer before editing its checkout. Suggested branch names in the cards are not existing claims.

## Current integration and handoff

Reviewed main `3b2d201` includes Core A PR #8 (`0ccaa1a`) and Core B/frontend PR #9.
Daniel explicitly releases future Core B paths in `docs/core_rules/CORE_A_HANDOFF.md`;
Oliver's work and Claude's frontend are already integrated. Preserve their implementation and history.
The Core corpus remains partial and explicitly paused; source/model review is not independent legal review.
Local PLAT-04 continuation `11afb55` still needs reconciliation. PLAT-05 is active separately on
`codex/platform-review`; preserve its working changes and current card when integrating these docs.

COORD-04 uses branch `codex/readiness-fixes-and-plan`, base `3b2d201`, checkout
`C:\Users\vzhu0\PycharmProjects\realpage-eggs\artifacts\readiness-fixes-and-plan`.
Its temporary override covers models, the generator, relevant tests and coordination docs only.
No change to another active checkout, remote branch, data store or provider job is implied.

## Exclusive file ownership after handoff

All paths are repository-relative. Listed basenames in each navigator/ or tests/ row mean that directory.

| Owner | Exclusive paths |
| --- | --- |
| Platform runtime | navigator/api.py, service.py, store.py, config.py, ingest.py, geocode.py, export.py, cli.py, __main__.py, contracts.py, evidence.py, retrieval.py, semantic_review.py, source_inventory.py, fact_inputs.py, assist_service.py, research_fixtures.py |
| Platform tests | tests/test_api_exports.py, test_geocode.py, test_evidence.py, test_retrieval.py, test_assist_api.py, test_research_contracts.py, test_numeric_contracts.py; steward of shared tests/conftest.py |
| Core A runtime/data | navigator/extraction.py, predicates.py, engine.py, changes.py, validation.py, demo.py; fixtures/**; config/test_rule_selectors.json |
| Core A tests/notes | tests/test_extraction.py, test_engine.py, test_change_adapters.py; optional new tests/test_traces.py; tests/fixtures/change_tests.json; docs/core_rules/**; CORE-01/02/03 cards |
| Core B runtime | navigator/question_planner.py, rule_renderer.py, core_assist.py |
| Core B tests/notes | tests/test_question_planner.py, test_rule_renderer.py; tests/fixtures/core_navigation/**; docs/core_navigation/**; CORE-04/05 cards |
| Frontend/UX | frontend/**, including its dependencies, styles, state, tests and UI docs; UX cards |
| Platform shared stewardship | navigator/models.py, contracts/**, root manifests/lock/env/ignore/instructions/README; shared docs, evidence summaries, board, playbook, plan, handoff, starters and merge queue |

Preserve docs/core/** as the imported historical Core candidate evidence; new lane notes use the separate
folders above. Platform coordinates any update to the shared historical verification runner. No two Core
writers edit the same evaluator, adapter or test file. Only Core B writes core_assist.py.
Core B requests engine/trace changes from Core A; Core A requests planner/renderer changes from Core B.
Both route model, registry, generated fixture, route and shared-document changes through Platform.
Core A owns validation.py, but official projection changes need Platform contract coordination.
Any ingest.py occupancy/fact change is Platform-owned even when discovered by Core A.
New deployment/migration paths require a named claim; deployment requires separate authority.

## Additions claimed for the next cards

| Owner/card | Additional paths |
| --- | --- |
| Platform / PLAT-06 | `scripts/assemble_snapshot.py`, `navigator/evidence_package.py`, `tests/test_snapshot_assembly.py`, `tests/test_evidence_package.py`, `deploy/**`, `scripts/platform_ops.py`; shared model/API/contract changes remain Platform-only |
| Core A / CORE-06 | `navigator/source_comparison.py`, `tests/test_source_comparison.py`; new notes/evidence under `docs/core_rules/**` |
| Core B / CORE-07 | Existing planner/renderer/adapter and tests; new benchmark notes/runner under `docs/core_navigation/**` |
| UX / UX-04 | Entire `frontend/**`, including generator/tests after COORD-04 is accepted |

These paths scope the assignments; absent files are planned deliverables, not implemented capabilities.
Only the board steward edits TASKS during lane implementation. Each lane maintains its own cards.

## Shared boundary and working order

Keep one Expression AST, one `evaluate_rules`, and the existing `rule_traces` producer contract.
Core A determines truth, dates, interactions and source-comparison semantics. Core B turns those
outputs into questions, explanations and remedies. Platform defines and wires shared contracts,
assembles source/geography snapshots and exports. UX renders the results without adding legal logic.

PLAT-06 releases the minimum additive disagreement/change/evidence-package contract before new
production consumers depend on it. All lanes can continue work using current interfaces meanwhile.
Do not rename an existing service or create a second AST/evaluator to avoid this dependency.

Use a separate checkout/branch and private mutable data/cache directory per active writer.
Record the actual human/session/base/absolute checkout before starting the new card. Do not switch
or rebase another writer. Core A's saved store and Platform's geography store stay immutable inputs
when PLAT-06 creates a combined snapshot. Request external-source capture from Platform.

Read [PLAN](PLAN.md) for priorities and gates. A new assignment does not restart stopped extraction,
contact teammates, publish work or deploy. Preserve exact source evidence, uncertainty and dates.
