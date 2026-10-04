# Private release handoff

`scripts/prepare_handoff.py` packages existing, verified **partial** exports for review. It never
calls the evaluator, a provider or a server. This is a saved-results handoff, not a new validation
run, deployment, submission or approval of incomplete legal evidence.

Inputs must be the immutable release plus the saved `deploy/verify_release.py` output: `report.json`,
the sibling `first/` and `replay/` directories, and their original run manifests. The command requires
independently retained SHA-256 pins for the report and both run manifests. The report anchors the
release manifest and seven payload hashes. The release manifest anchors every runtime/data/asset
file. Never accept newly computed pins as evidence that an unexpectedly changed input is correct;
compare them with the recorded verification handoff first. Hashes establish integrity, not authenticity.

From this checkout, using the existing environment:

```powershell
$env:PYTHON_DOTENV_DISABLED='1'
$python = 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/.venv/Scripts/python.exe'
$saved = 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/platform-release/artifacts/plat06'
& $python scripts/prepare_handoff.py prepare `
  --report "$saved/real-acceptance-verified/report.json" `
  --report-sha256 7cb0f32c01fa1184f53beefc840d5d4cff86873461f46dd23947d88ab8124578 `
  --first-manifest-sha256 1a7b1e03bf35a6fdbc72fd7b2cde451ff4e36151ae84b673e9167e69d16a9f11 `
  --replay-manifest-sha256 7204364a575d0e9f0605707957e058d1b857c1d55349991d48e2fc9d51ced104 `
  --release "$saved/releases/real-002" `
  --output artifacts/plat09/new-private-handoff
```

Choose a new output directory for each preparation. All inputs are read-only. Existing outputs,
overlapping trees, symlinks/junctions, missing/extra files, unexpected statuses, bad references,
inconsistent dates/input digests and differing replay payloads are rejected. Output is created only
after input validation. If copying fails, an incomplete marker remains and verification fails.
Exit 0 means packaging/integrity succeeded; exit 2 means failure. Exit 0 never means submission-ready.

The output contains the seven unchanged payloads (`rules.json`, `lookups.json`, `changes.json`,
`validation.json`, `change_details.json`, `evidence_inventory.json`, `evidence_checks.json`), the
unchanged first `run_manifest.json`, and the rendered [method note template](METHOD.md).
`provenance/` contains exact saved verification, replay-run, release and snapshot manifests.
`handoff.json` records their hashes, runtime commit, snapshot/source-catalog IDs, both run IDs,
logical input hashes, scenario statuses, validation counts and packager/template hashes.
Original absolute paths/timestamps remain untouched inside original manifests; they are provenance,
not paths the recipient verifier follows. The packager does not copy `.env` or unrelated files.

Retain the printed `manifest_sha256` outside the bundle (the recorded real run is in
[PLAT-09 evidence](evidence/plat09_handoff.json)). After copying to another private location:

```powershell
& $python scripts/prepare_handoff.py verify `
  --bundle artifacts/plat09/new-private-handoff `
  --manifest-sha256 <independently-retained-manifest-sha256>
```

The same saved inputs and same script/template bytes produce identical bundle files and manifest,
regardless of output directory. Repackage into a second new directory and compare all hashes to
check reproducibility. A recipient can verify without the original release, original absolute paths,
credentials or pipeline dependencies; only Python's standard library is used. Re-running actual
HTTP/evaluator checks still requires the separately retained frozen release and its locked environment.
The original full source/provider/geocoder store remains outside this handoff.

The real PLAT-06 handoff retains 500 addresses, 487 resolved municipalities, 140 review-needed rules,
16 exportable rules and 124 temporal-projection errors. T1 remains partial; T2–T5 remain blocked.
Both prior export commands exited 1 with explicit partial validation. No empty blocked result is
promoted to “no impact”; no legal repairs or fresh legal review are claimed. Core evidence/review,
remaining geography and UX acceptance remain separate work. Keep the private bundle out of Git
and public hosting; only tooling, documentation and hash evidence belong in this change.

Focused checks: `python -m pytest tests/test_handoff.py -q`. Tests are synthetic structural fixtures,
including byte preservation, replay, trust pins, tamper/missing/extra rejection, input/date mismatch,
submission-promotion rejection and output preservation. They are not legal test cases.
