# Source scanning repair — October 4, 2026

This research snapshot fixes omitted source context and records **45 separate AI-authored source reviews**: 42 reviews of selected fields and three complete-rule reviews. The 44 version-date repairs overlap two of those complete reviews. No provider calls were made, and the original source, address and jurisdiction files are unchanged. Publishing this archive does not update the hosted app.

The [review plan](review-plan.json), [runtime audit](runtime-audit.json) and [historical-lineage audit](lineage-audit.json) record the changes and limits. The [corrected Store](corrected-store.zip) contains `data/` and `ARCHIVE_MANIFEST.json`, which lists its file hashes. Original inputs remain in `data/source_review_inputs/`; individual review records retain each original rule and bind its corrected version to exact source evidence.

At **2026-10-01**, A0001's unknown temporal statuses fall from **119 to 75**. Its baseline still has **221 unknown applicability results** because unresolved facts and other rule-review issues remain. The three reviewed deposit duties have no runtime evidence blockers. A request-local test answer of `used_as_tenant_dwelling=true` produces **3 applies and 218 unknown**; leaving that answer unknown retains 221 unknown. This was a hypothetical test, not a confirmed user fact or a saved property update. The sampled New Jersey (A0002) and Massachusetts (A0006) results are unchanged.

`used_as_tenant_dwelling` asks whether the residential property is used as the tenant's dwelling **under the rental agreement being evaluated**. Both the agreement and actual dwelling use must be established. Residential classification, unit count, construction year or an owner's name cannot supply this answer. It does not establish that a deposit was collected or a duty was violated.

Future extraction now supplies the complete captured primary document up to 48,000 characters alongside each focus segment, without duplicating its text. Larger documents receive at most 6,000 characters from each boundary, with omitted ranges explicitly recorded. Only provisions whose primary quotation lies in the focus segment may become rules. Request sizing includes this expanded payload; the existing byte limit remains enforced. Runtime retrieval uses a bounded 32,000-character context by default and recognizes a self-reference to an already retained complete section without inventing a missing dependency. These scanner changes do not silently re-extract or approve old rules.

To run locally, use the repository root, a Python 3.12 environment with `requirements.lock` installed, and Node 20.19 or newer. Choose an unused extraction directory:

```sh
python -m zipfile -e docs/scanning_repair/corrected-store.zip artifacts/scanning-repair-local
npm --prefix frontend ci
VITE_API_BASE_URL=/api/v1 VITE_DATA_MODE=live VITE_DEMO_ONLY=0 npm --prefix frontend run build
python scripts/platform_ops.py serve \
  --data-dir artifacts/scanning-repair-local/data \
  --frontend-dist frontend/dist --port 8000
```

Open `http://127.0.0.1:8000/#/lookup?mode=live`. Use API base `/api/v1` if an earlier browser session saved a different configuration. This launcher clears provider credentials and disables `.env` loading.

To reproduce application of the plan, first extract the [original research archive](../change_case_results/final-research-archive.zip) into another unused directory. Its five original input hashes match this plan:

```sh
python -m zipfile -e docs/change_case_results/final-research-archive.zip artifacts/scanning-repair-original
PYTHON_DOTENV_DISABLED=1 OPENAI_API_KEY='' OPENAI_MODEL='' \
  python scripts/apply_source_review.py \
  --input artifacts/scanning-repair-original/tenent-research-2026-10-04/store \
  --output artifacts/scanning-repair-reapplied \
  --plan docs/scanning_repair/review-plan.json --reconstructed-input
```

The output must be new and separate from the input. Review timestamps and run IDs are newly generated, so whole-archive byte equality is not expected. `--reconstructed-input` explicitly identifies this archived API reconstruction: it validates retained source/rule bytes and separate correction provenance but cannot certify missing historical provider runs or caches. Strict snapshot assembly still rejects the incomplete original extraction lineage. Do not apply this plan to unrelated input hashes or treat a new source review as the old provider's output.

These corrections establish neither an independently measured legal-accuracy percentage nor a competition score. Three complete AI source reviews do not validate all 678 rules, establish universal legal completeness, or prove applicability without the required facts.
