# CORE-07 — actionable uncertainty and faithful explanations

Existing-interface work is implemented and locally verified. Full CORE-07 acceptance
remains pending the CORE-06 evidence cases, PLAT-06 integrated snapshot/disagreement
contract, and a named human's benchmark review. This is not a completed real-data release.

Human owner: Oliver. Writer: Codex /root, session `01a103bd-84d1-7c50-bd19-1fe9267bc139`.
Checkout: `/Users/oliverchen/Documents/random shi/realpage-eggs-core-explanations`.
Branch: `codex/core-b-explanations`.
Base: `0c441df4896cca844b9199597093267e1d4519a4`, reviewed main including PR #12.
Implementation checkpoint: `5a8e1cd` (runtime, tests, fixed inputs and verification evidence).
The following documentation-only commit records this checkpoint; runtime bytes are unchanged.

## Delivered behavior

Uncertainty now identifies the missing input, consequence and specific next action:
factual answer, legal geography evidence, original-source acquisition, interpretation
review, or expanded analysis. Rule-specific text identifies the query date, rule title,
citation, ID, encoding hash and source URL. Exact `SourceSpan` objects are reused from
existing evidence reports; missing source identities are never manufactured from quotes.
An unsupported input or legal classification is an interpretation/registry dependency,
not a property question. Source-context budget exhaustion requests more analysis.

Property answers still use Core A's evaluator, never a new truth implementation.
Original facts and geography are unchanged. Every displayed alternative remains
hypothetical, preserves source/interpretation gaps, and now carries the parent planner's
analysis-limit warnings. HTTP tests verify answer provenance, reset, partial dates,
remaining exemptions and numeric partitions, including prior >2**53 boundary repairs.

Rule rendering includes exact recorded quotations and their source IDs, offsets and
supported fields, including status-event and interaction evidence. It preserves date
precision, inclusive effective/exclusive end boundaries, original grouping and unresolved
branches. An enacted rule without an effective date remains unresolved even with a
dated lifecycle snapshot. Encoding hash semantics remain unchanged; a source-anchor move
alone still does not imply a substantive amendment.

`core_assist` additionally exports pure `render_evaluation(evaluation, rule, as_of)` and
`render_change(change, rules)` text helpers. They consume actual Core outputs, retain
before/after dates, partial/blocked/hypothetical states, overlapping impact counts,
Core uncertainty reasons, exact quotes and version references. Unsupported difference
payloads or mismatched IDs remain visibly unresolved. Callers must pass the rules from
the same evaluated snapshot; the present ChangeResult has no per-delta version hash.
No API route or shared response shape changed, and these new helpers are not wired to
HTTP by this lane. Existing assist HTTP automatically uses the improved planner/renderer.

Versions: `correlated-partitions-v3`, `encoded-rule-v3`.

## Before / after examples

- Before: “Supply the documented property fact.” After: identifies dwelling-unit count,
  the unresolved coverage branch, query day and rule version; requests a documented
  request-local fact and warns that other exemptions/source issues can remain.
- Before: a bounded reference scan could say “Retrieve missing source context.” After:
  identifies the context/depth budget and requests more analysis. A genuinely absent
  source still requests original-source acquisition.
- Before: semantic-support failures and missing source text shared a generic remedy.
  After: meaning/authority review and source restoration have separate actions.
- Before: `effective_date=None` with a dated snapshot could omit the missing boundary
  from `unresolved_nodes`. After: includes `effective_date` and explicitly says a snapshot
  does not establish effectiveness.
- Before: alternatives could omit a planner budget warning carried only on the parent.
  After: every displayed alternative retains the warning about unexamined combinations.

## Fixed benchmark and checks

Run with the already installed Python 3.12.14 environment:

```sh
cd '/Users/oliverchen/Documents/random shi/realpage-eggs-core-explanations'
PYTHON='../realpage-eggs-core/.venv/bin/python'
"$PYTHON" -m pytest tests/test_question_planner.py tests/test_rule_renderer.py -q
"$PYTHON" docs/core_navigation/verify_candidate.py
```

The reused environment's lockfile is byte-identical to this checkout's. The verification
runner copies code, tests, inputs and contracts to a private temporary directory, keeping
shared contracts and existing stores unchanged. Exact outputs and source SHA-256 values
are in `core07_validation/verification.json`. Results:

- 59 focused tests passed.
- 267 full backend tests passed; 1 skipped because the organizer pack is absent.
- Compileall, contract generation and diff checks passed. Schemas/OpenAPI unchanged.
- Ten generated example files differ inside the disposable copy (new text/versions plus
  extraction-run identities); Platform owns refreshing those examples after integration.
- One existing Starlette/httpx deprecation warning; no dependency change.

The new fixed input manifest is `tests/fixtures/core_navigation/benchmark_cases.json`;
runner: `docs/core_navigation/benchmark.py`. It uses production FastAPI handlers and
Core functions, without a substitute planner. Results: `core07_validation/benchmark_results.json`.
Every response repeats identically three times, all probe answers replay via HTTP,
original store files remain byte-identical, and the next unanswered request resets.

| Seven synthetic software cases | Planner | Ask every missing encoded fact | Generic unknown |
| --- | ---: | ---: | ---: |
| Questions | 8 | 8 | 0 |
| Unnecessary questions / questions asked | 0 / 8 | 1 / 8 | 0 / 0 |
| Useful facts missed / expected useful facts | 0 / 8 | 1 / 8 | 8 / 8 |
| Evaluator calls across cases | 28 | 7 | 7 |
| Hypothetical rule-result claims | 20 | 0 | 0 |
| Incorrect certainty / certain rule results | 0 / 12 | no claims | no claims |

There are 17 displayed alternatives across 20 alternative rule evaluations, 12 of which
are non-unknown. HTTP mismatches: 0/17. Incorrect certainty is checked against the
fixed agent-authored software oracle, not legal truth. Baselines each perform one
current evaluation; the planner includes its baseline plus probes. HTTP adds two common
Platform evaluations per request (42 across the seven cases). Naive missing-fact
selection misses the present-but-imprecise occupancy date and asks an irrelevant fact.
Latencies are three observed in-process samples per case, recorded individually with
median/min/max. They are not network or load-test results, and preparation is outside
the planner/baseline timings. See the JSON for exact observed values.

The eighth new case imports two unchanged actual D001 extraction records from the
tracked Core A audit. It uses an explicitly synthetic Berkeley property and leaves the
unavailable original source absent. Both outputs remain pending; it asks 0 questions
versus 21 missing encoded fields for the naive baseline, while retaining source and
interpretation remedies. It has 0 hypothetical certainty claims. This deliberately
limited real-extraction cohort is reported separately from the seven synthetic cases;
it is neither a reconstructed source snapshot nor real-property acceptance.

The original eight synthetic cases and their historical reports are untouched.
Their new repeat report is `core07_validation/planner_evaluation.json`: 11 questions
versus 14, 0 unnecessary questions versus 3, 0 missed useful facts, 0 incorrect certainty
out of 16 alternatives (6 certain), and 75 evaluator calls.

## Human review and remaining dependencies

All expectations were authored by the implementing agent; they are not held out.
Human reviewer: unassigned, requested from Oliver; review not performed. No official
benchmark/legal-accuracy score is claimed. Five additional real-case specifications
are fixed in the manifest, with supporting audit references and exact input blockers:
decisive ownership qualifications, two exemptions, partial certificate dates, the
Massachusetts/CORI source gap outside Berkeley, and the NJ source conflict. They are
pending, not passed. Complete original rules/source/property inputs are unavailable
in these local repository checkouts. No paused extraction/provider job was resumed.

Concrete owner requests, documented here without contacting teammates:

1. Daniel / CORE-06: supply evidence-backed fixed rule/property branches and expected
   useful factual fields/remedies for the pending cases; supply both supported NJ claims
   and their unresolved relationship. Do not infer a conflict from organizer expectations.
2. Vincent / PLAT-06: provide the immutable integrated snapshot with source hashes and
   record identities, plus the minimal disagreement/version metadata contract. Refresh
   generated examples and decide where to wire the additive text helpers. Preserve
   one evaluator and include rule/source versions on comparison payloads so a caller
   can verify version identity rather than relying on same-snapshot discipline.
3. Human reviewer: inspect/approve the fixed expectations and record name/date, actual
   source spans, accepted corrections and review scope. A named pending reviewer alone
   would not establish human review.

Claude received UX-04 in the existing app task on Opus 5.5 Extra and is the sole frontend
writer. This Core B branch edits no frontend, Core A, Platform runtime, canonical model,
shared board or contracts. No new dependency, provider call, remote push, merge or
publication was performed for this task. The original Core B handoff's local `.riv`
edit remains intact in its original checkout.

## Subsequent integration

See [UX04_INTEGRATION.md](UX04_INTEGRATION.md) for the combined verification with
Claude UX-04 and main `84c2887`, bounded compatibility fixes, and Daniel’s now-available
partial source checkpoint. The earlier unavailable-input statements above describe the
original Core B checkout. Real-snapshot and named-human acceptance remain pending.
