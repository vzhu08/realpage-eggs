# PLAT-13: deployment integration for the demo

Owner: Vincent / next Platform chat. State: Ready to review existing work; execution unclaimed.
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
