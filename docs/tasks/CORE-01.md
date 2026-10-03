# CORE-01: live extraction and evidence review

## Current four-developer assignment (supersedes historical claims below)

- Lane / future owner: Core A / Rules & Evaluation. Existing author Daniel; Vincent confirms continued session/base before edits.
- State: Review for candidate software repairs; live extraction Blocked on OPENAI_API_KEY and OPENAI_MODEL.
- Read first: AGENTS, current four-developer playbook, OWNERSHIP, ASSIST_CONTRACT, existing candidate handoff.
- Existing candidate: origin/codex/core-backend at c92ad8f; tested candidate reported as 0c32ec4.
  Existing author checkout: /Users/danny/Documents/ChatGPT/RealPage/core-backend. Preserve it and its commits.
- Future branch/absolute checkout/base/result commit: record at handoff; do not assume current main includes this candidate.
- Exclusive allowed paths for this task: navigator/extraction.py; tests/test_extraction.py; docs/core_rules/**; this card; private ignored run data.
- Reserved: the other Core lane's runtime/tests/cards, frontend, Platform APIs/services, models/contracts,
  dependencies, tests/conftest.py and shared docs/board. Core B exclusively owns core_assist.py.
- Dependency: Existing shared models and Platform contracts; keep the trace checkpoint independent of live extraction.
- Next bounded action: Review 30cdfb7, configure locally when available, then run and independently review D001 before broader extraction.
- Checks (checkout Python): python -m pytest tests/test_extraction.py -q; configured-only: python -m navigator extract --doc-id D001.
- Acceptance: retain the task's behavioral acceptance below; preserve one evaluator and evidence uncertainty.
  Platform must test actual combined HTTP/exports before marking integration verified.
- Non-goals: rewriting delivered features, changing another owner's files, model-authored legal certainty.
- Handoff: actual commit, paths, exact checks/results, remaining dependencies and whether combined integration ran.
- Authority: local task commits; no push, merge, deployment, external messages or new agents implied.

## Prior author record — preserved from c92ad8f

The following records Daniel's earlier single-Core work and reported checks. Its broad or Running claims
are historical; the current scope/state above controls future work. Remote-reported tests were not rerun by
this documentation pass, and the candidate is not merged into this checkout.

# CORE-01: live extraction and evidence review

- Human owner: Daniel. Tool/session: Codex /root, 01a103d0-b88b-7090-97aa-f9d5eec55d45.
- Branch: codex/core-backend. Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-backend`.
- Base: `354089fa9d1cfbaae3f6c8ad6595e6f024de4e26`. Result: `30cdfb7630b7bac81b7464e980ab6033ee69a239`.
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

Final combined candidate: `0c32ec447e1e9f3d352702a252493843c7871682`; 82 focused and 96 full-suite tests passed; compileall, contracts generation (disposable copy), and diff check passed. See docs/core/CORE_HANDOFF.md.
