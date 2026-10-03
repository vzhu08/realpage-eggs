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

## Successful D003 retry and current corpus resumption

D003 run **`6a01da26bbd44b0ca364b8f4988dcacd`** completed at 23:24:15 UTC in **354.466 seconds**,
using `gpt-6.1-sol`, 32,000 output allowance and 600-second read timeout. It added **14 rules**,
zero errors; store total became 24. Two completed responses consumed **20,547 input + 31,898 output
= 52,445 tokens**. The actual command added `--doc-id D003` to the extraction command above.
Safe manifest, usage and audit: `core01_d003_live.json`.

The final review added a broader criminal-history/background-check-use prohibition supported by
`[294,560)` and removed a separate unsupported lifecycle snapshot. All **70 evidence instances /
15 distinct spans** and all 14 main quotations match the original text. Owner exemption retains
owner occupancy, owner-of-record primary residence, and **1–3 units inclusive** together; missing
ordinance-specific requirements remain unsupported. Section 8/lifetime-offender references do not
supply blanket exemptions. Notice, opportunity to respond and prominent notice distribution remain.
The council-passage event is **2020-04-14**; effective/end/status_as_of remain null. No construction-
year/occupancy substitution, general rent/deposit cap, or unsupported interaction was found. All 14
records remain **needs_review**; ordinance details, exemption scope and effective date are unresolved.

Full-corpus run **`dec1982a0b2e4fe29ce31e8862b01430`**, started 23:26:06 UTC, reuses D001/D003/D004
full caches. Same command, store, configured model and bounded limits. Captured output:
`core01-live/corpus-final.stdout.json` / `corpus-final.stderr.log`. It is still running; no final counts
or full billing total are claimed. `audit_live_store.py` performs a repeatable read-only structural/
original-text audit with explicit store and original-text paths; it does not certify legal accuracy.

## D005 automated source comparison

The current corpus run saved **15 rules** after draft extraction (11), semantic/omission review (15),
and the existing single structural repair. The model initially wrote `California` where the shared
contract requires `CA`; repair normalized the representation and explicit false conflict flags without
changing the reviewed legal content. This handled provider-format error did not require a schema or
code change. Four review-added provisions separately cover policy order/selection, unconsidered-
applicant fees, fee-cap disclosure and Chapter 13.78 contractual applicability.

All **39 evidence instances / 20 distinct spans** and 15 principal quotations match the original.
The **$68.96** cap remains specific to **2026** (`[459,510)`, `fee_year == 2026`); no exact effective/end
dates were invented. Credit-report timing is **seven days from landlord receipt** (`[624,739)`), with
the agency's “should expect” qualification retained. The unselected-applicant refund alternative
requires **all three** policy elements (`[1098,1375)`); unused-fee refunds remain separate (`[868,914)`).
Nonrefundable existing-tenancy fees retain renewal/roommate scope (`[2647,2961)`), not a universal
fee ban. Pre-fee rights/cap disclosure, unresolved City URL placeholder, broad contractual applicability
(`[3022,3169)`) and violating-term unenforceability (`[3170,3288)`) remain represented.

All 15 retain **needs_review**, unknown operative dates and unresolved primary statutory/exemption
support. No invented precedence, penalties or occupancy proxy was found. This is automated source
comparison, not human or independent legal review. Evidence: `core01_d005_live.json`; aggregate usage
and elapsed time await the finished corpus manifest.

## D006 automated source comparison

The current corpus run saved **25 rules** after draft (23) and semantic review. All **90 evidence
instances** match original offsets. Selected high-risk checks found no demonstrated contradiction:
**5% limits the Annual General Adjustment**, with banked increases over 5% retained (`[11884,12265)`);
nonpayment requires debt **at least one month of regional HUD Fair Market Rent**, not contract rent
(`[6660,7033)`). The notice tenancy threshold **2024-12-20** (`[8886,9296)`) is distinct from the
utility-tenancy/charge threshold **2024-02-06** (`[9758,10071)`). Shared-facility exemption includes
landlord residence at tenancy start (`[3350,3556)`). Subsidy full/partial coverage and flattened-table
qualifiers remain unresolved (`[4029,4234)`).

No effective/end/status-snapshot/event dates were invented. All 25 remain **needs_review**. Many
predicates depend on facts outside the shared registry; particularly `rent_ordinance_coverage` is a
legal classification requiring source/reviewer work, not a renter factual question. No fact registry,
models or planner changes were made. Evidence: `core01_d006_live.json`.

## Cross-source limits found in captured primary text

Read-only comparison of D005 with **captured D026 (Civil Code 1950.6)** found consequential agency-
summary omissions. D026 permits applicant-provided credit reports (`[1794,1921)`) and references
reusable reports under 1950.1 (`[5911,6029)`); it does **not establish D005's mandatory-use claim**.
Ordinary and qualifying reusable reports may differ. No dedicated 1950.1 capture is in the manifest;
this interpretation remains unresolved. The no-availability prohibition includes knowledge and
availability within a reasonable period (`[2654,2885)`). Actual screening costs/reasonable time and
CPI adjustment of a $30 base (`[1922,2653)`) do not independently calculate the reported **$68.96**.

Primary refund paths additionally require completed-application order and written criteria
(`[3169,3457)`), concurrent-submission safeguards/transfer option/considered-denial qualification
(`[3684,4536)`), or the earlier of **seven days after tenant selection / 30 days after submission**
(`[4537,4845)`). The credit-report receipt deadline is confirmed (`[5605,5910)`).

Captured **D025 (Civil Code 1950.5)** clarifies D007's owner shorthand: **at most two residential
rental properties and four dwelling units offered for rent** (`[4867,5013)`), a prospective-service-
member exclusion (`[5014,5097)`) and qualifying ownership/trust definitions (`[5551,5898)`). Generic
`owner_total_units` or `family_trust` labels do not establish those narrower conditions. These are
primary texts already available for the forthcoming extraction, not globally missing documents.
Safe findings: `core01_cross_source_review.json`. No automatic legal precedence, manual cache rewrite,
property-fact invention, or human/independent legal review is claimed.

## D007/D008 review and demonstrated fact-contract repair

D007 produced **18 rules**, with **33 exact evidence instances**, after the existing single structural
repair normalized state identifiers. Source dates/caps, strict post-January-1-2003 cleaning threshold,
21-day return, and local annual/prorated interest were preserved. No numeric interest rate was invented.
Cross-source owner qualifications are described above. Evidence: `core01_d007_live.json`.

A read-only runtime check found a **demonstrated encoding defect**: two D007 rules used registered
`owner_type` values `natural_person`, `family_trust`, and `limited_liability_company`, incompatible with
the existing registry's `individual`, `trust`, and `llc`. The small-owner rule
`r-710522e0c2ff928cefe1` returned definite **inapplicable / coverage=false** for a hypothetical canonical
`individual` input despite an unresolved ownership qualification. This was a synthetic in-memory probe
against a real extracted rule, not a claim about an actual property. Record: `core01_fact_contract_fix.json`.

Core repair **`a422fb3`** consumes the shared definitions read-only. At extraction/cache validation,
incompatible enum comparisons in coverage, exemption and interaction scopes become **unsupported**,
with original expression/path and a review issue retained. It never guesses legal aliases: family-trust
qualification cannot be broadened to every trust. Valid enum values and explicit source-specific facts
remain unchanged. Original provider/cache files are preserved, and current validation applies on replay;
no prompt/schema/cache-key change or fresh model call is required for compatible completed evidence.
New manifests identify `fact_contract_validation: enum-literals-v1`.

Five focused regressions failed before this fix; **30 extraction tests pass** after it. The disposable
runner at `a422fb3` passed **104 focused / 118 full-suite**, compileall, isolated contracts and diff check;
working contracts unchanged, same seven Platform-owned generated-example differences and existing
Starlette/httpx warning. Read-only peer review found no blocker; repeated guard application is idempotent.
Real D007 cache revalidation run **`eb389c18dd4b4af28c6b3acdfc2fc2c9`**: **0.046 seconds**, one document,
one cache hit, 84 total rules, **zero provider calls/usage**. The same hypothetical probe now yields
**unknown / coverage=unknown**, with source-interpretation uncertainty retained.

D008 produced **two rules / ten exact evidence instances**. The rate remains **1.0%**, distinct from
65% of CPI / 1.5% CPI; rounding uncertainty is retained. Adoption **2025-10-16**, earliest adjustment
**2026-01-01**, signed snapshot **2025-10-17** apply to the AGA version, with no invented end date.
Exemption requires **tenancy_start >= 2025-01-01 AND Costa-Hawkins-set rents**. Missing Regulation1148
eligibility and notice details stay unsupported. Evidence: `core01_d008_live.json`.

The corpus was interrupted after D008 to install the demonstrated repair. Run
**`dec1982a0b2e4fe29ce31e8862b01430`** finalized **partial** after **1,207.285 seconds**, seven processed
documents, 84 total rules, three full cache hits and no source failure. Observed usage **87,052 input +
101,037 output = 188,089 tokens**; an interrupted request's usage remains unavailable, so this is not
complete billing. Evidence: `core01_corpus_contract_pause.json`.

Corpus resumed as **`296de71f2c794d6c9ca3ed48f133ebb2`** at **23:48:10 UTC**, same full-corpus command,
model, explicit store and bounded limits, with seven completed caches reused. Output files:
`core01-live/corpus-guarded.stdout.json` / `corpus-guarded.stderr.log`. Final corpus results remain pending.

## D009 automated source comparison

The resumed run saved **three category rules / 13 exact evidence references**. Rent-control-only
exclusions remain separate from eviction/deposit-interest coverage. New construction uses actual
completion **and** certificate-of-occupancy dates, never construction year as an occupancy proxy.
Subsidy/HUD conjunctions, Golden Duplex historical/current occupancy, shared-facility tenancy-start
condition and strict post-2018-11-07 ADU date remain. “Most” and overlapping rooming-house categories
stay unsupported. Lifecycle is **unknown**, all dates null; no rate or penalty was invented.

A conservative redundant before-1996/or-not-before-1996 partition in two rules can retain uncertainty
when tenancy_start is absent despite identical coverage on both sides. No unsupported legal
simplification or planner rebuild was made. Evidence: `core01_d009_live.json`.
