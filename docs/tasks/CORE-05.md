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
