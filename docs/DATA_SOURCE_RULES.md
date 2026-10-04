# Track data rules and release decisions

Checked October 4, 2026 against the supplied `participant-final-no-hour16/README.md`
(sections 2, 3, 4.1, 6 and 8) and the companion challenge PDF (pages 2, 4, 5 and 6).
The PDF calls the participant guide the full detail. These files are an October 2026 discussion
draft; later registration instructions are not present here. This is a reading of those supplied
instructions, not organizer clearance for every additional source or redistribution license.

## What the supplied rules establish

- Extraction must be automated from the supplied corpus, not hand-coded. Show the pipeline.
- Public data only. The guide says: "No non-public data. No customer, resident or pricing data."
- Public supplemental sources may be consulted, subject to the listed access instructions and
  source terms. Public availability is not blanket permission to scrape or redistribute.
- Census Geocoder/TIGER, public parcel facts, state/municipal codes, LegiScan and Open States
  are explicitly listed. Local program lookups are for spot-checks, not corpus replacement.
- City code publishers may be read, respecting terms and without prohibited bulk scraping.
  The manifest marks D032-D034, D038, D070-D072 and D074-D075 `check-terms`; do not treat a
  provided link as capture permission. Preserve link-only status until access is cleared.
- The guide specifically says California's site blocks scripts, so use the corpus copy.
- LSC Eviction Laws Database is a methods reference only, with laws dated January 1, 2021.
- Unknown is a valid result. Do not invent rules/citations, compliance certification or legal advice.
- Model/API access and credits, code/data licensing and submission logistics remain TBD at
  registration in this pack. No blanket paid-extraction prohibition or named model ban was found.

## Apply that to our data

The currently served frozen `real-002` release was checked: all 87 source IDs belong to the
starter manifest; its 140 rules reference 14 supplied documents, whose text matches the pack
after normalizing checkout line endings. The supplemental California captures and court mirror
are not in that served source set. The D069 pilot remains separate and uses supplied D069.
Thus the identified source-eligibility caveats affect research promotion, not the present demo's
use of starter-corpus texts. This is not a claim that all its legal encodings have been accepted.

| Material | Decision for the next Platform session |
| --- | --- |
| D069 pilot | Explicitly supplied official corpus document (manifest row 70). Automated pilot fits the stated extraction task. Preserve the original source and actual provider lineage. |
| Supplied 500 public-assessor properties and Census results | Explicitly permitted source/use categories. Missing units, ownership and occupancy facts stay unknown; do not add non-public tenant/customer/pricing data. |
| Official municipal ordinance text | Explicitly permitted source category, subject to host access terms. Supporting publication/adoption records are a reasonable supporting use, not separately named permission. |
| Official court opinion/docket for T5 | Public verification of the assigned case is consistent with the public-data task, but court records are not expressly enumerated in the source table. Treat this as an inference; obtain organizer clarification if strict source eligibility is material. |
| Third-party court-opinion mirror | Neither expressly approved nor officially verified here. Keep as labeled supplemental/conditional review material; do not treat it as an authoritative verified disposition or clear its host's rights by assumption. |
| Supplemental California captures from PLAT-11 | Official/public status alone does not settle the guide's corpus-copy instruction. Compare against supplied copies first; defer their promotion into submission records until the intended supplemental use/access is clarified. Keep saved provenance intact. |
| Core hand-authored RuleDraft annotations | Useful review/test proposals. Do not silently export them as automated extraction or give them a borrowed provider run ID. Accepted submission records must remain outputs of the reproducible extraction pipeline. |

Private storage of permitted public-source material does not itself make the source prohibited
non-public data. Conversely, a private repository does not make restricted data or copying allowed.
The D069 evidence bundle includes public legal text and model output, not property/person records.

No registration-specific source restriction or license has been verified beyond this pack.
Do not describe all 21 supplemental captures as unconditionally cleared for judged submission.
This check does not invalidate or rewrite those original research snapshots.

## Priority under the demo deadline

Proceed with PLAT-13 through PLAT-16 using permitted, supported inputs. The participant guide
prioritizes Modules A/B (automated extraction, geography and citations); change tracking follows.
Keep the municipal publication and official court-verification gaps assigned to PLAT-11/12,
but do not make all software delivery wait on them. They still limit definitive T2/T3/T5 results.

Only revisit a missing record for a concrete new lead that could change the selected demo.
Timebox that attempt; do not repeat failed URL searches or introduce bulk scraping. If a record
does not arrive, show the existing unknown/blocked explanation. No invented date or judgment.

Evidence consulted (organizer files remain in the ignored input pack):

- README SHA-256: `88959deb9e780e990f049cc0a7b8ad74916e250665199498211300bdd45082dd`.
- `mit-rental-housing-law-navigator-challenge-v5-participant-no-scoring-no-hour16.pdf`, SHA-256:
  `ba3ebc46abf2711aa24e345d7ab0a17920672262bcc83eaaf838c427f25982fb`.
- `corpus/corpus_manifest.csv` and `corpus/links_only.csv`; original data unchanged.
