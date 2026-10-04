# FINAL-01: finish the usable product within the remaining window

Priority: P0. State: scope selected; execution remains with existing lane owners.
User: less than two hours of coding; Daniel is already leading demo/frontend redesign.
Coordinator: Vincent / Platform. Board author: session `01a10660-7e93-7790-83ef-277a6ccd63f1`.
Claim: `codex/final-product-scope`, `artifacts/final-product-scope`, clean base `4e994b0`;
the five documentation paths are recorded in OWNERSHIP. Existing implementation claims persist.

## Time budget

Anchor: October 4, 2026, 06:10 America/New_York. Internal targets, not an organizer deadline;
an earlier actual team deadline wins. Do not restart the clock in another chat.

| Cutoff | Required decision |
| --- | --- |
| 07:10 ET (+60 min) | Daniel/Oliver hand off candidates; Platform selects dataset and hosted/local mode. |
| 07:25 ET (+75 min) | Finish integration/essential fixes; freeze code and data. No new feature work. |
| 07:55 ET (+105 min) | Finish focused release checks, exports, method note and rehearsal/local fallback. |

If a change cannot safely land, use tested previous behavior plus an explicit limitation.
An unresolved critical defect excludes that path from acceptance; it is not a pass.

## 1. Daniel: usable demo/frontend (UX-04 / PERF-01)

**Why:** users must reach real results and evidence; the blanket 20-second assist timeout can
turn a slow question plan into a failed lookup even when basic results are available.

Finish the selected flow only: property, as-of date, result/unknown reason, exact source quote,
answer/reset where supported, and existing evidence download. Add visible waiting, cancellation
and duplicate-submit protection. Reuse `/lookup` to keep basic results accessible when assistance
stalls. A longer deadline alone is insufficient; no new async job API is required.
Preserve request-local answers/provenance and property/date race guards. Preserve existing
change/disagreement views with actual/hypothetical/partial/blocked states; do not expand them.

Scope: existing sole writer of `frontend/**`, coordinated by Daniel; no concurrent second writer.
Done by 07:10: candidate with relevant frontend tests/build and real API checks for slow/failure/
cancel behavior, answer/reset and property/date switching. Fixture-only tests do not close this.

## 2. Oliver: one bounded planner improvement (PERF-01)

**Why:** the recorded local heavy case produced 120,502,306 decoded bytes (13,953,977 with gzip).
Platform transport and Core A result-only evaluator improvements are already merged; planner
construction and response volume can still make the final assisted flow unusable.

Timebox profiling and a small fix to 45 minutes. Inspect avoidable repeated evaluation/trace/
uncertainty construction and work discarded before question selection. Preserve the existing
public contract, one evaluator, correlated alternatives, exact evidence, date precision, analysis
limits and request isolation. Do not silently cut budgets or drop difficult rules/results.
Shared-model/payload redesign, new caching systems and the broad CORE-07 benchmark are deferred.

Scope: existing Core B planner/renderer/adapter, owned tests and `docs/core_navigation/**` in
Oliver's claimed checkout. Platform owns shared models/API. Deliver by 07:10 with same-snapshot
before/after time/size measurements, exact-output or justified semantic-equivalence evidence,
focused regressions and API answer replay. Small smoke samples are not a p95 or legal benchmark.
If no safe fix is ready, stop optimization and help rehearse; use the explicit UX/local fallback.

## 3. Vincent: Platform closeout and one dataset (PLAT-13/14/15)

**Why:** extraction candidates, a running service and a checked serving snapshot are different.
The final UI and exports must share reproducible permitted inputs.

Finish the active hosted retest, including cheap/heavy assist, follow-up answers and two users.
Use existing assembly/release tools to select an immutable snapshot. Check provider/source lineage,
hashes/anchors, all 500 address IDs, references and demo-critical dates/unknowns. Do not clear
review flags because software tests pass. Route semantic defects to Core A; retain uncertainty
or exclude an unsupported claim if the owner cannot resolve it before freeze.

Admit newly extracted output only if completed and checked before 07:10; otherwise use the verified
partial snapshot. The 147-rule research candidate is not automatically admitted. Never serve mutable
extraction output or relabel hand-authored Drafts. Reuse merged typed inputs; no speculative fields.
Select hosted or tested local mode by 07:10; local success does not establish public-host acceptance.
The existing authorized extraction remains independent within its cap; do not start/stop/duplicate
it or expand its budget through this assignment. Active Platform runtime/card claims remain intact.

## 4. Shared release check (PLAT-16)

**Why:** individually working components may fail together, and final delivery requires artifacts
and recovery instructions as well as code. Vincent owns integration/exports; Daniel rehearses;
Oliver checks answers/results. Spare reviewers check evidence in the selected flow.

After the 07:25 freeze, use one recorded commit/snapshot for all checks and outputs:

- Real property/citations, an uncertainty case and an existing change view with its truthful status.
  Include a cheap case, a heavy case and another jurisdiction where available; never hard-code answers.
- Property/date switching, answer/reset when offered, source panel, evidence download, slow/cancel
  behavior and two users. Record actual results; unresolved defects do not become passes.
- Existing tools produce `rules.json`, `lookups.json`, `changes.json`; check readback, IDs and hashes.
  Preserve actual supported/partial/blocked T1–T5 dispositions; never invent complete impact sets.
- One-page method note, exact tested local launch and preserved backup artifacts. A new backup
  recording is optional after required checks; reuse a suitable existing one.

Done by 07:55: real browser evidence, commit/snapshot, export paths/hashes, limits and local recovery.
Publication, purchases and submission retain their separately applicable authority.

## Deferred

Broad CORE-07 baseline/human-review scoring, full-corpus semantic/legal review, new D069/manual-Draft
admission, municipal/court source hunts, new law/field coverage absent a reproduced blocker, generic
chat, translations, async infrastructure, speculative cache/hosting migrations and design outside
the selected flow. Selected-release evidence/date/unknown checks stay required. Deferred work
remains incomplete. This board update creates no coding sessions or teammate messages.
