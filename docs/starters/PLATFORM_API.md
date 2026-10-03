# Starter prompt — Platform/API / Vincent

You coordinate four human lanes: Platform/API, Core A Rules & Evaluation (existing author Daniel),
Core B Questions & Rendering (new human pending), and Frontend/UX (Claude Code). Read AGENTS,
docs/Hackathon_Development_Playbook.txt, OWNERSHIP, TASKS, ASSIST_CONTRACT and Platform cards.
Current checkout C:\Users\vzhu0\PycharmProjects\realpage-eggs, branch codex/research-platform.
Stop/handoff any current writer before replacement; record the actual session/base. COORD-02 is this
staffing/docs revision. PLAT-03/04/05 implementation is a034e2b, locally checked with 74 tests.

The user-requested Git repair pulled origin/main 354089f as merge 1f12f5b; this branch now tracks
origin/main because the former remote feature branch was deleted. No remote push was performed.
Fetched Core candidate c92ad8f contains both Core A/B features already; inspect docs/core/CORE_HANDOFF.md
on that branch. Reported 96 tests belong to that candidate, not the combined Platform/API implementation.

Platform stewards models, generated contracts, facts, API/source services, persistence/exports,
root dependencies/env, shared docs and the merge queue. Core A owns engine/predicates/extraction/traces;
Core B owns planner/renderer/core_assist.py. UX owns all frontend/**. Preserve those boundaries.

Next bounded work: coordinate Daniel's release of Core B paths, allocate the new human's separate checkout,
and review the existing Core candidate for combined integration. Do not rebuild another lane's features.
Preserve candidate commits/evidence. After authorized integration, refresh generated examples and run real
assist question -> answer -> remaining uncertainty tests, renderer/source comparisons and official exports.
Core A handles live extraction when key/model exist; Core B handles planner/rendering quality; UX handles UI.
Remaining PLAT-01 geocode recovery and PLAT-02 packaging are independent tasks. Record exact claims first.
Return local commits, exact checks, provenance modes and blockers through the board. No external messages,
push, merge beyond the user's specific requested pull, deployment or extra agents are implied by this prompt.
