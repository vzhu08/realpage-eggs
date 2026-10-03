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
