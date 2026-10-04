# Four-developer ownership

The user's October 3 revision creates four human lanes. This map and the current
[playbook](Hackathon_Development_Playbook.txt) supersede the three-lane staffing in docs/reference/.
Vincent coordinates Platform/API. Daniel is the existing Core author, identified in the fetched Core
handoff. Core B's new human name/checkout and UX's actual checkout remain unallocated. No teammate was
contacted or any active remote checkout modified by this coordination pass.

| Developer lane | Deliverable | Tasks / starter |
| --- | --- | --- |
| Platform/API — Vincent | Contracts, APIs, validated answers, source services, exports and integration | PLAT-*; [starter](starters/PLATFORM_API.md) |
| Core A — Rules & Evaluation; existing Core author Daniel | Extraction, evaluator correctness, dates/interactions and predicate traces | CORE-01/02/03; [starter](starters/CORE_RULES.md) |
| Core B — Questions & Rendering; new human pending | Question planning, alternatives/ranking/budgets and deterministic rendering | CORE-04/05; [starter](starters/CORE_NAVIGATION.md) |
| Frontend/UX — Claude Code teammate | Entire frontend, question history, evidence, changes and visual design | UX-03 with UX-01/02 subflows; [starter](starters/FRONTEND_CLAUDE.md) |

## Existing work and handoff

Main integration base is 9a96fda (PLAT-01 / PR #5), including Platform implementation a034e2b and
the four-developer coordination. PLAT-02 at aa7a226 is published separately as PR #6 and is not
part of Daniel's PR #3 merge. Current local integration branch: codex/core-integration.

The user authorized merging Daniel's PR #3 and resolving its documentation conflicts. Imported
head 3cf0361 contains Core-01/02/03/04/05 and reported live D001/D004 evidence. The local combined
candidate passes 167 tests, including actual Core/API probes; see docs/tasks/COORD-03.md and
docs/evidence/core_integration.json. No new local provider run or independent legal review is claimed.
Core runtime/tests and docs/core/** are preserved from Daniel's exact head; five task cards combine
the current ownership headers with his complete author records. Do not rebuild these features.

The existing Core branch is a review/handoff source for both new Core lanes. Before another writer starts,
Vincent records Daniel's release of planner/renderer files, the new Core B human/session, and the agreed
starting commit in the task cards. This user-authorized split changes future ownership; it does not stop,
rebase, message or move Daniel's session. Preserve existing candidate commits and evidence. Avoid splitting
its interdependent historical commits arbitrarily; review the existing candidate, then continue on disjoint paths.

## Exclusive file ownership after handoff

All paths are repository-relative. Listed basenames in each navigator/ or tests/ row mean that directory.

| Owner | Exclusive paths |
| --- | --- |
| Platform runtime | navigator/api.py, service.py, store.py, config.py, ingest.py, geocode.py, export.py, cli.py, __main__.py, contracts.py, evidence.py, retrieval.py, semantic_review.py, source_inventory.py, fact_inputs.py, assist_service.py, research_fixtures.py |
| Platform tests | tests/test_api_exports.py, test_geocode.py, test_evidence.py, test_retrieval.py, test_assist_api.py, test_research_contracts.py; steward of shared tests/conftest.py |
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

## Working boundary and sequence

ASSIST_CONTRACT records the existing candidate's rule_traces boundary and plan_questions/render_rule
exports. There is one Expression AST and one evaluate_rules. Core A owns truth, residual/relevance and
legal date/interaction semantics; Core B owns materiality, correlated probing, ranking and readable rendering.

Core A can review extraction/date/trace work and prepare a real D001 run when credentials arrive.
Core B can read/review the existing renderer and planner immediately, then write after the ownership handoff.
Renderer work is independent of live extraction. Planner integration depends on Core A's trace/evaluator
candidate, not on completing corpus extraction. UI work can use current Platform routes and labeled fixtures.
Platform has checked the combined candidate and refreshed actual API examples; schemas are unchanged.
Future shared-contract changes still require actual integration checks.

Each human gets a separate clone or allocated branch/worktree and private mutable data/cache directory.
Existing Core checkout (reported): /Users/danny/Documents/ChatGPT/RealPage/core-backend, codex/core-backend;
never repurpose it for Core B. Suggested new branches: codex/core-a-rules, codex/core-b-navigation,
codex/frontend. They are proposals, not claims that checkouts exist. Use one agreed reviewed base that
contains the needed Platform/Core work; until then a candidate checkout must remain labeled unintegrated.
Suggested ports: Platform 8000, Core A 8002, Core B 8003, frontend 5173 or 3000. Record the chosen API URL.
Read-only corpus inputs may be shared; two writers must not share NAVIGATOR_DATA_DIR or mutable caches.

Vincent records actual human/session/base/absolute checkout and path claims. Only the board steward
edits TASKS. During implementation each lane updates its own cards/notes; shared changes go through the
steward. This user-authorized coordination pass updates all affected cards. Queue dependency-ordered
changes, check combined code, then use human-authorized merges/deployment. Never switch/rebase an active writer.
