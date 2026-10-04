# PLAT-10: automated Platform integration checks

Owner: root Platform integration writer, authorized by the October 4 parallel-work request.
State: Implemented and verified. Integration: PR #17; all three initial CI jobs passed.
Branch: `codex/platform-ci`; base `0f347a0`.
Checkout: `C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/platform-ci`.
Exclusive paths: `.github/workflows/platform.yml`, this card, `docs/evidence/plat10_ci.json`.
Root additionally owns integration docs, generated contracts and Platform environment configuration.

Run backend/schema, disposable frontend/browser and full container smoke on PRs and main.
Pin GitHub Actions to verified official commit IDs and use read-only repository permissions.
Use no provider credentials, organizer pack or real-data store. Preserve labeled synthetic scope.
The container job supplies Linux Docker verification unavailable on the local stopped engine.

Frontend generation in CI checks consumer compatibility after regeneration; it does not claim
UX's checked-in generated files are current. Backend checks compare the four stable contract schemas;
runtime-dependent example fingerprints are intentionally not a schema-drift gate. Real corpus and
legal acceptance remain separate. No deployment or submission is performed by this workflow.

Acceptance: actual workflow jobs pass on the integration commit, or exact failures remain disclosed.
Root reviews and merges only after required checks pass; no branch-protection bypass is requested.

## Verified combined checks

The first complete [CI run](https://github.com/vzhu08/realpage-eggs/actions/runs/37182634028)
passes all three jobs on the current Core B/UX plus Platform integration: 405 backend tests
(one private-pack skip), four unchanged generated schemas, 118 frontend unit tests, production
build and 114 browser tests (22 intentional skips). Full Linux image/runtime smoke passes with
three labeled synthetic properties. No private real store or provider credential is uploaded.

Windows checks with the organizer pack pass 405 tests with one symlink-privilege skip after
setting `PYTHONUTF8=1`. The initial CP1252 run failed while decoding a UTF-8 Core benchmark fixture;
Platform child processes and CI now enforce UTF-8. An explicit read encoding in Core's benchmark
is an owner follow-up. Regenerated evidence package examples both reproduce with current Core code.

Exact code IDs, run URL, runtime report and limits: `docs/evidence/plat10_ci.json`.
The final environment/docs update receives a fresh PR run before merge. Prior real release and
private handoff artifacts remain unchanged. Public hosting, legal acceptance and real-corpus
completion are not established by these software checks.
