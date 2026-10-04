# RENDER-01: local Render deployment preparation

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

Remaining verification: real snapshot installation/cache preparation is running locally. The local
Docker engine is unavailable; Linux container execution will be checked by the existing PR CI.
No Render resource exists yet, so actual Render disk permissions, SSH and public HTTP remain
unverified. Next user action: Render account/billing/GitHub connection, public SSH key registration
and Blueprint creation as described in `docs/RENDER_SETUP.md`. Then provide the SSH destination
and URL for terminal upload and deployment verification. Corpus limitations remain unchanged.
