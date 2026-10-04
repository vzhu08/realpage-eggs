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

The supplemental drafts and captures are useful evidence, but they are not saved
automated extraction results. The published submission applies a supplied-corpus-only
admission rule; see [its scope and exclusions](../submission/README.md). Preserve
that distinction when producing a new research or competition artifact. Do not
substitute expected address sets from the scenario descriptions.

## Software repairs

- Missing resolution records now retain the property's known state and leave
  municipal coverage uncertain instead of crashing all comparisons.
- Conflict prerequisites must connect the mapped state/local records, in either
  direction. An unrelated interaction does not establish the requested relationship.
- New extraction instructions distinguish governing property/actor coverage from
  proving prohibited conduct. Informational extraction notes have a separate field;
  genuine unresolved review issues continue to block unsupported conclusions.
- The extraction prompt version changes so old provider caches are not silently
  treated as products of the corrected instructions. Existing output remains intact.

These repairs do not retroactively clear review issues, change source roles, supply
missing dates or create legal rules. Fresh extraction requires a configured provider;
no API credentials were available in this local checkout during the diagnosis.

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
