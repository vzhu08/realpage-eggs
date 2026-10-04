# CORE-06 comparison integrity follow-up

Status: software ready for review; CORE-06 real-evidence acceptance remains partial.
Daniel / Core A, sole writer, Codex session `01a10555-b81d-7281-95f5-c06399af8238`.
Branch: `codex/core-a-comparison-integrity`.
Checkout: `/Users/danny/Documents/ChatGPT/RealPage/core-a-change-evidence`.
Base: `84c2887dee0d56c523d4fca8c0bd47de79546c2e` (main after PR #13).
Implementation: `8ea65dab22335f79ea926ea372b9dc90985026cd`.

The next available bounded Core A task was comparison correctness after the previous offline
delivery and snapshot merged. Source comparison could report no substantive encoding change
with no support gaps when a primary snapshot had an invalid hash, an evidence map pointed to a
different document, or either rule still carried unresolved review/conflict state.

## Behavior delivered

- Primary source identity is checked independently of supporting evidence, including when all
  supporting quotations come from a valid secondary document.
- Evidence identity verifies both the document ID and current text hash. A matching quotation
  retains its separate anchor result; an identity failure has an actionable remedy.
- Either side's review issues, needs-review status and active conflict flag keep the comparison
  unresolved. Resolving the later version does not erase the earlier version's uncertainty.
- Changes to review status, review issues, conflict flag and conflict explanation are visible
  as `review_state_change` observations, separate from substantive legal encoding changes.
  Semantic support remains `not_checked`; no winner or legal amendment is asserted.

Only `navigator/source_comparison.py`, `tests/test_source_comparison.py`, the CORE-06 card and
this notes directory changed. The internal comparison interface is still pending Platform's
public contract. No models, generated contracts, evaluator, routes, Core B or frontend code changed.

## Verification

| Check | Result |
| --- | --- |
| Focused Core A baseline at main | 113 passed |
| Added comparison regressions before repair | 11 failed, 16 existing comparison tests passed |
| `.venv/bin/python -m pytest tests/test_source_comparison.py tests/test_engine.py tests/test_change_adapters.py tests/test_extraction.py tests/test_traces.py -q` | 124 passed |
| `.venv/bin/python docs/core_rules/verify_candidate.py --output docs/core_rules/comparison_integrity/verification.json` | Exit 0; 141 integration-focused and 291 full-suite tests passed; compilation, contract generation and diff check passed |
| Read-only saved snapshot self-comparisons | All 140 rules retain unresolved review state; zero substantive changes, invalid evidence identities or asserted legal amendments |
| Independent read-only code review | No actionable findings |

[verification.json](verification.json) records the implementation commit and exact test outputs.
Checks ran in a disposable copy. All working contract files remained unchanged. No generated schema
files differed; ten generated example files differed and were not copied into this checkout.
The existing Starlette/httpx deprecation warning remains. No browser/deployment check was required
for this internal comparison change, and no new official export acceptance is claimed.

[saved_snapshot_check.json](saved_snapshot_check.json) records hashes and counts from reading
`sources.json` and `rules.json` directly from the committed ZIP and calling
`compare_rule_versions(rule, rule, sources, sources)` for each saved rule. The check verified the
ZIP against its existing manifest before reading and again afterward. It created no working
store and invoked no extraction or provider service. The 140 unresolved results are intentional:
all saved rules already carry review issues and `needs_review`; matching a rule to itself does
not resolve its evidence. This is software verification, not independent legal review.

## Next action and limits

Review this local branch for integration. No push, merge, deployment or teammate message was
performed in this follow-up. The previously pushed snapshot stays at
`docs/core_rules/snapshots/core-store.zip`, SHA-256
`157581d64b1c19fdfcc0414d08bbd0ffeeeca60e3142bd621a7152fe5c6e44bc`.
The original stores and paused extraction were not modified; new provider calls: zero.

Full CORE-06 acceptance still needs Platform's acquired source texts, geography assembly and
comparison contract, plus independent human review. Existing T1 partial / T2–T5 blocked and
16 exportable / 124 temporal-unknown counts remain the earlier offline evidence, not new export
results. Any provider resumption requires the existing explicit resume and budget decision.
