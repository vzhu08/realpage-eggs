# PLAT-12: remaining source evidence and manual extraction pilot

Owner: Vincent / Platform; root is sole writer; NJ/MA agents perform bounded read-only research.
State: manual pilot implemented and offline verified; source follow-up remains partial.
User requested the remaining municipal dates/publication and official court
verification, and manual commands for long jobs to conserve Codex credits. User selected a
$5 ceiling for a one-document extraction pilot; prepare commands without starting the paid run.

Checkout: `C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/platform-ci`, clean at claim.
Branch: `codex/platform-source-closeout`; base: `9ff4396de5b6bdc5d8daed159a0778f993dd49cc`.
Claims: `docs/platform_sources/2026-10-04-followup/**`, `docs/EXTRACTION_PILOT.md`,
`scripts/extraction_pilot.py`, `tests/test_extraction_pilot.py`, this card and Platform shared
coordination docs. No Core extraction/evaluator or frontend edits. Preserve earlier source bundles.

Deliver newly available original evidence with actual access limits, and a bounded manual pilot
using Core's existing extraction and verification path in a new private working copy. Prevent
unattended retries after transport errors; persist accounting and progress; default to dry-run.
Check the input selection and all spending boundaries offline. No paid calls during development.
Push/merge authority persists from the user's earlier Platform instruction; no teammate contact.

Results: one new official NJ statutory compilation (relevant provision on p. 49); five captured
access/source responses verified and derivatives reproduced; two official docket requests failed
HTTP 403. The archive search is not the full docket. County number SJ-2026-0063 is now explicitly
an unverified search-index lead; manual instructions require following SJC-13893's originating link.
Actual municipal publication/certified effective dates and official court verification remain open.

The manual launcher reuses Core's extractor with a new private copy, maximum three actual POSTs,
one chunk, unchanged 32k output cap, bounded request bytes, Standard tier, prepaid local allowance
reservation and no retries after errors/timeouts. Explicit env-file credentials take precedence;
missing keys fail closed. The $4.50 maximum local reservation is not actual billing; instructions
also require a dedicated project with the user's $5 enforced spend limit. No paid job was started.
Real D069 dry-run passes with 10,354 characters and one chunk. See docs/EXTRACTION_PILOT.md.

Validation: full offline suite 430 passed, 1 skipped, one upstream
Starlette deprecation warning. Includes a mocked two-request end-to-end pilot, source-copy
immutability, no-retry/budget limits and explicit credential selection. No paid provider calls.
Contract generation succeeded; all four committed schema files have zero drift. Generated
example churn from this Windows run is excluded from the change.
