# RealPage submission files

[Download submission.zip](submission.zip?raw=true) (about 14 MB). Extract it to obtain
exactly the three JSON files specified in section 5 of the original participant README:

| File | Contents |
| --- | --- |
| `rules.json` | A bare list of 174 rule records validated against the supplied schema. |
| `lookups.json` | All 500 supplied address IDs, with `as_of` set to `2026-10-01`. |
| `changes.json` | T1–T5, each with affected IDs, conflict IDs and explanatory notes. |

**These are partial results, not legal validation or organizer acceptance.** The files
were prepared on October 4, 2026 from a frozen research snapshot. They are saved outputs,
not a claim that the current live service or latest code reproduces the same snapshot.
No organizer submission is performed by publishing this directory.

## Citation eligibility and omissions

Only supplied corpus text counts toward these citations. Independently saved link-only
texts require an official organizer addition and mapping to become eligible; none was
provided. The projection excludes 113 supplemental research rules. Another 379 corpus-backed
rules have temporal status that the supplied schema cannot represent and are omitted
without inventing dates or status. Two override IDs pointing to omitted records are removed
from this projection, with the original interaction text retained and both omissions recorded.

All rules still require semantic review, and 13 addresses have unresolved municipalities.
T1 and T3 are partial, with 250 and 140 uncertain addresses respectively. T2, T4 and T5 are
blocked. The definite affected-address sets are empty; this does **not** establish no impact.
Full uncertainty sets remain in the locally retained research artifacts.

## Validation and provenance

- [Validation report](submission_report.json): format checks, hashes, replay result and remaining gaps.
- [Citation scope](citation_scope.json): every included/excluded source and rule.
- [Source retrieval metadata](source_retrieval_metadata.json): retrieval dates, URLs and source hashes.
- [SHA-256 checksums](SHA256SUMS): ZIP and extracted JSON checksums.

All seven raw export payloads matched byte for byte in two separate export runs before the
documented override-ID projection. The delivered rule records satisfy the supplied schema;
all lookup references resolve, every supplied address is present, and all five change tests
use the README's required structure. These checks establish format and reproducibility,
not complete evidence coverage or legal correctness.

The original README specifies a bare rule list, while its example template uses a `rules`
wrapper. This package follows the explicit README instruction. The ZIP is used because
the uncompressed `lookups.json` is about 115 MB, too large for ordinary GitHub file storage.

After downloading, extract with `Expand-Archive submission.zip` in PowerShell or
`unzip submission.zip` in a shell. The source snapshots and original participant pack were
not modified or included wholesale. The report pins the original README, schema and frozen
input hashes; source retrieval metadata connects records to their supplied document IDs.
