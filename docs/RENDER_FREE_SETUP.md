# Free Render deployment

The root Blueprint now uses one **Free** Docker web service, with no paid disk, database or
workspace upgrade. It serves the existing frontend and Python API together. The saved research
dataset is supplied privately to Render as a secret file and packaged into Render's private
container image. Caches are prepared by the existing evaluator during the build. Normal startup,
lookup and browsing make no OpenAI calls.

The prepared file is 821,268 bytes, below Render's combined 1 MB secret-file limit. It contains
only the verified `real-002` serving snapshot (500 addresses, 140 rules, 87 sources), encoded for
transport. It is not a credential and contains no API keys. It remains outside GitHub. The Docker
build context excludes it; only the explicit BuildKit secret mount makes it available to the build.
The resulting serving data lives outside the public frontend directory.

## Website steps

1. Sign in to [Render](https://dashboard.render.com/), keep the **Hobby** workspace, and connect
   GitHub with access to `vzhu08/realpage-eggs`. Choose no paid service or workspace upgrade.
2. Choose **New → Blueprint**, select the repo, branch `codex/render-setup`, and root `render.yaml`.
   Confirm the proposed service plan says **Free** and that no disk or database is listed.
3. For `NAVIGATOR_SNAPSHOT_SHA256`, paste the package's exact value:

   ```text
   f2e384742924b1555b25c44205585367d039983daaf1d131e0095a4fda076e77
   ```

4. Create the service. Then open **Environment → Secret Files → Add Secret File**. Set its filename
   to **`snapshot.b64`**. Copy the prepared contents with this PowerShell command on Vincent's laptop:

   ```powershell
   Get-Content -Raw 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/render-setup/artifacts/render/free/snapshot.b64' | Set-Clipboard
   ```

   Paste into Render's Contents field and save. The first build may fail before this file is added,
   with an explicit `Add Render secret file snapshot.b64` message. Saving the file triggers a new
   deployment. If needed, use **Manual Deploy → Clear build cache & deploy**.
5. Wait for the deployment to become Live, then open its `onrender.com` URL. Send that URL to the
   setup assistant for the public HTTP checks. There is no SSH upload or paid disk activation step.

Do not upload `.env`, an OpenAI key, or an SSH private key. The only file needed here is the prepared
snapshot. Adding it publishes the research data through the app's existing unauthenticated API.
The corpus remains partial and review-needed: T1 is partial and T2-T5 are blocked. Deployment
does not establish legal accuracy, evidence completeness or submission readiness.

## Free-tier tradeoffs

Render Free provides 512 MB RAM and 0.1 CPU. After 15 minutes without inbound traffic it sleeps;
the next visitor waits about a minute for it to wake. There is no SSH or persistent disk. Building
the immutable snapshot into the image lets it survive restarts without external downloads or
cache recomputation. A new approved dataset requires a rebuild, which is suitable for this demo.

Free services share 750 running hours per workspace per month and have included bandwidth/build
allowances. Without a payment method, exceeding those allowances results in suspension or disabled
builds rather than usage charges. With a payment method, overage charges can apply. Review Render's
dashboard usage settings if one is already attached. Keep only the intended free demo service active.

The automated free-container check uses labeled synthetic inputs, a read-only root, 512 MB RAM,
0.1 CPU and no swap. It verifies the actual frontend/API image and usable build-time caches. Actual
Render performance with the full research snapshot remains to be checked once the service exists;
this is a low-traffic demo configuration, not a production capacity guarantee.

References: [Free service limits](https://render.com/docs/free),
[secret-file size and setup](https://render.com/docs/configure-environment-variables#secret-files),
[Docker secret mounts](https://render.com/docs/docker-secrets),
[Blueprint reference](https://render.com/docs/blueprint-spec).

## Local app and future updates

The existing local app at [http://127.0.0.1:8030](http://127.0.0.1:8030) is unaffected. After a reboot:

```powershell
& 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/render-setup/artifacts/render/start-local.ps1'
```

To prepare a future approved release, run from the setup checkout:

```powershell
$python = 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/.venv/Scripts/python.exe'
& $python scripts/render_snapshot.py prepare --release 'C:/absolute/path/to/approved-release' --output artifacts/render/package-v2
$snapshotHash = (Get-Content artifacts/render/package-v2/snapshot.zip.sha256 -Raw).Trim()
& $python scripts/render_snapshot.py secret-file --archive artifacts/render/package-v2/snapshot.zip --sha256 $snapshotHash --output artifacts/render/free-v2/snapshot.b64
```

Update both the Render secret file and `NAVIGATOR_SNAPSHOT_SHA256`, then rebuild. The hash changes
invalidate the data build layer. If the snapshot grows beyond the 1 MB encoded limit, the helper
refuses to create the file; that future release needs a different transfer method. Original input
stores are never overwritten. Keep the previous private file/hash for rollback.
