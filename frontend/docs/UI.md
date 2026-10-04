# UI notes (UX-03)

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
| Date comparison and published scenarios; definite / uncertain / conflict; before/after evidence; blocked; if-enacted | `features/changes` |

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
| 404 unknown route | "Not available on the connected backend" (planned endpoints) with a visible fallback where one exists. |
| 503 | "The dataset is not ready": a service state, explicitly not "no rules apply". |
| 502 | "A backend dependency failed"; no partial result is shown. |
| Transport / timeout | "The service could not be reached", retry, and the demo as an explicit choice. |
| Contract mismatch | Response refused with the failing paths; extra fields surface as drift in "About this result". |
| Partial data | Tag in the result bar and a notice listing missing/unprocessed sources. |
| Unresolved / ambiguous jurisdiction | Tag in the result bar; jurisdiction block states the postal city is not the legal municipality. |
| Provider failure | Last extraction outcome in the service notice and status panel. |
| Rejected answer | Earlier result stays, labeled as predating the answer. |
| Blocked comparison | "Blocked", counts shown as "—", never as zero. |
| If-enacted | "Hypothetical · if enacted" tag and notice. |
| Demo: not recorded | Refused, with the recorded dates/comparisons offered. |
| Demo: value not recorded | Answer kept and labeled "Not evaluated"; baseline unchanged. |

## Decisions worth knowing

- **Default mode is live.** With no backend the app shows the unreachable state and offers
  the demo. `npm run dev:demo` or `?mode=demo` starts in the demo.
- **Dates.** The query date starts at `LookupRequest.as_of`'s default from the contract and is
  never read from the clock (tests pin the clock elsewhere to prove it). Changing the date
  does not change the result on screen; the result keeps its own date until re-run.
- **Answers** are request-local: kept only in page state, resent in full on every request,
  cleared when the property, date or fixture changes. `null` is sent as an explicit unknown
  on the assist route; on the `/lookup` fallback an unknown is simply not sent.
- **Demo answers.** Recorded probe values can be applied as `provenance: "demo"` only when
  the data declares itself synthetic. On other data, probes are displayed as hypotheticals
  and cannot be applied.
- **Evidence without a report.** When no `EvidenceReport` exists, each of the six rows says
  "Not checked by the service" and lists only what the lookup data itself shows (capture
  status, recorded hashes, offsets present, a literal quote comparison in the browser, the
  rule's recorded semantic status). These are labeled observations, not verdicts.
- **Encoded rule.** Until Core's renderer is available, the encoded expression is shown as a
  structural tree (operators, facts, values as stored). It is not an English paraphrase.
- **Offsets** are treated as Unicode code points, as the contract specifies, not UTF-16 units.
- **Fonts.** Inter is bundled (`@fontsource-variable/inter`); the serif and monospace use
  system faces, so the app has no runtime font requests.
- **Not built:** free-form address entry (the handoff says new-address geocoding is not
  available) and dark mode.

## Contract requests

For the Platform steward (models, routes, fixtures) and Core. None of these blocks the UI;
each is a place where the UI currently shows "not available".

1. **Evidence examples.** A schema-valid `EvidenceReport` (including a failing/insufficient
   case) and an `EncodedRuleRendering` example in `contracts/research_examples/`. The UI is
   built and tested against test doubles shaped by `research.schema.json`.
2. **`GET /facts` response shape.** `ASSIST_CONTRACT.md` names the route but not its response
   (list or map of `FactDefinition`?). Needed to type the supply-a-fact inputs when no plan
   exists; today the control type is chosen from how the encoded rule compares the fact.
3. **`GET /sources/{id}/context` parameters.** Which span/offset parameters select the
   context, and the response model (`SourceContext`?). Today context is cut client-side from
   `GET /sources/{id}`.
4. **Alternative intervals.** `AlternativeOutcome.interval` is `null` in every fixture. A
   documented shape (bounds and inclusivity) would let the UI state which values an
   alternative covers instead of only the probe value.
5. **Change scenarios list.** A route (or a field on `/health`) listing available `test_id`s
   with titles. The UI offers T1–T5 because the handoff names them.
6. **Rule titles in `ChangeResult`.** `differences` carries rule IDs and evaluations but no
   rule title/citation, so the changes view shows IDs.
7. **`two_unresolved_exemptions` fixture.** `address.facts.units` is 12 while
   `address.missing_facts` still lists `units` and `provenance` has no entry for it. The UI
   hides the contradiction (a fact with a value is not listed as missing) but the fixture
   should be consistent.
8. **`ChangeResult.differences` and `LookupResponse.metadata`** are open objects in the
   schema. Typed models would let the UI validate them instead of reading defensively.
9. **Unknown answers on `/lookup`.** `supplemental_facts` with a `null` value currently
   removes the fact from `missing_facts` in `service.lookup`; the UI therefore never sends
   `null` on that path. Worth confirming the intended behavior.
