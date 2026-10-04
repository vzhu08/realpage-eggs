# PLAT-16: freeze, export and rehearse the demo release

Owner: Vincent / Platform. State: Preparation ready; final freeze depends on selected PLAT-14
snapshot and any needed PLAT-15 fields. Public hosting may use PLAT-13 or the local fallback.
Execution unclaimed. Suggested branch `codex/platform-demo-freeze`; verify actual claim first.

Use one recorded code/data version for the UI, API and exports. Prioritize a clear supported
lookup/evidence journey and a clearly explained uncertainty/change case. The guide's minimum
prioritizes automated extraction, jurisdiction and citations; do not sacrifice them for a broad
but unsupported T1-T5 claim. Do not clear review flags, manufacture missing outcomes or promote
hand-authored annotations as automated extraction to make the demo look complete.

Reuse `deploy/verify_release.py`, `scripts/platform_ops.py` and `scripts/prepare_handoff.py`.
Produce rules.json, lookups.json and changes.json through the existing export path, preserve
all sample IDs, and prepare the one-page method note. Record any partial scope explicitly.
Keep the previous local release and its launch instructions as fallback.

Potential write scope: Platform release/export/handoff plumbing for concrete blockers, focused
tests, method/release documentation and this card; private outputs in fresh ignored directories.
Do not edit Core semantics or UX source. Serialize shared-file changes with PLAT-13/14.

Checks: one fresh-browser end-to-end journey, as-of date, source quotes, evidence download,
answer/reset if used, honest blocked state and export/readback identity. Avoid repeated broad
suites after passing relevant checks unless a new change/failure warrants them. Record actual
results rather than claiming legal validation from software tests.

Handoff: frozen commit/snapshot/hash, URL and local fallback, exact export paths/hashes, concise
demo sequence, known gaps and recovery instructions. Submission/publication uses applicable
human authority; this assignment does not submit the event entry automatically.
