# Re-extract the incomplete change cases

This workflow uses the existing extractor and evaluator. It preserves the input
Store, supplies explicit related documents, and writes candidates into a new private
copy. It does not publish, deploy, change corpus admission, or mark T1–T5 complete.

## Prepare and inspect without API access

Use the full producing Store when available. An API reconstruction can support
diagnosis, but missing historical provider outputs/run files remain missing; the
reconstruction must retain its capture manifest and cannot become an original freeze.

```sh
python scripts/prepare_change_case_sources.py \
  --store /path/to/read-only-store \
  --output /tmp/change-case-sources-new

python scripts/extract_change_cases.py \
  --source-dir /path/to/read-only-store \
  --source-bundle /tmp/change-case-sources-new \
  --output /tmp/change-case-extraction-new
```

The second command is a dry run: it reads and validates inputs but creates no Store,
reads no credentials and sends no provider request. It verifies document IDs, source
hashes, declared metadata changes, retained capture bytes and the nine explicit
primary/support selections. It also serializes the actual request bodies offline,
reports review headroom and rejects contexts leaving less than 16 KiB for the
escaped draft. That margin is a minimum, not a guarantee that any generated draft
will fit; the transport checks every actual review/repair before sending it.
Use `--doc-id D022` (repeatable) for a smaller primary
subset; a supporting document does not become an extraction target.

All 24 captures remain intact. The D022 job includes its incorporated definition,
codified provision/date annotation and legislative history. Separate SB763 and
municipal jobs retain their own scope. The large Hoboken minutes and NJ charter
compilation are retained but excluded from full-text context; no hidden truncation
occurs. See the [source manifest explanation](README.md) for unresolved source gaps.

## Configure and run a bounded allocation

Configure `OPENAI_API_KEY` in an ignored project `.env`. The existing bounded
transport uses `OPENAI_MODEL=gpt-6.1-sol`; an explicitly different model is rejected
instead of silently using incompatible pricing. Keep credentials out of prompts,
logs, commits and source bundles.

The model and Standard pricing were checked against the official
[model page](https://developers.openai.com/api/docs/models/gpt-6.1-sol) and
[API pricing](https://developers.openai.com/api/docs/pricing) on October 4, 2026.
The shared transport conservatively accounts for input at $2.75 and output at $11
per million tokens, including the higher cache-write rate and regional premium.
It reserves $1.50 before each request, enforces a 131,072-byte JSON request limit,
allows no tools, and stops on unconfirmed billing. This local ledger is an estimate,
not the provider's billing statement. Recheck pricing before a later run.

Choose the approved allocation explicitly (between $1.50 and $20); there is no
default spend in this runner:

```sh
python scripts/extract_change_cases.py \
  --source-dir /path/to/read-only-store \
  --source-bundle /tmp/change-case-sources-new \
  --output /tmp/change-case-extraction-new \
  --env-file /path/to/project/.env \
  --budget-usd APPROVED_CAP --execute
```

The output must not exist. Copy hashes are checked before extraction; original
sources and property facts are unchanged. The copied source bundle, extraction plan,
new provider outputs, caches, per-document run manifests and budget ledger stay
together. Supporting-source IDs, roles, exact text hashes and context identity are
bound to new runs and caches. Existing historical records retain their original
lineage. A source result that would merge new evidence into an older record with
outside-context evidence fails instead of borrowing its run ID.

Each uncached segment receives a draft and separate review, with at most one repair.
The v5 prompt includes the registered fact names, meanings, types and allowed
values in every pass. Its contract digest participates in run and cache identity.
Machine-detected enum mismatches and missing field evidence can use the same
single repair opportunity; unresolved issues remain visible after that attempt.
Legal terms are not automatically converted to superficially similar registry
values, and source-defined facts remain possible where their meanings differ.
Cached work can run without another reservation. An oversized review is refused
before sending it, and already-returned draft output is retained. A budget boundary,
provider failure or validation error leaves the private partial output for inspection;
do not rerun over it or allocate another budget without reconciling its ledger.

## Validate the resulting data

```sh
python scripts/check_change_cases.py \
  --store /tmp/change-case-extraction-new \
  --report /tmp/change-case-readiness-new.json
```

Exit 0 means the encoded cases meet the software readiness gate; exit 1 means data
is incomplete; exit 2 means invalid inputs or execution errors. Inspect rule-level
blockers, actual/hypothetical dates, uncertainty sets and directional relationships.
Official status documents may support lifecycle/dates only, never substantive
requirements or interactions. No source, source bundle, extraction success, or unit
test alone proves legal accuracy or an official competition score.

Supplemental captures remain admission-unverified research. Resolve the supplied
corpus policy before making a competition artifact. Only replace a release after
its data gate, ordinary tests, source review and export validation all pass against
the same frozen Store.

The historical export's corpus-only scope is a team decision, not an independently
verified blanket organizer ban. The original participant guide is absent from this
checkout. Retained instructions permit consultation of official sources while
distinguishing their provenance; final submission admission remains unverified.
