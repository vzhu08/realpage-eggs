# Manual $5 extraction pilot

Run this from an ordinary PowerShell window, so no Codex session needs to wait for completion.
No paid call was made while preparing these instructions. The user selected a $5, one-document
pilot. This is readiness for a bounded test, not a claim that extraction can never improve.

At reviewed main `9ff4396`, no open PR proposed another extraction change. Core already runs an
extraction pass, a separate semantic/omission review and at most one validation repair. Its
ordinary provider retries some failures; the pilot wrapper stops after the first HTTP/transport
error and uses the existing Core prompts, validator, caches and evaluator without modification.
The 21 new source captures do not by themselves repair existing rules or finish T1-T5.

Start with **D069, NJ FAIR Act**, already captured, 10,354 characters, one chunk. Do not start a
full-corpus command yet. Municipal redlines need visual review, broad minutes/compilations need
targeted source preparation, and cross-document date/version interpretation remains Core work.
A pilot's results determine whether a source-specific prompt/schema repair is worthwhile before
spending on the remaining queue. No speculative rewrite is required before this pilot.

## Budget and credentials

Use a dedicated API project/key for this pilot. In the API dashboard, select that project's
**Settings > Limits > Spend > Edit spend limit**, enter **$5**, enable **Enforce a hard limit**,
and save. A spending alert alone does not stop requests. Enforcement can lag slightly, so it
is not an exact per-job dollar guarantee. See [OpenAI spend controls](https://developers.openai.com/api/docs/guides/spend-limits).

Save the dedicated key locally in ignored
`C:\Users\vzhu0\PycharmProjects\realpage-eggs\.env.pilot` as `OPENAI_API_KEY=...`.
Do not paste the key into chat, command arguments or Git. An explicit `--env-file` overrides an
inherited API key; a selected file missing its key fails rather than using another project's key.
The wrapper explicitly pins model `gpt-6.1-sol` and Standard service tier.

Local controls: maximum 3 actual POSTs, 32,000 output tokens/request, 131,072 JSON request bytes, one
source chunk. The ledger reserves $1.50 before each request, at most $4.50, including failed or
unknown-billed attempts; it does not refund reservations automatically. This is conservative
local accounting, not observed spend or a server-enforced cap. Current published Standard rates
are $2/input, $2.50/cache-write, $10/output per million tokens, with a possible 10% regional premium.
The allowance includes ample headroom for these bounded requests, but must be reconsidered if
rates, model or request limits change. [Official model pricing](https://developers.openai.com/api/docs/models/gpt-6.1-sol).

## Exact Windows commands for this machine

The repository venv and immutable source snapshot already exist. The paths below use the
Platform checkout containing the new launcher. The output directory must not already exist.
First run the dry-run block (no key required, no files written):

```powershell
$project = 'C:\Users\vzhu0\PycharmProjects\realpage-eggs'
$work = Join-Path $project 'artifacts\platform-ci'
$python = Join-Path $project '.venv\Scripts\python.exe'
$source = Join-Path $project 'artifacts\platform-release\data\plat06\integrated-release'
$pilot = Join-Path $work 'data\extraction-pilot-d069'
Set-Location $work
& $python scripts/extraction_pilot.py --source-dir $source --output $pilot --doc-id D069 --budget-usd 5
```

After setting the dedicated project limit and saving its key, start the paid pilot:

```powershell
& $python scripts/extraction_pilot.py --source-dir $source --output $pilot --doc-id D069 --budget-usd 5 --env-file "$project\.env.pilot" --execute 2>&1 | Tee-Object -FilePath "$work\artifacts\d069-pilot.log"
$LASTEXITCODE
```

It prints progress before each request. Expect minutes; each request has a 10-minute read timeout
and at most 3 requests are allowed. Running it in your terminal does not require another Codex turn;
API usage is billed separately. Keep the terminal open. Ctrl+C interrupts and preserves finished
work/drafts; the active request may already be billed. An existing output directory is deliberately
rejected on restart. Inspect billing and saved results before creating a new run, particularly
after timeouts. Do not delete the ledger or repeatedly rerun against the original input snapshot.

## Inspect the result locally

```powershell
Get-Content "$pilot\latest_extract.json"
Get-Content "$pilot\pilot_budget.json"
Get-ChildItem "$pilot\provider_outputs" -Recurse -Filter usage.json | ForEach-Object { Get-Content -LiteralPath $_.FullName }
```

Exit 0 means the extraction command completed; the source/rules may still be marked review-needed.
Exit 1 means partial/failed execution; exit 2 means preflight/setup failed. Core review must check
definitions, exclusions, section 6(b) conflicts, relative effective-date evidence and exact quotes.
Compare returned usage with the API dashboard, since a timeout may not return usage. The pilot
directory is a mutable research copy, not a new approved assembly/release. Do not point the live
demo at it or publish its outputs as judge-ready data.

Bring back `latest_extract.json`, the budget ledger and redacted usage summaries if review is
needed; never send credentials. Keep the original snapshot and pilot working copy intact. The
next paid slice should be chosen after this result, rather than launching all 39 remaining originals
or every new capture automatically.
