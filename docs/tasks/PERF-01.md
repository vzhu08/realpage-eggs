# PERF-01: assisted lookup latency blocks the public demo

Priority: **P0**, before optional features and final demo rehearsal.
State: measured and assigned; runtime implementation unclaimed.
Lead: Vincent / Platform. Contributors in their existing lanes: Daniel / Core A (evaluator and
trace construction), Oliver / Core B (planner probes), existing UX owner (request lifecycle).
This is a release gate within PLAT-13 deployment integration and PLAT-16 rehearsal on current main.

The user requested this board priority on October 4 and asked about optimization, avoiding the
20-second cutoff, and paid Render. This session claims only `docs/TASKS.md`, this card and its
existing RENDER-01 documentation in its own `artifacts/render-setup` checkout, branch
`codex/render-setup`, starting at `aac65e8`. It made read-only local performance measurements;
no Core/frontend runtime edits, paid upgrade, model calls or additional writers. Future writers
must record their own checkout/branch/base and claim their lane before implementing.

## Evidence and reproduction

Runtime `b77ae3a`, immutable `real-002` serving snapshot with 500 properties, 140 rules and 87 sources.
Snapshot archive SHA-256: `f2e384742924b1555b25c44205585367d039983daaf1d131e0095a4fda076e77`.
Public service: https://realpage-navigator.onrender.com (Render Free: 0.1 CPU / 512 MB).

Request: `POST /api/v1/lookup/assist` with
`{"address_id":"A0001","as_of":"2026-10-01","answers":[]}`.
Observed HTTP 200 after **59.17 seconds**, plan `partial`, 64 evaluations. The real browser
instead displays an error at 20 seconds. `frontend/src/api/live.ts` hard-codes `TIMEOUT_MS = 20_000`
for all requests; this deadline is application behavior, not an observed Render timeout.
No provider API is involved in planner/renderer execution. Basic `/lookup` works; the five
build-time cached change scenarios return in 2.30–5.38 seconds. Those checks do not cover assist.

Unprofiled local direct calls against the same installed snapshot and source (single observations,
not hosted forecasts or p95 measurements):

| Property ID | Wall seconds | CPU seconds | Planner evaluations | Plan / questions |
| --- | ---: | ---: | ---: | --- |
| A0001 | 8.487 | 8.219 | 64 | partial / 3 |
| A0002 | 0.615 | 0.609 | 1 | complete / 0 |
| A0005 | 16.507 | 16.031 | 64 | partial / 5 |

A separate A0001 cProfile run incurred instrumentation overhead: 24.277 seconds, 36.20 million
calls. Cumulative times overlap and must not be added: planner 21.864 seconds; 66 `evaluate_rules`
calls 18.195 seconds; 240,540 `model_copy` calls 15.001 seconds (~62% of the full profiled request);
`evaluate_with_trace` 18.443 seconds. Evidence preparation was 0.554 seconds. The measurements
point primarily to CPU work in repeated probes/trace construction, not an OpenAI or network wait.
Private raw evidence: `artifacts/render/assist-local-timings.json`, `assist-profile.txt`,
`assist-profile.pstats`, `public-assist-verification.json` and the saved browser timeout screenshot.
These three diagnostic samples are not an acceptance benchmark or a hard-coded demo answer set.

## Smallest useful work, in order

1. **UX:** replace the blanket 20-second assisted-request failure with endpoint-specific handling.
   A 90–120 second deadline with visible waiting, cancel and duplicate-submit protection can provide
   immediate relief; it does not improve latency and may still be insufficient for the slowest
   Free requests. Prefer showing the basic lookup promptly and loading the question plan separately
   with explicit status. Preserve stale-response guards, answer accumulation and the active property/date.
2. **Core A + Core B:** profile evaluator probes and avoid constructing/deep-copying discarded audit
   traces repeatedly. Reuse request-invariant work or unchanged evaluations where equivalence is proven.
   Keep the one canonical evaluator/AST, exact audit traces where required, uncertainty, correlated
   alternatives, date precision and request isolation. Do not globally disable validation or mutable-copy
   protection. Reducing the analysis budget is a separately labeled fast/partial mode, not an equivalent
   optimization or silent loss of question quality.
3. **Platform:** assess bounded, versioned caches for unchanged prepared inputs and identical assisted
   requests. Any full-response key includes snapshot and relevant code identity, property/geography,
   date, all answers and provenance, supplemental facts, limits and scenario identity. Preserve request
   metadata and copy/isolate mutable responses. A cache hit alone cannot establish acceptable first-use
   performance; a new answer or date is a new request. No prewritten property/law outcomes.
4. **Fallback architecture:** if requests remain long, return a job ID promptly and poll/stream explicit
   progress/results. Design deduplication, cancellation, resource bounds and restart/expiration handling.
   This is a larger Platform/UX contract change; prefer the smaller fixes for the current demo window.
5. **Hosting:** benchmark paid compute if needed. Official prices checked October 4: `0.5c-512mb`
   (legacy Starter) is $7/month and `1c-2g` (legacy Standard) is $25/month. They offer 5x and 10x Free's
   nominal CPU allocation, respectively; these ratios do not promise equal speedups. The heavier local
   case means $7 is not a reliable blanket sub-20-second claim. $25 offers more CPU and 2 GB RAM for a
   demo, but still needs actual browser testing. Upgrade service compute, not the workspace plan; keep
   the immutable snapshot design, without adding a database or disk solely to address CPU latency.
   Confirm the selected recurring price before purchasing. No upgrade has been performed here.

## Acceptance and release gate

- Exercise actual `/lookup/assist` through a fresh browser, using a documented fixed cohort spanning
  multiple jurisdictions, both cheap and 64-evaluation cases, then answer follow-ups and date changes.
  Record snapshot/code/plan, request count, cold/warm state, CPU/RAM, payload size and p50/p95 latency.
- Synchronous target: warm p95 <=15 seconds, leaving margin below the current 20-second client window.
  Alternatively an explicit progressive/asynchronous flow must show useful basic results promptly and
  complete the plan without presenting a successful long-running request as a network failure.
  Cold-start behavior must be tested separately; Free sleeps after 15 idle minutes.
- Retain the same evaluations, questions/alternatives, uncertainty, traces and evidence for equivalent
  requests. Preserve partial/unavailable states. Prove no cross-user answer leakage, stale cache reuse
  or result overwrite when property/date/answers change. Do not drop difficult rules to meet a budget.
- Cover two simultaneous users without an unbounded job/request pile-up. Run lane-appropriate focused
  regressions and the real browser check. Software speed does not establish legal/data readiness.
- Close only with browser evidence on the selected host and an explicit residual-limits handoff to
  PLAT-13/16. A larger client timeout, green CI, a paid plan, or one cached property is not sufficient alone.

References: [Render compute specifications](https://render.com/docs/compute-plans),
[current compute prices](https://render.com/pricing), [Free limitations](https://render.com/docs/free).
