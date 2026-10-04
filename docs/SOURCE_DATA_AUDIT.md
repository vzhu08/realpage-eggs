# Source data audit — October 4, 2026

The saved corpus has a source-quality problem, but the evidence does **not** support saying
that half of its extracted rules came from news articles or the wrong API. The checkpoint
contains 23 secondary law-firm/news/mirror **links with no captured text and no rules**.
The larger issue is that 136 of 140 rule candidates were extracted from official guidance
or a city-linked policy, while many captured primary texts remain unprocessed.

This is an offline audit of the immutable
[`core-store.zip`](core_rules/snapshots/core-store.zip), not a claim about the current hosted
release or any later extraction run. The archive SHA-256 is
`157581d64b1c19fdfcc0414d08bbd0ffeeeca60e3142bd621a7152fe5c6e44bc`.
It preserves the original corpus, provider provenance and review flags. No retrieval,
provider calls, source replacement or Store writes are performed by this audit.

## Verified inventory

The reproducible [JSON report](evidence/source_data_audit.json) includes each source's URL,
authority, recorded type, capture hash/check, rule count, processing status and source-use
disposition. It contains no property records or full copied source bodies.

| Recorded publisher category | Inventory entries | Captured texts | Rule candidates |
| --- | ---: | ---: | ---: |
| Official | 54 | 53 | 120 |
| Official city-linked policy | 1 | 1 | 20 |
| Secondary law firm / news / mirror | 23 | 0 | 0 |
| Code publisher | 9 | 0 | 0 |
| Total | 87 | 54 | 140 |

- All 54 captured texts match their saved SHA-256 values.
- Fifteen captured documents have an extraction-index entry with status `review`; 39 are
  unprocessed in this checkpoint. Fourteen documents produced the 140 rule candidates.
- Twelve sources labeled `agency_guidance` produced 136 candidates. D001 and D022 are the
  two sources labeled `legal_text`, each producing two candidates. D011 is a status record
  with zero rules. Source types here are saved extractor metadata, not legal validation.
- All 140 candidates still need review. The four primary-text candidates are **not four
  accepted laws**: D001 lacks final-adoption support and D022 has its recorded date/scope
  issues. The evaluator's existing review guard retains unknown coverage where applicable.
- Under `source-use-v1`, 24 inventory entries are context-only: the 23 secondary links plus
  D011. Ten are access-blocked: nine publisher links requiring terms review and D056's failed
  capture. Two are primary-text candidates; 51 need document-role review.

The secondary IDs are D002, D015, D017–D021, D028, D030, D035, D037, D044, D054–D055,
D059–D064, D077 and D086–D087. The terms-review IDs are D032–D034, D038, D070–D072 and
D074–D075. They remain useful discovery/provenance records; none is silently deleted or
reclassified as accepted law.

## Distinguish permission, authority and document role

[DATA_SOURCE_RULES](DATA_SOURCE_RULES.md) records the earlier organizer-pack review:
automated extraction from the supplied corpus, public data only, supplements subject to
access terms, and the California corpus-copy instruction. Supplied-corpus membership does
not establish that a document is an operative legal instrument. Public accessibility does
not establish permission to scrape or redistribute it.

The ignored organizer README, PDF and CSV manifest were not available in this Mac checkout
or the searched local Documents/Downloads/Desktop locations for this audit. Their prior
review and recorded hashes are available in DATA_SOURCE_RULES; registration-specific
eligibility and licenses have not been independently reverified here. Do not invent an
organizer prohibition on every secondary source or a requirement that all laws arrive
through one API. This audit did not test any API endpoint; it found no wrong-API evidence.

Use these distinctions when reviewing the data:

| Material | Appropriate treatment |
| --- | --- |
| Official statute, adopted ordinance or authenticated regulatory text | Primary-text candidate; verify provision, version, scope and effective history before an operative result. |
| Official bill text | Candidate for the proposal's substance; bill text alone does not establish enactment. |
| Official history/docket/adoption record | Context supporting the particular status event it records; it is not a substitute for the substantive provision or missing judgment. |
| Agency guidance, summaries and announcements | Preserve as context. Obtain the primary instrument or a specific reviewed instrument classification before operative use. |
| Secondary reporting, law-firm summaries and unverified mirrors | Discovery/context only; never independently establish operative obligations. |
| Link-only, failed or terms-review capture | Retain the gap and provenance; no rule extraction from unavailable or uncleared text. |

Do not classify by `/news/` or `.gov` alone. D004 is an official Berkeley Rent Board
adjustment announcement; D080 is an official San Francisco Rent Board rate announcement.
D010 contains the Boston Fair Chance Tenant Selection Policy linked by the city through
Google Drive. Those deserve instrument-specific review, not automatic dismissal as
journalism or automatic promotion to adopted law. The shared policy conservatively leaves
guidance and unclassified material in review. A policy allowance is never independent
legal approval, and synthetic fixtures never become actual legal authority.

## Prioritize existing primary-text review

The following priorities are **manual document-review recommendations from the saved
source bodies**. They neither create rules nor change the source classifications. No legal
threshold or address outcome is hard-coded in the audit. Later extraction must preserve
the original hashes, exact quotes, provider lineage and unresolved facts/dates.

| Priority | Existing document IDs | Observed content and reason to review |
| --- | --- | --- |
| 1 | D023–D027 | The supplied California code texts identify CIV 1946.2, 1947.12, 1950.5, 1950.6 and GOV 12955. Use these captured statutory bodies instead of substituting general guidance or refetching contrary to the corpus-copy instruction. |
| 1 | D049–D053, D057–D058 | Captured Massachusetts General Laws sections contain substantive statutory text. D057 includes multiple effective versions, which must remain distinct. |
| 1 | D065–D066, D069 | Captured New Jersey chaptered acts contain substantive provisions. A separate completed D069 pilot exists; reconcile its reviewed lineage before any new provider run rather than duplicating work. |
| 1 | D073 | Captured San Diego Municipal Code Division 7 contains section text and amendment/effective annotations; verify the version and provision-level support. |
| 2 | D048 | Actual Massachusetts Chapter 40P section 4 text, useful for its own subject. It does not establish the T5 ballot petition's failure. |
| 2 | D001, D022 | Already extracted legal-text candidates; use existing source-review handoffs to address adoption/date/scope gaps rather than treating their source labels as acceptance. |
| 2 | D076 | A mixed San Diego staff-report/ordinance-materials packet; inspect component documents and adoption evidence before classifying the whole packet as operative text. |

D045–D047 are captured Massachusetts bill landing/history pages. The later
[PLAT-11 bundle](platform_sources/2026-10-04/README.md) already supplies substantive bill
and municipal texts under new IDs; preserve those identities instead of overwriting the
original D IDs. Their source-use and effective-history caveats persist. The
[browser follow-up](platform_sources/2026-10-04-browser/README.md) verifies additional
court docket identity and municipal adoption notices, but not every missing judgment or
publication/operative-date claim.

The generated `extraction_review_queue` is broader than this manual priority list: it has
39 unprocessed captured official records whose existing metadata permits extraction review.
It deliberately leaves their legal status `not_determined` and `accepted_for_release=false`.
In particular, an unclassified landing page or announcement in that queue is **not** an
approved primary source. Source-role checks must remain in extraction and release handling.

## Reproduce safely

From the repository root, with the locked Python environment:

```sh
python scripts/audit_sources.py --archive docs/core_rules/snapshots/core-store.zip
python scripts/audit_sources.py --archive docs/core_rules/snapshots/core-store.zip --output docs/evidence/source_data_audit.json
python scripts/audit_sources.py --store /path/to/frozen/store --output /path/outside/store/source-audit.json
python -m pytest -q tests/test_source_audit.py
```

The tool reads only `sources.json`, `rules.json` and the optional `extraction_index.json`.
It never extracts the ZIP, refreshes a capture, initializes a provider or writes inside an
input Store. Output defaults to stdout. An explicit output may replace an earlier report
outside the input Store; input paths and hardlink aliases cannot be overwritten. Duplicate
JSON keys and duplicate ZIP members are rejected rather than silently choosing one.

The committed report reproduces exactly from the immutable archive and shared policy.
Focused tests cover the saved counts, Store/archive equivalence, input immutability, missing
progress metadata, altered source hashes and output protection. Passing them establishes
software behavior, not complete legal coverage or submission eligibility. The separately
paused extraction job and currently served release are untouched by this audit.

## Integrated correction and hosted cross-check

The October 4 source-data fix adds a shared source-use gate at extraction, cached-output
validation, evidence preparation and partial rule export. Contextual candidates remain
visible with review blockers and original citations; they cannot become accepted operative
records through a matching quote alone. Context-only negative findings are excluded from
supported coverage, and partial exports cannot leave override IDs pointing to excluded rules.
`check-terms` survives ingestion even when a local text file is present. Batch and pilot
preflight reject blocked material before provider initialization. Original captures and
provider output caches are preserved.

The API exposes separate inventory, captured-text, rule-producing-source and primary-review
counts; the interface calls the 140 records candidates from 14 documents. This changes
classification and safeguards, not the substance of any law or the 500 property facts.

A separate read-only check on October 4, completed before 12:18 UTC, compared all 87
`/api/v1/sources/{id}` responses from `https://realpage-navigator.onrender.com` with the
audited archive. Every `sha256`, `authority`, `source_type` and `capture_status` matched.
The hosted health response reported 140 rules and 500 properties. This connects the source
audit to the hosted source metadata; it does not independently validate every hosted rule,
its geography, or its legal interpretation. No hosted dataset or deployment was changed.

Implementation was split among three agents in isolated checkouts: extraction guards,
API/export enforcement, and reproducible audit. The integration owner handled the shared
policy/contracts, ingestion restriction and frontend labels. Paid extraction was not started
or resumed; the outstanding primary-text queue requires its existing extraction/review owner.
