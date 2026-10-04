# Final research rerun — October 4, 2026

The final evaluation used **all 678 rules and all 500 properties**. All required T1–T5 references now map to rules, and mapped candidates have zero source-policy issues. **All five cases remain partial; none is fully ready.** These are readiness results, not an official competition score or a measured legal-accuracy percentage.

The [portable summary](final-rerun-summary.json) records exact counts, remaining blockers, hashes, timing and cost estimates. The [research archive](final-research-archive.zip) preserves the final Store, original receipts, provider outputs and pinned replay code. Publishing these files **does not update the deployed app or promote this Store to serving**.

| Case | Comparison | Baseline → final | Mapped rules | Definitely affected | Uncertain |
| --- | --- | --- | ---: | ---: | ---: |
| T1 | Actual, 2025-12-31 → 2026-01-02 | partial → partial | 4 | 0 | 250 |
| T2 | Actual, 2026-10-01 | partial → partial | 4 | 0 | 92 |
| T3 | Actual, 2026-10-01 → 2027-07-02 | partial → partial | 11 | 0 | 140 |
| T4 | If enacted, 2026-10-01 | blocked → partial | 5 | 0 | 110 |
| T5 | Actual, 2026-10-01 | blocked → partial | 4 | 0 | 0 |

All cases report zero conflicts. Zero definite impacts does not establish that no property is affected: uncertainty and incomplete evidence remain separate. The final Store contains 86 sources, 500 resolution records and 487 properties with a resolved municipality, compared with 666 rules and 83 sources in the captured baseline. Resolution status is not independently measured geographic accuracy.

The remaining work is visible in the results:

- T1 still has 250 uncertain property impacts despite no reported rule-review, source-policy or runtime evidence blockers.
- T2's four local records require review; the three Jersey City records also have an unresolved Section 1(a)(i)(1) definition.
- T3 lacks an extracted, evidence-backed state/local interaction for both Jersey City and Hoboken. Three NJ records require review, and the related Jersey City definition remains unresolved.
- T4 is explicitly hypothetical. All five pending records require review, with 110 uncertain impacts; absence of a runtime evidence blocker does not clear their saved review issues.
- T5's four failed-proposal records produce no operative impacts, but bounded source context and missing chapter 93A sections 4 and 9 keep evidence readiness partial.

The [legal benchmark candidate manifest](../evidence/legal_benchmark_candidates.json) contains **0 independently reviewed cases out of 12 candidates**. No legal-accuracy percentage or official score is available. Unit tests, exact quotation checks, model review and reproducible output do not supply independent legal ground truth.

The recorded gate tested revision `45f8ccf1b555102fb623eeda8bcaffd48d17ffa5` with source policy `source-use-v2`. Independent full-data case requests ran with at most three workers and the canonical report aggregator, taking **263.1052 seconds**. The gate made **zero provider calls**; Store and consumed code hashes were unchanged. Exit code **1** records incomplete readiness, not a process crash. Baseline and final runtimes are not a controlled speed comparison.

The completed extraction sequence recorded 34 reconciled provider requests with a cumulative **upper estimate of $3.55834050**, within the same $5 allowance; this is not an invoice. The final six jobs completed successfully. Original provider artifacts for 654 older retained rule records remain unavailable because the baseline was reconstructed from captured API responses. New extraction lineage does not repair those historic gaps.

The archive is 8,093,134 bytes (228 files), with SHA-256 `0ff9f391169958bcdaa4695995a4a0b7bef9c179112ad1043134929a74ccd1a2`.

To verify and reproduce the archived research results, extract `final-research-archive.zip` and enter `tenent-research-2026-10-04/`. Its `MANIFEST.json` maps exact payload hashes; `records/` retains the unchanged full reports, including their historical machine-specific metadata. This README and the compact summary use portable paths.

```sh
python3 tools/verify_archive.py
```

Use Python **3.12.14** with `runtime/requirements.lock`. If creating an environment, keep it outside the extracted archive:

```sh
python3.12 -m venv ../tenent-replay-venv
../tenent-replay-venv/bin/python -m pip install -r runtime/requirements.lock
../tenent-replay-venv/bin/python tools/rebuild_evidence_package.py \
  --output ../final-evidence-package.json \
  --receipt ../replay-receipt.json
PYTHON_DOTENV_DISABLED=1 OPENAI_API_KEY='' OPENAI_MODEL='' \
  ../tenent-replay-venv/bin/python runtime/scripts/check_change_cases.py \
  --store store --report ../readiness-reproduced.json
```

Dependency installation may require network access. The package rebuild and gate use archived inputs without provider calls; the gate writes outside the Store and is expected to return exit 1 with five partial cases. Use new output filenames. Full evaluation can take several minutes. The archived parallel helper records Git revision metadata and expects a checkout, so use the canonical serial command above for standalone reproduction.

Serving consumes the Store selected by `NAVIGATOR_DATA_DIR`; the Render configuration points to a separately installed snapshot and has automatic deployment disabled. Promoting these data requires explicitly packaging and installing a serving snapshot, updating its transfer files and expected hash, and rebuilding the deployment. The docs archive performs none of those steps. See the [deployment setup](../RENDER_FREE_SETUP.md) and [readiness discussion](../CHANGE_CASE_READINESS.md) for the existing workflow and remaining limits.
