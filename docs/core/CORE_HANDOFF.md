# Daniel / Core handoff

## Current funded run — 2026-10-03

Funding/configuration is now working. Real D001 extraction and automated source review completed;
D001/D003–D008 completed, for 84 records (all retain review limitations). Current model:
`gpt-6.1-sol`. The captured-corpus workflow is running as `296de71f2c794d6c9ca3ed48f133ebb2`,
reusing seven valid full caches in the same explicit `data/core-session` store.
Do not interpret the historical setup failures below as the current state.

Current detailed commands, actual run IDs, source comparisons, observed usage and limitations are in
`CORE01_LIVE_REVIEW.md`, with `core01_d001_live.json`, `core01_d003_live.json` and
`core01_d004_live.json`. Funded HTTP 400 was diagnosed and repaired by explicitly requesting JSON
in the API input. Interrupted-draft resumption, finalized interruption manifests, and bounded response
allowance repairs plus incompatible-fact-enum guard are tested at `a422fb3`: **30 extraction / 104 focused / 118 full-suite tests pass**;
compile/contracts/diff pass, working contracts unchanged. Historical verification reports are retained.

First real CLI lookup succeeded; actual-app local HTTP lookup returned 200, while the assist endpoint
returned 404 (Platform dependency). Final corpus evaluation/validation/export and full counts are pending.
Original source texts/hashes and all 500 unresolved municipalities remain preserved. No human or
independent legal review, complete coverage, deployment or push is claimed. Daniel pushes manually.

## Historical provider setup result — 2026-10-03

Both key/model are now configured locally. Fixed an invalid first `.env` line by commenting it, then
removed a duplicated `OPENAI_MODEL=` prefix from its value. Key and other settings were preserved;
`.env` stays ignored with mode 0600. No secret values were printed or committed.

Live CORE-01 acceptance remains **Blocked**, now on API funding: a minimal request returned HTTP 429,
`credit_balance_exhausted` / `insufficient_quota`. Calls stopped. Two preceding D001 manifests record
HTTP 404 for the malformed model value (run `4edb554e813f40ff943a641fff17d0f7`, 1.034 seconds), then
HTTP 400 with corrected `gpt-6.1-sol` (run `7a402a6829d942a59c705954bce8db44`, 0.402 seconds).
The HTTP 400 cause was not established; the following minimal diagnostic conclusively reported the
credit blocker. After funding, retry D001 and diagnose any remaining request error within Core scope.
No completed model output or usage record was returned. No corpus run or live legal review occurred.

Evidence: `core01_configured_attempts.json`, `core01_provider_diagnostic.json`, and latest section in
`EXTRACTION_EVIDENCE.md`. Store unchanged in substance: zero rules, 87 sources, 500 addresses,
zero resolved municipalities; source JSON hash unchanged. Prior explicit partial exports remain partial.
`CORPUS_REVIEW_CHECKLIST.md` adds source-only review targets for overlap, exemptions and proposal history.
No production-code change since the verified 106-test implementation. No push or teammate contact.
Next bounded action: Daniel adds API credits for the key's organization, then retries D001 here.

## Earlier CORE-01 continuation before local configuration — 2026-10-03

Software fixes: **Review**. Real extraction acceptance: **Blocked** on locally configured
`OPENAI_API_KEY` and `OPENAI_MODEL`, followed by actual output review. Presence checks after dotenv
loading found both absent. No model or usage is claimed. Starting HEAD was
`c92ad8fbd27a2175a41cb74428cdc03fb76ab14a`; branch `codex/core-backend` tracks origin/codex/core-backend.
Tested implementation commit: **`4155617a05b9a24ef0c6093d1910e7113359dbdf`**.
Any following continuation commit changes only Core documentation/evidence.
User's existing untracked `docs/.DS_Store` is preserved. Daniel retains manual pushing.

Changed implementation/tests: `navigator/extraction.py`, `tests/test_extraction.py`.
Different lifecycle histories and snapshot dates survive merge as explicitly conflicting variants;
equivalent histories retain accumulated rule/event evidence, including repeated alternative variants.
Invalid cache metadata now produces a finished failure without overwriting previous rules/cache or
making new provider calls. Valid empty output and cache reuse are preserved. No prompt/schema/dependency
change; no completed planner/renderer rebuild. Regressions use temporary synthetic fixtures only.

Changed notes: this file, `EXTRACTION_EVIDENCE.md`, `D001_SOURCE_PREFLIGHT.md`, `core01_preflight.json`,
`core01_pipeline_results.json`, `core01_service_results.json`, `verification.json`, archived
`verification_initial.json`, and `docs/tasks/CORE-01.md`. All writes remain in Daniel's claimed scope.

Actual fresh evidence:

- Existing explicit store `/Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session`:
  87 sources, 54 captured texts, 500 addresses, zero rules/cache entries, 500 unresolved municipalities.
  All 54 stored texts match original pack files and actual hashes. No reset, re-ingestion, source
  replacement, teammate-data writes, scraping, Census requests or invented geography.
- D001 run `fff936be69f04f6296a4e7efe0f32ba7`, 22:42:49 UTC, 0.040 seconds: failed
  ProviderUnavailable, zero processed/rules, no model identifier or provider usage. Full corpus was
  not attempted after the missing-configuration result. The 54 captured texts comprise 76 chunks.
- D001 automated source preflight has exact original-text offsets. Passage to print dated November
  18, 2025 does not establish final adoption/effective date. No explicit end date or construction-year
  occupancy condition appears. This is source-only preparation, not model output or independent/human
  legal review. Exact quote matches and passing tests do not prove semantic support.
- Benchmark 2026-10-01 evaluation/validation/export ran through existing CLI interfaces. Export remains
  `PARTIAL_NOT_JUDGE_READY`; all 500 input IDs retained, zero references (resolution check vacuous),
  all T1–T5 blocked. CLI lookup exit 2; real-store HTTP lookup 503. `/api/v1/lookup/assist` is still 404
  with the actual app. Platform route integration remains a dependency; no routes were edited.
- Requested `.venv/bin/python docs/core/verify_candidate.py` inspected and run: **92 focused / 106
  full-suite tests passed**, compileall passed, contract generator passed in disposable copy, diff
  check passed. One existing Starlette/httpx deprecation warning. Working contracts hash-unchanged;
  seven generated example differences remain Platform-owned. Standalone extraction tests: **18 passed**.
  Initial 96-test report is preserved in `verification_initial.json`; current logs are `verification.json`.

Exact commands, run IDs/timing/counts, provider setup, failure handling and missing-source priorities
are in `EXTRACTION_EVIDENCE.md` and the three `core01_*.json` records. The 33 missing text captures
include state code references, Massachusetts CORI and terms-review municipal sources. These potential
dependencies need Platform evidence work; overlapping support elsewhere has not been ruled out.

Next bounded action: Daniel configures the ignored local `.env` using the direct setup instructions in
`EXTRACTION_EVIDENCE.md` (recommended starting model `gpt-6.1-sol`, account availability untested).
Then run D001 in the same explicit store, review its actual quotations/conditions/exemptions/lifecycle,
fix demonstrated scoped defects, and resume the captured corpus using valid caches and existing bounded
retries. Record actual provider/model usage; repeat partial evaluation/export after extraction. Human or
independent legal review and complete geography are still outstanding. No push, merge, deployment or
teammate contact occurred in this session.

## Historical completed Core implementation handoff (preserved)

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
