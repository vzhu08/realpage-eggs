# CORE-06 offline implementation and evidence handoff

Daniel / Core A, sole writer, session `01a103d0-b88b-7090-97aa-f9d5eec55d45`.
Branch `codex/core-a-change-evidence`, isolated checkout
`/Users/danny/Documents/ChatGPT/RealPage/core-a-change-evidence`.
Reviewed/fetched base: `ad0881a15d3828a7ecc3bedb83167d6416912371`.
Final runtime implementation (following `54b2120ae9cb5bacee39b63dd6999fe3297df89d`): `b33af14dbd46bbad0ffafd795916bb503795a89b`.
The final evidence/documentation commit follows that implementation; see this branch's log.
The prior `codex/core-backend` checkout/commits were preserved and were already on origin.

Available software and offline review are complete. CORE-06's real-evidence acceptance remains
partial: missing sources, unresolved lifecycle/interpretation, geography, and independent human
review prevent a complete legal result. Paid extraction remains explicitly paused. The latest
direct user instruction authorizes pushing this code/documentation branch; it does not authorize
store upload, extraction, merge, deployment, or teammate contact. No such actions were taken.

## Changes and interfaces

- `navigator/source_comparison.py`: internal source, claim and rule-version comparison on existing
  canonical models. Both claims, exact original spans, hashes, authority, dates, changed fields,
  missing support and remedies survive. Formatting/offset/citation differences are separate from
  substantive encoding changes. Neither identical quotations nor later retrieval establishes
  semantic support or precedence. Conditional property impacts call the existing `evaluate_rules`.
- `navigator/changes.py`: unchanged unknown results across dates now retain possible impacts;
  review-needed selected rules prevent a complete empty-result claim; a negative-case
  “no operative obligation” note requires failed status at the query date and no unresolved review.
  Definite geographic exclusions remain excluded. Synthetic regressions establish these repairs.
- `tests/test_source_comparison.py` and `tests/test_change_adapters.py`: comparisons, anchors,
  missing support, thresholds/exemptions/dates, uncertainty and failed-proposal regressions.
  Existing engine/trace tests cover dates, scoped precedence, boundaries and hypothetical immutability.
- `docs/core_rules/verify_candidate.py`: optional report output within Core A's lane. The historical
  runner remains unchanged and all contract-generating checks still run in its disposable copy.
- `docs/core_rules/core06/*`, CORE-06 card and Core A handoff: reproducible review helpers and evidence.

PLAT-06 has not released a comparison contract at the reviewed base. The smallest proposal is
`compare_sources(before, after)`, `compare_claims(field, values, SourceSpan lists, source maps)`,
`compare_rule_versions(before: Rule, after: Rule, source maps)` and
`compare_impacts(rule lists, PropertyFacts, JurisdictionResolution, as_of)` returning internal
observations. Platform should select a shared envelope for field, both claims/spans, source identity,
rule IDs, unresolved reason and remedy. No models, public schemas, endpoints, official export
formats, fact definitions, dependencies, frontend or Core B files were changed. `rule_traces`
remains the producer boundary; consumers must not implement another evaluator.

## Immutable data and local transfer

Original store: `/Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session`.
Private copy: `/Users/danny/Documents/ChatGPT/RealPage/core-a-change-evidence/data/core06-working`.
Original 182-file manifest digest:
`617964c32c667e55ab5623b1d2cf8de8f1b7dbba72b72539c8c1e23cb9637fde`.
[snapshot_manifest.json](snapshot_manifest.json) records every original/copy hash.

[transfer_manifest.json](transfer_manifest.json) is the precise 94-file local transfer allowlist,
with sizes and individual hashes. Its payload-manifest digest is
`acaf723ebd04047e1874e726f249293e6352b100cb9e210ee56cca2c607563eb`.
It includes rules, unchanged sources, extraction indexes, caches, provider-output provenance,
run manifests, address facts/bounds/provenance, unresolved resolutions and required dataset/schema
metadata. Secrets and unrelated historical experiments/exports are excluded. It is a file manifest,
not an uploaded archive. Platform needs a user-approved destination/method and owns subsequent
geography assembly. No approved transfer route was available, so the payload remains local.

All 54 delivered source files match saved source bytes; see
[source_pack_integrity.json](source_pack_integrity.json). All source/offset, extraction-origin-run,
address and resolution references passed transfer checks. All 182 original files and all 94 copied
input files remained byte-identical. Only new verification runs/results were added to the private
copy. No rule/data corrections were applied, and no unrelated review issues were cleared.

## Real results at 2026-10-01

[offline_results.json](offline_results.json) records actual commands, code hashes, runs and checks.
The run used provider-constructor/generate, HTTP-transport, DNS and socket guards. Two local guard
probes were rejected; the actual workload attempted zero provider/network calls. No credentials
were printed or requested. This task incurred zero new provider calls/tokens.

- 87 manifest sources; 54 captured; 15 processed; 39 captured documents remain unprocessed.
- 140 rules, all review-needed; 84 replay and 56 live provenance; zero synthetic stored rules.
- 16 exportable; 124 temporal projections remain unknown; zero quote failures.
- 500 addresses preserved in evaluation/export; all exported lookup/override references resolve.
- Zero resolved municipalities in this store. No Census cache was borrowed or city inferred.
- Export label: `PARTIAL_NOT_JUDGE_READY`. Expected validation/export exit 1 reflects the 124
  unrepresentable temporal results, not a new software exception.

| Case | Current engine | Real evidence readiness | Next dependency |
| --- | --- | --- | --- |
| T1 | partial; 0 definite, 250 uncertain | Unestablished | AB325 operative-date authority/16702 and actual SB763 text/history |
| T2 | blocked | Unestablished | Hoboken/Jersey City ordinance text/history and Platform legal geography |
| T3 | blocked | Unestablished | D069 extraction after authorized resume; exact local targets/scope/other-law exception |
| T4 | blocked | Unestablished | Substantive H5222/S2983 texts and dated disposition; captured pages are procedural history |
| T5 | blocked | Unestablished | Actual IP25-21 petition and authoritative failure disposition; D048 is not that evidence |

The empty definite sets do not establish that no obligations exist. T1's former internal
“complete” status is corrected without inventing an effective date. No expected organizer address
set was used. [change_case_review.json](change_case_review.json) independently records mappings,
exact spans, dates/scenario, source gaps and engine status for each case. Synthetic tests demonstrate
geographic exclusions, boundaries, scopes, failed records and pending hypothetical immutability;
the missing real evidence prevents claiming those legal cases passed.

The CLI lookup for actual A0001 succeeded. The existing `POST /api/v1/lookup/assist` returned HTTP
200 using in-process ASGI and actual saved facts/rules; planner/renderer capabilities were present.
This is real-data integration evidence, not a browser deployment test or a claim of legal coverage.
Raw outputs remain under `data/core06-working/core06-results/`.
Evaluate run `60f0ca12ab1b4518b4df96d798a796b6`: 11.845 seconds, partial.
Export run `1d4b9b700f9642d295665931487438a3`: 108.661 seconds, partial.

## Source review and temporal triage

[temporal_triage.json](temporal_triage.json) covers every one of the 124 unrepresentable rules:
rule/document/date, reason, original support, lifecycle dimensions, action and affected case.
All 124 lack an effective date; 24 also have unknown lifecycle without dated observation/history.
An absent repeal/end date is not itself their projection failure. Adoption/enactment, effectiveness,
observed status and retrieval remain distinct. **Corrected: 0; unresolved: 124.**
D014 supplies a Boston HSNA date candidate, but D013's online procedures differ from the older
mail/certificate guidance; binding versions/exemptions remains a review action, not an automatic
cross-document date assignment.

[priority_source_review.json](priority_source_review.json) finishes D022's separate agent review:
the two restraints/coercion clauses, two-or-more-person/competitor-data definition, commercial terms,
consumer exclusion, criminal-penalty limits and preserved antitrust scope were checked. Chaptering/
approval is not effectiveness; BPC16702 and actual SB763 remain dependencies. No construction-year
predicate is present in these rules; no blanket algorithm ban, new law or forced count was added.

The same report anchors D069's section3 definitions/exclusions, section4 prohibitions, section6(b)
qualified municipality-conflict clause and section9 relative date. July1,2027 is an explicit
calendar derivation using July20,2026 approval as enactment, labeled for review, not an extracted
Rule. No particular local ordinance is deemed superseded. D045–D047 retain March12 procedural
history; they lack substantive bill text. D048 is MGL40P§4 with a qualified voluntary-regulation
exception; it supplies no ballot failure record. No captured text established the guide's alleged
June23 failure. Source absence is not evidence the event did not happen.

[source_comparisons.json](source_comparisons.json) applies the implementation:
NJ/local remains missing-support; Berkeley's passed-to-print record cannot resolve January1/March1
allegations; D041/D042 agree on February2,2026 utility cutoff, while the January24 allegation lacks
captured support. The calculator's 3% interval ends June30,2026 and cannot be extended to the
benchmark. The Boston pair demonstrates real encoded differences and conditional impacts through
the single evaluator, with local geography and interpretations unresolved.

All source reading is agent review plus automated exact-anchor checks. It is neither new provider
semantic verification nor independent legal review. Human reviewer: **not assigned; pending**.
[platform_requests.json](platform_requests.json) identifies exact acquisition/assembly dependencies.
[core_b_review_candidates.json](core_b_review_candidates.json) provides source-backed candidates for
Oliver, clearly unscored and awaiting a named human reviewer; no planner benchmark metrics claimed.

## Verification and reproduction

Run from the isolated checkout using its existing `.venv/bin/python` (Python3.13.15, reused original
venv; no dependency installation/change). Source guide: local participant README, organizer PDF and
`dev/change_tests.json`, treated as case definitions rather than legal evidence.

| Actual command/check | Result |
| --- | --- |
| `NAVIGATOR_PACK=/Users/danny/Downloads/participant-final-no-hour16 .venv/bin/python -m pytest -q` at base | 255 passed |
| New change regressions before repair | 3 failed, 6 passed |
| `.venv/bin/python -m pytest tests/test_engine.py tests/test_change_adapters.py tests/test_extraction.py tests/test_traces.py tests/test_source_comparison.py -q` | 113 passed |
| `.venv/bin/python docs/core_rules/verify_candidate.py --output docs/core_rules/core06/verification.json` | exit 0; 141 runner-focused + 275 full-suite passed; compile/contracts/diff passed |
| `.venv/bin/python docs/core_rules/core06/offline_verify.py` | exit 0; validate 1, evaluate 0, export 1, lookup 0; every integrity assertion passed |
| `.venv/bin/python docs/core_rules/core06/build_review.py` | exit 0; reproduced triage/source comparisons/cases/transfer manifest |
| `.venv/bin/python docs/core_rules/core06/audit_queue.py` | exit 0; guarded read-only cache/usage audit |
| `git diff --check` | exit 0 |

[verification.json](verification.json) identifies implementation commit b33af14 and the disposable
checks. One existing Starlette/httpx deprecation warning remains. The first baseline run regenerated
five nondeterministic example files in this isolated checkout; their exact HEAD bytes were restored
before task edits. All later full-suite/contract generation ran only in the disposable copy. No
shared or historical report/contract changes are included in this branch.

## Paused queue and next bounded action

[extraction_queue.json](extraction_queue.json) records all 87 source/cache states and all 39 remaining
captured documents. The original 15 processed documents have 16 valid chunk-cache entries, including
D011's empty result. No extraction command was invoked, even for cached material.
Historical model: `gpt-6.1-sol`; historical stopped run `296de71f2c794d6c9ca3ed48f133ebb2` remains partial.
Observed deduplicated usage: 35 responses (34 completed, 1 incomplete), 243,550 input + 277,296 output
= 520,846 tokens. Unknown-billed timeout/interruption usage is excluded, so this is not a bill total.

Proposed first paid slice, **not authorized or executed**: D069 only, one chunk, serial, maximum
three logical responses (extraction, verification, one repair). Planning expectation is 12–35k input
and 10–40k output tokens; review ceiling 150k returned tokens. Existing transport retries can make
up to nine attempts and unknown-billed timeouts defeat a returned-token ceiling. Conservative
allowance: 360k input + 288k output; cost depends on confirmed rates. The current CLI has no cumulative
spend cutoff. An account dollar cap, approved rates/model, enforced stop policy and explicit resume
are required before execution. Do not blindly retry an unknown-billed timeout. This proposed budget
is a planning estimate, not an approved spend or billing guarantee.

Next unblocking actions: Platform obtains the targeted missing texts and releases a comparison
contract; the user selects a store-transfer destination and a human reviewer. Any provider resumption
requires a separate explicit budget decision. Core B can work against the documented internal
observations/candidates meanwhile. No messages were sent to teammates.
