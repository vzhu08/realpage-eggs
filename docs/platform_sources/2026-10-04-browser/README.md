# Browser source follow-up - October 4, 2026

This tracked bundle makes the six acquired records available to the codebase. It is
supplemental research evidence, not an ingested Store or an automatically approved demo dataset.
Original downloads, prior bundles and serving snapshots remain unchanged.

## Documents and findings

| Record | Local source | New evidence / remaining limit |
| --- | --- | --- |
| SJC-13893 official docket | [Exact visible text](MA_SJC_13893_DOCKET.txt) | June 23 decision/paper 43 rescript; July 21 issuance; citation 497 Mass. 706; originating case SJ-2026-0063. Full opinion not downloaded. |
| SJ-2026-0063 official county docket | [Exact visible text](MA_SJ_2026_0063_DOCKET.txt) | Matching case/parties; paper 18 records declaratory judgment entered July 21, 2026. Signed judgment is not linked and remains missing. |
| Jersey City 25-057 adoption notice | [Original PDF](JC_25_057_ADOPTION_NOTICE.pdf) | Adoption May 21, 2025; stated insert date May 30, 2025. |
| Jersey City 25-098 adoption notice | [Original PDF](JC_25_098_ADOPTION_NOTICE.pdf) | Adoption September 24, 2025; stated insert date October 3, 2025. |
| Jersey City 25-105 adoption notice | [Original PDF](JC_25_105_ADOPTION_NOTICE.pdf) | Adoption October 8, 2025; stated insert date October 17, 2025. |
| Hoboken B-781 attachment | [Original PDF](HOB_B781_PRINTOUT.pdf) / [legislative record text](HOB_B781_LEGISLATIVE_RECORD.txt) | July 9, 2025 meeting and passage/publication-dependent effective clause. Attachment has blank signatures/votes and stale 2023 placeholders; title 158-2/body 154-8 discrepancy persists. |

The Jersey City insert dates are written instructions/dates on the notices, **not proof that
newspaper publication occurred**. Website modified dates are separate. Do not calculate definitive
effective dates from these fields. All three notice PDFs are image-only; empty `.extracted.txt`
files record that pypdf found no text, not that the documents are empty. Their PNGs were visually
checked. Hoboken's printout is an unsigned template, not certified publication/adoption proof.

`content_review.json` contains agent observations, not independent legal review or source text.
The court docket text now verifies the originating case and post-rescript judgment entry. This
supersedes those specific access/identity gaps in the older PLAT-11/12 handoffs, without rewriting
their historical captures. The signed judgment and official-hosted full opinion remain outstanding.

## Provenance and offline verification

`captures.json` records all 13 observations with source URLs and actual UTC capture times:
four original PDFs, the two court dockets, and seven municipal/navigation text snapshots.
Text files preserve the browser's exact `document.body.innerText`; they are not raw HTTP bodies.
No HTTP status, server response headers, historical retrieval time or certified status is invented.
The docket screenshots preserve the displayed entries. All six PDF pages were visually inspected.

Original browser HTML contains scripts and session/form tokens. It is omitted from Git; the
unchanged full private archive remains at `artifacts/browser-source-acquisition-20261004/`
in Vincent's original checkout. All published PDF/text/image payloads match that archive byte for
byte. `manifest.json` records their hashes and source-archive identity. `.gitattributes` preserves
evidence bytes across platforms. No model call or additional source retrieval is needed to verify:

```sh
python docs/platform_sources/2026-10-04-browser/verify_bundle.py
```

Use the existing project environment (pypdf) or the bundled runtime. This checks every payload hash,
all capture references, four PDF signatures/page counts, reproducible pypdf derivatives, and docket
identity/disposition text. Integrity checks do not establish legal correctness or submission eligibility.
Source-use review remains governed by [DATA_SOURCE_RULES](../../DATA_SOURCE_RULES.md).

## Demo decision

**Stop broad document hunting and focus on delivery.** The remaining signed county judgment,
publication affidavits, certified municipal operative dates and full amendment history may require
clerk records requests; their turnaround is uncertain. No request was sent. Allow a maximum
10-15-minute follow-up only for a concrete new lead that changes the selected demo.

Prioritize assisted-lookup performance and successful browser completion; the typed-input and
reviewed-output integration from Daniel's merged D069 handoff; then a frozen snapshot, consistent
exports, end-to-end rehearsal and local fallback. Keep unresolved publication/effective-date and
legal-interpretation limits visible. These captures improve evidence without clearing every T2/T3/T5
gate or authorizing more paid extraction. See [task card](../../tasks/PLAT-12-BROWSER.md).
