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
