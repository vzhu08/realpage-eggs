# CORE-04 — P1 bounded useful-question planner

## Current four-developer assignment (supersedes historical claims below)

- Lane / future owner: Core B / Questions & Rendering. New human/name/session/checkout unallocated; Daniel authored the existing candidate. Vincent records path release before another writer starts.
- State: Review for existing candidate; new writer handoff/allocation required.
- Read first: AGENTS, current four-developer playbook, OWNERSHIP, ASSIST_CONTRACT, existing candidate handoff.
- Existing candidate: origin/codex/core-backend at c92ad8f; tested candidate reported as 0c32ec4.
  Existing author checkout: /Users/danny/Documents/ChatGPT/RealPage/core-backend. Preserve it and its commits.
- Future branch/absolute checkout/base/result commit: record at handoff; do not assume current main includes this candidate.
- Exclusive allowed paths for this task: navigator/question_planner.py, core_assist.py; tests/test_question_planner.py; tests/fixtures/core_navigation/**; docs/core_navigation/**; this card.
- Reserved: the other Core lane's runtime/tests/cards, frontend, Platform APIs/services, models/contracts,
  dependencies, tests/conftest.py and shared docs/board. Core B exclusively owns core_assist.py.
- Dependency: Existing shared models; planner consumes Core A rule_traces/evaluate_rules. Renderer has no live extraction dependency.
- Next bounded action: Inspect existing planner and its synthetic comparison now; after path release, review/repair in a separate checkout and integrate against Core A traces and Platform API.
- Checks (checkout Python): python -m pytest tests/test_question_planner.py -q; rerun the fixed synthetic comparison with exact denominators.
- Acceptance: retain the task's behavioral acceptance below; preserve one evaluator and evidence uncertainty.
  Platform must test actual combined HTTP/exports before marking integration verified.
- Non-goals: rewriting delivered features, changing another owner's files, model-authored legal certainty.
- Handoff: actual commit, paths, exact checks/results, remaining dependencies and whether combined integration ran.
- Authority: local task commits; no push, merge, deployment, external messages or new agents implied.

## Current Core B assignment — 2026-10-03

This claim supersedes the unallocated status above for this isolated continuation.
Oliver explicitly assigned this session to complete Core B while Claude owns the frontend.
No claim is made that Vincent or Daniel separately recorded a release. Daniel's candidate
and original author record below are preserved; his active checkout is untouched.

- Human: Oliver. Sole writing agent: Codex /root, session `01a103bd-84d1-7c50-bd19-1fe9267bc139`.
- Branch: `codex/core-b-navigation`.
- Checkout: `/Users/oliverchen/Documents/random shi/realpage-eggs-core`.
- Review base: local `1d34fad`, combining Core candidate `3cf0361` with Platform main `9a96fda`.
- Scope: only the Core B paths listed above and `docs/core_navigation/**`.
- Mutable data: temporary test directories; reserve ignored `data/core-b-session` if needed.
- State: Review — locally complete; combined real-Core/Platform HTTP integration verified with TestClient.
- No frontend, Core A runtime, shared contract, dependency or Platform runtime edits.
- Local review commits only; no remote publication, deployment or teammate messages.

### Core B completion evidence

Implementation: `6326deb6e3f68f656e065f99758c74f899150053`.
See [Core B handoff](../core_navigation/HANDOFF.md) for behavior, scope, provenance and integration dependencies.
Both Core B test files: 51 passed. Full combined suite: 176 passed, 1 skipped
(organizer pack unavailable); compile, disposable contract generation and diff checks passed.
The actual planner and renderer were exercised through Platform's HTTP handlers,
including answer/alternative reproduction and source comparison; no injected fixture services.
Fixed 8-case comparison: 11 questions vs 14 ask-all, 0 unnecessary, 0 missed,
0 incorrect certainty / 16 alternatives (6 certain). This is synthetic software evidence.
Runtime versions: correlated-partitions-v2 and encoded-rule-v2. Shared contracts and
Claude's frontend checkout remain untouched. Next: Platform integration review and
shared example regeneration; remote main/deployment/frontend acceptance remain separate.

## Prior author record — preserved from Core candidate 3cf0361

The following is the existing author’s record, imported without alteration.
Current four-lane scope above governs new work; candidate results remain reported evidence until rerun.

# CORE-04 — P1 bounded useful-question planner

State: Review (local). Human owner: Daniel. Session: Codex /root, 01a103d0-b88b-7090-97aa-f9d5eec55d45.
Branch: codex/core-backend. Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend`.
Base: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`. Result: `eaa5d10f2ec822f19a31c3f05aa720649924f442`.
Dependencies: CORE-03 + COORD-01.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/core_assist.py (coordinate one Core writer), question_planner.py; tests/test_question_planner.py; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: plan_questions(AssistContext)->QuestionPlan at the shared boundary.
Acceptance: Bounds, correlated variables, inclusive date/numeric partitions, joint materiality, deterministic ranks/budgets and partial status; all probes reproduce via evaluate_rules; occupancy answer with two exemptions remains unknown.
Checks (use project .venv Python): python -m pytest tests/test_question_planner.py -q; fixed-set unnecessary-question/incorrect-certainty counts versus baselines.
Next action: Platform wires the actual assist route to the Core functions; no API/schema/frontend edits made here.
Non-goals: extra evaluator/provider/database, copied unlicensed code, taking another lane's task.
Handoff: actual commit, changed files, tests, limitations, contract requests and dependency status in this card.
Integration: single ordered queue, recheck combined code; local commits allowed, no push/merge/deploy authority.


## Daniel's Core implementation claim — 2026-10-03

Human owner: Daniel. Sole writing agent: Codex /root, session 01a103d0-b88b-7090-97aa-f9d5eec55d45.
Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend` (dedicated clone; no pre-existing changes).
Branch: `codex/core-backend`. Base: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`.
The user assigns this session to Core; earlier unallocated metadata is superseded by this claim.
Claimed paths: the exact allowed implementation/tests/card above, plus `docs/core/**` and ignored `data/core-session/**` for evidence.
Work is serialized CORE-03 -> CORE-04 -> CORE-05 -> focused CORE-02; adapter changes have one writer.
State: Ready, reserved to this session; no concurrent writes.
No push, merge, deployment, external messages or submission authorized.

### Local result — Review
Implemented `plan_questions(AssistContext) -> QuestionPlan` in the Core adapter and planner.
Actual baseline and every hypothetical use `engine.evaluate_rules`; the baseline counts toward the budget.
The planner enumerates supported Boolean/enums and threshold-partitioned numeric/date domains, clipped
to known bounds/partial dates. Correlated predicates share a value; bounded joint probes establish
conditional materiality. Displayed alternatives change one field and preserve all other uncertainty.
Rank: relevant unresolved predicate count / shared answer effort, deterministic field tie-break.
Budget/field/question/joint limits stay explicit; unsupported domains remain partial. Exhaustive refers
only to supplied encoded property domains, never source coverage or legal validation.
Checks: `.venv/bin/python -m pytest tests/test_engine.py tests/test_question_planner.py -q`: 50 passed.
Related serialized CORE-03 adjustments retain questions under unknown temporal status and retain
hypothetical provenance when a precise probe is accompanied by an existing numeric bound.
Fixed synthetic comparison and final integration results will be in docs/core/CORE_HANDOFF.md.
Platform HTTP assist route is absent on the inspected base; service integration verified directly.

Read-only adversarial review led to focused repairs: inactive rules cannot create false sensitivity or
poison date partitions; source/lifecycle remedies survive negative factual answers; real-number
membership with type-sensitive integer/float semantics is explicitly unsupported rather than exhaustive;
nonmaterial residuals no longer request a useless fact. 58 combined engine/planner/renderer tests pass.

Final review: partition only relevant traced expressions, so an absent interaction target cannot poison
a supported date partition. Missing interaction targets remain explicit cross-reference remedies.
Fixed synthetic evaluation: docs/core/evaluate_planner.py and planner_evaluation.json (8 cases, 11
questions versus 14 ask-all; 0 versus 3 unnecessary; 0 incorrect certainty / 16 alternatives, 6 certain).
Expectations were authored by the implementing agent, not independently/human reviewed legal outcomes.

Final combined candidate: `0c32ec447e1e9f3d352702a252493843c7871682`; 82 focused and 96 full-suite tests passed; compileall, contracts generation (disposable copy), and diff check passed. See docs/core/CORE_HANDOFF.md.
