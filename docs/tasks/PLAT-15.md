# PLAT-15: unblock Core's required typed inputs

Owner: Vincent / Platform. State: Ready on a concrete Core request; no speculative field work.
Execution unclaimed. Suggested branch `codex/platform-core-inputs`; verify checkout/base/writer.

Read CONTRACTS, ASSIST_CONTRACT, `navigator/fact_inputs.py` and Daniel's predicate/evidence
matrix from CORE-06. Accept only a field request that gives source spans, precise meaning,
type/enum/units, question wording, provenance, consumers and the demo case it unblocks.
Reuse an existing definition when its meaning matches. Unknown facts remain unknown.

Deliver the smallest agreed input-contract increment. Platform owns typed definitions,
request validation, shared models/contracts and API wiring; Core owns legal conditions and
the evaluator, Core B owns question planning/rendering, and UX owns frontend controls.
Do not invent property facts or encode document-specific legal answers in the registry.

Potential write scope: `navigator/fact_inputs.py`, Platform request validation/API integration,
agreed `navigator/models.py` and generated contracts when required, focused Platform tests and
this card. One writer per file; coordinate shared changes before consumers depend on them.

Checks: accepted value, rejected invalid value, unknown/reset behavior and one actual HTTP
consumer path. Regenerate contracts only for agreed schema changes and run affected consumer
checks. Keep the increment small enough for the existing three-hour coding window.

If Core has not requested a needed input, continue PLAT-13/14. No placeholder fields or API
redesign. Handoff includes field semantics, exact changed paths, actual checks and consumer action.
