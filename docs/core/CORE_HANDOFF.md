# Daniel / Core handoff

Core-02/03/04/05: **Review**, locally completed. CORE-01 software repairs: **Review**;
live extraction and source review: **Blocked** on missing OPENAI_API_KEY and OPENAI_MODEL.
No HTTP assist/frontend integration, merge, deployment or submission is claimed.

Owner: Daniel. Sole writing agent: Codex /root, session `01a103d0-b88b-7090-97aa-f9d5eec55d45`.
Read-only helper reviewed temporal/interaction and planner traps; it wrote no files.
Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend` (dedicated clone; original supplied workspace was empty).
Branch: `codex/core-backend`. Base and freshly fetched origin/main: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`.
Tested combined candidate: `0c32ec447e1e9f3d352702a252493843c7871682`; later handoff commits change only Core notes/cards/evidence.
All commits are local. Daniel explicitly retains manual pushing. Nothing was pushed or sent to teammates.
Benchmark query date remains **2026-10-01**. Repository planning assumption remains October 4, 2026,
09:00 America/New_York; the actual pack says submission logistics are organizer-TBD, not confirmation.

## Delivered and reviewable increments

| Task | Result commits | Behavior |
|---|---|---|
| CORE-03 | `49ac41f`, serialized refinements in `c68a098` | One traversal supplies PredicateResult and canonical traces, stable AST paths, evidence, residual grouping and short-circuit relevance. Actual occupancy is required. |
| CORE-04 | `c68a098`, `c1a7903`, `eaa5d10` | Bounded deterministic correlated-field planner, clipped numeric/date partitions, Boolean/enum alternatives, joint materiality, exact evaluator probes, explicit limits/remedies. |
| CORE-05 | `1595b03`, `87b92f0` | Deterministic encoded rendering with operators/grouping/units/exemptions/partial dates/lifecycle/interactions, stable SHA-256, unresolved nodes and explicit non-validation designation. |
| CORE-02 | `bfe1d86`, `644680c` | Removes inactive/self interaction edges; only supported scope establishes priority; preserves real conflicts/cycles; lifecycle interval overlap cannot invent event order. |
| CORE-01 | `30cdfb7` | Requires evidence for end_date/status_as_of; prompt distinguishes actual occupancy; prompt-version cache invalidation. Live run blocked with actual failure manifest. |
| Verification | `0c32ec4` | Reusable disposable-copy check runner so generated contracts never overwrite the working checkout. |

Changed implementation files: `navigator/{predicates,engine,question_planner,core_assist,rule_renderer,extraction}.py`.
Changed tests: `tests/{test_engine,test_question_planner,test_rule_renderer,test_extraction,test_change_adapters}.py`.
Changed docs: only the five Core cards and `docs/core/**`. Models, fact registry, shared instructions/board,
contracts, dependencies/configuration, API/services, persistence/geocoding/exports and frontend are untouched.
`changes.py` needed no repair; existing adapters and new end-date behavior tests verify the shared evaluator.

## Platform consumption and limits

```python
from navigator.core_assist import plan_questions, render_rule
plan = plan_questions(context)  # AssistContext -> QuestionPlan, synchronous
encoded = render_rule(rule)     # Rule -> EncodedRuleRendering, synchronous
```

The planner deep-copies the supplied context and recomputes actual evaluations instead of trusting stale
context.evaluations. The baseline counts as one evaluate_rules call. Every single/joint probe uses that
same engine. Returned alternatives change only the questioned field, remain hypothetical, retain numeric
bounds and carry `Hypothetical planner probe; not a known property fact` provenance. Reproduction must
apply probe_facts plus that provenance to a deep copy; keep the original bounds. Never persist probes.
Joint probes test sensitivity holding all other assigned facts fixed. They are not displayed as if one answer
settled other exemptions. Rank = relevant unresolved predicate count / shared answer-effort weight,
with field-name tie-breaks. Scores are heuristics, not probabilities.

Default/supplied AnalysisLimits are honored, including baseline evaluation, field/question/joint ceilings.
Budget exhaustion retains conservative candidate questions (possibly zero evaluated alternatives), explicit
analysis_limit remedies and partial/non-exhaustive status. `exhaustive` covers supported encoded property
domains only, never complete source coverage or legal correctness. A no-question plan can retain unknown
actual evaluation when correlated predicates are insensitive; it never replaces that evaluation with certainty.

Generic string domains, date eq/ne/in raw-string semantics, large enums (>16), and real-number membership
with type-sensitive integer/float equality are explicitly unsupported/partial. Use the canonical date
operators for date interval analysis. Cross-field relationships are not invented: AssistContext contains no
relationship constraints. Factual questions do not resolve source, geography, interpretation or authority gaps.
Missing interaction targets remain cross-reference remedies. A generic source-coverage limitation remains
because AssistContext has rule reports but no complete jurisdiction/category inventory.

## Actual checks

Python **3.13.15**, exact existing requirements.lock, isolated `.venv`; no dependency changes.
Baseline: **44 passed** with actual pack. Final candidate, disposable copy:

| Command (with checkout .venv Python) | Result |
|---|---|
| `python -m pytest tests/test_engine.py tests/test_question_planner.py tests/test_rule_renderer.py tests/test_extraction.py tests/test_change_adapters.py -q` | 82 passed |
| `python -m pytest -q` | 96 passed; one existing Starlette/httpx deprecation warning |
| `python -m compileall -q navigator tests` | Passed |
| `python -m navigator contracts` | Passed inside disposable copy |
| `git diff --check` | Passed |

Exact logs: `verification.json`. Run `.venv/bin/python docs/core/verify_candidate.py` from this checkout to
repeat safely; direct full-suite/research-contract/generator execution in the working tree is unsafe because
those checks generate files. Working contracts were hash-verified unchanged. Generated schemas and OpenAPI
match checked-in versions; seven example JSON files differ in disposable output. Platform owns any fixture
refresh; no generated changes were committed. Existing authored research plans remain labeled fixture-only.

Service check (`service_verification.json`): real Core functions round-trip through AssistResponse, synthetic
unknown -> units question -> user-supplied answer -> applies; persisted facts unchanged. Existing HTTP/export
regressions pass. `/api/v1/lookup/assist` returns **404** on this base: Platform route is absent, so the complete
HTTP/frontend assist journey remains pending. No mock route or fixture production fallback was added.

Fixed synthetic comparison (`evaluate_planner.py`, `planner_evaluation.json`):

| Method | Questions / 8 cases | Unnecessary | Useful questions missed | Incorrect certainty |
|---|---:|---:|---:|---:|
| Implemented planner | 11 | 0 | 0 | 0 / 16 displayed alternatives (6 certain) |
| Ask every absent AST field | 14 | 3 | 0 | 0 claims made |
| Generic unknown | 0 | 0 | 11 | 0 claims made |

Expected useful-field sets and a separate case-specific outcome oracle were authored by the implementing
Codex agent. Read-only agent review found algorithmic bugs; this is not independent/human legal review.
Cases are fixed, synthetic, not held out or an official score. No actual legal source-support accuracy was
measured. Synthetic extraction replay tests are distinct from the failed real provider attempt.

## Extraction evidence and intentional semantic changes

`EXTRACTION_EVIDENCE.md` records actual run IDs/timings/errors. Pack ingestion: 87 rows, 54 texts, 500
addresses. D001 attempt: ProviderUnavailable, zero processed/rules, no selected model or provider usage.
Real lookup correctly unavailable. Partial export retains all 500 IDs and explicitly blocks T1–T5. This
new isolated store has no Platform Census cache; no geocoding/retrieval work was taken over. Real legal
extraction, exact-quote/model review, corpus omissions and real address outcomes remain unverified.

Construction year no longer proves either occupancy fact, including years earlier than the legal cutoff.
The former proxy test was intentionally replaced with before/cutoff/after construction years plus actual
partial/exact occupancy answers. No proxy remains. Undated pending/failed snapshots no longer establish
arbitrary historical lifecycle. Conflicting overlapping status intervals remain unknown until a later event
establishes status. Extraction requires explicit end/snapshot support and uses `extract-v2-core-dates`.

## Vincent's next bounded integration actions

1. Review this branch in the existing merge queue; Daniel pushes manually when ready. Recheck against
   current main before an authorized merge. No competing board or remote PR was created.
2. Wire Platform's assist service/route to the two Core functions; preserve source inventory warnings and
   hypothetical provenance. Run the occupancy/two-exemptions flow through HTTP and UX once available.
3. Update Platform-owned `docs/CONTRACTS.md` fact paragraph to remove the obsolete year-built occupancy
   proxy statement. No models/schema change is required; affected consumers are lookup, planner, UX and
   exports (more honest unknowns where only construction year exists).
4. Optional explicit contract request: if Platform wants plans to distinguish complete source inventories,
   add a source-coverage inventory/status input to `navigator/models.py::AssistContext`, regenerate
   `contracts/research.schema.json` and fixtures, and adapt assist_service/UX. Current generic source-gap
   remedy is deliberate until such evidence exists; this is not a blocker to the implemented services.
5. Daniel supplies key/model locally, runs/reviews D001, then resumable corpus extraction. No live review
   or legal correctness claim should precede that step. Interaction targeting remains citation/jurisdiction/
   category-level; finer provision/version targeting needs Platform coordination if actual evidence demands it.

Manual push from this checkout:

```sh
git push -u origin codex/core-backend
```

No external code was copied; the deterministic algorithms were implemented within the existing architecture.
