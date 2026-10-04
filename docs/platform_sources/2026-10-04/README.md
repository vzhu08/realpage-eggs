# T1-T5 source handoff for Daniel / Core A

Platform captured **21 documents on October 4, 2026 UTC**: eight California, six New Jersey
municipal and seven Massachusetts documents. Twenty are hosted by official government or
municipal legislative systems; one is a court-authored slip opinion on an amicus participant's
site. This corrects the earlier Platform completion summary: new-source acquisition was still
Platform work and had not been delivered. The existing saved NJ FAIR Act text (D069) was already
available and is not counted as a new capture.

Task: [PLAT-11](../../tasks/PLAT-11.md). Branch: `codex/platform-source-acquisition`.
Base: `445102a0b0f306f51feae94e1ac3207f025b8a92`. Root was the only writer; three agents performed
read-only source research/content checks. Existing captures, rules, extraction caches, source IDs,
Core notes and the running release were not changed. No extraction/provider calls were made.

## What to use

| Case | Captured material | Remaining acquisition/review limits |
| --- | --- | --- |
| T1 | AB325 and actual SB763 chaptered texts and histories; BPC articles including16702,16729,16755/16755.1/16756.1/16762; California Constitution ArtIV | Requested supporting texts available. Core interprets applicability and dates; current code includes neighboring provisions with different dates. |
| T2 | Hoboken B-781 full legislative record, July9 minutes pp10-12 and city announcement; Jersey City adopted25-057 and amendments25-098/25-105 | Hoboken publication date and minutes approval unverified. JC exact operative/publication dates and absence of later amendments unverified. Redline PDFs require visual review. |
| T3 | Same local texts for comparison with already-saved D069 NJ FAIR Act | Local publication/date gaps remain Platform work. Core owns exact conflicting target/scope and qualified other-law exception; no automatic preemption winner. |
| T4 | Substantive H5222/S2983 text and fresh official histories | Histories observed October4 list March12 referrals, not enactment. Retrieval is not a historical status event. |
| T5 | Original IP25-21 petition, H5008 transmission/certification, court-authored SJC-13893 slip opinion | Opinion is from a third-party mirror. Official docket/opinion verification and final county judgment remain unverified. |

Start with [acquisition_status.json](acquisition_status.json) and [content_review.json](content_review.json).
The latter records source-specific checks and caveats. Core's original
[requests](../../core_rules/core06/platform_requests.json) are preserved as historical input.
Berkeley, LA and other temporal requests in that file are outside this bounded T1-T5 delivery
and remain open; this bundle does not silently close them.

## Files and identity

- `raw/`: unchanged HTTP response bodies, with HTML/PDF extensions determined from content.
- `text/`: separate UTF-8 derivatives. HTML uses the documented deterministic parser in
  `capture.py`; PDF uses pypdf6.10.0, with form-feed page separators. PDF formatting, strikeout,
  insertion and signatures are not represented faithfully in plain text. Inspect raw PDFs.
- [manifest.json](manifest.json): URLs, final URLs, retrieval timestamps, HTTP status, selected
  response headers, raw/text SHA-256, derivation and review notes. Raw hashes and text hashes
  serve different purposes. Records retain all five failed attempts as well as successful retries.
- [sources.json](sources.json): 21 canonical `SourceDocument` records using new `P11_...` IDs.
  Their `sha256` identifies the exact derivative UTF-8 text, not the downloaded PDF/HTML.
  All are supplementary, with explicit review issues. The court mirror has distinct authority.
- `records/`: original capture-attempt metadata. Those records retain their initial pending-review
  status; the aggregate manifest adds the later content review without rewriting capture metadata.

Daniel can merge selected records into a **new private working copy**, after reviewing raw sources,
preserving existing D IDs and their evidence offsets. This is a source bundle, not a whole Store;
do not replace an existing `sources.json` with it. No importer or provider job runs automatically.
The existing paid extraction pause remains in effect. Interpretation/human review is separate
from source acquisition and integrity checks.

Important version details: Hoboken's title says158-2 and body154-8; the discrepancy remains exact.
JC25-098 adds algorithm-related disclosure and separately changes218-1 security requirements.
JC25-105 changes general1-25 penalties referenced by25-057; it does not directly amend218-12.
Do not assign every housing-penalty change to the algorithm ordinance. These specific versions
do not prove that the amendment chain is exhaustive.

T5's opinion majority concludes on PDF p16; the separate concurrence begins p17. The mirror's
identity, date, full text and disclaimer are preserved. The official petition and prior AG
certification establish identity/history, not proof of current ballot eligibility.

## Verification and reproduction

Both checks below passed for all21 documents and accounted for five failed attempts, offline.
Agent review additionally checked target identity/substance and relevant PDF pages, including
redlines, adoption records, petition certification and the opinion's disposition. This is not
independent legal review or evidence that T1-T5 evaluations now pass.

```powershell
# Repository Python (Pydantic installed): hashes, models, IDs and metadata
.\.venv\Scripts\python.exe docs/platform_sources/2026-10-04/verify.py
# Python with pypdf6.10.0: independently regenerate all HTML/PDF derivatives
python docs/platform_sources/2026-10-04/verify.py --derive-only
```

`capture.py` is the one-off acquisition script and skips completed attempt IDs. Do not overwrite
this dated snapshot to refresh a page; create a new dated/versioned capture. `build_handoff.py`
reproduces the manifest and additive records from captures plus content review. No runtime,
schema, frontend or dependency change is part of this delivery.
