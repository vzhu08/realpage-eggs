# UI notes (UX-03, UX-04, hackathon polish)

Design and behavior decisions for the frontend, the states it covers, and what it needs from
the other lanes. Screenshots are in `docs/screenshots/` (regenerate with
`SCREENSHOTS=1 npm run screenshots`).

## Principles

1. **The answer first.** A result opens with the property and date, the counts by status, what
   is unresolved and the next useful step. Everything else is below it or one disclosure away.
2. **Detail is kept, not shown by default.** Raw IDs, 64-character hashes, field names, method
   codes, plan limits and the service's verbatim statements live in disclosures next to the
   thing they describe. Nothing is deleted or reworded to make a page shorter.
3. **Unknown is a result, not an error.** Unknown, pending, not-yet-effective and superseded
   are separate groups with their own words and shapes. A failure to get a result is never
   shown as "no rules".
4. **Applicability is not a verdict.** Nothing is phrased as compliance or violation; the
   disclaimer stays under the header and in the pinned result bar.
5. **Evidence is one step away**, opens only when asked for, and its checks are never
   collapsed into a score.
6. **The UI adds no law.** It renders evaluator output, source text and contract defaults. It
   does not evaluate, rank questions, infer outcomes or prefer a source.

## Design system

Tokens live in `src/styles/tokens.css`; text/background pairs are tested for WCAG AA
(4.5:1) in `tests/unit/contrast.test.ts`.

- **Ground and surfaces:** a cool grey page (`--paper`) with white working surfaces
  (`--surface`) for the things you read and act on: the verdict, a question, a rule, a claim.
  Cards carry a hairline border and a light shadow; nesting is avoided.
- **Type:** Inter for all interface text, with weight and size doing the hierarchy. The serif
  (Charter and system equivalents) is kept for quoted source text only, so law always looks
  like law. A monospace is used only for identifiers, offsets, hashes and encoded expressions.
  Body 16px/1.55; sizes `--text-xs`…`--text-2xl`.
- **Accent:** one cobalt, used only for actions, links, focus, selection and the one question
  worth answering. The current view in the header is a filled pill.
- **Status tones:** applies (green), unknown (amber), not yet effective (indigo), pending
  (violet, outlined), superseded/does not cover (grey), conflict/failure (red). Every tag
  carries a word and an icon shape, so color is never the only signal.
- **Quotes:** source text is set in serif on a pale highlighter ground with a gold rule; the
  encoded rule is set on the accent wash. The two never share a treatment. The two sides of a
  source comparison are styled identically; nothing ranks one over the other.
- **Synthetic data:** a dark banner that cannot be dismissed, a "Synthetic data · not actual
  law" tag in every pinned result bar, and a labeled notice for contract fixtures and the
  development fixture.
- **Motion:** 120–220ms ease for the evidence drawer, dialogs and re-evaluation; a brief
  highlight on a rule whose result changed. All motion is disabled under
  `prefers-reduced-motion`.
- **Spacing and controls:** 4px scale (`--s-1`…`--s-7`); controls are 40px tall and 44px on
  touch widths, with a 2px focus ring.

## Layout

- One reading column (`--page`, 76rem) on every view. Nothing sits beside the result.
- **Lookup start:** a one-sentence purpose, three one-click examples in the synthetic demo
  (or links to the other two views on the live API), then the property chooser.
- **Lookup result, top to bottom:** the address with its legal location and stored facts on
  one line (the provenance and resolution record are a disclosure; an unresolved municipality
  stays on the page as a notice) → the explicit as-of date → the pinned result bar → the
  verdict card (counts by status, "What is unresolved", "Next") → what an answer changed →
  the most useful question → your answers → rule by rule → what remains uncertain → keep this
  result → about this result.
- **Evidence** opens as a right-hand drawer over the page (a full-height sheet on a phone),
  only when a rule's "Evidence" button is used. It holds focus, closes on Escape and returns
  focus to the button that opened it. The phone sheet repeats the synthetic-data label when
  applicable; closed disclosures are excluded from its keyboard focus loop.
- **Property chooser:** inline on the start page; once a property is on screen it opens from
  "Change property" as a dialog (a full sheet on a phone) with the search field focused.
- **Portfolio changes, top to bottom:** the form → the pinned comparison bar → the three
  totals → the two group tables → one tabbed detail: *By property* (default), *By source and
  rule*, *Timeline*. Each level of the detail is a native `<details>`.
- **Compare sources:** conflicts for one property and date (when arriving from a lookup), then
  every claim comparison in the snapshot, then the form for another property and date. The two
  claims sit side by side on desktop and stack on a phone.
- The pinned bar (property, query date, synthetic/partial/jurisdiction tags, disclaimer) is
  sticky, so the date a result was computed for is always visible while scrolling.
- A newly run lookup or one-click portfolio comparison scrolls to its result and next step.
  On narrow screens the three navigation links fit without horizontal clipping. Header
  controls wrap, while long identifiers and source URLs wrap inside their reading column.

## Journey → components

| Step | Where |
| --- | --- |
| Start page: one-click examples whose sentences are computed from the recordings they open; “Restart demo” / “Start over” in the header | `features/lookup/LookupView`, `api/demo.ts` (`examples`), `App.tsx` |
| Search/select a sample property; legal location and stored facts on one line, provenance and resolution record behind a disclosure | `features/property` |
| Explicit as-of date, starting at the contract default; nothing runs until asked | `features/lookup/AsOfControl` |
| Verdict: counts by status, what is unresolved, the next step | `features/lookup/Results` |
| Rules grouped by evaluator result; requirement first, “How this result was reached” (explanation, reasons, IDs) on request | `features/lookup/RuleList` |
| The most useful question: the fact definition in plain words, what an answer can change, a typed input, "I don't know"; hypothetical outcomes and the planner's own wording, ranking and limits behind disclosures | `features/questions/QuestionsPanel`, `QuestionCard`, `AnswerInput` |
| Answers in play with provenance and disposition; edit, remove, change history | `features/questions/AnswerHistory` |
| What an answer actually moved: before → after per rule, the answers it was evaluated with and their provenance, "result unchanged, still needs…" | `features/questions/WhatChanged` |
| What remains uncertain: statements grouped by typed kind and fact, each topic expanding to every original statement, remedy, rule ID, hash and quote | `features/questions/RemainingUncertainty`, `lib/openItems`, `lib/uncertainty` |
| Evidence: exact quotes, offsets, surrounding text, source record, retrieval time | `features/evidence/SourceTab` |
| Source text beside the encoded rule; rule-level encoding apart from this property's evaluation | `features/evidence/EncodedTab` |
| Six separate checks (availability, identity, anchor, quote, semantic, dependencies) | `features/evidence/ChecksTab` |
| Temporal versions and status events | `features/evidence/VersionsTab` |
| Date comparison and published scenarios; definite / uncertain / conflict; blocked; if-enacted | `features/changes/ChangesView`, `ChangeResultView` |
| Totals, then the service's own groups by rule jurisdiction and category (`POST /changes/summary`); regrouped from records when the backend has no summary route | `features/changes/ChangeResultView`, `PortfolioSummaries`, `lib/portfolio` |
| Property by property (default), source → rule → property, and the timeline as a third view; names from the summary at once, source text, dates and locations as records load | `features/changes/PortfolioDrillDown`, `PortfolioTimeline`, `usePortfolioDetails` |
| Truthful waiting for a slow comparison: elapsed seconds, what the service is doing, Cancel | `features/changes/ChangesView` |
| Claim comparisons from `GET /source-comparisons`: both exact texts, authority, retrieval date, anchor and identity checks, the service's remedy, no winner | `features/disagreements/ComparisonCard`, `lib/sourceComparisons` |
| Evaluator conflicts for one property and date: two rule records side by side | `features/disagreements/DisagreementCard`, `lib/disagreements` |
| Evidence package (`POST /lookup/evidence-package`) for the request on screen; working export kept apart | `features/lookup/KeepResult`, `lib/exportPackage` |

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
| Records still loading | The comparison is shown at once. With a change summary every property and rule is already named; legal locations, source text and dates fill in as `/addresses`, `/rules/{id}` and `/sources/{id}` answer. Without one, IDs stand in until then. |
| A record could not be read | “Some records could not be read”; the affected entries keep the summary's name (or their ID), and a retry is offered. The comparison is unaffected. |
| Slow comparison | “Comparing… N s” with what the service is doing and a Cancel button. The wait is 180 seconds; a timeout is reported as a timeout and nothing is substituted. No progress bar is drawn, because none is known. |
| No summary route | The comparison comes from `POST /changes` and a status line says so. |
| Request edited while comparing | The pending comparison is withdrawn; a late response is discarded. |
| Month- or year-only date | Shown as stated (“Dec 2026 · month only”) with the span it can mean; never placed on a day. |
| Municipality unresolved | Its own summary row and label; the postal city is never used in its place. |
| Conflict flagged | A red cue in the verdict card, a tag on the rule and on each comparison row, and a link to both records side by side. |
| Claims differ | “The two texts state different things”: both passages, both sources, the service's remedy, “No source is preferred”, “Meaning not checked”. Not called a legal conflict. |
| Support missing or stale | “Support is missing on one side”: the side with no passage, or whose passage or source no longer matches its recorded hash, says so. |
| Same observation | “Both texts state the same thing”, labeled as not semantically verified. |
| No claim comparisons | “No claim comparisons are saved with this snapshot” with the service's notes: an absence of comparisons, not agreement. |
| Evidence package | Loading with Cancel; a receipt with the artifact label in words and raw, the disclaimer, and the hashes and limitations in a disclosure; errors with retry. A new result withdraws a request in flight. Not offered in the synthetic demo or for a contract fixture, and the card says why. |
| No conflict flagged | “No conflict is flagged…”, with the note that this is not a finding that every source agrees. |
| Rules outside this result | Uncertainty the service reports for rules that do not reach the property is collapsed, not mixed in. |
| Development fixture | A tag in the pinned bar wherever it is shown and a short paragraph one disclosure down: fictional sources, backend-computed results. |
| Start over | “Restart demo” / “Start over” rebuilds every view: no property, answer, result or comparison carries over. |
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
  A previous result retained after editing the date still displays and exports its original
  answers, read-only. Facts echoed by the service from those answers are labeled as answers,
  unverified and not on the stored record.
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
  comparison’s own lists. The two group tables are the service’s own groups from
  `POST /changes/summary` (by the *rule’s* jurisdiction and by category); the page says the
  groups overlap and are not additive. A backend without that route is asked through
  `POST /changes`, a status line says so, and the tables regroup `differences` from the address
  and rule records instead (by the *property’s* legal municipality and by category). The
  timeline and the source → rule → property view always use the rule and source records.
- **One-click examples describe themselves from data.** Which recording an example opens is
  configuration (`WALKTHROUGH` in `src/demo/fixtures.ts`); every number in its sentence is
  counted from that recording when the page loads. They exist only in the synthetic demo.
- **Open statements are grouped by type, never by text.** A topic is one `Uncertainty.kind`
  and one `field`. Its heading is the interface’s name for that kind of gap; the next steps
  are the service’s remedies, verbatim; the statements, with their rule IDs, encoding hashes
  and source quotes, are in the topic’s disclosure, word for word. A unit test checks that
  every recorded statement, remedy, rule reference and quote survives grouping.
- **A question is asked in the fact’s own words.** The heading is `FactDefinition.meaning`;
  the planner’s prompt, its “why”, the ranking rationale and the predicate IDs are in “Why
  this is asked, in the planner’s words”. Hypothetical outcomes stay closed until asked for.
- **Evidence package and working export are different things** and are shown as two cards.
  The package is requested for exactly the request that produced the result on screen
  (property, date, every request-local answer including explicit unknowns), saved byte for
  byte as the service sent it, and refused if it echoes a different request.
- **Timeline dates are the rule records’ own.** Status events, effective and end dates are
  shown with the precision the record carries. “Compare across this date” offers the day
  before against that day; for a month or year it offers the first and the last possible day
  and says the evaluator returns unknown inside the span. Rules come from the comparison’s
  own differences, including equal-status rows Core retains as unresolved possible impacts.
  A timeline entry does not by itself establish a definite change.
- **Names.** A property is named by its street address and its *legal* municipality when that
  is resolved; otherwise “Municipality unresolved”. Two records of one provision share a title,
  so a repeated title is followed by its source document.
- **Comparisons never have a winner.** The view has no field for a preferred source, an
  order of authority or a score. The two claims appear in the order the response gives them,
  labeled “First claim” and “Second claim” (the contract calls them `before`/`after`; that is
  the order of the annotation, not a statement about time). A difference between two texts is
  called a difference; only the evaluator’s own conflict flag is called a conflict.
- **Next step for each uncertainty** comes from `Uncertainty.kind` and `Uncertainty.remedy`.
  Only `property_fact` is presented as answerable. Identical statements are shown once with
  every rule they hold back. Core B’s dated, version-specific statements stay separate when
  their text differs; rule and field identity keep interpretation gaps from becoming property questions.
- **What an answer would move** compares the evaluator’s recorded output for a probe with the
  evaluator’s current output. Both sides are service output; the UI only lists differences.
- **Working export** is assembled in the browser from the payloads on screen and says in its
  first field that it is not the evidence package the service builds.
- **Not built:** free-form address entry (the handoff says new-address geocoding is not
  available), dark mode, and the optional English/Spanish explanations.

## Demo data

| Dataset | Where it comes from | Labeled as |
| --- | --- | --- |
| Maple Harbor (3 properties, 1 rule) | `contracts/examples`, `contracts/research_examples`, `contracts/evidence_examples`, and the backend’s own synthetic store recorded by `scripts/record_demo.py` | “Synthetic data · not actual law”, “Contract fixture”, “Recorded backend output” |
| Development portfolio (14 properties, 6 sources, 6 rules, fictional state ZZ) | Sources and properties authored in `scripts/dev_portfolio.py` and `scripts/dev_fixture/*.txt`; rules created by the backend’s `ingest_document` + `extract` validation; every lookup, comparison, conflict flag, question and evidence report computed by the backend | “UX development fixture”, “Development fixture · fictional law” |
| Claim comparisons (4 observations) | Annotations authored in `scripts/dev_portfolio.py` (`write_claim_annotations`) in the shape Core saves as `source_comparisons.json`, with spans computed from the fixture texts; the recorded `GET /source-comparisons` response, including every anchor check and classification, is the backend’s | “Development fixture · fictional sources” |

The development portfolio exists because the backend’s own synthetic store has one rule and
three properties, which cannot exercise a timeline, two groupings or a drill-down. It is not a
substitute for the integrated snapshot and is not used in live mode.

## Contract requests

For the Platform steward (models, routes, fixtures) and Core. None of these blocks the UI.

Resolved and adopted: evidence and rendering examples; the `GET /facts` shape;
`GET /sources/{id}/context` parameters; the `AlternativeOutcome.interval` shape; `null`
supplemental facts on `/lookup`; **claim comparisons** (`GET /source-comparisons`); the
**evidence package** (`POST /lookup/evidence-package`); and **labels and groups for a
comparison** (`POST /changes/summary`).

Still open:

1. **Change scenarios list.** A route (or a field on `/health`) listing available `test_id`s
   with titles. The UI offers T1–T5 because the handoff names them.
2. **More of the rule in the change summary.** `rule_labels` is the title only. Citation,
   category, jurisdiction and `source_doc_id` per rule (and each property’s resolution) would
   let the source → rule → property view and the timeline open without one `GET /rules/{id}`
   per rule, one `GET /sources/{id}` per source (which returns the full text when only the
   record is needed) and paging through `GET /addresses`.
3. **`two_unresolved_exemptions` fixture.** `response.lookup.address.facts.units` is 12 while
   `missing_facts` still lists `units` and `provenance` has no entry for it.
4. **`ChangeResult.differences` and `LookupResponse.metadata`** are open objects in the
   schema. Typed models would let the UI validate them instead of reading defensively.
5. **`GET /sources/{id}/context`** needs an example payload in `contracts/` before the
   evidence drawer shows cross-referenced sections.
6. **Which interaction or version a conflict flag refers to.** Today the UI pairs conflicting
   records by matching `Interaction.target_citation` / `target_jurisdiction` / `category` and
   by the provision identity used for `RuleDetail.versions`. A list of the rule IDs in each
   conflict on the evaluation would make that pairing the service’s statement.
7. **A display title on a claim comparison.** Observations are keyed by an internal name
   (`Berkeley_dates`). The UI titles a card with the field and the classification and keeps
   the key in the small print; a short human title per observation would read better.
8. **Claim comparisons for one property.** `rule_ids` ties an observation to rules, and many
   real observations name none. A way to ask which observations bear on a property and date
   would let a lookup link to exactly those.
9. **Classification of a rule-version difference (CORE-06).** Whether two versions of a rule
   differ in requirement, exemption, coverage or lifecycle, or only in formatting or citation.
   The internal rule-version records are listed in the response notes and not yet exposed.
10. **Action type on an uncertainty (CORE-07).** The UI derives “needs a factual answer /
    location evidence / a source / interpretation review / more analysis” from
    `Uncertainty.kind`. If CORE-07 adds an explicit action field, the UI will read it.
11. **Why a changed result changed (CORE-07).** `differences` gives before and after
    evaluations. A short, source-cited explanation of the change per rule would replace the
    two raw explanation strings in the detail.
12. **A shorter statement beside the full one.** Planner statements carry the rule ID, the
    encoding hash, the citation and the source URL inline. The UI keeps them verbatim in a
    disclosure and writes its own heading per kind. A `summary` field on `Uncertainty` (and on
    `FactQuestion.why`) would let the reading path use the service’s words too.
