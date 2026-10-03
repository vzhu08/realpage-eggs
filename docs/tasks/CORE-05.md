# CORE-05 — P1 deterministic encoded-rule renderer

## Current four-developer assignment (supersedes historical claims below)

- Lane / future owner: Core B / Questions & Rendering. New human/name/session/checkout unallocated; Daniel authored the existing candidate. Vincent records path release before another writer starts.
- State: Review for existing candidate; new writer handoff/allocation required.
- Read first: AGENTS, current four-developer playbook, OWNERSHIP, ASSIST_CONTRACT, existing candidate handoff.
- Existing candidate: origin/codex/core-backend at c92ad8f; tested candidate reported as 0c32ec4.
  Existing author checkout: /Users/danny/Documents/ChatGPT/RealPage/core-backend. Preserve it and its commits.
- Future branch/absolute checkout/base/result commit: record at handoff; do not assume current main includes this candidate.
- Exclusive allowed paths for this task: navigator/rule_renderer.py, core_assist.py; tests/test_rule_renderer.py; tests/fixtures/core_navigation/**; docs/core_navigation/**; this card.
- Reserved: the other Core lane's runtime/tests/cards, frontend, Platform APIs/services, models/contracts,
  dependencies, tests/conftest.py and shared docs/board. Core B exclusively owns core_assist.py.
- Dependency: Existing shared models; planner consumes Core A rule_traces/evaluate_rules. Renderer has no live extraction dependency.
- Next bounded action: Review existing renderer independently of live extraction; after handoff, preserve operators/exemptions/date boundaries and coordinate actual source-comparison UI integration.
- Checks (checkout Python): python -m pytest tests/test_rule_renderer.py -q.
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

# CORE-05 — P1 deterministic encoded-rule renderer

State: Review (local). Human owner: Daniel. Session: Codex /root, 01a103d0-b88b-7090-97aa-f9d5eec55d45.
Branch: codex/core-backend. Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend`.
Base: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`. Result: `87b92f091cac25ad6ef3b1e95d7ea3f479abbc29`.
Dependencies: COORD-01 Rule/Expression contract.
Read first: AGENTS, OWNERSHIP, ASSIST_CONTRACT, canonical follow-up specification and relevant code.
Allowed write paths: navigator/rule_renderer.py; tests/test_rule_renderer.py; renderer export in core_assist.py coordinated with CORE-04; this card and lane-owned notes/tests travel with implementation.
Shared files consumed: models, contracts, API routes, root dependencies and shared docs are Platform-stewarded;
request changes there. Core internals and frontend are reserved to their lanes. Preserve other active claims.
Outcome: render_rule(Rule)->EncodedRuleRendering without a model.
Acceptance: Preserve operators/grouping/thresholds/precision/exemptions/unsupported nodes/effective dates; stable hash; distinct from property explanation and legal verification.
Checks (use project .venv Python): python -m pytest tests/test_rule_renderer.py -q.
Next action: Platform consumes render_rule from core_assist; review through existing merge queue.
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
Implemented deterministic `render_rule(Rule) -> EncodedRuleRendering` and exported it from
`navigator/core_assist.py`. Rendering preserves AST grouping/operators/units, exemptions, membership,
negation, partial-date precision, inclusive effective/exclusive end boundaries, lifecycle events and
scoped interactions. Unsupported nodes retain stable AST paths. The SHA-256 includes operative
property/temporal/interaction semantics, excluding retrieval IDs/offsets; version is encoded-rule-v1.
The contract's encoded_rule_not_legal_validation designation is preserved.
Checks: `.venv/bin/python -m pytest tests/test_rule_renderer.py tests/test_question_planner.py -q`: 34 passed.
No schema, route, dependency or frontend changes. Integration awaits Platform.

Final review: fractional or out-of-calendar-range age_at_least values are visibly unsupported and
included in unresolved_nodes, matching evaluator capability instead of implying valid whole years.

Final combined candidate: `0c32ec447e1e9f3d352702a252493843c7871682`; 82 focused and 96 full-suite tests passed; compileall, contracts generation (disposable copy), and diff check passed. See docs/core/CORE_HANDOFF.md.
