# Retained sources for T1–T5 repair

`scripts/prepare_change_case_sources.py` creates a new private **source-only research
bundle** from an existing Store and the captures already tracked under
`docs/platform_sources`. It makes no network or provider calls and creates no Rules,
RuleDrafts, extraction runs, or submission. A successful command means byte/provenance
validation succeeded; it does not mean a change scenario passed.

```sh
python scripts/prepare_change_case_sources.py \
  --store /path/to/read-only-store \
  --output /tmp/change-case-sources-new
```

The Store only needs `sources.json`; all other Store files are ignored. Alternatively,
use `--archive docs/core_rules/snapshots/core-store.zip` instead of `--store`. The ZIP
is read in memory without extracting members. `--captures-root` can select another
checkout's retained capture root, but the reviewed text pins must still match.

The destination must not already exist and must be outside every input path. Its root
is created with mode `0700` and files with `0600` on POSIX. Inputs are read, pinned and
checked again before writing. A missing document, changed text version, changed raw
capture, ID collision, or invalid destination fails with exit code 2 before creating
the output. Existing captures and stores are never overwritten.

## Contents and roles

The explicit allowlist contains 24 documents: 17 legal-text candidates and 7 status
records. Each text hash is pinned to the reviewed retained body. This is document-kind
classification, not a legal interpretation or a declaration that proposed text is law.

| Scope | Original IDs and retained document families | Intended evidence |
| --- | --- | --- |
| T1 | `D022`; `P11_CA_AB325_TEXT`, `P11_CA_AB325_HISTORY`, `P11_CA_BPC_ART1`, `P11_CA_BPC_ART2`, `P11_CA_BPC_ART3`, `P11_CA_CONS_ART4`, `P11_CA_SB763_TEXT`, `P11_CA_SB763_HISTORY` | Original AB325, version comparison, incorporated definition, companion provisions, date authority and separate legislative history |
| T2/T3 | `D069` (T3); `P11_NJ_HOB_B781_HTML`, `P11_NJ_HOB_MINUTES`, `P11_NJ_JC_25_057`, `P11_NJ_JC_25_098`, `P11_NJ_JC_25_105`, `P12_NJ_CHARTER` | FAIR, municipal instrument bodies/amendments, separate adoption evidence and general publication/effectiveness framework |
| T4 | `P11_MA_H5222_TEXT`, `P11_MA_H5222_STATUS`, `P11_MA_S2983_TEXT`, `P11_MA_S2983_STATUS` | Proposal provisions and distinct status/history captures |
| T5 | `P11_MA_IP25_21_ORIGINAL`, `P11_MA_H5008`, `MA_SJC_13893_DOCKET`, `MA_SJ_2026_0063_DOCKET` | Petition bodies/transmission and separate official docket disposition records |

The bundle contains:

- `sources.json`: canonical `SourceDocument` records retaining exact text, IDs, URLs,
  retrieval timestamps and hashes. Role changes are explicit in the manifest. D069's
  original snapshot is unclassified; its pinned enactment body is declared legal text
  only in this new bundle.
- `manifest.json`: input and script hashes, original metadata, role declarations,
  per-document case relevance, capture records, independent raw/text hashes, admission
  labels and remaining gaps. It also reports shared `source-use-v2` classifications.
- `evidence/<original-id>/`: exact UTF-8 text plus unchanged raw response files when
  retained. D022/D069 only have the supplied Store text here. Browser dockets contain
  exact visible-text captures, not original HTTP response bodies or signed judgments.

Raw-to-text derivation is **not reexecuted**. The tool checks the saved derivatives and
raw responses against their manifests independently; hashes establish identity, not
authenticity, legal validity or access permission. Large mixed sources, such as the
Hoboken minutes and NJ charter compilation, require bounded relevant-span selection
before later extraction. The third-party opinion mirror, adoption news announcement,
link-only failures, and handwritten RuleDraft annotations are excluded.

The manifest also includes a stable nine-primary `extraction_jobs` plan for later
orchestration. Each entry has `doc_id`, `supporting_doc_ids`, case relevance, separate
substantive/temporal context lists, and the full-text character count. Status records
never become substantive provisions. Every current job is below 128,000 source-text
characters. The 268,053-character Hoboken minutes and 206,858-character charter are
retained whole but deferred for bounded-span review; they are not silently truncated
into an extraction request. The plan is neither provider output nor a legal finding.

## Corpus admission and remaining work

Only `D022` and `D069` are labeled `supplied_corpus`. The other 22 are labeled
`supplemental_research_admission_unverified`, even when their document kind qualifies
as `eligible_primary` under the application policy. Public official sources and user
authorization do not establish organizer admission. See `docs/DATA_SOURCE_RULES.md`
and `submission/citation_scope.json`; California's corpus-copy instruction remains
material. This helper preserves research provenance without deciding admission.

- **T1:** The captured definition, histories and date authority support further
  automated extraction. They do not themselves encode dates, thresholds or historical
  version relationships.
- **T2/T3:** Ordinance-specific publication and consequent operative dates remain
  unresolved. Adoption or notice-index dates do not resolve that gap. Hoboken's title
  and body identify different section numbers. Jersey City amendments require version
  and scope reconciliation. General charter provisions alone do not establish that
  each ordinance satisfied their conditions. State/local conflicts require evidence.
- **T4:** October 4 captures do not alone prove the exact proposal text in force as a
  pending version on October 1. Status history is separate from provisions; hypothetical
  enactment must remain separate from actual lifecycle.
- **T5:** The retained official dockets record the rescript and judgment/disposition.
  The signed judgment and full opinion were not captured from the official host. A
  lifecycle conclusion must cite and correctly link the docket to the petition; the
  bundle does not create an operative cap or automatically mark a Rule failed.

Later automated extraction must produce its own provider lineage and retain evidence
review. Evaluate the resulting Store with `scripts/check_change_cases.py`; source
availability and passing software tests are not T1–T5 readiness or an official score.

Validation: `python -m pytest -q tests/test_change_case_sources.py`.
