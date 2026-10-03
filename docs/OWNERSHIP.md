# Ownership

Vincent coordinates Platform/API; this Codex session writes on codex/research-platform from 5ef1de1.
BOOT-01 released its bootstrap scope. Core/UX human names and checkouts are unallocated; no teammate
is claimed started or contacted. Vincent distributes the prepared lane prompts.

| Lane | Paths | Steward |
| --- | --- | --- |
| UX | `frontend/**` (reserved; not created), UX-owned future tests | UX owner / Claude Code |
| Platform | `navigator/api.py`, `service.py`, `store.py`, `config.py`, `ingest.py`, `geocode.py`, `export.py`, `cli.py`, `__main__.py`, `contracts.py` | Platform/API owner |
| Platform additions | `navigator/evidence.py`, `retrieval.py`, `semantic_review.py`, `source_inventory.py`, `fact_inputs.py`, `assist_service.py`, `research_fixtures.py`, `tests/test_evidence.py`, `test_retrieval.py`, `test_assist_api.py`, `test_research_contracts.py` | Vincent / Platform |
| Core | `navigator/extraction.py`, `predicates.py`, `engine.py`, `changes.py`, `validation.py`, `demo.py`, `fixtures/**`, `config/test_rule_selectors.json` | Core owner |
| Core additions | `navigator/core_assist.py`, `question_planner.py`, `rule_renderer.py`, `tests/test_question_planner.py`, `test_rule_renderer.py`, Core task cards | Core owner |
| Shared | `navigator/models.py`, `contracts/**`, dependency manifests/lock, `.env.example`, `.gitignore`, root instructions, README | Platform/API owner, coordinating affected consumers |
| Coordination | `docs/TASKS.md`, merge queue, `docs/PLAN.md`, handoff | Platform/API owner |
| Deployment/migrations | No deployment or database migrations yet; any future configuration requires a claim | Platform/API owner |
| Frontend shared layout/styles | Future files under `frontend/**` | UX owner |

Tests travel with the changed behavior; claim exact test files in a card. Do not concurrently write
`tests/conftest.py`. Each lane gets an isolated checkout/branch and distinct local port.
Only the board steward edits the board. Other writers update their own cards and hand off results.
Queue one reviewed change at a time, update against current main, run affected checks, then obtain
merge/deployment authority. Local validation is separate from merged/deployed verification.

COORD-01 is Platform's minimal shared-schema/fixture bootstrap; shared files remain Platform-stewarded
after its release. CORE-01 retains extraction.py and live extraction/omission repair. PLAT-05 consumes
rules to create a targeted source inventory/verifier without editing the extractor. No transfer occurred.
