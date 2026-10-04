# Four-minute judge walkthrough (UX-04)

One journey, two tracks. **Track A** is the real-data demo and is the one to present. **Track B**
is the synthetic rehearsal: the same clicks on labeled fictional data, used for practice and
kept as the backup. Nothing in Track B may be presented as law or as a real result.

The journey: disclosure → property → one consequential question → date change → portfolio
impact → source disagreement → keep the result.

## Before the demo

1. Start the backend on the integrated snapshot (PLAT-06) and the frontend (`npm run dev`, or
   the served build). Open the app in a fresh browser profile at 1440 px wide or more.
2. Open the status button in the header. Check that it says **Dataset ready** or **Partial
   dataset**, and read the counts aloud once in rehearsal so nobody is surprised by them.
3. Confirm the header does **not** show the “Synthetic demo” banner. If it does, you are in
   Track B.
4. Walk the chosen examples once (see “Choosing the real examples”). If any step shows a
   state you did not expect, change the example, not the wording.

## Track A — real data (to present)

Times are targets. Say what is on screen; do not narrate IDs.

| # | Time | Do | Say |
| --- | --- | --- | --- |
| 1 | 0:00–0:25 | Header status button → read dataset state. Close it. | “Rules here were extracted automatically from the captured sources. This run is *[live / a replay of a recorded extraction]*. The header says how complete the dataset is, and every result says so again.” |
| 2 | 0:25–1:00 | Lookup → search the chosen property → check **Jurisdiction** → **Run lookup** at the default date. | “This is one property on one explicit date. The date comes from the contract, never from today’s clock. It shows which rules reach the property, which are not yet determinable, and why. This is applicability, not compliance.” |
| 3 | 1:00–1:45 | Scroll to **Useful questions**. Read the line “Depending on the answer, N of M results can change.” Answer it. | “Only a fact that can change a result is asked. The answer is mine, unverified, and applies to this request only. Here is exactly what moved, and here is what stays unknown and why: that part needs a source, not an answer.” |
| 4 | 1:45–2:15 | Click a rule → evidence pane: quote, surrounding text, **Checks** tab. | “Every result opens onto the exact text it rests on, with where it sits in the source and when it was retrieved. The checks are separate; there is no single confidence score.” |
| 5 | 2:15–3:05 | **Changes** → the chosen two dates → **Compare**. Read the three counts. Scroll the timeline. Select one location in “Where and what”. Open one source → rule → property. | “Across these two dates: this many properties are definitely affected, this many are uncertain, and they are never merged. The timeline is the dates the sources themselves state. I can follow any change from the source, to the rule, to each property it reaches.” |
| 6 | 3:05–3:40 | On a row with a conflict tag → **Compare the conflicting sources**. | “Here two sources say different things. Both texts are shown with their authority and retrieval date. The workspace does not pick one; the result stays unknown, and it says what would resolve it.” |
| 7 | 3:40–4:00 | **Open the full lookup** → **Download working export**. | “And I can keep exactly what I saw: facts, my answers, results, quotes and what is still uncertain, each kept apart.” |

If a step is blocked on the day, say so in the same words the screen uses (“Blocked: this
comparison could not be established”) and move to the next step. Do not switch to Track B
without saying “this next part is a synthetic rehearsal on fictional data”.

### Choosing the real examples

Choose them from verified results on the integrated snapshot, with Platform and Core, and
write them into the table below before rehearsal. Do not pick an example because it matches
this script; pick one because its result has been checked.

| Step | What the example needs | Chosen (fill in at rehearsal) |
| --- | --- | --- |
| 2 | A property whose municipality is **resolved**, with at least one rule that applies and one that is unknown. | |
| 3 | A question whose consequence line says at least one result can change, and whose answer is known to the presenter from the property record. | |
| 4 | A rule whose evidence report has a passing quote check and a non-pass somewhere else, so the separate checks are visible. | |
| 5 | Two dates with a **complete** or **partial** comparison (not blocked) and at least one definite and one uncertain property. T1 or T3 if CORE-06 verifies them. | |
| 6 | A property with a conflict flag on the later date. NJ first; Berkeley and Los Angeles reuse the same view. | |

Field-level date disagreements (two sources, one effective date) need the PLAT-06 contract
and CORE-06 comparisons. Until those exist the real demo shows only conflicts the evaluator
flags today; the field-level view appears in Track B only, labeled as a development fixture.

## Track B — synthetic rehearsal and backup

Fictional state “ZZ”, fictional cities and properties. Start with `npm run dev:demo` (or
`?mode=demo`). The dark **Synthetic demo** banner stays on screen throughout.

| # | Do | What it shows |
| --- | --- | --- |
| 1 | Header status button | The build replays recorded files; the development portfolio is named as authored by the UX lane. |
| 2 | Search “Ember” → **61 Ember Road** → recorded date **Jan 15, 2027** → **Run lookup** | One rule applies, two are unknown, and a red notice says sources conflict for two rules. |
| 3 | **Useful questions**: “Depending on the answer, 2 of 6 results can change.” → **Answer with No as a demo answer** | Nothing moves, and each fee-cap rule says “Still unknown, and not for want of a property fact”. (Answering **Yes** instead takes the property out of the rule and the conflict notice disappears.) |
| 4 | Click a fee-cap rule | Exact quote, offsets, the six checks. |
| 5 | **Changes** → **Oct 1, 2026 → Jan 15, 2027** | 11 definite, 10 uncertain, 10 conflict flagged; the timeline with “Dec 2026 · month only”; summaries by municipality and category; source → rule → property. |
| 6 | Open source `DEV-LP-ORD-03` → the rule → **25 Dune Lane** → **Compare the conflicting sources** | Two records of one provision: $35 in the ordinance, $50 in the codified text. No source is preferred. |
| 7 | **Disagreements** in the header | The field-level example (Nov 1 vs Dec 1 effective date), labeled “Development fixture · proposed shape”. |
| 8 | **Open the full lookup** → **Download working export (JSON)** | The file, with its notice that it is not the reproducible evidence package. |

`DEMO_BACKUP=1 npm run demo:backup` replays steps 1–8 and writes numbered frames and one
recording to `docs/demo-backup/`. See that folder’s README for what the backup is and is not.

## Words to keep, and words to avoid

- Say “applies”, “not yet determinable”, “uncertain”, “blocked”, “hypothetical”.
- Do not say “compliant”, “violation”, “the law is”, “confidence”, or “no rules apply” for a
  result that is blocked, failed or partial.
- A hypothetical (“if enacted”) is never described as upcoming law.
- A model review is never described as a legal or human review.
