# PLAT-10: automated Platform integration checks

Owner: root Platform integration writer, authorized by the October 4 parallel-work request.
State: In progress; awaits merged PLAT-08 runner and actual GitHub Actions results.
Branch: `codex/platform-ci`; base `0f347a0`.
Checkout: `C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/platform-ci`.
Exclusive paths: `.github/workflows/platform.yml`, this card, `docs/evidence/plat10_ci.json`.

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
