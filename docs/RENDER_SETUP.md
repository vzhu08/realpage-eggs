# Render setup

This branch prepares one Docker web service that serves the existing React frontend and Python API
from the same URL. It uses a 1 GB persistent disk for the saved JSON dataset. No Postgres, Redis,
separate frontend host, Docker Hub account, custom domain or hosted OpenAI key is needed.

## Already available on Vincent's laptop

- Python 3.12.14 and the installed, checked `requirements.lock` environment.
- Node/npm, Docker CLI/Compose, GitHub CLI and Windows OpenSSH. The local Docker engine is stopped;
  native local operation works without it. Render builds the Docker image remotely.
- Ignored root `.env` with an OpenAI key and model configured. This session has not made a new
  billable API call. Existing extraction/semantic-review code is implemented; ordinary HTTP
  lookups and offline cache preparation do not call a model.
- Verified frozen `real-002` release: 500 addresses, 140 rules, 87 sources; a partial research
  corpus, with 487 resolved addresses. The original release stays unchanged.

The setup checkout is `C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/render-setup`.
Its private upload package is `artifacts/render/package/snapshot.zip`; the adjacent `.sha256`
and `receipt.json` record its identity. It contains 13 serving files and excludes old derived
change caches, provider caches, run history and secrets. It is not committed to Git.

The dedicated Render public key is `C:/Users/vzhu0/.ssh/id_ed25519_render_realpage.pub`.
Its private counterpart stays on this laptop, with user-only permissions and no passphrase.
Add a passphrase with `ssh-keygen -p -f "$env:USERPROFILE/.ssh/id_ed25519_render_realpage"`
if you want an interactive unlock on each connection. Only upload the `.pub` file's contents.

## Website steps

1. Create/sign in to [Render](https://dashboard.render.com/), connect your GitHub account and
   grant it access to `vzhu08/realpage-eggs`. Add billing for the paid service and disk.
2. In Render **Account settings → SSH Public Keys**, add the dedicated public key. Copy it locally:

   ```powershell
   Get-Content "$env:USERPROFILE/.ssh/id_ed25519_render_realpage.pub" | Set-Clipboard
   ```

3. Create **New → Blueprint**, select the repo and the published `codex/render-setup` branch
   (or `main` after this change is merged), using the root `render.yaml`.
4. For its one prompted variable, `NAVIGATOR_DATA_DIR`, enter `/var/data/not-loaded` initially.
   Review the displayed price before creating resources: one `1c-2g` web service in Virginia and
   one 1 GB disk. The 2 GB memory choice leaves room for the API plus offline evaluation during
   snapshot installation; it is a starting allocation, not a measured production capacity claim.
5. Create the Blueprint and wait for its first deployment to become live. The frontend loads;
   `/api/v1/health` reports `dataset_readiness: absent` until a snapshot is activated.
6. Copy **Connect → SSH** from the service and send its destination and public service URL to the
   setup assistant. These are not credentials. No Render API token is required for SSH upload.

The Blueprint uses JSON syntax, which is valid YAML and can be checked without a YAML dependency.
Render supplies `RENDER_GIT_COMMIT` to the Docker build; manual Git SHA maintenance is unnecessary.
Automatic deployments are off. `NAVIGATOR_DATA_DIR` is dashboard-managed (`sync: false`) so a later
Blueprint sync cannot reset the selected snapshot. Do not add the laptop's OpenAI key to Render.

Configuration references: [Blueprints](https://render.com/docs/blueprint-spec),
[Docker](https://render.com/docs/docker), [default variables](https://render.com/docs/environment-variables),
[SSH](https://render.com/docs/ssh), [persistent disks](https://render.com/docs/disks).

## Terminal upload after the service exists

The assistant can run this once you provide the service's actual SSH destination. To run it yourself
from the setup checkout, substitute the destination shown by Render:

```powershell
.\deploy\upload-render.ps1 -SshDestination 'srv-YOUR-SERVICE@ssh.virginia.render.com'
```

Use the real lowercase destination; the placeholder above intentionally is not a valid host.
On the first SSH connection, compare the host fingerprint with Render's current SSH documentation.
The helper checks the local archive hash, uploads it over SFTP, verifies its contents on the host,
validates the stored Pydantic models and recomputes the saved scenarios through the existing Core
evaluator. This can take several minutes. It prints progress for each completed scenario.
No model is called. The disk is only available on the running service, so this is not a build or
pre-deploy command. An ephemeral shell/one-off job cannot initialize this attached disk.

Successful installation returns `NAVIGATOR_DATA_DIR=/var/data/snapshot-v1`. Set that value in the
service's **Environment** page and save/redeploy. This publishes the snapshot through the existing
API, which has no authentication. Use this for the intended demo audience; production access
control is a separate feature. The corpus remains `RESEARCH_RELEASE_NOT_VALIDATED`; software and
file-integrity checks do not establish legal accuracy or submission readiness.

Verify the public URL and `/api/v1/health`: 500 addresses and 140 rules should be visible, with
partial/review-needed readiness preserved. Check a property lookup, the change scenarios and
evidence download in the UI. A green liveness check alone does not prove dataset readiness.

## Updates and rollback

Use a new snapshot name for each installation, for example `-SnapshotName snapshot-v2`. Existing
snapshots are never overwritten. A failed install retains only `.snapshot-v2.installing`; do not
activate it. The upload ZIP also remains on the persistent disk as a recovery copy.

After a code update, install the package under a new name to prepare caches for that exact runtime,
then change `NAVIGATOR_DATA_DIR`. Normal requests can recompute when a cache is stale, but offline
preparation avoids making the first demo request pay that cost. For rollback, select the previous
snapshot path and, if needed, redeploy its matching reviewed code commit. A disk-backed Render
service has one instance and brief downtime during redeploys. Local Compose's additional read-only
root/capability restrictions are not automatically applied by Render.

To prepare a later approved frozen release, without modifying that release:

```powershell
$python = 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/.venv/Scripts/python.exe'
& $python scripts/render_snapshot.py prepare --release 'C:/absolute/path/to/release' --output artifacts/render/package-v2
.\deploy\upload-render.ps1 -SshDestination 'ACTUAL-DESTINATION' -Archive artifacts/render/package-v2/snapshot.zip -SnapshotName snapshot-v2
```

Source acquisition after `real-002` is not automatically included in this snapshot. Core review and
extraction must produce a separately approved release before packaging new legal data.
