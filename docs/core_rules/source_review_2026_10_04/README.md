# CORE-06 review of the PLAT-11 source delivery

The 21 documents delivered in PR #20 now have a Core A interpretation handoff:
**two amendments to existing AB325 rule candidates, ten new RuleDraft candidates,
and two separate conditional failed-lifecycle variants**. This closes the earlier
absence of substantive source text for the required cases. It does not close the
remaining publication, historical-version, court-verification or human-review gaps.

Base: `9ff4396de5b6bdc5d8daed159a0778f993dd49cc`; branch `codex/core-a-source-review`.
Daniel / root integrates; three agents reviewed California, New Jersey and Massachusetts
in parallel. Root is the only repository writer. The captured source bundle and original
140-rule snapshot remain unchanged. No provider extraction was resumed.

## Results in task order

| Case | New usable evidence and candidate work | Remaining limit |
| --- | --- | --- |
| T1 | Official BPC16729 annotation supplies January1,2026; separate bill history supplies October6,2025 enactment. BPC16702 supplies the missing person definition. Two existing-rule amendments retain the distinct restraint/coercion clauses. SB763 penalties, dates and procedural provisions have separate exact-span findings. | Qualifying persons, conduct, legal interpretation and independent review remain unresolved. SB763 is not another blanket algorithm-use prohibition. |
| T2 | Hoboken and Jersey City prohibitions, separate JC disclosure duty, redlines and versions reviewed. The deleted JC public-data collection alternative is excluded. JC25-098's security requirement and JC25-105's specified housing penalties are not folded into the algorithm rule. | Local operative dates remain null pending publication/authority; Hoboken numbering discrepancy and later-amendment completeness remain explicit. |
| T3 | Saved D069 plus local provisions support five two-sided claim comparisons. State July1,2027 effectiveness is a labeled calendar derivation from approval and section9. | The other-law exception and exact conflict scope prevent automatic supersession. Comparisons retain `winner=null` and `semantic_support=not_checked`. |
| T4 | Two distinct H5222 prohibitions and one S2983 prohibition have canonical Drafts. Definitions and exceptions stay separate; pending status and hypothetical temporal paths reproduce. | No enactment, effective date, verified property conduct or blanket statewide applicability. October4 text identity for an exact October1 substantive replay needs version confirmation. |
| T5 | Original petition yields separate rent-cap and exempt-unit-notice drafts. Majority disposition is distinguished from concurrence. Primary lifecycle remains unknown; two failed variants are explicitly conditional on the mirrored opinion. | Official opinion/docket and final county judgment remain unverified. The conditional failure result is not an accepted T5 empty address set. |

The new AB325 operative wording matches D022 after whitespace normalization; the capture
does not establish a new legal amendment. The date corrections are to existing encodings.
They make the two candidate temporal boundaries determinate, but the original store still
has **124 unresolved temporal projections and zero applied corrections**. In candidate
probes, December31 is not yet effective and January1 is in force; overall coverage on saved
California facts remains unknown because review and conduct facts are unresolved.

## Review artifacts

- `annotations/california.json`: 56 exact spans, source/version findings, two bounded patches,
  SB763 companion context and retained dependencies.
- `annotations/new_jersey.json`: five Drafts, exact redline-aware source spans, five claim
  comparisons, fifteen synthetic-property/date probes and acquisition requests.
- `annotations/massachusetts.json`: five primary Drafts, two separately labeled conditional
  variants, exact petition/bill/status/opinion spans and visual PDF-review notes.
- `t1_amendments.json`: reproducible amendments serialized as **RuleDraft**, with existing
  rule IDs and original-rule hash references outside the Draft. They are not provider output.
- `t1_version_comparisons.json`: observations from the existing Core comparison helper,
  retaining uncertainty. Full transient Rule envelopes and borrowed extraction provenance
  are deliberately omitted from this review artifact.
- `verification.json`: input/code hashes, anchor/model checks and reproduced probe results.
- `remaining_work.json`: ordered next actions, exact owners and the unchanged provider pause.

Offsets are zero-based Unicode character positions in unchanged captured derivative text.
Raw HTML/PDF and derivative hashes remain separate. Original D IDs and offsets are preserved.
PDF redlines and relevant petition/opinion pages were visually inspected; lexical matches and
successful software probes do not establish legal correctness.

## Reproduction

From the repository root, using the installed project Python:

```sh
python docs/platform_sources/2026-10-04/verify.py
python docs/core_rules/source_review_2026_10_04/build_review.py --check
```

Omit `--check` to reproduce only the three generated files in this directory after reviewing
any annotation change. The runner reads the committed immutable ZIP and additive source bundle
directly; it does not require the author's private store, load credentials, use a provider,
write a Store or refresh captured sources. It checks all21 raw/text pairs and155 unique anchors,
validates12 new Draft objects (including2 conditional variants), recomputes5 claim comparisons,
reproduces15 NJ synthetic-property probes and7 MA temporal probe groups, and checks the two
AB325 candidates against saved facts with the single `evaluate_rules` implementation.

New candidates remain Drafts because the existing Rule provenance contract represents actual
extraction/replay or synthetic fixtures, not manually amended provider results. A transient
copy of the two original Rules is used only for evaluation; its original run metadata is never
serialized as provenance of a new extraction. NJ synthetic probes use temporary synthetic Rule
envelopes; only labeled property inputs/results are retained. None is eligible for direct store
import or accepted output without review and provenance-preserving assembly.

See [remaining work](remaining_work.json) before continuing. Platform still owns missing source
records and snapshot assembly; paid extraction requires explicit resumption and an agreed budget.
This handoff changes no served rules, API, schema, frontend or runtime behavior.
