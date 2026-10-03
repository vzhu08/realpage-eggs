# CORE-01: live extraction and evidence review

- Human owner: Core owner, name/claim pending. Tool/session: unallocated.
- Branch/checkout/base/result commit: unallocated.
- Dependency/blocker: user sets OPENAI_API_KEY and OPENAI_MODEL in local .env; never paste keys into chat.
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
