param(
    [Parameter(Mandatory = $true)]
    [ValidatePattern('^[a-z0-9-]+@ssh\.[a-z0-9-]+\.render\.com$')]
    [string]$SshDestination,
    [string]$Archive = (Join-Path $PSScriptRoot '../artifacts/render/package/snapshot.zip'),
    [string]$IdentityFile = (Join-Path $env:USERPROFILE '.ssh/id_ed25519_render_realpage'),
    [ValidatePattern('^[a-z0-9][a-z0-9-]{0,63}$')]
    [string]$SnapshotName = 'snapshot-v1'
)

$ErrorActionPreference = 'Stop'
$archivePath = (Resolve-Path -LiteralPath $Archive).Path
$identityPath = (Resolve-Path -LiteralPath $IdentityFile).Path
$expected = (Get-Content -LiteralPath "$archivePath.sha256" -Raw).Trim()
if ($expected -cnotmatch '^[0-9a-f]{64}$' -or
    (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected) {
    throw 'Snapshot archive SHA-256 verification failed.'
}
$sshOptions = @('-i', $identityPath, '-o', 'IdentitiesOnly=yes')
# Keep ordinary SSH host-key verification. On the first connection, compare Render's
# documented fingerprint before accepting it; never disable StrictHostKeyChecking.
& ssh @sshOptions $SshDestination "test -w /var/data && test ! -e /var/data/$SnapshotName && test ! -e /var/data/.$SnapshotName.installing"
if ($LASTEXITCODE -ne 0) { throw 'Disk is not writable or the snapshot name already exists.' }

$remoteArchive = '/var/data/upload-' + [guid]::NewGuid().ToString('N') + '.zip'
Push-Location -LiteralPath (Split-Path -Parent $archivePath)
try {
    $localArchive = './' + (Split-Path -Leaf $archivePath)
    & scp -s @sshOptions $localArchive "${SshDestination}:$remoteArchive"
    if ($LASTEXITCODE -ne 0) { throw 'Snapshot upload failed.' }
} finally {
    Pop-Location
}
& ssh @sshOptions $SshDestination "python /app/scripts/render_snapshot.py install --archive $remoteArchive --sha256 $expected --data-root /var/data --name $SnapshotName"
if ($LASTEXITCODE -ne 0) { throw 'Snapshot installation failed. Keep the current NAVIGATOR_DATA_DIR; inspect the retained staging directory.' }
Write-Output "Installed snapshot. To serve it, set NAVIGATOR_DATA_DIR=/var/data/$SnapshotName in Render and redeploy."
Write-Output "The verified uploaded archive remains at $remoteArchive as a backup."
