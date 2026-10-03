# BOOT-01: working backend bootstrap

- Human owner: user/current bootstrap owner. Tool/session: Codex, this chat; single writer.
- Branch: `codex/realpage-bootstrap`.
- Checkout: `C:\Users\vzhu0\PycharmProjects\realpage-eggs`.
- Base: `0066cb3fd2378aaa35df88373ce7d48141ee056f`. Dependencies: supplied pack/brief/playbook.
- Allowed: `navigator/**`, backend tests, fixtures, config, contracts, docs, root backend setup and instructions.
- Reserved: `frontend/**`; original participant pack and Downloads sources unchanged.
- Read first: AGENTS, original build specification/playbook, supplied schemas/templates and challenge PDFs.
- Outcome: auditable ingestion, extraction boundary, geography, coverage, changes, API and exports, ready for UX integration.
- Acceptance: real-data processing where available; honest provider/missing-source limitations; exact evidence;
  three-valued/temporal/interaction tests; all 500 IDs; generated contracts; coordination handoff.
- Checks: `.\.venv\Scripts\python.exe -m pytest -q`; `python -m navigator contracts`;
  `ingest`, `resolve`, `extract --doc-id D001`, `evaluate --allow-partial`, `export --allow-partial`, synthetic demo.
- Non-goals: frontend, deployment, pushing/merging, fabricated scoring or legal answers.
- Handoff: docs/HANDOFF.md and docs/EVALUATION.md; state Review, live extraction blocked.
- Integration authority: user. No push, merge, deployment or external messages authorized by this card.
