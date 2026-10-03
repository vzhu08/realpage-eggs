# PLAT-01: unresolved Census recovery

- Human owner: Platform/API owner, name/claim pending. Tool/session: unallocated.
- Branch/checkout/base/result commit: unallocated. Dependencies: BOOT-01 and cached real Census evidence.
- Allowed: `navigator/geocode.py`, `tests/test_geocode.py`, this card and a new recovery report.
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
