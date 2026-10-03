# CORE-01 evidence — blocked live extraction; local checks completed

Owner Daniel; sole writer Codex /root. Dedicated clone/branch and base are in CORE_HANDOFF.md.
Participant pack found at `/Users/danny/Downloads/participant-final-no-hour16`; originals unchanged.
Both OPENAI_API_KEY and OPENAI_MODEL were absent from this session; no local .env was found.
No secret values were printed. Python 3.13.15 virtual environment installed exact requirements.lock.

Actual local commands (from the Core checkout; `.venv/bin/python`):

- `-m navigator --data-dir data/core-session ingest --pack /Users/danny/Downloads/participant-final-no-hour16`: success, 87 manifest entries, 54 source texts, 500 addresses, 54 declared/actual hash mismatches. Run `a96fb8f7334b47bb8a91b696498fed1e`, 2026-10-03 22:12:23 UTC, 0.029 seconds.
- `-m navigator --data-dir data/core-session extract --doc-id D001`: exit 2 ProviderUnavailable. Run `2634e1c36d41409cb511644884c6090f`, 22:12:46 UTC, 0.036 seconds, processed=0, rules=0. Manifest mode=live denotes the requested mode, not a successful model call. Model unset; zero provider calls, no billed usage recorded. The attempt preceded the prompt-version fix and records extract-v1.
- `-m navigator --data-dir data/core-session validate --as-of 2026-10-01 --output data/core-session/validation.json`: completed; ready_for_submission=false. Zero rules means quote/schema failure counts of zero have denominator zero. Source gaps: 33 absent texts; all 54 texts await extraction.
- `-m navigator --data-dir data/core-session lookup A0001 --as-of 2026-10-01`: exit 2 DatasetUnavailable, correctly refusing a legal lookup without completed extraction.
- `-m navigator --data-dir data/core-session export --as-of 2026-10-01 --allow-partial --output data/core-session/partial-export`: PARTIAL_NOT_JUDGE_READY; all 500 input IDs represented, zero rule references, all T1–T5 blocked.

The isolated store has no Census cache and 500 unresolved municipalities. This does not contradict
Platform's historical 479 resolutions: no teammate data/cache was copied or geocoding rerun.
No real source interpretation, quotations, thresholds, exemptions or lifecycle output could be reviewed
because no provider output exists. No full corpus extraction was attempted after the decisive missing
configuration failure. No synthetic rules were inserted into this real store.

Two focused extraction defects were reproduced by failing tests: supplied end_date and status_as_of
could lack field-level support without a review issue. Both now require support. The extraction prompt
names actual first occupancy and explicitly rejects year-built substitution; prompt version
`extract-v2-core-dates` invalidates stale prompt caches. Field-level labels and exact quote presence
still do not prove semantic or independent legal correctness. Existing synthetic extraction/replay,
provider-failure and bounded-repair tests pass; these are software evidence only.

Next bounded action: Daniel configures OPENAI_API_KEY and an explicit OPENAI_MODEL locally, runs D001
with the command above, reviews original-source anchors/meaning/lifecycle/omissions, then resumes the
captured corpus. Preserve this store and its run manifests; obtain Platform's resolved geography through
its existing ownership process before evaluating real local coverage. No push/deploy/submission done.
