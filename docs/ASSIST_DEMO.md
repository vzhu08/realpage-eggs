# Assisted demo caching and rehearsal

PERF-02 implements real result caching and a configurable five-request rehearsal. All results
come from the existing evaluator and planner. No outcomes, legal thresholds, rule selections,
or property facts are authored for the demo. The manifest's answers are hypothetical inputs.

Branch: `codex/assist-demo-cache`, base `5475b69cafd7dac4ca324099ee3b60a9a1d280e8` (PR32).
Checkout: `C:/Users/vzhu0/PycharmProjects/realpage-eggs/artifacts/assist-demo-cache`.
Exact input/code/runtime hashes, request keys, response hashes and measurements are in
[the evidence receipt](evidence/assist-demo.json). Original sources and other checkouts remain unchanged.
The user authorized this branch's push, merge and deployment to the existing Render service.
The final-snapshot release verification below supersedes the initial 140-rule rehearsal.

## Snapshot and hosting decision

Local rehearsals use the frozen, previously hosted 140-rule `real-002` snapshot copied from
`artifacts/render-setup/artifacts/render/local-data/snapshot-v1` into this checkout's
`artifacts/snapshot-initial`. The original archive SHA-256 is
`f2e384742924b1555b25c44205585367d039983daaf1d131e0095a4fda076e77`.
It has 500 properties, 87 sources and 487 resolved municipalities. It remains a partial research
dataset. The 147-rule candidate was not promoted solely because it has more rules.

Read-only inspection of the extraction owner's chat and `filtered-resume-handoff.json` on
October 4 found the first run stopped and reconciled, with 506 combined candidate rules. The
owner subsequently started `authoritative-30-v2` with a hash-bound source allowlist. Its completion
hook will produce `demo-authoritative-final-v1` after provenance checks. That final output was
not yet available at the local rehearsal cutoff. This task neither controls nor resumes extraction.
The 506-rule intermediate store is not the selected serving snapshot.

Render's dashboard was inspected before any proposed hosted rehearsal: service
`srv-db10ntfavr4c739nf3f0` showed **1 CPU / 2 GB, $25/month**, one instance, autoscaling off,
and live commit `4e994b0`. No purchase was made. The target is
https://realpage-navigator.onrender.com. This task's new behavior has **not** been tested there.
The existing blueprint still describes Free: deploy the existing upgraded service; do not apply
an unrelated blueprint plan change.

Before release, recheck the extraction handoff. Select a provenance-verified immutable serving
snapshot, copy it to a new task-owned directory, prime using the release runtime, and repeat the
actual browser flow. Inspect the returned question fields: a larger snapshot can change which
questions are useful. Adjust only the input manifest to a valid flow, then recompute and rehearse.
Never copy outcomes from this receipt or modify an extraction store to make a demo pass.

## Cache behavior

Set `NAVIGATOR_ASSIST_CACHE_DIR` to a private derived directory outside the source store.
Without it, the original uncached evaluator behavior remains available. The container enables
it at `/var/cache/navigator-assist` and primes during the image build, after snapshot installation,
using that image's exact Python, dependencies, code and configuration. Local cache artifacts
must not be transplanted across runtimes. No extra service, database or persistent disk is needed.

The key includes the complete normalized AssistRequest: property, date, accumulated answers in
order, explicit null/false, provenance and notes, supplemental facts, scenario and all limits.
Geography is bound through the full property/resolution snapshot. Every consumed data file and
semantic review is hashed, including explicit absence. All `navigator/**/*.py`, `config/**/*.json`,
Python version/implementation and Pydantic/Core/FastAPI/Starlette versions are also bound.
Code line endings are normalized; original source bytes are not. A changed input invalidates
the entry even if its timestamp is unchanged. Deployments must restart the process, not hot-edit
imported code/configuration in place.

Pydantic and domain validation run before hits. Results are produced by the existing assist
service, serialized once, checksummed, atomically installed, then hash-validated and streamed in
64 KiB chunks on hits. A hit does not rebuild a large Pydantic graph. Corrupt or stale entries
miss and recompute. Changed inputs detected during an HTTP analysis produce a retryable 503.
Injected Core adapters are not cached because they have no portable identity.

Default bounds are 16 entries, 256 MiB total committed artifacts and 256 MiB per decoded result.
Both canonical and compact representations count toward disk use. Oldest entries are evicted.
One temporary entry can coexist during atomic construction; disk-full/read-only failures bypass
the cache and preserve the actual result. One cold computation is admitted per API process;
another cold miss receives `503 analysis_busy` and `Retry-After: 2`. Warm hits can stream concurrently.
Keep the existing one-worker deployment. These controls bound cache retention and concurrent
construction, not the evaluator's intrinsic memory for an arbitrarily large uncached result.

The derived directory contains user answers and evidence. Keep it private and out of the public
frontend/source store. There is no cache-list/download route. HTTP responses use `no-store`.
Requests share an artifact only when **all** inputs match; no answer is carried into another
request. There is still no production authentication in this application. A crashed offline/API
writer can leave `.writer`; after confirming no writer uses that derived directory, use a fresh
cache directory and re-prime. Do not remove locks or prune another active writer's directory.

## Lossless transport and browser preparation

Default JSON clients retain the canonical AssistResponse. A client explicitly accepting
`application/vnd.realpage.assist-dag+json` receives an interned JSON graph: identical subtrees are
referenced repeatedly instead of serialized repeatedly. The decoder restores every field, array,
quote, trace, uncertainty and null/false value. Tests compare the decoded graph with canonical JSON.
The browser freezes shared nodes and validates them against the same schemas, memoizing only
successful checks for the same object/schema pair. It does not skip validation or evidence.

Large hypothetical alternatives and original uncertainty disclosures mount on opening. All
original content remains accessible. Small fixture results retain their existing DOM. Indexed
deduplication keeps the same source version, span, section, text and ordering distinctions.

Open `/?preload=1#/lookup?mode=live&address=A0001&as_of=2026-10-01` before presenting. Preparation
loads at most eight manifest requests sequentially and shows progress/cancellation. Wait for the
prepared count and opening-property button. Each tab has its own eight-entry, 256 MiB accounted
memory cache. Accounting counts each shared node once, including strings, references and
container/property overhead; it is a conservative budget, not a browser heap/RSS guarantee.
The duplicate wire text is released after validation.
It never uses localStorage. A server identity check precedes each local reuse. Failed checks
fall through to the server; they never serve a possibly stale local result.

Duplicate requests in the tab share transport, with independent cancellation. Property/date/answer
changes invalidate older completions; cancellation cannot later replace the visible screen. The
assisted deadline is 120 seconds with elapsed time and cancel controls. This is a fallback for
slow misses; it is not the performance fix. Busy, unavailable, partial and validation states remain
visible. Date changes clear answers as before.

## Repeatable local commands

Run in the isolated checkout. The repository's existing environment supplies dependencies:

```powershell
$TaskPython = 'C:/Users/vzhu0/PycharmProjects/realpage-eggs/.venv/Scripts/python.exe'
$env:PYTHONUTF8 = '1'
$env:PYTHON_DOTENV_DISABLED = '1'
& $TaskPython scripts/prime_assist.py --store artifacts/snapshot-authoritative --cache artifacts/cache-authoritative-v2 --manifest config/demo_requests.json --report artifacts/prime-authoritative-v2.json --verify
```

`--verify` independently computes each whole response and compares exact canonical bytes. The
receipt records all consumed snapshot/code hashes, runtime versions, keys, response SHA-256,
sizes, limits and question fields. Priming uses no providers. The command rejects a cache inside
the immutable store. The manifest accepts 1–8 validated AssistRequests. Offline priming supports
all request dimensions; this browser's manifest adapter rejects supplemental facts, scenarios or
custom limits that its current form cannot represent.

Build and serve in a terminal:

```powershell
Set-Location frontend
npm ci
npm run verify
Set-Location ..
$env:NAVIGATOR_DATA_DIR = (Resolve-Path artifacts/snapshot-authoritative).Path
$env:NAVIGATOR_ASSIST_CACHE_DIR = (Resolve-Path artifacts/cache-authoritative-v2).Path
$env:NAVIGATOR_FRONTEND_DIST = (Resolve-Path frontend/dist).Path
& $TaskPython -m uvicorn navigator.api:app --host 127.0.0.1 --port 8017 --workers 1
```

In a second terminal, in `frontend`:

```powershell
node scripts/rehearse-assist.mjs --base http://127.0.0.1:8017 --mode cached --output ../artifacts/rehearsal-cached.json
node scripts/rehearse-assist.mjs --base http://127.0.0.1:8017 --mode preloaded --paced --output ../artifacts/rehearsal-paced.json
```

For a cold/uncached measurement, stop **only your own** server, start it with a new empty
task-owned cache directory, then use `--mode uncached --server-state cold`. The flag records an
operator assertion; it does not restart a server. The receipt verifies misses. Reuse that server
for `--mode cached`, then a new browser context for `--mode preloaded`. `--headed` displays Chromium.
Keep competing builds/tests off the machine during measurements. Each run saves JSON and PNG.

The paced command cues actions at 0, 12, 25, 38 and 48 seconds, then opens actual source evidence
at 55 seconds. It records request/transfer/parse/validation/render timings, ResourceTiming sizes,
cache headers, identity, DOM node count and click-to-usable after two animation frames. It checks
the two-second target for all five analyses and the evidence click. A scripted paced run does
not measure a human narrator's speech; no audio recording was made.

## 60-second presenter script

| Time | Action and narration |
| --- | --- |
| 0–12 | Run the prepared A0001 lookup on October 1, 2026. “RealPage starts with a property and date. These are computed research results; unknowns and partial analysis stay visible.” |
| 12–25 | Answer owner-occupied **No**, then Apply. “Suppose the owner does not occupy it. That is an unverified answer. The evaluator updates the results and the next useful question.” |
| 25–38 | Enter tenancy start **2020-01-01**, then Apply. “A second hypothetical answer accumulates with the first. Remaining evidence and interpretation gaps are still shown.” |
| 38–48 | Edit owner-occupied and choose **I don't know**. “We can withdraw certainty. Unknown is an explicit answer, distinct from false.” |
| 48–55 | Change date to **2025-10-01**, Run lookup again. “Changing the date clears the answers and evaluates that date's rules.” |
| 55–60 | Open the first result's Evidence. “Every result leads back to its source quote. This is not legal advice.” |

For the measured snapshot all five plans are partial. The opening and date-change requests
reach 64 evaluations; all five reach the max-fields bound. No narrated step should claim a
definitive legal conclusion. If a click stalls, keep the loading state visible and describe the
measured limitation; do not substitute a fabricated answer or relabel synthetic fixtures as live.

## Verification and release gate

Historical **140-rule** localhost measurements (one observation per step, milliseconds from action handler to
usable UI; the cold server used an empty cache and each run used a fresh Chromium context):

| Step | Cold / uncached | Server cache | Browser preloaded, paced |
| --- | ---: | ---: | ---: |
| Opening | 5,828 | 293 | 208 |
| Owner-occupied false | 4,102 | 346 | 464 |
| Accumulated tenancy date | 2,468 | 321 | 357 |
| Reset owner-occupied to unknown | 3,019 | 342 | 441 |
| Date change / cleared answers | 5,498 | 359 | 322 |

All planned server-cached and preloaded analysis clicks passed the two-second local target.
The paced flow reached a visible source quote in **55.22 seconds**, with the evidence click taking
**213 ms**. The initial paced attempt failed because the test used the wrong accessible evidence
selector; the corrected script was rerun successfully. Cold analysis waiting totaled **20.91 seconds**.
The opening response is 28,957,297 canonical bytes, 3,267,859 compact bytes and 399,731 gzip bytes.
Transfer, JSON/graph parsing, schema validation and rendering are recorded separately for every
step in the receipt. Preloaded clicks transfer an identity response, not the assist body again.
The local server's observed peak working set across the five-request flow was 305 MB; this is
not a hosted measurement or an A0005 memory bound.

Backend full suite: 521 passed, 2 skipped before the final HTTP identity/encoding guard; final
cache/wire focused suite: 20 passed including that guard. Contracts regenerated successfully;
the public model/OpenAPI contracts did not change. Windows regeneration changes synthetic quote
offsets because of checkout line endings; only that generated churn was restored. No source text
or model was changed to suppress it. Frontend: 233 unit tests, typecheck and production build pass.
Desktop full run had 128 passes / 11 intentional skips and two failures subsequently fixed;
the affected 15-test demo/preload suite passes. See receipt for final rehearsal measurements.

Tests cover exact cached/uncached equivalence; every snapshot input; code/runtime invalidation;
answer/provenance/date/scenario/limits distinctions; false versus null; validation before hits;
corrupt bodies/metadata; eviction; concurrent user isolation; cold admission; compact round-trip;
late-response cancellation; duplicate joining; explicit partial states; accessible original evidence.

Local evidence does not establish performance on Render. Docker image execution is unverified
locally because the Docker daemon was unavailable. After the user authorizes this specific change's
push/merge/deployment, build on the existing service with the selected immutable snapshot,
confirm the new revision and 1 CPU / 2 GB state, then run the same three browser modes against
the hosted URL with `--hosted-authorized`. Obtain a controlled empty cache/restart for a true cold
miss measurement; otherwise label the state uncontrolled. Do not delete an active production
cache just to manufacture a cold test. Record failures and actual headers rather than assuming
build-time priming worked. Re-prime after any snapshot, relevant code, configuration or runtime change.

The planned cached path can meet the target locally while cold analyses fail it. A0005's full
canonical response is about 120 MB; its compact gzip transport is about 796 KB, but its uncached
compute-and-cache construction still took 27.4 seconds. Large expanded disclosures, working
exports and arbitrary nonmanifest requests are not covered by the sub-two-second claim.
No broad p95, multi-jurisdiction load, 2 GB hosted memory, or general performance readiness claim
is made. Passing software tests does not establish legal accuracy.


## Final 666-rule snapshot release

The extraction owner's `authoritative-30-v2` run completed at 2026-10-04T11:33:04Z.
The admitted `demo-authoritative-final-v1` snapshot has 666 rules, 83 sources and 500 properties.
D043, D058 and D067 remain failed/excluded. Original extraction stores were not changed.
The source-policy/provenance selector was independently rerun, then the complete original and
copy inventories were compared before and after copying. Policy SHA-256:
`c1c70480382c6b68252658edbc76ff1f83389333fd7fe8e2d3f66515bd5bb15a`.
Task-owned input: `artifacts/snapshot-authoritative`; verification receipt:
`artifacts/final-snapshot-verification.json`. Retain the label
`AUTHORITATIVE_SOURCE_DEMO_PARTIAL_NOT_LEGALLY_VERIFIED`; authoritative source identity does
not establish correct interpretation or exhaustive coverage.

Merged current main `35106d1` (TENENT frontend) into this branch without rewriting its view or
style files. Full merged frontend: 260 passed, 22 intentional skips. Final targeted checks after
memory/packaging changes: 523 backend passed / 2 skipped; 241 frontend unit tests, typecheck,
production build, and 24 desktop/mobile preload/live-state checks passed.

Render was rechecked: selected `1c-2g`, 1 CPU / 2 GB / $25 monthly. Existing service only.
Its build pipeline is separate from serving RAM; the default pipeline has 8 GB, per
[Render's build documentation](https://render.com/docs/build-pipeline). Do not change pipeline
billing/spend limits or buy resources for this task. Local priming still reached about 3 GB;
a cold evaluator call is not established safe within the 2 GB serving instance.

The default ZIP was too large for the existing 1 MB secret allowance. LZMA preserves every
input byte and produces 695,072 bytes, encoded into two 463,382-byte private secret files.
Repeat packaging with the repository helper (never commit the archive/base64):

```powershell
& $TaskPython scripts/render_snapshot.py prepare --release artifacts/release-authoritative --output artifacts/render-authoritative-lzma --compression lzma
& $TaskPython scripts/render_snapshot.py secret-file --archive artifacts/render-authoritative-lzma/snapshot.zip --sha256 db5be9319de0c89b0fe74fbbf9831e97968fe3c71f717ccae5a2897a8316a121 --output artifacts/render-authoritative-lzma/snapshot.b64
```

Use new output directories when repeating. Read the newly emitted SHA instead of reusing a
hash after inputs change. Upload both parts as `snapshot.b64` and `snapshot-part-2.b64` to the
existing Render service, update `NAVIGATOR_SNAPSHOT_SHA256`, then rebuild the authorized code.
The unchanged installer checks archive and individual input hashes before installing.
The image primes with its own runtime identity; local cache files are not uploaded.

For a bounded first-request failure diagnostic, add `--opening-only` to the rehearsal command.
Its receipt explicitly says the full flow was not tested. Retain separate cold/miss/hit/preload
receipts; never describe a preprimed process restart as a cold cache miss.


Final-snapshot local rehearsal after exact uncertainty indexing (every original/grouped
statement byte-compared across all five real results):

| Step | Server cached (ms) | Preloaded paced (ms) |
| --- | ---: | ---: |
| Opening | 1,280 | 1,068 |
| Owner occupied false | 2,051 | 1,637 |
| Accumulated tenancy date | 2,125 | 1,568 |
| Reset to unknown | 1,918 | 1,629 |
| Date change | 1,929 | 1,195 |

The preloaded flow reached the actual source quote in **55.57 seconds**; evidence click
**554 ms**. All preloaded planned clicks met the local target. Two server-cache-only clicks
missed it. Opening canonical size is 247,818,703 bytes; compact gzip is 2,285,311 bytes.
All five cache results independently match uncached canonical output. Cold offline preparation
for the steps took 67.64, 77.04, 46.84, 43.76 and 64.58 seconds. These are offline compute/cache
timings, not browser cold timings. Preserve that distinction in any performance claim.
