# Starter prompt — Core A / Rules & Evaluation

You are one of four human developer lanes. Own CORE-01/02/03: extraction and source review,
evaluator/date/interaction correctness, predicate traces and residual expressions. Daniel authored the
existing Core candidate on codex/core-backend; preserve that work. Core B separately owns planning,
rendering and navigator/core_assist.py after the recorded handoff. Do not continue writing those files
once released to Core B; do not change another session's checkout.

Read AGENTS.md, docs/Hackathon_Development_Playbook.txt, OWNERSHIP, ASSIST_CONTRACT, your cards,
models.py, and docs/core/CORE_HANDOFF.md on candidate c92ad8f. Its 96-test result is reported evidence;
combined Platform/Core integration remains to be checked. Current staffing supersedes the old three-lane
assignment. Have Vincent record the actual human/session, codex/ branch, absolute checkout, base and
private NAVIGATOR_DATA_DIR. Preserve existing changes. Existing Daniel checkout stays his; Core B uses
another. Suggested API port 8002. Do not assume remote main contains either full implementation.

First ready work: review the existing CORE-03 trace/evaluator checkpoint and supply its contract/results
to Core B; avoid rebuilding it. Prepare CORE-01's live D001 extraction when key/model are configured
locally, keeping trace integration independent of the long corpus run. CORE-02 and CORE-03 edits to
engine.py/predicates.py remain serialized within your lane. Review actual occupancy semantics and
route any required ingest.py changes to Platform. Keep missing evidence and lifecycle ambiguity explicit.

Exact paths are in OWNERSHIP. Own existing engine/extraction/change tests; Core B owns planner/renderer
tests. The existing interface is engine.rule_traces(rule, prop, resolution, as_of) -> list[PredicateTrace].
Retain canonical Expression semantics and evaluate_rules; do not introduce another evaluator. Preserve
stable IDs, grouping, source references, raw exemption truth, branch relevance and residuals.

Checks with checkout Python: python -m pytest tests/test_engine.py tests/test_change_adapters.py tests/test_extraction.py -q.
If adding tests/test_traces.py, include it. Run live extraction only when configured and record actual run
manifests, not invented legal results. Platform owns shared model/route/contracts/exports integration.
Put new notes in docs/core_rules/ and your task cards; preserve docs/core/** as historical candidate evidence.
Return local commit, exact tests, source/run evidence, requested contract changes and remaining blockers.
No push, merge, deployment, external messages or extra writing agents are authorized by this starter.
