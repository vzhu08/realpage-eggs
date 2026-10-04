# Local frontend/API container

PLAT-08 replaces the backend-only image with a production frontend build served by the existing API
on one origin. The complete image build and Linux runtime passed in GitHub Actions on labeled
synthetic data. Docker Desktop's Linux engine remains stopped on the local Windows host. See
[recorded evidence](evidence/plat08_container.json) and [combined CI results](evidence/plat10_ci.json).
No public host, authentication or TLS is added.

The frontend stage runs `npm ci`, regenerates types from the current contracts, then runs the existing
UX `verify` command (contract check, typecheck, unit tests and production build). Only its `dist/`
enters the runtime image; no authored frontend source is changed. The runtime installs the Python
lock, includes the existing API/config/contracts and labeled synthetic fixtures, and serves assets
from `/app/public`. Both image stages use pinned official multi-architecture manifests. Python
3.12.14 matches the verified native release. The Python lock has no artifact hashes, so this is not
a claim of byte-reproducible images across registry/package changes.

The build context is an allowlist. Private stores, organizer inputs, Git metadata, `.env` files,
local dependency/build directories and screenshots stay outside it. The selected snapshot is an
existing read-only bind mount, never a build input. UID/GID 10001, a read-only root, dropped
capabilities, `no-new-privileges`, bounded temporary storage and loopback publication are retained.
Provider credentials are blank; dotenv and cross-origin browser access are disabled.

## Unattended verification

Run from a clean committed checkout, using the repository Python environment. The runner never
starts or installs Docker Desktop. It creates a unique Compose project and image tag, uses an empty
Compose env file instead of loading an ambient `.env`, preserves all inputs, and tears down only
its own project after runtime checks. The image and local report remain available for review.

Configuration-only verification needs the Docker CLI/Compose but no running engine:

```powershell
$env:PYTHON_DOTENV_DISABLED = '1'
python deploy/verify_container.py --synthetic --output artifacts/container-config --port 8028
```

When a Docker engine is already available (including a Linux CI runner), this is the complete
unattended synthetic build/smoke command:

```powershell
python deploy/verify_container.py --synthetic --output artifacts/container-ci --port 8028 --build-and-run
```

Use a new output directory for each run. `--synthetic` creates clearly labeled software-test data;
it does not establish real corpus readiness. To verify a reviewed real snapshot instead:

```powershell
python deploy/verify_container.py --data-dir C:/absolute/path/to/reviewed-snapshot --output artifacts/container-real --port 8028 --build-and-run
```

The runner verifies normalized Compose settings before launch and actual container settings after
launch: image revision, non-root user, read-only mount/root, capabilities, environment and loopback
port. It requests HTML and linked assets, checks private paths remain unavailable, paginates all
addresses, performs a real lookup through HTTP, probes write denial and rehashes the input snapshot.
These checks exercise the service, not browser interactions or legal correctness. The healthcheck
proves HTTP liveness; partial corpus readiness remains visible in the report.

Exit codes: 0 = requested checks passed (configuration-only reports `candidate_validated`, never
`runtime_verified`); 2 = refusal/check/cleanup/preservation failure; 3 = requested runtime test could
not proceed because the engine is unavailable. Detailed logs and `report.json` stay in the output.
Image build downloads only public dependencies/base images. No provider or public deployment is used.

## Keep a reviewed local container running

After successful verification, choose a clean committed checkout and an immutable snapshot readable
by UID 10001. Do not loosen snapshot permissions globally to work around a Linux bind-mount error;
prepare a separate serving copy with appropriate local ownership. Use an unused loopback port.

```powershell
$env:NAVIGATOR_SOURCE_REVISION = (git rev-parse HEAD).Trim()
$env:NAVIGATOR_IMAGE = 'realpage-navigator:reviewed'
$env:NAVIGATOR_DATA_PATH = (Resolve-Path C:/absolute/path/to/reviewed-snapshot).Path
$env:NAVIGATOR_PORT = '8028'
New-Item -ItemType Directory -Path artifacts/container-launch -ErrorAction Stop
Set-Content -Path artifacts/container-launch/empty.env -Value '# Intentionally empty'
docker compose --env-file artifacts/container-launch/empty.env -p navigator-reviewed -f deploy/compose.yaml config --quiet
docker compose --env-file artifacts/container-launch/empty.env -p navigator-reviewed -f deploy/compose.yaml build
docker compose --env-file artifacts/container-launch/empty.env -p navigator-reviewed -f deploy/compose.yaml up -d --wait
```

Open `http://127.0.0.1:8028/`. Save the image ID, source revision and snapshot fingerprint from the
verified report. Stop this named service without deleting the snapshot or image:

```powershell
docker compose --env-file artifacts/container-launch/empty.env -p navigator-reviewed -f deploy/compose.yaml down
```

For rollback, retain the earlier image ID and its matching immutable snapshot. Stop this project,
select that image/snapshot and use `up -d --no-build --wait`; repeat the HTTP and snapshot checks.
PLAT-06's verified native bundle remains the known-good local fallback. Synthetic Linux CI verifies
the container runtime; a real-data container rehearsal is still separate. Keep native port 8016
separate from container verification port 8028.

Published-scenario caches depend on evaluator inputs/code and Python/Pydantic versions. The pinned
Python patch version avoids an unnecessary mismatch with PLAT-06, but changed code or data still
invalidates old caches. A missing/stale cache invokes the existing evaluator and can take minutes;
HTTP does not save a replacement. Use the Platform offline cache workflow on a separate serving copy
before rehearsal and verify cache hits on the actual final runtime. This runner deliberately does not
claim portfolio latency or final judge readiness from a successful lookup.
