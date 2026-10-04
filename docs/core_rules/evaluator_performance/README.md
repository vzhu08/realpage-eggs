# PERF-01: avoid discarded evaluator audit work

Core A / Daniel, base `912643a047568f6df4bddf3c1222ea7043676ec2`, branch
`codex/core-a-evaluator-performance`. The existing evaluator built full audit trees during
every planner probe, then discarded them. Result-only evaluations now omit trace models,
expression/evidence deep copies and residual-tree construction. Requested audit traces still
use the same semantic traversal and preserve their existing deep-copy isolation.

This changes product runtime behavior: planner probes and ordinary rule evaluations do less
work. It does not reduce the analysis budget, skip difficult rules, cache answers or change
questions. Every child still evaluates because multiple decisive siblings can contribute
different supporting facts. Negation, depth limits, missing facts, interval/date precision,
interaction scope, uncertainty and explanation construction remain unchanged.

Only `navigator/predicates.py` and `navigator/engine.py` change runtime. Existing callers of
`evaluate_with_trace`, `rule_traces` and the default `evaluate_coverage` keep full traces and
their return shapes. The result-only coverage option is keyword-only. Core B, Platform, UX,
models and public API contracts are unchanged.

## Verification

The focused evaluator, trace, change, planner, renderer and assist API suite passes 182 tests.
Eight new regression cases cover complete traced/result-only result equality across nested
operators, numeric bounds, partial dates and invalid types; both decisive siblings' support;
the nesting limit; absence of audit allocation in ordinary rule/interaction evaluation; and
mutation isolation across trace expressions, residuals, evidence, inputs and repeated calls.
The D069 candidate and 25-probe reports still reproduce unchanged.

A read-only reviewer also compared the complete results and trace trees for 1,200 seeded
expression/fact combinations against the pre-edit evaluator with no differences. No review
finding remains. This supplemental diagnostic is distinct from the committed test suite.

```sh
.venv/bin/python -m pytest -q tests/test_traces.py tests/test_engine.py tests/test_change_adapters.py tests/test_question_planner.py tests/test_rule_renderer.py tests/test_assist_api.py
.venv/bin/python docs/core_rules/d069_predicates/build_candidates.py --check
.venv/bin/python docs/core_rules/d069_predicates/check_candidates.py --check
.venv/bin/python docs/core_rules/evaluator_performance/benchmark.py --output /tmp/core-a-performance.json
git diff --check
```

The benchmark runs baseline code from Git and candidate code in separate subprocesses against
one disposable extraction of the pinned 140-rule / 500-property Core snapshot. It blocks Store
writes, verifies input-file hashes before and after, and compares complete serialized evaluator
results, audit traces and assist responses. Four properties span CA/NJ/MA. Additional requests
cover false/true/null answers and a date change. Hypothetical answers stay request-local.
All request limits and planner budgets remain identical. Timing includes serialization.

[benchmark.json](benchmark.json) contains the actual samples, wall/CPU medians, code/source
hashes, plan/evaluation counts and full-output digests. These are sequential local diagnostic
measurements. The Core snapshot has no resolved municipalities and is not hosted `real-002`;
it cannot establish hosted p95, cold starts or two-user performance. No provider calls occur.

Direct evaluation of all 140 rules was **3.60–3.81 times faster** across the four properties.
Complete assist responses improved **1.13–1.38 times** across all eight requests. All complete
outputs and requested traces matched the baseline; each measurement used three repetitions.
The narrower evaluator gain does not translate into the same whole-request speedup because
the planner still performs other work, including requested traces and analysis.

## Platform / Core B / UX handoff

The Core A implementation is ready for integration. PERF-01 remains open for the complete
release gate: benchmark the actual selected snapshot on the selected host through a fresh
browser, including answer follow-ups, date changes, cold/warm behavior and two users. Preserve
the request and plan comparison evidence when combining other lanes' optimizations. Do not
claim the 20-second frontend timeout is fixed by these local numbers.

Platform's existing cache keys include evaluator source hashes, so the runtime change correctly
invalidates previous change-cache keys. Rebuild caches with the existing release tools when
preparing the new code/data release; do not change the preserved serving snapshot in place.
No deployment, hosting purchase, contract expansion or registry change is part of this PR.
