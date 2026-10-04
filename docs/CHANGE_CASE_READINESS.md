# T1–T5 diagnosis and repair

The saved submission has no definite affected addresses in any of the five cases.
Its own report labels T1/T3 partial and T2/T4/T5 blocked. Passing unit and browser
tests verifies the software's behavior, including uncertainty handling; it does
not establish successful competition scenarios or an official score.

[The diagnosis](evidence/change_case_diagnosis.json) records the unchanged ZIP's
hash, producing revision, actual lookup outcomes and original case notes. This is
the 174-record corpus-only archive, not the later hosted 666-candidate research Store.

| Case | Why the saved output is incomplete | Work needed on the producing Store |
| --- | --- | --- |
| T1: California | The two mapped D022 candidates lack effective dates and encode prohibited conduct as coverage prerequisites. The archive reports 250 uncertain properties. | Preserve the distinct obligations; re-extract property/actor coverage separately from prohibited acts. Reconcile the retained official date/person evidence with admissible sources. Do not replace unknown conduct with invented property facts. |
| T2: Hoboken/Jersey City | Both local reference mappings are empty in the corpus-only archive. Supplied links do not contain the ordinance bodies. | Review/admit retained official municipal captures, extract the actual provisions, establish the applicable versions and operative dates, and use legal municipality resolutions. |
| T3: New Jersey | D069 candidates exist, but coverage/interpretation remains unresolved and local conflict mappings are absent. The archive reports 140 uncertain properties. | Separate property/actor scope from prohibited conduct and government-only duties; resolve actual source-backed local relationships. A general preemption clause does not prove every local rule is superseded. |
| T4: Massachusetts bills | D045–D047 contain procedure/history, not substantive bill provisions; both bill mappings are empty. | Review/admit retained H.5222/S.2983 text and status versions, then run automated extraction. Keep pending actual status distinct from the hypothetical comparison. |
| T5: Massachusetts initiative | No mapped IP25-21 failed-proposal record. D048 is a different statute. | Use the retained petition and official docket disposition with accurate lineage. The July 21 county judgment entry is already captured; older claims that no official disposition was obtained are stale. |

The earlier supplemental drafts and source captures are distinct from fresh
automated extraction results. The historical submission chose supplied-corpus-only
scope; see [its scope and exclusions](../submission/README.md). That choice does not
establish a blanket organizer prohibition on official public supplementation. Keep
source provenance and final admission decisions explicit. Do not substitute expected
address sets from the scenario descriptions.

## Current deployed-data diagnosis

The October 4 API capture contains 666 rules, 83 sources and 500 properties with
487 resolved municipalities. The canonical gate evaluated all rules and properties
in 384.94 seconds: T1 is partial (250 uncertain, four mapped rules), T2 is partial
(43 uncertain, one Hoboken rule), T3 is partial (140 uncertain, eight mapped rules),
and T4/T5 are blocked with no mapped rules. No case has a definite affected set or
passes readiness. [The captured-data diagnosis](evidence/deployed_change_case_diagnosis.json)
records hashes, case blockers and the exact scope. Inputs were unchanged; provider
calls were zero. This is separate from the saved 174-record competition archive.

All 49 captured extraction-index entries are marked review, not failed API calls.
The Jersey City and Massachusetts primary texts are present but unprocessed. The
official Massachusetts disposition dockets are retained in this repository but were
absent from the deployed source collection. California's primary extraction needs
explicit related-definition/date evidence; merely repeating the single-document
prompt cannot supply that evidence.

The analysis Store reconstructs original evidence-package inputs plus a separate
bounded address capture. It is not the original release freeze: historical provider
outputs/run files, caches and other unexposed records were not recovered. Stable
health counts during address capture do not establish an atomic server snapshot.

The new [source bundle](change_case_sources/README.md) preserves 24 exact captures
and a nine-primary extraction plan. Follow the [bounded rerun runbook](change_case_sources/RUNBOOK.md)
to supply explicit supporting documents, record fresh extraction lineage and rerun
the data gate. Fresh provider results and unresolved source/version decisions remain
necessary; the software changes do not alter these observed case results.

## Software repairs

- Missing resolution records now retain the property's known state and leave
  municipal coverage uncertain instead of crashing all comparisons.
- Conflict prerequisites must connect the mapped state/local records, in either
  direction. An unrelated interaction does not establish the requested relationship.
- A case with no mapped rules returns its blocked diagnosis without evaluating
  unrelated rules against every property.
- New extraction instructions distinguish governing property/actor coverage from
  proving prohibited conduct. Informational extraction notes have a separate field;
  genuine unresolved review issues continue to block unsupported conclusions.
- The extraction prompt version changes so old provider caches are not silently
  treated as products of the corrected instructions. Existing output remains intact.
- Explicit related documents can now supply definitions and temporal evidence.
  Their text, roles and hashes are bound to run/cache identity; official status
  documents cannot supply substantive requirements or interactions. Outside-context
  records retain their original lineage instead of absorbing unprovided evidence.
- The v5 extractor supplies registered fact meanings, types and enum values to
  every provider pass, with the contract digest bound to run/cache identity.
  Machine-detected field-evidence and enum issues can use one bounded repair;
  unresolved legal issues and incompatible interpretations remain visible.
- Retrieval preserves external chapter qualifiers. A reference to section 4 of
  another chapter no longer becomes a false cycle with the proposal's section 4.
  A chapter identity that the index cannot establish remains unresolved.

These repairs do not retroactively clear review issues, change source roles, supply
missing dates or create legal rules. The initial diagnosis ran without provider
credentials; subsequent extraction uses separately recorded live runs and spending.

## Run the data gate before publishing

Use the full producing Store in an isolated copy, not the three projected JSON files:

```sh
python scripts/check_change_cases.py --store /path/to/frozen-store --report /tmp/change-case-readiness.json
```

The gate prepares source evidence, runs the saved cases through the existing change
engine and exits nonzero for missing, partial or blocked cases. It reports mappings,
counts and reasons without inventing expected impact sets. A complete result means
the encoded dataset has no reported scenario blocker, not independent legal acceptance.

After correcting admitted sources and re-extracting the affected documents, run this
gate, the ordinary software tests, and the exporter against the same frozen copy.
Review any nonempty uncertainty sets before replacing the saved ZIP. Keep the old
archive and its hashes as historical evidence until the replacement is validated.

Useful retained evidence:

- [Core source review and draft provenance](core_rules/source_review_2026_10_04/README.md)
- [D069 extraction and review](platform_pilots/2026-10-04-d069/README.md)
- [Official municipal and court browser captures](platform_sources/2026-10-04-browser/README.md)
- [County docket with disposition and judgment entry](platform_sources/2026-10-04-browser/MA_SJ_2026_0063_DOCKET.txt)
