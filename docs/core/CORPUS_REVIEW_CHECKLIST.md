# Captured-corpus source-only review preparation

Prepared by automated agent review on 2026-10-03 while live extraction was blocked. These are
review priorities from existing captured originals, not provider output, fixture answers, target
counts, human review or independent legal verification. No production rules were inserted.
Offsets are zero-based Python Unicode character ranges `[start,end)` in the original stored text,
including captured headers. Re-read full surrounding text when comparing actual output.

| Source | Original spans | Review priorities |
| --- | --- | --- |
| D024 — CA Civil Code 1947.12 | `[3867,4142)`, `[4143,4268)`, `[4269,4886)`, `[6091,6421)`, `[15507,15873)` | Qualifying lower local-cap exclusion; actual certificate date; mobilehome qualification; conjunctive separate-title/owner/notice exemption; historical/continued owner occupancy; distinguish operative April 1, 2024 from amendment effective January 1, 2024 and stated repeal boundary. |
| D041 — Los Angeles RSO overview | `[499,788)`, `[2074,2335)` | Pair with D024 for state/local overlap. Construction cutoff, replacement-unit dependency and condominium qualification; rent-amount scope versus other RSO protections; dated utility rule and historical freeze through January 31, 2024. |
| D069 — NJ FAIR Act | `[208,253)`, `[3435,3719)`, `[5021,6059)`, `[9341,9570)`, `[10175,10283)` | Approval evidence plus relative effective clause; device and coordinating-function exclusions; qualified municipal-conflict provision does not support blanket supersession. Ground any computed date in both source clauses. |
| D047 — S.2983 history | `[829,883)`, `[1025,1234)` | Committee referral/reporting is procedural history, not enactment or operative requirements. Keep March 12, 2026 procedural actions distinct from retrieval metadata. |
| D011 — Boston H.3744 petition history | `[325,622)`, `[1681,1732)` | Local approval of home-rule petition does not establish state enactment. September 9, 2024 study-order referral leaves an H5035 history dependency; do not invent a failed-law event. |

Missing failed-history source: D059 is link-only with empty text. Its article URL/title cannot
establish ballot failure or a supported date. Platform owns obtaining missing evidence.

D001's separate `D001_SOURCE_PREFLIGHT.md` covers exact quotations, exclusions, strict <90-day
threshold and passage-to-print limitation. Review the real D001 result before running the remaining
54-text workflow. Preserve empty results, unsupported predicates and unresolved lifecycle/dependencies.


## Additional source-only date checks while corpus extraction runs

These are original-source review targets, not extracted results or fixture answers.

- D066: the citation says P.L.2025, but actual approval is **January 20, 2026** `[4126,4152)`.
  Pair that date with the “first day of the fourth month next following” clause; the fee limit's
  expected calendar date from those supplied clauses is **2026-05-01**, while anticipatory agency
  action has a separate exception. Annual adjustment begins the year following actual enactment,
  not a year inferred from the session-law title. Preserve the $50 base, positive-only CPI mechanism,
  one-/two-family dwelling exclusion and licensed-agent exclusion unless the licensee is the landlord.
  Original fee cap span: `[345,612)`.
  Original exemptions span: `[1523,1823)`.
  Original indexing span: `[1823,3200)`.
  Original effective clause span: `[3817,4126)`.

- D080: current 1.6% announcement `[258,381)` runs March 1, 2026 **through** February 28, 2027;
  an exclusive encoded end would be March 1, 2027. Prior 1.4% period `[828,924)` similarly ends
  exclusively March 1, 2026. Do not infer complete rent-control eligibility from this announcement.
- D081: explicit effectiveness **October 14, 2024** `[478,709)` differs from publication October16.
  Preserve the nonpublic competitor-data / vacant-unit recommendation definition, and do not invent
  monetary penalties or an adoption date from publication.
