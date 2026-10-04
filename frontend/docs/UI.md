# UI notes (UX-03, UX-04)

Design and behavior decisions for the frontend, the states it covers, and what it needs from
the other lanes. Screenshots are in `docs/screenshots/` (regenerate with
`SCREENSHOTS=1 npm run screenshots`).

## Principles

1. **The situation first.** A result opens with its date, what applies, and what is not yet
   determinable. Technical detail (IDs, hashes, plan limits, raw reasons) sits behind
   disclosures.
2. **Unknown is a result, not an error.** Unknown, pending, not-yet-effective and superseded
   are separate groups with their own words and shapes. A failure to get a result is never
   shown as "no rules".
3. **Applicability is not a verdict.** Nothing is phrased as compliance or violation; the
   disclaimer stays in the header and in the sticky result bar.
4. **Evidence is one step away** and its checks are never collapsed into a score.
5. **The UI adds no law.** It renders evaluator output, source text and contract defaults. It
   does not evaluate, rank questions or infer outcomes.

## Design system

Tokens live in `src/styles/tokens.css`; text/background pairs are tested for WCAG AA
(4.5:1) in `tests/unit/contrast.test.ts`.

- **Ground:** warm paper `--paper`, white-ish `--surface` for the things you act on (the
  date form, questions, the evidence pane). Hairline rules instead of nested cards.
- **Type:** a serif (Charter and system equivalents) for titles, rule names, dates and quoted
  law; Inter for interface text; a monospace only for identifiers, offsets and encoded
  expressions. Sizes `--text-xs`…`--text-2xl`; body 15px/1.55.
- **Accent:** one deep navy, used only for actions, links, focus and selection.
- **Status tones:** applies (green), unknown (amber), not yet effective (indigo), pending
  (violet, outlined), superseded/does not cover (grey), conflict/failure (red). Every tag
  carries a word and an icon shape, so color is never the only signal.
- **Quotes:** source text is set in serif on a pale highlighter ground with a gold rule; the
  encoded rule is set on the accent wash. The two never share a treatment.
- **Synthetic data:** a dark hatched banner that cannot be dismissed, a hatched notice for
  contract fixtures, and a "Synthetic data · not actual law" tag on every result.
- **Motion:** 120–220ms ease for the evidence pane, popover and re-evaluation; a brief
  highlight on a rule whose result changed. All motion is disabled under
  `prefers-reduced-motion`.
- **Spacing:** 4px scale (`--s-1`…`--s-7`); controls are 38px tall, 44px on touch widths.

## Layout

- ≥1280px with a rule selected: property list · results · evidence pane (sticky, own scroll).
  A new result opens the first rule's evidence so the source is on screen immediately.
- 861–1279px: property list · results; evidence opens as a right-hand sheet.
- ≤860px: one column. The property list collapses behind "Change property"; evidence opens
  as a full-height modal sheet with focus trap, Escape to close and focus return.
- The result bar (query date, synthetic/partial/jurisdiction tags, disclaimer) is sticky, so
  the date a result was computed for is always visible while scrolling.
- Changes and Disagreements are single-column pages. A comparison reads top to bottom: the
  three counts, the timeline, the two summaries, then the drill-down. Each drill-down level is
  a native `<details>`: source → rule → property → before/after. The first source and its
  first rule start open so the structure is visible without a click.
- ≤860px: the timeline rail moves to the left edge with dates above each entry; summary
  tables become one block per group with its four counts labeled; the two claims of a
  disagreement stack.

## Journey → components

| Step | Where |
| --- | --- |
| Search/select a sample property; facts and jurisdiction quality shown separately | `features/property` |
| Explicit as-of date, starting at the contract default; nothing runs until asked | `features/lookup/AsOfControl` |
| Results grouped by evaluator result; missing facts, reasons, partial-data and warnings | `features/lookup/Results`, `RuleList` |
| Useful questions: prompt, meaning, why, typed input, "I don't know", hypothetical outcomes, ranking rationale, plan limits | `features/questions/QuestionsPanel`, `QuestionCard`, `AnswerInput` |
| Answers in play with provenance and disposition; edit, remove, change history | `features/questions/AnswerHistory` |
| What moved after re-evaluation, including "result unchanged, still needs…" | `features/questions/WhatChanged` |
| What remains uncertain, by kind and by who can resolve it | `features/questions/RemainingUncertainty` |
| Evidence: exact quotes, offsets, surrounding text, source record, retrieval time | `features/evidence/SourceTab` |
| Source text beside the encoded rule; rule-level encoding apart from this property's evaluation | `features/evidence/EncodedTab` |
| Six separate checks (availability, identity, anchor, quote, semantic, dependencies) | `features/evidence/ChecksTab` |
| Temporal versions and status events | `features/evidence/VersionsTab` |
| Date comparison and published scenarios; definite / uncertain / conflict; blocked; if-enacted | `features/changes/ChangesView`, `ChangeResultView` |
| Portfolio timeline of the dates the rule records state, with the two compared dates marked | `features/changes/PortfolioTimeline`, `lib/portfolio` |
| Summaries by legal municipality and by rule category; filters | `features/changes/PortfolioSummaries` |
| Source → changed rule → impacted property, with names instead of IDs and before/after evidence | `features/changes/PortfolioDrillDown`, `usePortfolioDetails` |
| Source disagreements: two claims side by side, authority, dates, why unresolved, next step | `features/disagreements`, `lib/disagreements` |
| What an answer would move; grouped remaining uncertainty with the kind of next step | `features/questions`, `lib/uncertainty` |
| Working export of one result | `lib/exportPackage`, `features/lookup/Results` |

## State inventory

Each state has a deliberate presentation and an automated check (`tests/e2e`).

| State | Presentation |
| --- | --- |
| Loading | Skeleton for first load; earlier result dimmed during re-evaluation. |
| Empty search | "No sample properties match" with what search covers. |
| Valid empty lookup | "No rules were returned…" plus: this describes the extracted dataset, not that no law applies. |
| Legal unknown | Its own group, with what it needs and why. |
| Validation | Inline, before sending: date, typed answers, comparison form. |
| 422 | "The request was not accepted" with the field-level detail from the API. |
| 404 unknown ID | "That selection is no longer in the dataset" → choose another property. |
| 404 unknown route | "Not available on this backend" (an older backend without a route) with a visible fallback where one exists. |
| 503 | "The dataset is not ready": a service state, explicitly not "no rules apply". |
| 502 / 503 `core_unavailable` | "A backend dependency failed"; no partial result is shown. |
| Capability unavailable | A successful response whose `capabilities` mark the planner, renderer or evidence as unavailable: the result is shown, the missing part is named, and facts can still be supplied from `GET /facts`. |
| Evidence failure | A missing or unsupported source keeps the result unknown; each check states its own status and reason. |
| Transport / timeout | "The service could not be reached", retry, and the demo as an explicit choice. |
| Contract mismatch | Response refused with the failing paths; extra fields surface as drift in "About this result". |
| Partial data | Tag in the result bar and a notice listing missing/unprocessed sources. |
| Unresolved / ambiguous jurisdiction | Tag in the result bar; jurisdiction block states the postal city is not the legal municipality. |
| Provider failure | Last extraction outcome in the service notice and status panel. |
| Rejected answer | Earlier result stays, labeled as predating the answer. |
| Blocked comparison | "Blocked", counts shown as "—", never as zero. |
| If-enacted | "Hypothetical · if enacted" tag and notice. |
| Demo: not recorded | Refused, with the recorded dates/comparisons offered. |
| Names still loading | The comparison is shown at once with IDs; names replace them as `/addresses`, `/rules/{id}` and `/sources/{id}` answer. |
| A name could not be read | “Some names could not be read”, the affected entries keep their ID, and a retry is offered. The comparison is unaffected. |
| Request edited while comparing | The pending comparison is withdrawn; a late response is discarded. |
| Month- or year-only date | Shown as stated (“Dec 2026 · month only”) with the span it can mean; never placed on a day. |
| Municipality unresolved | Its own summary row and label; the postal city is never used in its place. |
| Conflict flagged | Red notice on the lookup, a tag on each changed row, and a link to both sources side by side. |
| No conflict flagged | “No conflict is flagged…”, with the note that this is not a finding that every source agrees. |
| Rules outside this result | Uncertainty the service reports for rules that do not reach the property is collapsed, not mixed in. |
| Development fixture | Hatched notice and tag wherever it is shown: fictional sources, backend-computed results. |
| Demo: value not recorded | Answer kept and labeled "Not evaluated"; baseline unchanged. |

## Decisions worth knowing

- **Default mode is live.** With no backend the app shows the unreachable state and offers
  the demo. `npm run dev:demo` or `?mode=demo` starts in the demo.
- **Dates.** The query date starts at `LookupRequest.as_of`'s default from the contract and is
  never read from the clock (tests pin the clock elsewhere to prove it). Changing the date
  does not change the result on screen; the result keeps its own date until re-run.
- **Answers** are request-local: kept only in page state, resent in full on every request,
  cleared when the property, date or fixture changes. `null` is sent as an explicit unknown
  on the assist route; on the `/lookup` fallback (older backends only) an unknown is not sent.
- **No client-side planner.** Questions, their order, alternatives and intervals come from
  `question_plan`. With no plan, the UI lists the facts the evaluator reported missing and
  types their inputs from `GET /facts`; it does not rank them or predict outcomes.
- **Demo answers.** Recorded probe values can be applied as `provenance: "demo"` only when
  the data declares itself synthetic. On other data, probes are displayed as hypotheticals
  and cannot be applied. A typed number is matched to a recorded outcome only through an
  interval the planner declared (`AlternativeOutcome.interval`), never by the UI's own
  reading of a threshold.
- **Evidence checks.** Reports arrive with the assisted lookup (or from
  `GET /rules/{id}/evidence`). The six kinds stay separate; a kind with several results shows
  each one and a count per status, and a kind the report omits says "No result in the
  report". With no report at all, each row says "Not checked by the service" and lists only
  what the lookup data itself shows, labeled as observations, not verdicts.
- **Encoded rule.** The renderer's text is shown as returned, beside the source quote, with
  its validation status. The evaluation trace (`question_plan.traces`) is drawn as the
  evaluator's own condition tree with each node's result. When the renderer is unavailable
  the stored expression is shown as a structural tree, not an English paraphrase.
- **Offsets** are treated as Unicode code points, as the contract specifies, not UTF-16 units.
- **Fonts.** Inter is bundled (`@fontsource-variable/inter`); the serif and monospace use
  system faces, so the app has no runtime font requests.
- **Portfolio view regroups, it does not compute.** Counts in the three tiles are the
  comparison’s own lists. Summaries, the timeline and the drill-down rearrange
  `ChangeResult.differences` using records read from `GET /addresses`, `GET /rules/{id}` and
  `GET /sources/{id}`. A property under two headings is counted in both, and the page says so.
- **Timeline dates are the rule records’ own.** Status events, effective and end dates are
  shown with the precision the record carries. “Compare across this date” offers the day
  before against that day; for a month or year it offers the first and the last possible day
  and says the evaluator returns unknown inside the span. Rules come from the comparison’s
  own differences, including equal-status rows Core retains as unresolved possible impacts.
  A timeline entry does not by itself establish a definite change.
- **Names.** A property is named by its street address and its *legal* municipality when that
  is resolved; otherwise “Municipality unresolved”. Two records of one provision share a title,
  so a repeated title is followed by its source document.
- **Disagreements never have a winner.** The view has no field for a preferred source, an
  order of authority or a score. The two claims appear in the order the response gives them.
- **Next step for each uncertainty** comes from `Uncertainty.kind` and `Uncertainty.remedy`.
  Only `property_fact` is presented as answerable. Identical statements are shown once with
  every rule they hold back. Core B’s dated, version-specific statements stay separate when
  their text differs; rule and field identity keep interpretation gaps from becoming property questions.
- **What an answer would move** compares the evaluator’s recorded output for a probe with the
  evaluator’s current output. Both sides are service output; the UI only lists differences.
- **Working export** is assembled in the browser from the payloads on screen and says in its
  first field that it is not the reproducible evidence package.
- **Not built:** free-form address entry (the handoff says new-address geocoding is not
  available), dark mode, and the optional English/Spanish explanations.

## Demo data

| Dataset | Where it comes from | Labeled as |
| --- | --- | --- |
| Maple Harbor (3 properties, 1 rule) | `contracts/examples`, `contracts/research_examples`, `contracts/evidence_examples`, and the backend’s own synthetic store recorded by `scripts/record_demo.py` | “Synthetic data · not actual law”, “Contract fixture”, “Recorded backend output” |
| Development portfolio (14 properties, 6 sources, 6 rules, fictional state ZZ) | Sources and properties authored in `scripts/dev_portfolio.py` and `scripts/dev_fixture/*.txt`; rules created by the backend’s `ingest_document` + `extract` validation; every lookup, comparison, conflict flag, question and evidence report computed by the backend | “UX development fixture”, “Development fixture · fictional law” |
| Field-level disagreement (1 entry) | Authored by the UX lane in a proposed shape; offsets and hashes read from the fixture sources | “Development fixture · proposed shape” |

The development portfolio exists because the backend’s own synthetic store has one rule and
three properties, which cannot exercise a timeline, two groupings or a drill-down. It is not a
substitute for the integrated snapshot and is not used in live mode.

## Contract requests

For the Platform steward (models, routes, fixtures) and Core. None of these blocks the UI.

Resolved by `origin/main` at `3b1ef06` (PR #3–#5) and adopted here: evidence and rendering
examples (`contracts/examples/assist.json`, `contracts/evidence_examples/`); the `GET /facts`
shape (a map of `FactDefinition`); `GET /sources/{id}/context` parameters and `SourceContext`;
the `AlternativeOutcome.interval` shape; and `null` supplemental facts on `/lookup`, which now
keep the fact in `missing_facts`.

Still open — existing contract:

1. **Change scenarios list.** A route (or a field on `/health`) listing available `test_id`s
   with titles. The UI offers T1–T5 because the handoff names them.
2. **Labels in `ChangeResult`.** `differences` carries rule IDs, evaluations and address IDs
   only. The UI reads one `GET /rules/{id}` per changed rule, one `GET /sources/{id}` per
   source (which returns the full text when only the record is needed) and pages through
   `GET /addresses`. A summary block on the result — rule title, citation, category,
   jurisdiction, `source_doc_id`; property address and resolution — or a `fields=` option on
   those routes would remove the extra requests on a 500-property comparison.
3. **`two_unresolved_exemptions` fixture.** `response.lookup.address.facts.units` is 12 while
   `missing_facts` still lists `units` and `provenance` has no entry for it.
4. **`ChangeResult.differences` and `LookupResponse.metadata`** are open objects in the
   schema. Typed models would let the UI validate them instead of reading defensively.
5. **`GET /sources/{id}/context`** needs an example payload in `contracts/` before the
   evidence pane shows cross-referenced sections.
6. **Which interaction or version a conflict flag refers to.** Today the UI pairs conflicting
   records by matching `Interaction.target_citation` / `target_jurisdiction` / `category` and
   by the provision identity used for `RuleDetail.versions`. A list of the rule IDs in each
   conflict on the evaluation would make that pairing the service’s statement.

Needed from PLAT-06 / CORE-06 / CORE-07 for UX-04 (nothing below exists in `contracts/` yet;
the UI shows it only from the labeled development fixture or not at all):

7. **Source disagreement (PLAT-06 contract, CORE-06 comparisons).** One object per
   disagreement, with no preferred claim. The development fixture uses this proposed shape
   (`ProposedDisagreement` in `src/api/types.ts`); any equivalent is fine:

       disagreement_id, field, status ("unresolved" | …), affected_rule_ids[],
       claims[2..]: { claim_id, stated_value (as the source states it, with its precision),
                      span: SourceSpan, status_dates[]: { status, on } },
       unresolved_reason, remedy_kind (an Uncertainty.kind), remedy

   Plus how it is reached: on `AssistResponse` / `LookupResponse` for a property and date, and
   on `ChangeResult` for the affected addresses. The source record for each span’s `doc_id`
   (authority, type, URL, retrieval time) is already available.
   A disagreement should also appear in `remaining_uncertainty` for the rules it holds open,
   so a result is never shown as settled beside an open disagreement about its date.
8. **Classification of a source difference (CORE-06).** Whether two versions differ in
   requirement, exemption, coverage or lifecycle, or only in formatting or citation. The UI
   lists literally different fields today and cannot tell a moved quote from a changed rule.
9. **Evidence package (PLAT-06).** A route returning the reproducible package for a property
   and date, or its manifest: snapshot and code hashes, original facts, request-local answers
   with provenance, evaluations, exact quotes, URLs, retrieval dates, remaining uncertainty,
   and a field for independent human review. The UI’s working export has the same sections
   minus the hashes and will hand over to that route when it exists.
10. **Portfolio grouping (PLAT-06).** If the API groups changes by jurisdiction and category
    itself, the UI will show those groups instead of regrouping `differences`.
11. **Action type on an uncertainty (CORE-07).** The UI derives “needs a factual answer /
    location evidence / a source / interpretation review / more analysis” from
    `Uncertainty.kind`. If CORE-07 adds an explicit action field, the UI will read it.
12. **Why a changed result changed (CORE-07).** `differences` gives before and after
    evaluations. A short, source-cited explanation of the change per rule would replace the
    two raw explanation strings in the drill-down.
