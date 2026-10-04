# PLAT-14: assemble the next permitted demo snapshot

Owner: Vincent / next Platform chat. State: Ready for preparation; final integration waits on
Core's selected reviewed automated output. Execution unclaimed. Suggested new branch:
`codex/platform-demo-snapshot`; record actual checkout/base/changes first.

Read PLAT-06/07/09, [Core next steps](../CORE_NEXT_STEPS.md),
[source-use decisions](../DATA_SOURCE_RULES.md), and the existing assembler/release runbooks.
The currently served release has 140 rules; the separate D069 pilot added seven candidates to
a private working copy. Neither its partial portable bundle nor PR #23's annotations is a Store.

Prepare a new output directory and explicit input manifest now. Select only inputs with known
source identity, permitted use and truthful lineage; preserve original stores and prior releases.
Resolve the California corpus-copy and third-party-mirror caveats before promoting those
supplements. Keep Core hand-authored Drafts as review annotations, not judged extraction records.

When the selected Core increment is available, use `scripts/assemble_snapshot.py` and
`scripts/platform_ops.py` rather than creating another pipeline. Preserve all 500 address IDs,
source hashes/offsets, actual run IDs and unresolved review/date state. Do not weaken provenance
checks to import edited provider rules. Request a suitable reproducible extraction/provenance
handoff if Core delivers only annotations; do independent packaging work while waiting.

Potential write scope: assembler/release plumbing and its focused Platform tests only if a
specific defect prevents the selected integration; this card/runbooks and ignored new outputs.
No Core evaluator, source truth, frontend or preserved input changes. Shared writes serialize
with PLAT-13/16 and any existing owner.

Checks: input immutability, no lost IDs/dangling references, new snapshot identity, one lookup
and one supported change/uncertainty case, export consistency. No broad paid run is authorized.
Handoff: exact inputs/output manifest, counts, code/data IDs, admitted/deferred source decisions,
actual checks and unresolved case statuses. Promote to the demo only after this bounded check.
