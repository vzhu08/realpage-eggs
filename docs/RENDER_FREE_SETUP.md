# Free Render deployment

The root Blueprint now uses one **Free** Docker web service, with no paid disk, database or
workspace upgrade. It serves the existing frontend and Python API together. The saved research
dataset is supplied privately to Render as two secret files and packaged into Render's private
container image. Caches are prepared by the existing evaluator during the build. Normal startup,
lookup and browsing make no OpenAI calls.

The prepared transport is 821,268 bytes, split into two 410,634-byte files. Each is below Docker
BuildKit's 500 KiB per-secret limit; their total is below Render's combined 1 MB limit. It contains
only the verified `real-002` serving snapshot (500 addresses, 140 rules, 87 sources), encoded for
transport. It is not a credential and contains no API keys. It remains outside GitHub. The Docker
build context excludes both parts; only explicit BuildKit secret mounts make them available to the build.
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

4. Create the service. Then open **Environment → Secret Files → Add file**. Add both files, using
   these exact names. Copy and paste each prepared file's contents into its corresponding Contents field:

   ```powershell
   # First file: snapshot.b64
   Get-Content -Raw 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/render-setup/artifacts/render/free-split/snapshot.b64' | Set-Clipboard
   # After pasting the first file, copy the second: snapshot-part-2.b64
   Get-Content -Raw 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/render-setup/artifacts/render/free-split/snapshot-part-2.b64' | Set-Clipboard
   ```

   Choose **Save, rebuild, and deploy** after adding both. The first build may fail before the files
   are added, with an explicit missing-file message. Do not use the old unsplit 821,268-byte file:
   Render accepts its upload, but BuildKit rejects it with `secret snapshot_b64 too big. max size 500KiB`.
   When fixing an existing setup, replace `snapshot.b64` with the first smaller part and add the second.
   If needed, use **Manual Deploy → Clear build cache & deploy**.
5. Wait for the deployment to become Live, then open its `onrender.com` URL. Send that URL to the
   setup assistant for the public HTTP checks. There is no SSH upload or paid disk activation step.

Do not upload `.env`, an OpenAI key, or an SSH private key. Only the two prepared snapshot parts are
needed. Adding them publishes the research data through the app's existing unauthenticated API.
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

The helper creates `snapshot.b64` and `snapshot-part-2.b64`. Update both Render secret files and
`NAVIGATOR_SNAPSHOT_SHA256`, then rebuild. The hash changes
invalidate the data build layer. If the snapshot grows beyond the 1 MB encoded limit, the helper
refuses to create the files; that future release needs a different transfer method. Original input
stores are never overwritten. Keep the previous private files/hash for rollback.
