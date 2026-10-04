# Starter prompt — Core B / Questions & Rendering

You are the fourth human developer, taking over question planning and rule rendering from the prior
single Core lane. Own CORE-04/05 and exclusively navigator/question_planner.py, rule_renderer.py and
core_assist.py after the ownership handoff. Core A owns extraction, engine.py, predicates.py, changes.py,
validation.py and trace production. Do not write those files or copy their evaluator.

Read AGENTS.md, docs/Hackathon_Development_Playbook.txt, OWNERSHIP, ASSIST_CONTRACT, CORE-04/05,
models.py and labeled research/evidence fixtures. Inspect Daniel's existing candidate c92ad8f on
origin/codex/core-backend, particularly docs/core/CORE_HANDOFF.md and planner/renderer tests.
These capabilities are already implemented in that candidate; review and continue them instead of
starting over. Candidate code and its reported 96 tests are not combined Platform/Core verification.

Vincent records the existing writer's release of these paths, your actual human/session, separate
codex/ branch/absolute checkout/base and private NAVIGATOR_DATA_DIR before you write. Read-only review
can start now. Do not use Daniel's active checkout. Suggested branch codex/core-b-navigation, port 8003.
Preserve candidate commits; do not assume origin/main contains them. Current four-lane ownership
supersedes the original prompt's single Core assignment.

First work after handoff: review CORE-05's deterministic renderer and CORE-04's fixed synthetic planner
comparison; repair concrete failures and integrate the real services with Platform. Both exported
functions already exist in the candidate. Renderer review does not require live extraction. Planner
integration needs Core A's rule_traces/evaluate_rules; retain this boundary without new ASTs or a production
mock fallback. If publishing a renderer-only checkpoint, expose render_rule alone and keep imports
independent of missing planner dependencies so the API reports the planner unavailable honestly.

Use evaluate_rules for every hypothetical outcome. Preserve repeated-field correlation, bounds,
short-circuit irrelevance, partial dates, joint materiality, explicit budgets and remaining exemptions.
Rank reproducibly using documented effort weights. Keep source/jurisdiction/interpretation gaps as
separate remedies. Render operators/grouping/thresholds/exemptions/dates/unsupported nodes without an LLM.

Own tests/test_question_planner.py, tests/test_rule_renderer.py, tests/fixtures/core_navigation/** and
docs/core_navigation/**. Do not edit tests/test_engine.py, tests/test_traces.py, tests/conftest.py or fixtures/**.
Checks: python -m pytest tests/test_question_planner.py tests/test_rule_renderer.py -q with checkout Python.
Preserve the existing synthetic baseline comparison and report exact denominators; it is not a legal score.
Request engine/trace changes from Core A; schema/API/generated-fixture changes from Platform. Put new
results in your cards/new note directory, retaining prior author attribution and candidate evidence.
Return local commit, actual tests, combined integration status and blockers. No push, merge, deployment,
external messages or extra writing agents are authorized by this starter.
