# CORE-01 real extraction and automated source review

Owner Daniel; sole writer Codex /root. Read-only agents assisted comparison; neither human review
nor independent legal review is claimed. Same explicit isolated store throughout:
`/Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session`.
Original captured files remain `/Users/danny/Downloads/participant-final-no-hour16/corpus/text/`.
Benchmark date: 2026-10-01. No synthetic laws, invented geography, missing-source scraping or teammate
data copying. Daniel pushes manually.

## Funded request repair

After the user added API credits, D001 still returned HTTP 400 in runs
`94936c30ecf64f8b81ce8225f49c8944` (0.464 seconds) and
`e7d2438cb4e745c09293536e472c92ca` (0.357 seconds, sanitized diagnostic).
The API identified `input`: JSON mode requires an explicit JSON instruction in that field;
the existing separate `instructions` field was insufficient for this endpoint guard.
`core01_funded_diagnostic.json` records only allowlisted metadata and boolean flags.

Core fix `d1ca8ce`: prepend an explicit JSON instruction to the unchanged serialized payload;
use prompt version `extract-v3-core-json-input`. No valid real caches existed before this repair.
A synthetic MockTransport regression reproduced failure before the fix and passed after it.
19 extraction tests passed. Inspected disposable runner: 93 focused / 107 full-suite tests,
compileall and isolated contract generation passed; original contracts hash-unchanged.
`verification.json` is current; `verification_pre_live.json` preserves the prior 106-test report.
No model/contracts/API/dependency/planner/renderer changes.

## D001 first real slice

Actual command:

```sh
.venv/bin/python -m navigator --data-dir /Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session extract --doc-id D001
```

Run **`2c214d19d3b944a29f98847f16db16ca`**, model **`gpt-6.1-sol`**,
2026-10-03 22:59:40–23:02:13 UTC, **152.588 seconds**. Success: one processed document,
two rules, zero cache hits/errors, one source-scoped negative finding. Two completed provider
responses: **13,781 input + 12,448 output = 26,229 tokens**, including 542 reasoning tokens.
Raw usage retains cache-write details and provider response IDs. No structural repair was needed.
Complete safe audit record: `core01_d001_live.json`; raw draft/review/usage remain in the ignored
store under `provider_outputs/2c214d19d3b944a29f98847f16db16ca/`.

The implementing agent and a separate read-only agent compared the reviewed/persisted result with
the original, including its draft-to-review changes. All **20 evidence instances / 12 distinct
spans** match original zero-based Python character offsets. Both principal quoted spans are verbatim.

| Check | Actual result and original support |
| --- | --- |
| Distinct obligations | Vendor provision quote `[4829,5081)` and landlord-use quote `[5086,5283)` remain separate rules. |
| Numeric threshold/data scope | `identified_input_data_age_days < 90`, nonpublic data, other-property ownership/management boundary, and coordination requirement retained; definition evidence `[4339,4701)`. Data predicates concern the same qualifying input, not all inputs. |
| Exclusions | Definition `[2683,4335)`: aggregated anonymous reports require no recommendations; affordable-limit products, financing research, appraisal and software-development alternatives remain explicit. Review corrected the draft's overly broad software-runtime proviso to the described predictive/ML activity. Interpretation limitation remains. |
| Remedies | City remedies `[5534,5914)`; tenant remedies `[5919,6444)`; landlord month/unit multiplicity `[5284,5502)`. $1,000 ceiling, distinct enforcement scope, prevailing-party fees and tenant fee-waiver restriction retained internally. No invented multiplication formula. |
| Lifecycle | Passage-to-print evidence `[7695,7874)` supports pending snapshot/event 2025-11-18. No final adoption, effective date, end date or URL/retrieval-derived enactment was invented. |
| Occupancy | No construction-year, first-occupancy or certificate-date predicates. Source occupancy levels/rates retain their own meaning. |
| Omissions/negative findings | No target count imposed. Source-scoped statement that this chapter does not regulate rent amounts is not a citywide absence-of-law finding. Enforcement retained in penalties; six-category omission review is automated and not a completeness guarantee. |

Rule IDs: `r-12c99cf95c4f2cd2242e` (provider prohibition), `r-f372d8d7042cb492998b`
(landlord use). Both remain **needs_review**, with ten retained issues each; source index status
remains **review**, despite successful pipeline completion. Final adoption/current status, prior
versions/interactions, the data-age reference time and software-exclusion interpretation remain
unresolved. Custom algorithm/data/activity facts are dependencies, not established address facts or
answers supported by the current fact registry. No further demonstrated extraction defect emerged
from this first slice. Exact quotation checks do not establish legal accuracy.

## Captured corpus

Started the existing resumable workflow after the D001 comparison:

```sh
.venv/bin/python -m navigator --data-dir /Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session extract
```

The workflow selects 54 captured texts / 76 chunks, reuses the valid D001 cache, and retains existing
three transport attempts, one structural repair, concurrency one and stop-after-three-consecutive-
source-failures behavior. Missing captures are not retrieved. Final results will be recorded here;
starting the workflow does not establish corpus completion.

Corpus run: `a2c106ffc11b44258bc0e207a2970777`, started 2026-10-03 23:02:51 UTC.
CLI output is captured in the same store's `core01-live/corpus.stdout.json` and `corpus.stderr.log`.

This first corpus attempt hit three response-read timeouts on D003 with the original 120-second
limit. D001 had been replayed successfully; a D004 draft subsequently completed. The operator
interrupted during D004 review to correct the transport limit before further repeated failures.
The old code's interrupt escaped manifest finalization; its original `running` manifest was preserved
in `core01-live/interrupted-original-manifest.json`, then finalized as **partial** through Store.finish.
`core01_corpus_interrupted.json` records the recovery and notes elapsed time includes bookkeeping.
Observed D004 draft usage: 3,011 input + 4,014 output = 7,025 tokens. Timed-out/interrupted-request
usage is unavailable, so observed usage is not a complete billing total.

Core repair **`114ec4a`** raises only the read timeout to 300 seconds, preserving three transport
attempts and the existing output/repair limits. New manifests record the read timeout. Interrupts now
produce finished partial/failed manifests with completed records preserved. Saved drafts can be reused
only under the same source/chunk/schema cache key and matching run/model/mode/prompt/pipeline metadata;
every reused draft still receives the full review and validation pass before it can become a rule.
Draft origin chains are recorded in `config.draft_replays`. No prompt-version change or invalidation
of D001's valid cache was needed for this transport/resumption repair.

24 extraction tests passed, including two interruption/resume cycles and incompatible provenance.
Disposable runner at `114ec4a`: **98 focused / 112 full-suite passed**, compileall/contracts/diff passed,
original contracts hash-unchanged; one existing Starlette/httpx deprecation warning.

Resumed corpus run **`b0f3490db6d54a2e97f6c7be92334240`**, started 2026-10-03 23:13:02 UTC,
uses the same explicit store and selected 54 texts. Output: `core01-live/corpus-resume.stdout.json`
and `corpus-resume.stderr.log`. Completion and observed usage remain pending.

The resumed run returned a definitive D003 **incomplete** response at exactly 16,000 output tokens;
it was rejected, never accepted as empty/partial law. D004 successfully reused its draft, completed
review and produced eight rules. Before continuing, the operator interrupted the run to repair the
demonstrated output limit. New interrupt handling finalized it automatically as partial: two processed
documents, ten total rules, one full cache hit and one draft replay; 289.303 seconds.
Observed responses: D003 3,703 input / 16,000 output (incomplete); D004 review 6,428 input / 7,243
output (completed). Interrupted-request usage remains unavailable. `core01_corpus_output_limit.json`
retains the actual manifest and usage, distinct from accepted evidence.

The bounded response allowance is now 32,000 tokens with a 600-second read timeout. Three transport
attempts, one structural repair, serial operation and three-consecutive-source-failure stop remain.
Both bounds are recorded in new manifests. Valid completed caches and draft provenance remain compatible
because source/schema/prompt/model are unchanged. An explicit regression rejects incomplete responses
even if their text happens to parse as valid JSON; usage/status remain recorded. D003 is retried alone
before the next corpus resumption, so the larger-output path can be checked without repeated corpus starts.

## D004 automated source comparison

Eight records were produced from an official agency announcement, following draft replay and a fresh
semantic review in run `b0f3490db6d54a2e97f6c7be92334240`. All **38 embedded evidence/event instances,
10 distinct ranges**, match original offsets exactly. Persisted semantic fields match the final review.
Standard relocation payment **$19,413** (`[1139,1208)`), additional **$6,471** (`[1209,1305)`), and
the **1.5%** adjustment (`[1306,1618)`) match the source; the percentage concerns relocation payments,
not interest or rents. Approval **2025-10-16** and adjustment effectiveness **2026-01-01** are supported
at `[989,1138)`; the source's **2025-10-27** snapshot at `[489,519)`. No end date was invented.

The additional-household qualification and missing exemptions remain `unsupported`; all eight records
remain **needs_review**. Two records concern Board publication duties, not landlord obligations.
`eviction_reason` and `responsible_actor` are absent from the shared fact registry. Underlying ordinance
details, complete property coverage, payment timing and prospective indexing formula are not supplied
by this announcement. No material source contradiction was found in this automated comparison; that
does not establish legal completeness. Safe evidence: `core01_d004_live.json`.

## First real lookup and integration boundary

After D001 completed, the existing CLI lookup for real input **A0001**, as-of **2026-10-01**,
returned exit 0; `POST /api/v1/lookup` through the actual local app returned HTTP 200. Both D001
records are pending; no claim that the address is within Berkeley or subject to an enacted rule.
The response retains missing-source, incomplete-extraction and unresolved-local-geography warnings.
`POST /api/v1/lookup/assist` still returns HTTP 404. No Platform routes were edited.
Evidence: `core01_live_lookup.json`, with complete CLI response in ignored `core01-live/d001-lookup.json`.
This is real-store CLI/local TestClient evidence, not a deployed HTTP endpoint or synthetic replay.
