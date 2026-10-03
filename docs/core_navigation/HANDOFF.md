# Core B completion — CORE-04 / CORE-05

Status: implemented and verified locally; ready for Platform integration review.
Human: Oliver. Sole writing agent: Codex /root, session `01a103bd-84d1-7c50-bd19-1fe9267bc139`.
Branch: `codex/core-b-navigation`.
Checkout: `/Users/oliverchen/Documents/random shi/realpage-eggs-core`.
Implementation commit: `6326deb6e3f68f656e065f99758c74f899150053`.

## Starting point and scope

Continued Daniel's existing planner/renderer implementation on Core candidate
`3cf0361abb81f073f7f9df02544995c4e8355097`; did not rebuild those features.
The isolated review base `1d34fada79dbc7e4c28bbb44665f504c224c62fd` combines that
candidate with Platform main `9a96fda205c75536d81b17d7d1baf5b3c0ced0e6`.
The preparation merge preserved both histories and prior task-card author records.
It is a local integration candidate, not a change to remote main.

Oliver explicitly assigned Core B to this session while Claude works on the frontend.
This claim does not assert a separate recorded release from Vincent or Daniel.
Neither active writer's checkout was modified. Claude's checkout remains
`/Users/oliverchen/Documents/random shi/realpage-eggs`, on `codex/realpage-frontend`.

New implementation changes touch only `navigator/question_planner.py`,
`navigator/rule_renderer.py`, and their two existing test files. New notes/evidence
are under `docs/core_navigation/`; only CORE-04/05 cards are updated for this work.
No new shared schema, dependency, Platform runtime, Core A runtime or frontend edits.
No model calls, external messages, remote pushes or deployments were performed.

## Behavior delivered

- Numeric partitions preserve exact integer answers between floating-point endpoints.
  Previously, `amount > 2**60 AND amount < 2**60 + 2` produced no question and was
  incorrectly marked exhaustive, despite the valid answer `2**60 + 1`.
  Open cells now try an exact integer before a floating-point midpoint.
- Unbounded interval endpoints are correctly marked exclusive. Finite numeric
  property/definition bounds retain their original clipping behavior.
- Non-finite bounds in an unresolved field produce an explicitly partial plan
  with an interpretation remedy, instead of a rounding exception or an ignored bound.
- Non-finite/out-of-calendar-range age encodings render as unresolved nodes;
  `NaN` and `Infinity` no longer crash the renderer.
- Versions are `correlated-partitions-v2` and `encoded-rule-v2`. Public interfaces
  and schemas are unchanged; the existing semantic hash policy is retained.

New tests exercise actual `create_app` routes with the real Core adapter, without
injecting a fabricated planner or renderer. They cover every displayed units
alternative, answer provenance, stateless resets, budget exhaustion, a partial date
refined to the exact inclusive cutoff, two independently unresolved exemptions,
source-gap persistence, evidence/source context, and rendering/hash changes.
Answers affect the property evaluation while the same rule's rendering remains stable.
Every hypothetical still uses Core A's `evaluate_rules`.

## Verification

Python 3.12.14; exact repository `requirements.lock` installed in this checkout's `.venv`.

| Check | Result |
| --- | --- |
| `.venv/bin/python -m pytest tests/test_question_planner.py tests/test_rule_renderer.py -q` | 51 passed |
| `.venv/bin/python docs/core_navigation/verify_candidate.py` | Passed |
| Full suite inside disposable copy, `python -m pytest -q -rs` | 176 passed, 1 skipped |
| `python -m compileall -q navigator tests` | Passed |
| `python -m navigator contracts` in disposable copy | Passed |
| `git diff --check` | Passed |

The skipped test requires the organizer pack, which is not installed here.
One upstream Starlette/httpx deprecation warning remains; dependencies were not changed.
The full suite includes existing synthetic export/reference checks. Actual corpus
extraction, the 500-address benchmark, deployment and browser UI were not verified.
HTTP integration uses FastAPI's TestClient against production handlers and real Core
functions, not a separately deployed server. No persistent API server was started.
All mutable test data lived in private temporary directories.

`verification.json` records exact outputs and SHA-256 values for the tested source
and tests. Its base commit precedes implementation commit `6326deb`; its source
fingerprints identify the tested implementation bytes. No code changed after the run.
Contract generation changed ten example files only inside the disposable copy;
schemas were unchanged, and the working checkout's `contracts/**` was preserved.
Platform owns regeneration/publication of those shared examples after integration.

## Fixed planner comparison

Reran the original, unchanged `docs/core/evaluate_planner.py` against the combined
candidate. Historical evidence under `docs/core/**` was not overwritten.
New exact results are in `planner_evaluation.json`:

- 8 synthetic cases; 11 planner questions versus 14 for ask-every-missing-fact.
- Unnecessary questions: 0 planner versus 3 baseline. Useful facts missed: 0 planner
  versus 11 for the generic-unknown baseline, which asks no questions.
- Incorrect certainty: 0 out of 16 displayed alternatives, including 6 alternatives
  with a certain result. Baselines make no hypothetical certainty claims.
- 75 total evaluations across the eight independently budgeted cases.

These original agent-authored cases are software checks, not independent legal
review or evidence of completeness of source coverage. Exhaustive property
analysis continues to carry separate source/interpretation uncertainty.

## Integration and remaining ownership

Both tasks are locally complete and ready for review. Platform should integrate
the preserved Core A/Platform dependencies plus implementation `6326deb` through
the coordinated merge queue, then refresh shared generated examples. Do not apply
the Core B delta alone to a main branch that still lacks Core A's trace/evaluator
candidate. Claude's frontend can then consume the unchanged assist/evidence contracts.
Remote integration and frontend acceptance have not been claimed or performed.

Concrete shared-model follow-up for Platform: `navigator/models.py` currently
accepts non-finite `Bound`/`FactDefinition` endpoints and `Expression` thresholds.
Reject those values at validation so malformed stored input cannot reach any
consumer. Core B now handles the demonstrated planner/age-renderer failures, but
does not override baseline evaluator truth: e.g. a stored `units` lower bound of
Infinity can already be treated as decisive by Core A before a question is needed.
This is outside Core B ownership; ordinary validated finite inputs remain covered.
