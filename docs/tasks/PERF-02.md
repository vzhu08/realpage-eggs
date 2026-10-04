# PERF-02 — canonical assist caching and 60-second rehearsal

Owner: Vincent / session 01a1067b-43a7-7cf1-813d-b0d807b6171f, sole writer.
Implementation branch: codex/assist-demo-cache. Original base: 5475b69cafd7dac4ca324099ee3b60a9a1d280e8.
Checkout: C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/assist-demo-cache.
Status: implemented and verified locally/hosted; prepared target met, uncached 2 GB OOM remains documented.

User explicitly authorizes Platform caching and narrowly necessary frontend preloading.
Exclusive claim: navigator/assist_cache.py, assist_wire.py, api.py, assist_service.py;
scripts/prime_assist.py; config/demo_requests.json; tests/test_assist_cache.py,
test_assist_wire.py; frontend/src/api/live.ts, assistWire.ts, assistPreload.ts;
frontend/src/api/validate.ts (memoize validation of shared transport nodes);
frontend/src/features/questions/QuestionCard.tsx (cache disclosure, stable fact field and lazy alternatives);
frontend/src/features/questions/RemainingUncertainty.tsx (lazy original quote disclosures);
frontend/src/components/ui.tsx (opt-in lazy disclosure contents);
frontend/tests/e2e/live-states.spec.ts (open lazy evidence and correct the request date in an API double);
frontend/src/lib/uncertainty.ts (same exact deduplication with indexed comparisons);
frontend/src/state/source.tsx, session.ts; frontend/src/features/demo/**;
frontend/tests/unit/assist-cache.test.ts; frontend/tests/e2e/assist-preload.spec.ts;
frontend/scripts/rehearse-assist.mjs; deploy/Dockerfile; docs/ASSIST_DEMO.md,
docs/evidence/assist-demo.json; this card and generated contracts if required.

Final-snapshot follow-up claim: scripts/render_snapshot.py and tests/test_render_snapshot.py
for optional lossless LZMA packaging. RENDER-01 is completed/merged; no active writer found.
Publishing authority received from the user's "authaorize" reply. Final 666-rule snapshot
independently verified against the extraction owner's completed run and source policy;
all original/copied file hashes match (artifacts/final-snapshot-verification.json).
Final browser-profile claim: frontend/src/lib/openItems.ts and
frontend/tests/unit/uncertainty-rendering.test.ts for exact indexed statement lookup.
Both existing UX checkouts have no edits to these paths; preserve their merged behavior/design.
CI follow-up claim: .github/workflows/render-free.yml, to use a synthetic request manifest
with its synthetic snapshot and verify the baked assist cache under the existing resource limit.

Read-only claim audit: both existing Claude checkouts preserved. Active design edits and
origin/codex/tenent-frontend-preview touch LookupView, Results, main, styling and visuals;
none of this claim's frontend paths overlap. Do not edit those view/style files.
Earlier Platform integration chat is idle after merged PR31. Extraction chat owns the
six-worker run in artifacts/extraction-parallel. Do not control it or modify its stores.
All original data and root AGENTS/playbook edits remain untouched.

Use PERF-01 acceptance plus requested sub-two-second planned clicks; report measurements
separately for cold, uncached, cached and browser-preloaded requests. A partial corpus and
cached demo never establish general performance or legal accuracy.

## Local handoff

Implemented bounded canonical artifact cache, complete request/snapshot/code/runtime identity,
lossless compact transport, offline manifest priming, tab-local preloading, cancellation and
stale-response protection. Existing evaluator/planner semantics remain unchanged.
Runbook/script: docs/ASSIST_DEMO.md; exact hashes/results: docs/evidence/assist-demo.json.

Selected rehearsal snapshot: frozen existing 140-rule store. Five final-code requests were each
independently recomputed and byte-compared successfully. Server-cached clicks: 293–359 ms;
preloaded paced clicks: 208–464 ms. Actual source quote visible by 55.22 s, evidence click 213 ms.
Cold clicks: 2.47–5.83 s. A0005 diagnostic: 120.5 MB canonical to 796 KB compact gzip; 27.4 s miss.
All results remain partial; no legal conclusion or general performance-readiness claim.

Checks: backend full 521 passed / 2 skipped before final HTTP guards; final cache/wire 20 passed;
contracts generated with unchanged schemas/OpenAPI; frontend 233 unit tests, typecheck/build pass.
Full desktop run: 128 passed / 11 skipped / 2 failures subsequently fixed; affected 15-test suite
then passed. Container execution unavailable (Docker daemon not running).

Render read-only verification showed 1 CPU / 2 GB / $25 per month on existing service, revision
4e994b0. No purchase, push, merge, deploy, extraction control or teammate messaging performed.
Extraction owner has authoritative-30-v2 running; final filtered snapshot is pending. Recheck its
handoff and re-prime/rehearse any newly selected immutable snapshot before release.
Next: obtain explicit authority for this branch's push/merge and existing-service deployment,
then verify actual hosted cold/uncached/cached/preloaded behavior. Preserve this active checkout
and ignored snapshots, caches, browser receipts and screenshots; no branch cleanup is due yet.

Final selection: 666 rules / 83 sources / 500 properties. Five independent canonical comparisons
pass. Final preloaded clicks 1.07–1.64 s; actual source quote at 55.57 s. Server-cache-only
follow-up/second-answer clicks were 2.05/2.13 s and miss target. Offline cold preparation is
43.76–77.04 s, still memory-heavy. Backend 523 passed / 2 skipped; frontend 241 full unit checks
plus added uncertainty regression, typecheck/build, 32 final affected E2E checks passed.
User authorized publication/deployment; no additional service purchase. See updated runbook
and authoritative evidence receipt. Root and all other active checkouts remain untouched.


Hosted follow-up: implementation PR34 merged at cb32524ea5e8d0fc3731f94d0478f65e55508039.
All four CI gates passed, including image-built assist hits under synthetic Free limits.
Both implementation source branches cleaned up after switching this same checkout to
codex/assist-demo-hosted-results for docs/evidence only. Snapshots, caches and other worktrees
are preserved. Deployment uses the existing 1c-2g service; final hosted results pending below.

Follow-up also retains the original navigator/assist_cache.py and tests/test_assist_cache.py
claim to preserve supplemental-fact insertion order in exact request keys. This order becomes
answers_applied list order, so sorted request dictionaries must not alias distinct response echoes.


Final integrated release: PR36 merged at ed1ae11dd7e3ca52bcde89b85219dae8dc99b7ca after four
passing CI gates. PR34 and PR36 remote/local source branches were deleted after confirmed merges
and switching this same checkout. Current evidence-only branch: codex/assist-demo-rehearsal-evidence.
The existing rehearsal-script claim remains active for preparation/failure timing receipts;
no frontend product or Core semantics changes are planned. All five final-code canonical
comparisons passed. Hosted final image dep-db14rlgu01pc73crflpg succeeded; final measurements follow. Root changes,
extraction sources, other checkouts and task-owned ignored artifacts remain preserved.

Final hosted outcome: all prepared clicks 0.98–1.58 s; source quote at 55.58 s, after 3.04 s
preparation. Warm cache-only clicks reached 2.14 s. Controlled same-request cold opening
returned HTTP 502 after 39.78 s and Render confirmed memory above 2 GB. Prepared cache
restored; fresh-browser cache hit verified. All five Linux image canonical hashes match
independently computed local results, and all five decoded compact artifacts match exact
canonical bytes. Final runbook/evidence identify limitations, commands and changed paths.
