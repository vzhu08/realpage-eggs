# D069 paid pilot: portable candidate evidence

This is a partial evidence bundle for Core review, not a Store or approved release.
Read [Daniel's next steps](../../CORE_NEXT_STEPS.md) before changing rule candidates.

The user completed run `a6f959812096402480a583f7e4310452` on October 4, 2026, at
04:05:41 America/New_York (08:05:41 UTC). The source text is the previously captured D069
NJ FAIR Act, with exact hash `1fdbfb48743a46429c3f47dbd8d08c665739202361661e1a2f19b94bb0ec43a6`.
No fresh source fetch or provider request was made to prepare this bundle.

- `sources.json`: only D069, preserving original text and identity.
- `rules.json`: only the seven candidate rules from this run, with review/provenance unchanged.
- `provider_review.json`: the unchanged complete second provider response saved by extraction.
- `run.json`: unchanged final manifest; its 147 rules and original artifact paths describe the
  author's complete private working copy. This bundle contains seven rules and uses the filenames above.
- `usage.json`, `pilot_budget.json`: unchanged returned usage and request ledger. Two HTTP 200
  responses, 20,043 input and 27,279 output tokens. The $3 reservation is not actual billing;
  the earlier approximately $0.32 estimate is not a reconciled API invoice.
- `manifest.json`: byte hashes, scope and review limitations for the copied/subset files.
- `verify.py`: offline hash, schema, lineage, source/quote and subset checks.

No addresses, property facts, geography, environment files, credentials, other source/rule
collections, old run outputs or caches are included. Do not replace a complete collection with
these subset files. Do not insert edited annotations into a provider cache or relabel them as
this run's original output. Preserve the seven `needs_review` labels pending proper acceptance.

From repository root, run `python docs/platform_pilots/2026-10-04-d069/verify.py` using the
project environment. All 25 distinct evidence spans must match. This checks structural identity,
not legal correctness. Six rules retain unsupported coverage logic; successful extraction does
not mean they can yield definitive applicability answers.
