# D001 automated source preflight

Prepared 2026-10-03 from the supplied original text, before any successful live extraction.
This is an automated agent review checklist, not provider output, human review, independent legal
review, an adopted rule set, or a target rule count. No legal rules were inserted into the store.

Store: `/Users/danny/Documents/ChatGPT/RealPage/core-backend/data/core-session`. Original: `/Users/danny/Downloads/participant-final-no-hour16/corpus/text/D001.txt`.
Actual SHA-256: `7f24d692c68f42ed2ab11a2d1f8e060a951f8cf6a3974b4e8090e63081ad6f17`.
All 8,000 Python characters match the original (8,034 UTF-8 bytes after decoding).
The original manifest-declared hash mismatch remains a separate provenance limitation.

Offsets below are zero-based Python character ranges `[start,end)` over the stored/original decoded
captured text, not PDF byte offsets. Literal `\n` denotes a source newline; other whitespace is preserved.

| Review item | Original offsets | Exact quotation |
| --- | --- | --- |
| Definition: coordination and competitor data | `[2680,3041)` | `A. “Coordinated pricing algorithm” means any analytical or computation process that \nuses Competitor Data to calculate and recommend rent prices, fees, occupancy rates or \nother rental contract terms for future leases in coordination between one City of Berkeley \nlandlord and one or more of such landlord’s competitors, including through a third-party \nvendor.` |
| Aggregated anonymous reports exclusion | `[3168,3433)` | `(a) a product or process that \ngenerates or presents any report, study, or presentation that publishes rental data in an \naggregated and anonymous manner but does not recommend rent prices, fees, or \noccupancy rates or other rental contract terms for future leases;` |
| Affordable-housing limits exclusion | `[3434,3652)` | `(b) a product used for \nthe purpose of establishing rent or income limits in accordance with the affordable \nhousing guidelines of a local government, the state, the federal government, or other \npolitical subdivision;` |
| Research/appraisal/software exclusion: complete context | `[3656,4335)` | `(c) a product or process that provides or uses, or the provision or \nuse of, information for the purpose of (i) conducting market research for project financing, \n(ii) conducting an appraisal, or (iii) conducting research, testing, or training for software \ndevelopment. For clarity, “research, testing, or training for software development” \nincludes without limitation the use or processing of Competitor Data in the development, \ntraining, or testing of predictive or machine learning models so long as any such data is \nnot used as an input in the operation of the model at the time a recommendation is \ncalculated for publication or provision to a City of Berkeley landlord.` |
| Own-property boundary | `[4513,4659)` | `regarding a property other than a property that is owned or managed by the landlord \nwho is the recipient or user of the generated recommendation,` |
| Data age strictly less than 90 days | `[4660,4701)` | `when such data is less \nthan 90 days old.` |
| Vendor prohibition | `[4826,5081)` | `A. It shall be unlawful to sell, license, or otherwise provide to City of Berkeley \nlandlords any coordinated pricing algorithm that sets or recommends rents or occupancy \nlevels that may be achieved for residential dwelling units in the City of Berkeley.` |
| Landlord use prohibition | `[5083,5283)` | `B. It shall be unlawful for a landlord to use a coordinated pricing algorithm described \nin subsection A when setting rents or occupancy levels for residential dwelling units in \nthe City of Berkeley.` |
| Per-month and per-unit violations | `[5284,5502)` | `Each separate month that a violation exists or continues, and each \nseparate residential dwelling unit for which the landlord used the coordinated pricing \nalgorithm, shall constitute a separate and distinct violation.` |
| City penalty ceiling | `[5710,5763)` | `and/or civil penalties of up to $1,000 per violation.` |
| Tenant remedy limited to subsection B | `[6001,6107)` | `subsection B, for injunctive relief, money damages, and/or civil penalties of up to $1,000 \nper violation.` |
| Dated passage-to-print record | `[7695,7874)` | `At a regular meeting of the Council of the City of Berkeley held on November 18, \n2025, this Ordinance was passed to print and ordered published by posting by the \nfollowing vote:` |

## Conditions, dates and omissions to inspect after D001 runs

- Preserve both prohibitions, residential/locality scope, the competitor-data conditions, and each
  exclusion branch. Residential status alone does not prove algorithm use or all data predicates.
  Unsupported algorithm/data facts must remain unsupported or unresolved, not unconditional true.
- Keep data age strictly less than 90 days, the $1,000 ceiling per violation, and the per-month/
  per-unit structure distinct. Check City and tenant remedy scope against the full surrounding text.
- The dated closing record is passage to print/publication on November 18, 2025. It does not
  establish final adoption or an effective date. The URL date (2025-12-02) and retrieval timestamp
  (2026-10-01) cannot substitute. No explicit end date appears. Retain unresolved lifecycle evidence
  and request final adoption/effective support through Platform ownership, without scraping here.
- Occupancy here means occupancy levels/rates. No construction year, certificate date, first-occupancy
  day, or building-age cutoff appears. Do not repurpose these mentions as occupancy date predicates.
- Review all categories without inventing a required count. Purpose text saying this chapter does
  not regulate rent amounts does not establish that other rent rules do not exist.
- For each actual model rule, compare quotations and anchored offsets against this original; then
  separately assess semantic support for requirements, coverage, exclusions, dates and interactions.
  Exact string matches alone do not establish support. Preserve valid empty output and review issues.

Current limitation: extraction produced no rules or provider output because key/model were absent.
Actual output review, state/local overlap, other-source exemption and proposal-history spot checks
remain pending. This document does not satisfy live CORE-01 acceptance.
