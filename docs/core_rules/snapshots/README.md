# Core store checkpoint — partial, extraction paused

Archive: `docs/core_rules/snapshots/core-store.zip` on `codex/core-a-change-evidence`.
Packaged from the unchanged original `core-backend/data/core-session/` checkpoint.
Producing/packaging code commit: `0493b2c72536aa93ea5f6dfe9304819bcada6dc5`.
Extraction runtime revision: `a422fb3b79e6169dabc8b5ff1b148c013de7c7c2` (documented in
`docs/core/CORE01_LIVE_REVIEW.md`; runtime unchanged through stop commit `32ac1e5`).
The run manifests record pipeline version 0.1.0 rather than Git SHA; older replay
origins remain individually recorded in the included runs and caches.
Latest independently software-verified Core runtime: `b33af14dbd46bbad0ffafd795916bb503795a89b`.

Snapshot: **500 addresses, 140 rules (all review-needed),
87 sources / 54 captured, 15 processed documents**.
It contains 94 checkpoint files: 21 run manifests,
16 cache entries and 46 provider-output files.
All municipalities remain unresolved. Prior offline validation at 2026-10-01 found
16 exportable rules / 124 unresolved temporal projections. This is not a complete
submission or independent legal review. Live/replay provenance is retained; no new
extraction, model call, geography assembly or data correction occurred.

Latest extraction: `296de71f2c794d6c9ca3ed48f133ebb2`, `partial`, stopped
`2026-10-04T00:09:47.066896+00:00`. Its interruption and usage records are preserved.
`negative_findings.json` and `latest_ingest.json` are included; `semantic_reviews/`
is absent in this checkpoint. The requested folders retain their relative paths.
`.env`, API keys, `.venv` and unrelated output/experiment artifacts are excluded.

`SHA256SUMS` inside the ZIP verifies every checkpoint file after extraction:
`shasum -a 256 -c SHA256SUMS`. Extract only into a **new empty private directory**.
The adjacent `core-store.manifest.json` lists every ZIP member's SHA-256 and size,
the archive SHA-256, provenance, counts and original-store integrity checks.
The adjacent `core-store.sha256` verifies the ZIP from this directory.
The original 182-file store was hashed before and after packaging and is unchanged.

The user's October 4 instruction explicitly authorizes committing/pushing this
snapshot and its handoff on this branch, superseding the earlier local-transfer
restriction. Extraction remains paused; Platform owns subsequent store assembly.
