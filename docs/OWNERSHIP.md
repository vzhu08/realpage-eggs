# Four-developer ownership

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
