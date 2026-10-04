# Platform integration after Core PRs #28 and #29

October 4, 2026. Vincent / session `01a1061b-41fb-7180-9973-b0937d2f95c9`;
branch `codex/platform-core-integration`, isolated checkout `artifacts/platform-core-integration`.
Base `ebda27644ca9b1434f4a58c65943dccec25502ed`. Original stores remain unchanged.

## Typed inputs (PLAT-15)

The registry adds the 20 concrete Core field requests plus 15 inherited fields consumed by
the selected predicates. `docs/evidence/plat15_inputs.json` records source spans, definitions,
consumers and deferred fields; `contracts/fact_definitions.json` is generated from the registry.
Inputs refer to one documented actor/activity. Unknown or disputed values remain null;
inputs remain request-local and unverified. No property answers are inferred or stored.
The legacy `actor_type=municipality` value remains distinct from `government_entity`.

Core's two hand-authored predicate Drafts and 25 synthetic probes remain review annotations.
They are not provider output and were not imported into the Store. Core must supply an admitted
automated/provenance handoff before those rewrites can become demo rules.

## Snapshot assembly (PLAT-14)

The existing assembler successfully combined the unchanged full D069 pilot Store at
`../platform-ci/data/extraction-pilot-d069` with the reconciled geography at
`../platform-release/data/plat06/geography-reconciled`. Result: 500 addresses, 147 rules,
87 source entries, 487 resolved municipalities. Snapshot identity:
`54e80ebd908ea1bf47244b2f3da26190fa50162fb1bf58cf91afd3540e72f3f0`.
Consult the generated manifest for the authoritative full identity and file hashes.
All seven pilot rules remain review-needed; six have unsupported coverage. This is a partial
research snapshot, not a legal validation or submission-ready release. Newly captured supplemental
records and Core Drafts are excluded. Published change caches retain T1/T3 partial and T2/T4/T5 blocked.

The frozen local release uses source revision `f81f120cdf28f6c363bf3047dd81d9d970f9366f`;
release manifest SHA-256 `f100e8310000c65cc7196ae9b5c765bc59ace7eed37c2b91f6fa849f155986ce`.
The verified Render transport ZIP is 636,482 bytes, SHA-256
`cb3e4773283b070ae601142b08dee80444d6afa34702164ea25c6862b09e18b4`.
It splits into two 424,322-byte secret-file parts. It has not been uploaded or activated.
Private prepared outputs and exact code/file manifests are under `artifacts/integration/`.
The earlier 140-rule hosted release remains the rollback source; the mutable extraction output
is never a serving directory. Final publication must retain all research limitations.

## Hosted verification and response transport (PLAT-13 / PERF-01)

The live Free service at `https://realpage-navigator.onrender.com` was checked on Core revision
`ebda276` with the existing 140-rule store. Health/frontend passed. Assisted A0001 took 32.417 s
and returned 28,957,297 decoded bytes; A0002 took 2.631 s. A0005 returned 502 after 131.232 s;
the server subsequently restarted. No explicit out-of-memory cause was established.
The hosted performance gate fails. These observations are not a p95 or controlled cold-start test.
Private raw report: `artifacts/integration/hosted-check.json`.

Platform now serializes the already-validated canonical AssistResponse directly and negotiates
low-CPU gzip. This removes an intermediate Python object tree and reduces transfer size while
retaining complete JSON, quotes and traces. HTTP parity tests cover identity and gzip transport.
No planner limits, evaluator semantics, frontend timeouts or evidence were removed.
The new transport still needs hosted validation before claiming the latency gate passes.
The frozen local 147-rule release passed real HTTP health/frontend/basic lookup/T3, A0001/A0002/A0005
assist, answer/reset/date changes and two concurrent users. A0001 took 4.916 s and compressed
28,957,297 bytes to 3,456,049 bytes; A0005 took 15.708 s and compressed 120,502,306 bytes to
13,953,977 bytes. These are local timings, not a forecast for Render Free. A0005's decoded
response is still large; Core B owns any planner representation changes. The verification
harness initially compared defaulted answer metadata too strictly; comparing field/value and
checking provenance separately passes. Private report: `artifacts/integration/local-verification.json`.

## Remaining supplied-corpus extraction

The user authorized the remaining supplied corpus with a $20 cap and runs it separately.
`scripts/extraction_batch.py` defaults to a no-call dry run, validates unchanged supplied texts,
copies the source Store into a new directory and preserves completed documents. The inspected
queue has 38 remaining captured documents / 59 chunks, 16 completed documents preserved and
33 unavailable/link-only source entries excluded. New results remain review candidates.

The first user-launched run was `data/corpus-batch-20` in this integration checkout. It stopped
after saving D023 because the batch client lacked Core's per-document `close()` interface.
Five calls were fully reconciled at a conservative $0.99463650; no process remains active.
The wrapper now retains its outer-owned transport across documents and creates a fresh provider
per document so usage receipts are not duplicated. A real Core/two-document mock-transport
regression and continuation-ledger checks pass (27 extraction wrapper/pilot tests total).
`--continue-budget` carries fully reconciled receipts into a new output directory under the same
total $20 cap; any in-flight/unknown billing, changed rates or inconsistent totals refuse continuation.
The stopped original output is preserved; its incomplete run manifest must be recovered and
provenance-checked in a separate copy before resuming. Do not run overlapping jobs.
Inspect `batch_budget.json`,
`batch_plan.json`, per-document run files and `artifacts/integration/extraction.log` for progress.
The original launcher is `artifacts/integration/start-extraction.ps1`; it must not be invoked twice.

The transport reserves $1.50 before each provider call. It reconciles returned usage at conservative
rates of $2.75/M input and $11/M output, keeps the reservation on unknown billing, and stops without
retry after HTTP/transport/usage errors. A new request cannot start if its reservation exceeds the
remaining allocation. Existing output/ledgers cannot be overwritten. These are upper estimates,
not a provider invoice. [Official model pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol)
was checked October 4; the wrapper requires default service tier, bounded requests and no tools.
Adding budget or resuming an interrupted run requires reconciliation, not a fresh overlapping job.

## Checks and next action

Backend: 500 passed, 1 skipped, with `PYTHONUTF8=1` on Windows (one existing dependency warning).
The first run exposed a Windows default-encoding failure in an existing benchmark; UTF-8 mode
resolved it. Contract generation passed; unrelated generated fixture churn was restored.
Disposable frontend generation, typecheck, unit tests and production build passed.
Assembly verified provenance and input immutability; all five change caches were recomputed.
These checks establish software behavior, not legal accuracy.

Next: verify the frozen local release, publish the transport/input integration through the merge
queue, then retest the current hosted service. Core admission and the full PERF-01 browser/cohort
gate remain explicit. Extraction can proceed independently and must be reviewed before promotion.
