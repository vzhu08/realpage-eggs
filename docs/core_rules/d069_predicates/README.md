# D069 predicate follow-up — October 4, 2026

Core A / Daniel follows [CORE_NEXT_STEPS](../../CORE_NEXT_STEPS.md) from main
`fec517db973f102c7623a22947b57eb644b2aaa5`, on `codex/core-a-d069-predicates`.
The subsequent PR #25 [source-use decisions](../../DATA_SOURCE_RULES.md) also apply.
This increment supplies two evidence-backed RuleDraft overlays and a complete gap matrix
for the seven paid D069 rules. It makes factual conditions usable by the existing evaluator
and traces, so a future integrated product can distinguish excluded conduct from missing
facts or unresolved interpretation. It does not change the currently served 140-rule release.

The original paid bundle, caches and stores are unchanged. The candidate wrappers record
agent authorship and the original rule/source hashes; their Draft payloads have no provider
run ID, evidence mode or stored rule ID. All remain review candidates. The only Rule envelopes
created here are explicitly synthetic and transient, for the checks.

## Candidate differences

| Paid rule | Compiled candidate conditions | Still unresolved |
| --- | --- | --- |
| Section 4(e), `r-b557a89502e37db1bddd` | Three distinct coordinating-function routes: qualifying collection from at least two normalized owners for automated use; setting using another owner's nonpublic information; and algorithmic setting/recommendation for at least two recipient owners. Named sensitive-information categories, factual purpose and use gates are explicit. | Other-information materiality, substantial similarity, and branch three's agreement/interchangeability/affordability-control legal tests. |
| Section 4(a), `r-b9212520dd133bdf1584` | At least one rental unit belonging to the relevant owner and the four alternative service transactions. Receipt, subscription and contracting do not each require payment. | Owner/agent relationship, coordinator qualification and the original unresolved device/coordinating-function exclusions. |

Both overlays retain intended primary-residence use and the applicable institutional exclusions.
They remove the paid output's extra current `residential` use gate: the registered fact describes
actual use, while D069's definition describes intended primary-residence use. A vacant intended
rental is not excluded solely by that current-use flag. Other paid rules are left unchanged and
their analogous definition questions are recorded in the matrix.

Activities are evaluated separately. An actor's unrelated research, free estimate or brokerage
activity does not exempt its pricing activity. Controller plus controlled entity counts as one
owner; unit counts cannot substitute for distinct owners. These are input normalization
requirements, not a newly implemented identity resolver. Incomplete ownership mapping is null.
Terms-only facts whose materiality is unresolved also remain null.

## Review and integration inputs

- [reconciliation.json](reconciliation.json) maps the earlier grouped section 4 annotation to
  the five paid prohibitions and accounts for sections 6(b) and 7. Platform must choose a reviewed
  representation, not import both as duplicate obligations or multiply penalties by five.
- [predicate_matrix.json](predicate_matrix.json) covers all nine original unsupported nodes:
  six coverage nodes and three exemption nodes. Each retains its original AST, exact source spans,
  factual/registry analysis, interpretation issue, proposed expression and dependency owner.
  Proposals outside the two selected overlays remain backlog, not implemented candidate behavior.
- [compilation_design.json](compilation_design.json) explains the selected expressions and
  source support. [edits.json](edits.json) is the executable, hash-guarded patch plan;
  [candidate_drafts.json](candidate_drafts.json) contains its generated Draft overlays.
- [fact_requests.json](fact_requests.json) hands Platform 20 proposed typed inputs with meaning,
  units/enums, question text, provenance, consumer paths, synthetic demo cases and exact support.
  None is registered by this PR.
  The matrix additionally audits 21 unregistered fields already in the paid output; the one
  registered name, `residential`, is only a partial source-semantic match. Platform must define
  the consumed old inputs too before API activation. Do not silently bypass request validation.
- [verification.json](verification.json) binds the inputs and verifies 39 distinct exact D069
  spans. It checks every matrix row against the nine original unsupported nodes. The two selected
  Drafts retain six more precise unsupported nodes; raw node totals are not a measure of resolved
  legal scope. The remaining five paid rules are unchanged, not claimed resolved.

Platform owns typed-input integration and reviewed snapshot assembly. Review must preserve the
single-activity scope across facts, attach separate revision provenance, and retain `needs_review`
until acceptance is actually established. These hand-authored Drafts cannot themselves become
judged automated-extraction records. Under PLAT-14, integrate permitted original automated output
or request a reproducible extraction/provenance handoff for accepted refinements; do not weaken
lineage checks to import edited provider rules. The typed-input work is routed to PLAT-15.
No new AST, evaluator, runtime legal constant or API
schema is introduced. Municipal operative records and official court verification remain deferred
as requested; section 6(b) does not establish an actual preemption winner. Historical MA bill-text
identity remains a separate source dependency. None blocks reproducing this increment.

## Focused checks and demonstration

[cases.json](cases.json) contains 25 labeled synthetic activity/date probes; [checks.json](checks.json)
records the evaluator and selected evidence-bearing traces. Cases cover supported true/false/unknown
coverage, owner aggregation and unknown mapping, collection versus setting versus recommendation,
activity exclusions, service receipt without payment, and June 30 / July 1, 2027.

For a supported exclusion, `controller_and_owned_entity_are_one_owner` supplies one normalized
owner and no other coordinating route: coverage is false and the result is `inapplicable`.
For uncertainty, `unresolved_owner_mapping_not_inferred_from_units` leaves the owner count null:
coverage and the result remain unknown, and the count is the missing fact. A supported positive
collection route produces true coverage but still an unknown overall result because review is
required. These are evaluator demonstrations, not public API or real-property findings.

The research/brokerage exclusion fixtures leave the activity's coverage facts unknown so exclusion
is tested without contradictory conduct. `research_label_does_not_override_lease_use` is explicitly
an inconsistent-input robustness probe, not an example of qualifying research.

Reproduce from the checkout root:

```sh
.venv/bin/python docs/platform_pilots/2026-10-04-d069/verify.py
.venv/bin/python docs/core_rules/source_review_2026_10_04/build_review.py --check
.venv/bin/python docs/core_rules/d069_predicates/build_candidates.py --check
.venv/bin/python docs/core_rules/d069_predicates/check_candidates.py --check
.venv/bin/python -m pytest -q tests/test_extraction.py tests/test_engine.py tests/test_traces.py tests/test_change_adapters.py
git diff --check
```

The focused suite passes 124 tests, including 27 new cases: the 25 probes, candidate reproduction
and proposed count validation. Evidence checks pass for the original seven-rule pilot and the
previous regional review. A disposable-copy smoke check also passes all 27 new cases; the existing
Core integration runner's copy list now includes their candidate and immutable pilot inputs.
No provider request or Store write occurs. Tests establish encoded behavior and evidence identity,
not independent legal acceptance.

## Proposed next paid slice

[next_paid_slice.json](next_paid_slice.json) proposes only `P11_CA_SB763_TEXT`, with the captured
history and Business and Professions Code article as offline context. A fresh $5 ceiling and the
existing launcher's three-request / $4.50 local reservation limit are proposals, not billing claims
or permission to run. Platform must prepare a source-complete private copy and receive explicit
authorization before execution. No D069 rerun or broad corpus pass is proposed; zero new paid calls
were made for this increment. The PR #25 source-use check is another prerequisite: compare this
supplemental California capture with the supplied corpus copy and resolve the permitted input
before a submission run. Capture availability alone does not make the proposed slice ready to run.
