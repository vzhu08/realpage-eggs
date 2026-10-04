# RENDER-01: local Render deployment preparation

## Prioritized follow-up

At the user's request, [PERF-01](PERF-01.md) is now a P0 task-board item and deployment/rehearsal
gate. Read its local CPU profile, endpoint-specific timeout/progressive UX options, correctness
requirements and optional paid-compute comparison. This session's additional claim is limited to
`docs/TASKS.md` and `docs/tasks/PERF-01.md`; runtime ownership stays with the existing human lanes.

## Dashboard repair (October 4)

The user now explicitly requested computer use to repair Render and approved uploading the prepared
dataset and deploying the public demo on the free service. Service `realpage-navigator` exists on
Render Free, on this branch. The initial build lacked its snapshot; the checksum also had a leading
space, now corrected. Uploading the original single file exposed BuildKit's separate 500 KiB
per-secret limit, despite fitting Render's combined 1 MB allowance. The helper now produces two
410,634-byte parts, mounted and concatenated before the unchanged SHA-256/archive checks. The data
and evaluator are unchanged. Existing path claims cover this repair; no additional writers.
The earlier account/dashboard and no-deployment restrictions below describe the historical setup.

Outcome: Render deployment `b77ae3a` succeeded and is Live at
https://realpage-navigator.onrender.com on Free. All four CI jobs passed for that runtime revision;
38 focused local tests passed. Public HTTP verifies frontend assets, all 500 addresses, a basic
lookup (52 evaluations), private-path 404s, and all five cached scenarios (2.30–5.38 seconds).
The real build prepared the five caches in 343.6 seconds and became Live in 6m35s.
The setup checkout is still `codex/render-setup`; draft PR #22 contains the fix, not merged.

Remaining application issue discovered during browser verification: `POST /api/v1/lookup/assist`
returns HTTP 200 with a partial plan and 64 evaluations, but took 59.17 seconds on this Free instance.
The frontend's fixed 20-second timeout makes the browser lookup fail. This is not a remaining
Render build failure. Route planner performance to Oliver/Core B, cache/orchestration options to
Vincent/Platform, and timeout UX to the existing UX owner; no cross-lane runtime edits were made.
Next action: optimize the assisted path and retest browser lookup on Free before a demo rehearsal.
Research limitations remain T1 partial and T2–T5 blocked. No paid upgrade or provider calls.
Private verification reports and dashboard screenshot are under `artifacts/render/`.

## Free-hosting follow-up (October 4)

The user asked to deploy on a free platform. This session now replaces the default paid Blueprint
with Render Free and a build-time, hash-verified snapshot supplied through a Render secret file.
The frozen source ZIP fits Render's 1 MB secret-file limit after base64 encoding. The existing
evaluator prepares caches in the private image once per build; cold starts need no extraction,
external data download, persistent disk or SSH. Snapshot contents remain outside Git and logs.
Additional exclusive claims: `docs/RENDER_FREE_SETUP.md` and `.github/workflows/render-free.yml`,
for a synthetic image test under 512 MB RAM / 0.1 CPU. Existing claims below remain. This is the same writer and checkout; base
`e986453`. The paid procedure below is historical. No cloud account or resources are created here.

Owner: Vincent / this setup session; one writer, no delegated agents.
User assignment: do as much setup as possible through the terminal; user handles Render accounts/dashboard.
Branch: `codex/render-setup`; base: `9ff4396de5b6bdc5d8daed159a0778f993dd49cc`.
Checkout: `C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/render-setup` (clean at claim).

Claims: `render.yaml`, `deploy/Dockerfile`, `.dockerignore`, `scripts/render_snapshot.py`,
`deploy/upload-render.ps1`, `tests/test_render_snapshot.py`, `docs/RENDER_SETUP.md`, this card.
PLAT-08's Docker work is already integrated. Other active checkouts, shared board, authored
frontend/Core code and original stores remain untouched. Private outputs stay in ignored `artifacts/`.

Deliver one Docker web service with persistent disk, SSH-capable non-root user, verified private
snapshot transfer and offline cache preparation through the existing evaluator. Preserve partial
research labels. No provider calls, corpus resumption or public dataset activation in this session.
Render account/billing/GitHub connection and deployed service identifiers are still user inputs.

Implemented: Blueprint, automatic Render Git revision build argument, named non-root SSH user,
allowlisted snapshot ZIP preparation/validation/install, atomic new-directory publication and
PowerShell SSH/SFTP upload. The existing evaluator prepares runtime-bound caches; the public
data selector remains dashboard-managed. No Core/API/frontend source or dependency lock changed.

Local verification: 426 backend tests passed, two skipped; this includes 11 new snapshot tests
and 21 existing deployment tests. The four regenerated schemas match. Disposable frontend
generation/typecheck/118 unit tests/production build pass. Blueprint validates against Render's
official current JSON schema; PowerShell upload script parses. Python `pip check` passes.
Test-generated research fixtures were restored to their original committed bytes.

Private package: 13 serving files, 615949 compressed bytes;
SHA-256 `f2e384742924b1555b25c44205585367d039983daaf1d131e0095a4fda076e77`.
Original release manifest SHA-256:
`08e95c386914a570cd159000da4799c616100ffe059a727f5702648517910d5b`.
Dedicated Ed25519 SSH key created in Vincent's `.ssh`; only the public key is to be registered.

Final verification: real snapshot installation completed. Native HTTP on port 8030 serves the
current frontend, all 500 addresses, a property lookup and evidence download; private-file routes
remain unavailable. All five cached scenarios return in 0.45-0.98 seconds on this laptop, retaining
T1 partial and T2-T5 blocked. Original release and installed serving inputs are unchanged. The
private `artifacts/render/local-http-verification.json` and installed `render_install.json` retain
the results. No performance claim is made for the hosted service.

The user explicitly approved publishing the branch and opening draft [PR #22](https://github.com/vzhu08/realpage-eggs/pull/22).
Runtime implementation commit: `effa4ed`. [CI run 37186288607](https://github.com/vzhu08/realpage-eggs/actions/runs/37186288607)
passed backend/contracts, frontend/browser flows and full Linux container build/runtime. The local
Docker engine remains stopped. Only documentation is updated after those checks.

No Render resource exists yet, so actual Render disk permissions, SSH and public HTTP remain
unverified. Next user action: Render account/billing/GitHub connection, public SSH key registration
and Blueprint creation as described in `docs/RENDER_SETUP.md`. Then provide the SSH destination
and URL for terminal upload and deployment verification. Corpus limitations remain unchanged.
