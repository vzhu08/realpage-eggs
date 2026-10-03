# CORE-01 evidence — live extraction and automated source review

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

## Historical configured attempts — 2026-10-03

The user created the ignored local `.env`. Secure parsing found an invalid first line (preserved as
a comment) and a duplicated model-setting prefix (corrected). Other parsed settings, including the
key, were preserved. Both key and model are now present; file permissions are 0600. No credentials
were shown, logged, staged or committed.

Same explicit `data/core-session` path and unchanged real inputs; D001 commands were identical to
the command below. Actual outcomes:

| Request | Model identifier | Actual result |
| --- | --- | --- |
| D001 run `4edb554e813f40ff943a641fff17d0f7` | Incorrect local value `OPENAI_MODEL=gpt-6.1-sol` | HTTP 404, failed; 22:54:23 UTC; 1.034 seconds; processed/rules/cache hits all zero |
| D001 run `7a402a6829d942a59c705954bce8db44` | Corrected `gpt-6.1-sol` | HTTP 400, failed; 22:55:12 UTC; 0.402 seconds; processed/rules/cache hits all zero |
| One minimal connection diagnostic (request for empty JSON, no legal input) | `gpt-6.1-sol` | HTTP 429; `credit_balance_exhausted`, type `insufficient_quota`; no response ID or usage |

The HTTP 400 cause remains unclassified. The diagnostic logged only allowlisted error metadata and
boolean message flags, never the raw error body or key. It establishes an API-credit blocker; it does
not prove the original 400 had the same cause. These were three HTTP attempts, no completed model
response, no token-usage record and no accepted rules. No actual extraction or replay quality claim.
All further calls, including corpus extraction, stopped after the funding error.

Safe records are `core01_configured_attempts.json` and `core01_provider_diagnostic.json`; run manifests
and empty usage lists remain in the same ignored store. Source JSON hash is unchanged; 87 sources,
54 texts, 500 addresses, zero rules and 500 unresolved municipalities remain. Existing benchmark
partial evaluation/export evidence remains applicable; no fabricated output replaces the failed runs.
No production code changed in this setup turn; the existing 106-test verification is still the code
verification record. `CORPUS_REVIEW_CHECKLIST.md` adds bounded source-only checks for the next real run.

Next: use [API billing](https://platform.openai.com/account/billing/overview) for the organization
that owns this key to add credits, then retry D001 with the existing explicit store. If HTTP 400
persists after funding, inspect sanitized request-error metadata before further corpus calls.
No key replacement or additional dotenv edits are needed based on the current evidence.

## Earlier continuation before local configuration — 2026-10-03

Started from `c92ad8fbd27a2175a41cb74428cdc03fb76ab14a` on `codex/core-backend`.
Fresh configuration checks after loading the existing dotenv configuration found both
`OPENAI_API_KEY` and `OPENAI_MODEL` absent. No values were logged. The existing `.venv`
was reused; neither dependencies nor shared configuration changed.

All real-input operations use the same explicit directory:
`/Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session`.
The valid participant pack remains `/Users/danny/Downloads/participant-final-no-hour16`.
No reset, re-ingestion, original-source overwrite, synthetic injection, scraping or teammate-cache
copy occurred. All 54 stored texts exactly match the original captured files (decoded UTF-8-sig),
and actual text hashes match the store. The historical declared-manifest hash discrepancies remain
separate provenance issues; this check does not repair or validate those declarations.

### Actual extraction and local processing

Safe machine-readable records: `core01_preflight.json`, `core01_pipeline_results.json`, and
`core01_service_results.json`. Full CLI stdout/stderr and partial outputs remain in the ignored
store's `core01-followup/` directory. Run manifests remain under `runs/`.

From this checkout, the actual first-slice command was:

```sh
.venv/bin/python -m navigator --data-dir /Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session extract --doc-id D001
```

Run `fff936be69f04f6296a4e7efe0f32ba7`: 2026-10-03 22:42:49 UTC, 0.040 seconds,
exit 2 / ProviderUnavailable, failed, zero processed documents and zero rules. Prompt version
`extract-v2-core-dates`; configured model **absent**; provider calls **0**; provider usage **not
produced**. Manifest mode `live` records an attempted mode, not successful model evidence.
No provider outputs or reusable extraction cache entries exist. D001 is 8,000 characters and one
chunk. The 54 captured documents total 76 chunks with the current 18,000/1,500 configuration.
The corpus extraction was not run after this decisive prerequisite failure.

Evaluation, validation, export and CLI lookup used the existing interfaces with benchmark date
**2026-10-01**. Exact commands and exit codes are in `core01_pipeline_results.json`.

| Operation | Actual result |
| --- | --- |
| `evaluate --as-of 2026-10-01 --allow-partial` | Exit 0; partial run `8f67d4a2da454266bb29dbda00450937`, 22:45:35 UTC, 0.010 seconds |
| `validate --as-of 2026-10-01` | Exit 0; `ready_for_submission=false` |
| `export --as-of 2026-10-01 --allow-partial` | Exit 0; partial run `92e67f0601524a369b83ea63eb86bf07`, 22:45:36 UTC, 0.040 seconds |
| `lookup A0001 --as-of 2026-10-01` | Exit 2 / DatasetUnavailable; no legal lookup asserted |
| Local HTTP TestClient, same real store | Health 200 / partial; lookup 503 / dataset_unavailable; `/api/v1/lookup/assist` 404 |

The partial export is labeled `PARTIAL_NOT_JUDGE_READY`: 87 sources, 54 texts, 500 addresses,
zero rules, zero exportable rules, all T1–T5 blocked. All 500 input address IDs are represented
(exact set comparison). All exported lookup rule references resolve **vacuously: there are zero
references**. Quote/schema failures are zero with denominator zero, not evidence of extraction quality.
The 500 municipalities remain unresolved because this isolated store has no Platform Census cache.
Input/source hashes remained unchanged through processing and HTTP reads. Platform's assist route
is an explicit dependency; API wiring was not edited.

### Source-review preparation and missing evidence

`D001_SOURCE_PREFLIGHT.md` is an automated read of the supplied original text with exact offsets.
It is not live extraction output, a provider semantic review, human review or independent legal review.
No actual extracted quotations, executable conditions or omissions can yet be compared against it.
In particular, the captured closing record supports passage to print on November 18, 2025, not
final adoption/effective date. A date in the URL or retrieval metadata supplies neither. No explicit
end date is stated. Construction year and actual first occupancy are not factual triggers in this
text; its references to occupancy levels must not be converted into either.

All 33 absent captured texts are enumerated with original manifest IDs/status/URLs in
`core01_preflight.json`. Consequential potential dependencies, based only on those identities:

- California D017–D021: screening fees, termination/rent-cap provisions, security deposits and
  fair-housing code references; D028 is algorithmic-pricing commentary.
- New Jersey D061–D064: discrimination, eviction and deposit code references; D060 is FAIR Act
  reporting. Hoboken D032–D034 and Newark D070–D072 are terms-review local code sources.
- Massachusetts D056 is the failed CORI housing capture; D059 is missing ballot-status reporting.
  D054–D055 are absent fee-related secondary sources.
- Los Angeles D038 and San Diego D074–D075 are terms-review code captures; D044 and D077 are
  absent interest/protection guidance. Berkeley D002, Cambridge D030, Jersey City D035/D037 and
  Santa Ana D086/D087 are missing secondary/status context.

These are review priorities, not findings that another captured document cannot supply overlapping
support. Final adoption/effective evidence for D001, state/local overlap, exemptions, proposal history
and unsupported factual predicates still require review of actual extraction and available evidence.
Platform owns retrieval/evidence gaps; no missing document was scraped or treated as proof of no law.

### Scoped software repairs (synthetic evidence only)

Focused temporary-fixture reproductions demonstrated two extraction defects:

1. Duplicate-rule merging discarded different `status_events` and `status_as_of`. Different supported
   histories/snapshots now survive through the existing conflict path, without automatic precedence.
   Equivalent event ordering merges normally; equivalent histories, including repeated alternative
   variants, retain additional rule/event evidence and review issues.
2. Malformed cache wrappers could raise uncaught `KeyError` and leave a run `running`, while an empty
   wrapper could trigger a new provider call. Metadata is now checked explicitly. Invalid entries fail
   with a finished manifest, preserve the previous rules/cache, and make no replacement provider call.

Only `navigator/extraction.py` and `tests/test_extraction.py` changed in production/test scope.
Prompt/schema are unchanged by these repairs, so valid caches remain reusable. Focused extraction
tests: **18 passed**, including valid empty results and cache replay without additional provider calls.
Tests use synthetic disposable data. They do not establish legal accuracy or live-provider readiness.

Implementation commit `4155617a05b9a24ef0c6093d1910e7113359dbdf` passed the inspected
`.venv/bin/python docs/core/verify_candidate.py`: **92 focused tests, 106 full-suite tests**,
compileall, disposable contract generation, and `git diff --check`. One existing Starlette/httpx
deprecation warning remains. `verification.json` records current logs; `verification_initial.json`
preserves the historical 96-test result. Original working contracts were hash-verified unchanged.
Seven example JSON differences generated in the disposable copy remain Platform's review responsibility.

### Exact local setup and next bounded action

Create a project key at [OpenAI API keys](https://platform.openai.com/api-keys), and ensure the API
project has funding via [API billing](https://platform.openai.com/account/billing/overview).
Recommended starting model: `gpt-6.1-sol`, based on the
[official model capabilities](https://developers.openai.com/api/docs/models/gpt-6.1-sol), not a measured
legal extraction result. Review D001 before the corpus run; account access has not been tested.

In the VS Code terminal:

```sh
cd /Users/danny/Documents/ChatGPT/RealPage/core-backend
cp -n .env.example .env
chmod 600 .env
nano .env
```

Set these existing entries locally (never paste the real key into chat):

```dotenv
OPENAI_API_KEY=PASTE_YOUR_KEY_HERE
OPENAI_MODEL=gpt-6.1-sol
NAVIGATOR_DATA_DIR=/Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session
NAVIGATOR_PACK=/Users/danny/Downloads/participant-final-no-hour16
```

Save with Control+O, Enter, then exit with Control+X. `.env` is already ignored by Git.
Next: verify presence without showing values, rerun the explicit D001 command, inspect exact source
anchors/conditions/dates/omissions, then run the same command without `--doc-id D001` to resume all
captured texts. Preserve three transport attempts, one validation repair, and stop after three
consecutive source failures. Record actual model response IDs/usage/timing before claiming completion.
Daniel pushes manually; this session has not pushed, merged, deployed or contacted teammates.

## Historical initial run (preserved)

Owner Daniel; sole writer Codex /root. Dedicated clone/branch and base are in CORE_HANDOFF.md.
Participant pack found at `/Users/danny/Downloads/participant-final-no-hour16`; originals unchanged.
Both OPENAI_API_KEY and OPENAI_MODEL were absent from this session; no local .env was found.
No secret values were printed. Python 3.13.15 virtual environment installed exact requirements.lock.

Actual local commands (from the Core checkout; `.venv/bin/python`):

- `-m navigator --data-dir data/core-session ingest --pack /Users/danny/Downloads/participant-final-no-hour16`: success, 87 manifest entries, 54 source texts, 500 addresses, 54 declared/actual hash mismatches. Run `a96fb8f7334b47bb8a91b696498fed1e`, 2026-10-03 22:12:23 UTC, 0.029 seconds.
- `-m navigator --data-dir data/core-session extract --doc-id D001`: exit 2 ProviderUnavailable. Run `2634e1c36d41409cb511644884c6090f`, 22:12:46 UTC, 0.036 seconds, processed=0, rules=0. Manifest mode=live denotes the requested mode, not a successful model call. Model unset; zero provider calls, no billed usage recorded. The attempt preceded the prompt-version fix and records extract-v1.
- `-m navigator --data-dir data/core-session validate --as-of 2026-10-01 --output data/core-session/validation.json`: completed; ready_for_submission=false. Zero rules means quote/schema failure counts of zero have denominator zero. Source gaps: 33 absent texts; all 54 texts await extraction.
- `-m navigator --data-dir data/core-session lookup A0001 --as-of 2026-10-01`: exit 2 DatasetUnavailable, correctly refusing a legal lookup without completed extraction.
- `-m navigator --data-dir data/core-session export --as-of 2026-10-01 --allow-partial --output data/core-session/partial-export`: PARTIAL_NOT_JUDGE_READY; all 500 input IDs represented, zero rule references, all T1–T5 blocked.

The isolated store has no Census cache and 500 unresolved municipalities. This does not contradict
Platform's historical 479 resolutions: no teammate data/cache was copied or geocoding rerun.
No real source interpretation, quotations, thresholds, exemptions or lifecycle output could be reviewed
because no provider output exists. No full corpus extraction was attempted after the decisive missing
configuration failure. No synthetic rules were inserted into this real store.

Two focused extraction defects were reproduced by failing tests: supplied end_date and status_as_of
could lack field-level support without a review issue. Both now require support. The extraction prompt
names actual first occupancy and explicitly rejects year-built substitution; prompt version
`extract-v2-core-dates` invalidates stale prompt caches. Field-level labels and exact quote presence
still do not prove semantic or independent legal correctness. Existing synthetic extraction/replay,
provider-failure and bounded-repair tests pass; these are software evidence only.

Next bounded action: Daniel configures OPENAI_API_KEY and an explicit OPENAI_MODEL locally, runs D001
with the command above, reviews original-source anchors/meaning/lifecycle/omissions, then resumes the
captured corpus. Preserve this store and its run manifests; obtain Platform's resolved geography through
its existing ownership process before evaluating real local coverage. No push/deploy/submission done.
