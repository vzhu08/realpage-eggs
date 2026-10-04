# Core A readiness after Platform PR #17

Daniel / Core A, Codex session `01a10555-b81d-7281-95f5-c06399af8238`.
Starting main: `6b577104572ce28f4e539db45112d31ff060cae6`.
The user authorized continuing work in parallel and publishing/merging completed task PRs.

## Delivered software versus available source evidence

Platform's full container and CI work is now merged, and no open repository PRs were found at
the audit. The local main branch was fast-forwarded to the same origin revision. This includes
the earlier Core A source-comparison fix in PR #18, Core B/UX in PR #15, Platform release/integrity
in PR #14, and the private export handoff in PR #16.

Read-only source audit found identical `sources.json` bytes in:

- `core-backend/data/core-session/` (the original local store);
- `core-a-change-evidence/data/core06-working/` (the earlier working copy);
- `docs/core_rules/snapshots/core-store.zip` (the committed checkpoint).

Each contains 87 records and 54 nonempty source texts, SHA-256
`0337104f1cfc110c1385df4bc4be7116ac94e8b7c42d72ef9f2d5de0285e4e39`.
Platform's PLAT-09 handoff records the same source-catalog hash and explicitly supplies exports
and provenance, not new source evidence or the full original store. The 54 organizer text files
also still match their captured originals. No store, snapshot or source text was modified here.

Consequently, the next ordered real-evidence work still needs:

1. T1: AB325 operative-date authority, BPC16702, and actual SB763 text/history.
2. T2/T3: official Hoboken/Jersey City adopted ordinances, scope and dated history.
3. T4: H5222/S2983 substantive texts and authoritative subsequent status.
4. T5: IP25-21 petition identity/text and authoritative failed disposition.

See `../core06/platform_requests.json` for exact existing source IDs and leads. The NJ D069 text
already exists and needs no new capture merely to extract it. No provider resumption, source
acquisition takeover, production-rule correction or independent human review occurred in this audit.

## Local verifier compatibility

PR #17 added `tests/test_deployment.py`, which imports `deploy.verify_container`. The existing
Core A disposable verifier did not copy `deploy/`, so collection failed before the full suite ran.
The bounded repair includes that directory and its hashes, uses explicit UTF-8 output handling,
and permits a separate report destination without replacing earlier verification evidence.
This repairs local verification tooling; it does not change product runtime or legal behavior.

Implementation: `85f9afd948a3cf51771def661af097bccb30a038`; report:
`7fe3380aad447014b708ea357d4ba2a56eae5844`. The isolated writing agent changed only the runner
and the new [pr17_verification.json](pr17_verification.json). Root reviewed that exact diff.

The final runner passed **417 backend tests, zero skips**, compilation, schema generation with
zero schema differences, both fresh evidence-package replays, and `git diff --check`. The initial
repaired sandbox run passed 416 tests but could not bind the localhost socket for the remaining
deployment test. The complete rerun used approved local-network access and passed that test too;
no test was skipped. No provider or geocoder request was made.

Reproduction: `.venv/bin/python docs/core_rules/comparison_integrity/verify_integration.py --output docs/core_rules/comparison_integrity/pr17_verification.json`.
Historical `integration_verification.json` and all working contract files remain byte-identical.
Platform PR #17's final [CI run](https://github.com/vzhu08/realpage-eggs/actions/runs/37182929348)
also passed all three jobs; its backend count is 416 passed plus one unavailable-private-pack skip.

The next real-evidence task remains awaiting source-acquisition ownership/delivery and the existing
explicit budgeted resumption decision before paid extraction. This tooling repair does not resolve
those legal/source gaps or change the previously partial/blocked case results.
