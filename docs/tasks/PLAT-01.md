# PLAT-01: unresolved Census recovery

- State: Merged. Human owner: Vincent / Platform/API. Tool/session: current Codex session, user-assigned October 3, 2026.
- Branch: `codex/research-platform`; checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs`.
- Base: `22d271cb827e6f4606b7f7025eafe1c890d1d6b8` after authorized fast-forward to origin/main; clean starting tree.
- Result: `5cef6d8e83b040e989faa87141cd238674c30ddd`; user-authorized [PR #5](https://github.com/vzhu08/realpage-eggs/pull/5)
  merged as `9a96fda205c75536d81b17d7d1baf5b3c0ced0e6` on October 3, 2026. No deployment performed.
- Dependencies: BOOT-01 and cached real Census evidence.
- Allowed: `navigator/geocode.py`, `tests/test_geocode.py`, this card and a new recovery report.
- Report claim: `docs/evidence/plat01_recovery.json`. Platform steward also claims this task's row in `docs/TASKS.md`.
- Private validation store: `data/plat01-recovery/`; seed from existing real data/cache, preserve originals and prior snapshots.
- Reserved: models, core predicates, raw inputs, other docs/board unless steward coordinates.
- Read first: AGENTS, CONTRACTS, docs/evidence/real_validation.json, `data/resolutions.json` and relevant cache entries.
- Outcome: recover resolvable cases among 21 unresolved addresses without postal-city guessing.
- Acceptance: inspect leading-zero ordinals, fractional/range/compound addresses and multiple matches;
  preserve attempt provenance; accept a city only with authoritative boundary evidence; retain unresolved cases.
- Checks: `python -m pytest tests/test_geocode.py -q`; `python -m navigator resolve --retry-unresolved`;
  `python -m navigator validate`; manually inspect recovered responses. Target 30–60 minutes.
- Non-goals: guessed street numbers, city count targeting, law thresholds, new geography vendor without reason.
- Handoff: before/after counts, IDs, evidence hashes, failure causes and commit in this card.
- Integration authority: user/Platform reviewer; no deployment or main merge without authority.

Four-developer coordination: use the current playbook and OWNERSHIP. Core A owns extraction/evaluator/traces;
Core B owns planner/renderer. Existing Core candidate c92ad8f awaits combined review/integration; do not duplicate it.
Platform stewards shared contracts and UX owns the entire frontend. Prior task results remain historical evidence.

## October 3 implementation handoff

Changed paths: `navigator/geocode.py`, `tests/test_geocode.py`, this card,
`docs/evidence/plat01_recovery.json`, and this task's shared-board status.
No model, dependency, environment or API schema changes.

Recovered **12 of 21** previously unresolved municipalities: **479 -> 491 of 500**.
IDs: A0115, A0156, A0168, A0229, A0279, A0291, A0328, A0357, A0364, A0400, A0428, A0484.
The implementation normalizes padded street ordinals, requires unanimous boundary evidence across
multiple matches, and checks every explicit range/compound component. Returned house numbers must
preserve the requested number, including fractions. All previous attempts remain recorded, with
response hashes, cache keys and timestamps for new attempts. No postal-city inference or guessed numbers.

The [recovery report](../evidence/plat01_recovery.json) contains the full run manifest, all 21 IDs,
attempt hashes, matched-address evidence, decisions, remaining causes and limitations.
Run `6db6a1bae8e1420da587fb49c0571176` used real cached evidence plus 14 new Census response snapshots.
All 21 results reproduced offline with network denied. Existing caches, original address/source snapshots,
default `data/resolutions.json`, and all 479 previously resolved records remain unchanged.
Recovered results are in the isolated `data/plat01-recovery/` store; historical baseline counts still
describe the default `data/` store. Select the isolated store explicitly when reviewing the result.

Checks (project `.venv` Python):

- `python -m pytest tests/test_geocode.py -q`: **28 passed**.
- `python -m pytest -q`: **96 passed**, one existing Starlette/httpx deprecation warning.
- `python -m navigator --data-dir data/plat01-recovery resolve --retry-unresolved`: exit 0;
  partial, 21 attempted, 491 resolved, 9 unresolved, 0 failed.
- `python -m navigator --data-dir data/plat01-recovery validate --output artifacts/plat01-recovery-validation.json`:
  exit 0; schema valid, **not ready for submission** (zero rules and 33 missing source texts remain).
- `navigator contracts` CLI through `runpy`, with the two generator output roots redirected to
  `artifacts/plat01-contract-check`: succeeds; all four generated schemas byte-identical to tracked files.
- `git diff --check`: clean.

Remaining nine: six lack house numbers (A0098, A0128, A0295, A0346, A0376, A0380), A0384 has
no Census match, A0009's fractional endpoint is misread as house 5, and A0352 has competing Newark
and Verona boundaries. They remain unresolved pending authoritative address/boundary evidence.
Municipal agreement does not establish a unique physical location or legal applicability; range endpoint
agreement retains the existing policy and does not prove the geography of intervening parcels.
Current Census snapshots are not historical boundary verification. Software checks do not establish legal accuracy.

Next action: PLAT-02 packaging, now assigned on the merged base. The later user request authorized
the push and merge through PR #5; no deployment or teammate contact performed.
