# CORE-01: live extraction and evidence review

## Current four-developer assignment (supersedes historical claims below)

- Lane / human owner: Core A / Rules & Evaluation — Daniel, explicitly reassigned by the user in this session.
- State: Partial: first live slice and saved-store closeout complete; remaining corpus stopped at the user’s request.
- Read first: AGENTS, current four-developer playbook, OWNERSHIP, ASSIST_CONTRACT, existing candidate handoff.
- Existing candidate: PR #3 head `3cf0361`; combined integration tracked in [COORD-03](COORD-03.md).
  Existing author checkout: /Users/danny/Documents/ChatGPT/RealPage/core-backend. Preserve it and its commits.
- Current branch/checkout/base/result: `codex/core-backend`, `/Users/danny/Documents/ChatGPT/RealPage/core-backend`, merged main `3b1ef06`, runtime result `9ac58ba`.
- Exclusive allowed paths for this task: navigator/extraction.py; tests/test_extraction.py; docs/core_rules/**; this card; private ignored run data.
- Reserved: the other Core lane's runtime/tests/cards, frontend, Platform APIs/services, models/contracts,
  dependencies, tests/conftest.py and shared docs/board. Core B exclusively owns core_assist.py.
- Dependency: Existing shared models and Platform contracts; keep the trace checkpoint independent of live extraction.
- Next bounded action: Keep extraction stopped. If explicitly resumed, finish D022 source review and continue the same resumable store; see the new Core A handoff.
- Checks (checkout Python): python -m pytest tests/test_extraction.py -q; configured-only: python -m navigator extract --doc-id D001.
- Acceptance: retain the task's behavioral acceptance below; preserve one evaluator and evidence uncertainty.
  Platform must test actual combined HTTP/exports before marking integration verified.
- Non-goals: rewriting delivered features, changing another owner's files, model-authored legal certainty.
- Handoff: actual commit, paths, exact checks/results, remaining dependencies and whether combined integration ran.
- Authority: user-authorized local commits and local branch integration only; Daniel pushes manually. No remote merge, deployment or teammate contact.

## Current Daniel continuation — 2026-10-03 local / 2026-10-04 UTC

The user explicitly assigns this session to Core A and requests local branch integration.
Human: Daniel. Sole writer: Codex /root, session 01a103d0-b88b-7090-97aa-f9d5eec55d45.
Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend`; branch `codex/core-backend`.
Fetched merged-main base: `3b1ef06`; local integration: `3eced75`; final runtime candidate: `9ac58ba`.
Read-only helpers reviewed Core A behavior; they made no edits. The prior task's extraction remains stopped.
Daniel releases future writes to the planner, renderer, core_assist adapter, their tests and CORE-04/05
to Core B under OWNERSHIP. No shared-board edit or teammate contact was made.

Actual D001 run `2c214d19d3b944a29f98847f16db16ca` used `gpt-6.1-sol`, took 152.588s, and saved two rules with 26,229 observed tokens. Automated original-text review retained pending status, exact quotations, strict thresholds and exclusions without supplying an unsupported effective date.

The final corpus run `296de71f2c794d6c9ca3ed48f133ebb2` stopped cleanly as partial after 1,296.981s: 15 processed documents, 140 stored rules, seven cache hits, and only the requested-interruption error. Valid empty D011 and all caches/drafts remain preserved. All 54 texts/hashes and evidence offsets match originals; 39 captures remain unprocessed and 33 captures are missing. All 500 addresses remain represented with unresolved local geography. No new provider call followed the stop.

The enum-contract guard from `a422fb3` is preserved. The new extraction-to-evaluator regression ensures enactment snapshots do not create effective dates. Read-only evaluation of seven actual stored rules exposed and verified the related CORE-02 repair. Changes in this continuation: `tests/test_extraction.py`, this card and `docs/core_rules/**`; runtime extraction was not rebuilt.

Core A focused tests: 93 passed. Disposable-copy checks: 125 historical focused / 200 full-suite passed; compileall/contracts/diff passed and working contracts stayed intact. Real evidence, replay, synthetic regressions and automated versus human review are distinguished in the handoff. All actual CLI/API closeout results, partial-export limitations, usage and missing dependencies are in `docs/core_rules/CORE_A_HANDOFF.md` and `saved_store_closeout.json`. CORE-01’s full-corpus acceptance remains incomplete, not blocked by missing credentials.

Final local integration: actual lookup and assist both HTTP 200 on A0001 / 2026-10-01, with unresolved geography and bounded analysis preserved. Partial export contains 16 representable rules, retains all 500 input IDs, and has no broken lookup/override references. Validation's 124 unknown-temporal projection errors remain explicit; all 140 internal rules are retained and review-needed. These in-process checks do not constitute Platform release approval or independent legal review.

## Daniel author record — preserved from PR #3 head 3cf0361

The following is Daniel's complete task record at the imported commit, including historical
claims and checks. The current lane assignment above controls future work. His newer live
evidence is in `docs/core/CORE01_LIVE_REVIEW.md`; COORD-03 records combined Platform verification.

# CORE-01: live extraction and evidence review

- Human owner: Daniel. Tool/session: Codex /root, 01a103d0-b88b-7090-97aa-f9d5eec55d45.
- Branch: codex/core-backend. Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend`.
- Base: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`. Current tested extraction implementation: `a422fb3`.
- Current state: funded live extraction is working; D001/D003–D008 reviewed; enum-contract defect repaired; captured corpus running. Current evidence: `docs/core/CORE01_LIVE_REVIEW.md`. Earlier setup blockers below are historical.
- Allowed: `navigator/extraction.py`, `tests/test_extraction.py`, a new core evidence report and this card;
  isolated data/cache directory for the writer. Model/schema changes require Platform stewardship.
- Reserved: API, geocoder, frontend, canonical models/contracts, original corpus, shared board.
- Read first: AGENTS, build brief, CONTRACTS, DECISIONS, extraction pipeline and actual corpus source.
- Outcome: one live source runs end-to-end, then all captured text is reviewed for omissions and supported interpretations.
- Acceptance: first D001 run has valid exact quotations, lifecycle/threshold/exemption support and unresolved issues retained;
  then full run reports actual tokens/timing/counts/errors. Spot-check at least state/local overlap, exemption and proposal history.
- Checks: `python -m navigator extract --doc-id D001`; `python -m navigator extract`;
  `python -m navigator validate`; `python -m pytest tests/test_extraction.py -q`; save actual API lookup/export evidence.
- Non-goals: target rule counts, hard-coded laws, official score claims or fabricated enactment evidence.
- Target: 30–60 minutes for first real slice; split full-corpus quality review if needed.
- Handoff: provider/model identifier, run IDs, usage, semantic spot checks, errors and commit in this card (no keys).
- Integration authority: user/Core reviewer and Platform contract steward; no publication/deployment authority.

## Daniel's Core implementation claim — 2026-10-03

Human owner: Daniel. Sole writing agent: Codex /root, session 01a103d0-b88b-7090-97aa-f9d5eec55d45.
Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend` (dedicated clone; no pre-existing changes).
Branch: `codex/core-backend`. Base: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`.
The user assigns this session to Core; earlier unallocated metadata is superseded by this claim.
Claimed paths: the exact allowed implementation/tests/card above, plus `docs/core/**` and ignored `data/core-session/**` for evidence.
Work is serialized CORE-03 -> CORE-04 -> CORE-05 -> focused CORE-02; adapter changes have one writer.
State: Blocked for live extraction: OPENAI_API_KEY and OPENAI_MODEL absent; participant pack located at /Users/danny/Downloads/participant-final-no-hour16.
No push, merge, deployment, external messages or submission authorized.

### Local result — software fixes Review; live acceptance Blocked
Pack located and ingested in isolated ignored data/core-session. D001 returned ProviderUnavailable;
OPENAI_API_KEY and OPENAI_MODEL are both missing. No live rules, token usage or legal review claimed.
Focused tests reproduced missing end_date/status_as_of field-support checks; fixed with extraction
prompt version extract-v2-core-dates and actual-occupancy wording. 8 extraction tests pass.
Actual run IDs, timing, validation/export/lookup outcomes and next action: docs/core/EXTRACTION_EVIDENCE.md.
Corpus run and real source review remain blocked only on provider configuration and subsequent quality review.

Final combined candidate: `0c32ec447e1e9f3d352702a252493843c7871682`; 82 focused and 96 full-suite tests passed; compileall, contracts generation (disposable copy), and diff check passed. See docs/core/CORE_HANDOFF.md.

## CORE-01 continuation — 2026-10-03

Daniel reassigns this same session/checkout to live extraction and review, starting from
`c92ad8fbd27a2175a41cb74428cdc03fb76ab14a`. Branch now tracks origin/codex/core-backend;
existing untracked docs/.DS_Store is preserved. This agent does not push.
Allowed writes remain extraction.py, test_extraction.py, this card, docs/core notes and the existing
ignored data/core-session store. No shared paths or completed planner/renderer changes are claimed.
Current prerequisite check: neither key nor model configured; no local .env. Existing pack and source
snapshots are valid; no re-ingestion/reset needed. Fresh D001 attempt is ProviderUnavailable.
Offline work reproduces and repairs lifecycle-history loss during duplicate-rule merge and malformed
cache metadata escaping failure handling; valid empty results and valid cache reuse remain supported.

Continuation implementation: `4155617a05b9a24ef0c6093d1910e7113359dbdf` (**Review**).
18 extraction tests; disposable runner 92 focused / 106 full-suite passed, compileall/contracts/diff
passed, working contracts unchanged. Repeated equivalent alternative histories retain all evidence.
No production files beyond extraction.py changed; no shared board/models/contracts/API/dependencies edited.

Live acceptance remains **Blocked**: fresh run `fff936be69f04f6296a4e7efe0f32ba7` failed
ProviderUnavailable in 0.040 seconds, processed=0, rules=0, model absent, no calls/usage.
All 54 original texts match the reused store; 87 sources/500 addresses remain. Full corpus not attempted.
Automated D001 source-only checklist records exact offsets, exclusions and the absence of final-adoption/
effective evidence; this is not provider or human legal review. No construction-year occupancy trigger.

Evaluation/validation/export at 2026-10-01 remain explicitly partial; all 500 IDs retained, no rule
references, 500 unresolved municipalities, all T1–T5 blocked. CLI lookup unavailable; actual local HTTP
lookup 503 and assist 404. Platform retrieval/evidence/geography and route wiring remain dependencies.
Current source-review limitations, 33 missing source IDs, commands/run IDs/counts/errors and direct local
key/model setup are in `docs/core/EXTRACTION_EVIDENCE.md`; current verification log is
`docs/core/verification.json`. Next: configure locally, review live D001, then resume captured corpus.
No push, merge, deployment, contact or legal-accuracy claim; Daniel pushes manually.

### Latest local setup and provider attempts

Both settings are now configured. Corrected malformed first `.env` line and duplicated model prefix,
preserving key/other settings and keeping the file ignored, mode 0600. Actual D001 runs:
`4edb554e813f40ff943a641fff17d0f7` (malformed model value, HTTP 404, 1.034s) and
`7a402a6829d942a59c705954bce8db44` (gpt-6.1-sol, HTTP 400, 0.402s), both zero processed/rules.
One minimal API diagnostic then returned 429 credit_balance_exhausted / insufficient_quota.
The original 400 cause remains unclassified; calls stopped at the confirmed credit blocker.
No completed model response/usage, no corpus extraction. Source inputs and 500 unresolved addresses
preserved. Current records: `core01_configured_attempts.json`, `core01_provider_diagnostic.json`.
Next bounded action: add API credits for this key's organization, then retry D001 and inspect any
remaining request error before proceeding. Existing 106-test code result is unchanged.
