# Daniel — Core A Rules & Evaluation

Current session: Codex /root, 01a103d0-b88b-7090-97aa-f9d5eec55d45.
Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend`. Branch: `codex/core-backend`.
The user assigned continued Core A work and local conflict resolution on October 3, 2026.
The sole writer claims CORE-01/02/03 and their exact paths in OWNERSHIP; read-only helpers review existing behavior.
Core B owns question_planner.py, rule_renderer.py, core_assist.py and their tests/cards. Daniel releases those paths for future Core B work; existing implementation remains preserved. Platform records the new Core B human/session and shared-board allocation.

## Safe extraction stop

The user requested stopping the active corpus extraction. Run `296de71f2c794d6c9ca3ed48f133ebb2` finalized as **partial**, with 15 completed documents, 140 stored rules and 7 cache hits. The only run error is the requested interruption. Saved drafts, caches, original text and completed records remain resumable. No further provider calls are authorized by this closeout.

The stop checkpoint and full structural store audit are adjacent JSON files. All 54 captured source texts match their originals; primary quotations and evidence offsets validate. This automated source audit is not human or independent legal review. D022 was extracted but had not received the separate agent source review when stopped. All 500 input addresses remain stored; local municipalities remain unresolved.

Observed returned usage across live runs is 520,846 tokens (243,550 input; 277,296 output). Timeouts and interrupted requests can have unobserved billable usage, so this is not a billing total.

Historical notes under docs/core were authored before the four-lane integration and are preserved as such. In particular, older mentions of a running corpus or an unavailable assist route are historical. Current integration checks and task outcomes will be recorded here and in CORE-01/02/03.

## Completed local integration and Core A repairs

The user requested resolving their branch against the new four-lane documents. PR #3 had already been merged upstream. This session checkpointed its newer saved evidence at `32ac1e5`, then integrated fetched `origin/main` (`3b1ef06`) into `codex/core-backend` with local merge `3eced75`. Git merged CORE-01's ownership header and author record automatically; no unresolved conflict entries remained. Earlier Core commits, the enum-contract guard, and all historical records were preserved. The separate Platform packaging PR was not imported.

Final runtime candidate: **`9ac58ba`**, following evaluator/trace repair `eef489e`. New work is confined to `navigator/engine.py`, Core A's `tests/test_engine.py`, `tests/test_traces.py`, `tests/test_extraction.py`, these lane notes/helpers, and CORE-01/02/03 cards. Shared code/contracts and Core B files changed only through the existing upstream merge; this session made no new edits to those paths.

### CORE-02 — completed implementation and local verification

Read-only independent agent review found that any status event caused the evaluator to discard a dated lifecycle snapshot. For example, a pending January event hid a failed October snapshot. The evaluator now considers both kinds of dated evidence without treating a snapshot as a transition date. A contradictory later observation leaves intervening history uncertain unless dated events explain the transition. Exact observed days, uncertain month/day ordering, pending/failed behavior, exclusive end dates, scoped priorities, cycles and hypothetical scenarios remain tested. New retrieval timestamps never establish precedence, and no automatic cross-document lifecycle linking was added.

The real saved-store closeout then exposed a related defect: D022's exact chaptering evidence supported enactment, but the evaluator treated its dated snapshot as proof of effectiveness even though `effective_date` was absent. The final repair keeps enacted rules with no effective date temporally unknown. This corrects seven actual stored rules: four D004, one D008 and two D022. Their original encodings and evidence remain unchanged; see `temporal_snapshot_evidence.json` for exact snapshot support and before/after results. A synthetic validated-extraction-to-evaluator regression checks temporal status directly, so `needs_review` cannot hide the defect. The earlier 23-rule export is preserved only as pre-fix diagnostic evidence.

### CORE-03 — completed producer repair and written handoff

`engine.rule_traces(rule, prop, resolution, as_of)` remains the existing synchronous producer boundary. All roots and interaction scopes now lose relevance/residuals when their source rule is definitively inactive, including false combined coverage. Six synthetic failures were reproduced before repair. Raw expression truth, exemption truth, stable original AST paths, grouping, source references and input immutability remain intact. Unknown geography does not become false. Construction year still establishes neither certificate nor first-occupancy dates; supplied partial dates and numeric bounds retain uncertainty.

Core B continues consuming the single `evaluate_rules`, `rule_traces` and `predicates.mark_irrelevant`. Its target-rule relevance checks are still necessary and compatible; no planner/renderer/adapter change or new interface is needed. The old consumer already compensated for inactive interaction scopes, so the producer defect did not previously generate incorrect questions through that consumer. Daniel releases all future Core B file writes as recorded above. No message was sent to another developer.

### Checks and evidence distinctions

At `9ac58ba`, `.venv/bin/python -m pytest tests/test_engine.py tests/test_change_adapters.py tests/test_traces.py tests/test_extraction.py -q` passed **93 tests**. The existing disposable-copy runner, invoked through `.venv/bin/python docs/core_rules/verify_candidate.py`, passed **125 historical focused tests and 200 full-suite tests**, plus compileall, contracts generation and diff checks. The full suite includes all seven new producer tests. The wrapper only redirects the runner's report into this lane; the historical runner/report and working contracts remain unchanged. One existing Starlette/httpx deprecation warning remains; dependencies were not changed.

Generated schemas and OpenAPI match. The ten generated example-file differences were inspected at the earlier integrated candidate: all 18 changed leaves were random extraction run IDs (`generated_contract_drift.json`), not schema or answer differences. Final runner differences have the same file set; no generated artifacts were copied into the checkout.

Synthetic unit/HTTP fixtures demonstrate software behavior, not legal accuracy. Real-data HTTP checks use the actual live/replay store and unmodified A0001 facts; they do not prove complete geography, extraction, or legal applicability. All source review here is automated agent/model review, never human or independent legal review. No provider calls were made after the requested stop.

## CORE-01 saved evidence and remaining limits

The first real slice was completed using configured model `gpt-6.1-sol`: D001 run `2c214d19d3b944a29f98847f16db16ca`, 152.588 seconds, two rules, 13,781 input + 12,448 output = 26,229 observed tokens. Quotes/offsets, the strict data-age threshold, coverage/exclusions, penalties, and pending lifecycle were checked against unchanged original text. The source establishes passage to print, not final adoption or an effective date. Detailed review is preserved in `../core/CORE01_LIVE_REVIEW.md` and `../core/core01_d001_live.json`.

The final stopped corpus run lasted 1,296.981 seconds and ended at 2026-10-04T00:09:47.066896Z. Its 15 processed documents include a valid empty D011 extraction; 39 captured documents remain unprocessed. All 15 index entries remain `review`. The complete stopped-run manifest, counts, errors, cache hits, per-response usage and original-text audit are saved alongside this note. All 140 records remain review-needed; 84 have replay provenance and 56 live provenance. Replay refers to real provider evidence reused from valid caches, not synthetic fixtures.

| Captured document | Stored rules | Review status |
| --- | ---: | --- |
| D001 | 2 | Automated original-text review; pending proposal retained |
| D003 | 14 | Automated review; absent effective date retained |
| D004 | 8 | Automated review; relocation amounts and indexing distinguished |
| D005 | 15 | Automated review; guidance/primary-code differences unresolved |
| D006 | 25 | Automated review; coverage qualifications and dates retained |
| D007 | 18 | Automated review; enum-contract defect guarded, ownership scope unresolved |
| D008 | 2 | Automated review; AGA and eligibility/notice dependencies distinguished |
| D009 | 3 | Automated review; construction and actual occupancy remain separate |
| D010 | 20 | Automated review; program-limited guidelines, unknown lifecycle |
| D011 | 0 | Valid empty status-record result; not an absence-of-law finding |
| D012 | 1 | Automated review; unknown lifecycle/citation gaps retained |
| D013 | 3 | Automated review; city notice timing remains unsupported |
| D014 | 3 | Automated review; foreclosure actor/nonwaiver scope remains review-needed |
| D016 | 24 | Automated review; units vs people and qualified standards checked |
| D022 | 2 | Extracted; full separate source review unfinished at stop. Closeout checked chaptering/effective-date distinction only |

D016's 77 evidence instances (47 distinct spans) and all principal quotations matched the original. Owner occupancy's additional-person exception was not encoded as additional units; the senior-housing 80% criterion concerns occupied units. No accessibility bill date, construction year, certificate or occupancy fact was imported as FEHA lifecycle evidence. Effective/end/snapshot dates remain absent; criminal-history/program-cooperation overlaps and section boundaries remain review limitations.

Consequential follow-up evidence includes final adoption/effectiveness for D001; Berkeley Regulation 1148 eligibility and notice support for D008; D005's mandatory reusable-credit-report assertion versus the captured D026 text and missing dedicated Civil Code 1950.1 text; D007's broad registered ownership facts versus D025's rental-property/rental-unit and service-member qualifications; D010's program scope and missing D056 CORI regulation; D011's missing H3744/H5035 substantive texts; and D013/D014's unresolved city submission timing, actor scope and nonwaiver interpretation. D025/D026 are already captured, not missing sources. Their deeper extraction remains stopped.

There are 33 missing manifest captures, listed in `core01_stopped_store_audit.json`. Especially consequential unresolved retrieval includes D056, municipal code D070–D072, and San Diego D074–D075. Missing alternate statute URLs do not imply that every version of that statute is absent: captured alternate sources remain available. No missing source was scraped, no retrieval service was taken over, and no municipality was inferred from a postal city or borrowed Census cache.

**CORE-01 remains partial by the user's stop request.** Available first-slice work, safe-stop evidence, software repairs and offline closeout are complete; completing the remaining corpus and legal review is not claimed. The next bounded action, only if the user resumes extraction, is to finish D022's source review and continue the existing resumable workflow from the saved store, using valid caches and bounded retries. No configuration/credit blocker remains in the recorded successful runs. Source/effectiveness evidence, unresolved interpretations and Platform-owned local geography remain substantive dependencies.

## Offline closeout

The final saved-store report is `saved_store_closeout.json`; `pre_effective_date_fix_closeout.json` is superseded diagnostic evidence. Exact CLI commands, artifact paths, run IDs, timing, returned errors, address/reference checks and actual integrated HTTP responses are in those reports. No push, remote merge, deployment or teammate contact occurred. Daniel will push manually.

Final closeout at `9ac58ba`, benchmark **2026-10-01**:

| Operation | Actual result |
| --- | --- |
| Evaluate | Exit 0; partial; 500 addresses / 140 rules; run `5e841ace4f3b460bb11fcef0e923a8f7`; 11.478s |
| Validate | Exit 1; zero quote failures; 124 rules have unknown temporal status unrepresentable in the competition schema |
| Export | Exit 1 with explicit partial artifacts; run `93dbbf6629c04c90ab81208d509c6dea`; 105.726s; 16 representable rules (14 in_force, 2 pending) |
| CLI lookup A0001 | Exit 0; same actual stored facts and date |
| In-process POST /api/v1/lookup | HTTP 200; 111 unknown / 2 pending evaluations; municipality unresolved |
| In-process POST /api/v1/lookup/assist | HTTP 200; actual planner/renderer implemented; 2 questions, 8 evaluations; bounded partial, exhaustive=false |

Validation/export exit 1 is explained by the 124 preserved unknown temporal statuses; these are not malformed quotations or fabricated substitute dates. The artifact label is **PARTIAL_NOT_JUDGE_READY**. All 500 original CSV IDs equal stored, batch-evaluated and exported ID sets. Every lookup and override reference resolves in exported rules; all change-mapping references resolve internally. All 100 protected store files (including saved rules, input facts, geography, extraction metadata and caches) remain byte-identical across closeout. The original text audit remains valid.

T1 reports complete for the encoded comparison only; T2–T5 remain blocked by missing mapped extracted evidence. Neither T1's internal status nor the presence of all address IDs establishes complete law/address coverage. Every rule still needs semantic review, all local municipalities remain unresolved, and no independent legal review or official benchmark score is claimed.

The actual combined HTTP checks use FastAPI TestClient against the unchanged Platform routes and actual Core services, with model generation forbidden. They are in-process checks, not a deployed server. A0001 receives 113 rule/evidence/rendering records. Assist hits the requested max_fields/max_evaluations/max_joint_fields/max_questions limits and keeps source, interpretation, geography and analysis uncertainty. Original facts and geography are unchanged.

Reproduce the offline closeout (about two minutes on this checkout; no model calls):

```sh
cd /Users/danny/Documents/ChatGPT/RealPage/core-backend
.venv/bin/python docs/core_rules/closeout_saved_store.py --data-dir /Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session --pack /Users/danny/Downloads/participant-final-no-hour16
```

The helper invokes existing evaluate, validate, export and lookup CLI commands serially with the same explicit data directory. The exact expanded commands and exit codes are recorded in `saved_store_closeout.json`. Latest artifacts: `data/core-session/core01-live/core-a-closeout-20261004T002153Z/`; the competition-shaped files are under `partial-export/`. They are local, ignored and explicitly incomplete.
