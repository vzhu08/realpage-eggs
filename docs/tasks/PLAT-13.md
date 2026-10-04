# PLAT-13: deployment integration for the demo

## October 4 integration

`codex/platform-core-integration` independently verified the live `ebda276` deployment with
140 rules: health/frontend pass, A0001 assisted lookup 32.417 s, A0002 2.631 s, A0005 502.
PERF-01 remains failed. Platform's complete-response serialization and gzip fix passes parity
and full backend checks; it awaits hosted retest. See [integration handoff](../PLATFORM_CORE_INTEGRATION.md).
The preparation history below is superseded for current status.

## Preparation claim — October 4, 2026

Owner: Vincent / Codex session `01a1060f-0c12-7a41-a29e-c2de9377f99f`.
State: Preparation verified; final integration pending RENDER-01 review and ownership release.
Branch: `codex/platform-demo-prep`; base: `e7662374d5b8ad7f98401aae9c1fc5192e32a583`.
Checkout: `C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/platform-demo-prep`, clean at claim.
Exclusive writes: this card, PLAT-14 card, shared TASKS/OWNERSHIP, new
`docs/DEMO_PREPARATION.md`, `docs/evidence/plat13_14_preparation.json`, and private outputs
under this checkout's `artifacts/demo-prep/`. No deployment implementation paths are claimed.

PR #22 remains a draft on `codex/render-setup`; head `b77ae3a` has four passing checks.
The existing chat "Check Required Infrastructure" owns the Render repair, including two-part
snapshot secret transport. Its checkout and cloud configuration remain untouched by this claim.
Do not merge or clean up that active branch before the writer releases the tested result.
The stale no-hosting-yet handoff below is historical; hosted success still requires current evidence.

Result: see [DEMO_PREPARATION](../DEMO_PREPARATION.md). The writer reports deployed basic
lookup/cached scenarios, but assisted lookup takes about 59 seconds against a 20-second UI timeout. This session did not
independently verify hosted behavior. The pinned local fallback passed fresh HTTP health,
HTML, A0001 lookup, exact quote/evidence and T1 partial/T2 blocked checks with no input changes.
No deployment paths, dashboard, other writer's processes or branches were changed.

## Original assignment (status superseded above)

Owner: Vincent / next Platform chat. State at assignment: Ready; execution then unclaimed.
Start from current main; record actual checkout, branch, base and dirty files before editing.
Suggested branch for new work: `codex/platform-demo-deployment`. Do not switch another writer.

Continue existing [PR #22](https://github.com/vzhu08/realpage-eggs/pull/22), `codex/render-setup`,
and its RENDER-01 card. At this handoff it is open/mergeable and all four CI jobs passed.
Read its latest `docs/RENDER_FREE_SETUP.md` and claim/release state first; do not create a
second deployment implementation or overwrite its active author's checkout.

Outcome: one recorded frontend/API deployment with a pinned permitted snapshot and a working
local fallback. Review/merge the existing PR under established authority, complete account/config
steps under applicable deployment authority, then run a small hosted smoke test. This assignment
does not itself provision a service, authorize charges or claim a public URL already works.

Potential write scope after coordination: PR #22's deployment/runbook paths, this card and
Platform coordination docs. Keep Core and frontend source owned by their existing lanes.
Snapshot selection follows [PLAT-14](PLAT-14.md) and [data-source rules](../DATA_SOURCE_RULES.md).
Do not expose secrets or turn private infrastructure files into public frontend assets.

Checks: health, one real lookup, static frontend, source/evidence link, one change response,
displayed data/code identity and a cold-start check if practical. Reuse passing checks unless
new deployment changes justify rerunning them. If account setup stalls, retain the local demo
and continue PLAT-14; do not spend the entire coding window on hosting.

Handoff: PR/commit, deployed URL or precise setup blocker, snapshot/code hashes, actual checks,
remaining limitations, local fallback command. No source-record acquisition dependency blocks
deployment of an explicitly partial snapshot.
