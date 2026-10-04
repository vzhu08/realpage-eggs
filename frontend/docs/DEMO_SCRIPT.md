# Four-minute judge walkthrough

One journey, two tracks, kept apart.

- **Track A** is the real-data demo and is the one to present. Its examples are chosen from
  responses that were checked on the real snapshot and written into the table below.
- **Track B** is the synthetic rehearsal and the backup: the same journey on labeled fictional
  data, opened with three one-click examples. Nothing in Track B may be presented as law or as
  a real result.

The journey: start page → one property on one date → the one question that matters → the
answer and what it moved → the evidence → what stays uncertain → keep the result → what
changes across the portfolio → two sources side by side.

Labels below were reviewed against the integrated native build on October 4, 2026
(see `NATIVE_UX_REVIEW.md` and the historical audit in `QA_HACKATHON.md`). If a label
on screen differs, say what the screen says.

## Before the demo

1. Start the backend on the snapshot to be shown and the frontend. Open the app in a fresh
   browser window, 1440 px wide or more.
2. Look at the top of the page.
   - Track A: there is **no** dark “Synthetic demo” banner, the switch reads “Live API”, and
     the status button reads “Dataset ready” or “Partial dataset”.
   - Track B: the dark “Synthetic demo” banner is there and stays there.
3. Track A only: open the status button and read the counts once in rehearsal, so nobody is
   surprised by them. If a “Partial dataset” notice sits above the page, read it once too.
4. Track A only: walk the chosen examples once, including the portfolio comparison, so its
   prepared result is confirmed (see “When a comparison is slow”). If a step shows a state you
   did not expect, change the example, not the wording.
5. Press “Start over” (Track A) or “Restart demo” (Track B). You should be on the start page
   with no property selected.

## Track A — real data (to present)

Live mode has no one-click examples. The start page shows “Across the whole dataset” (two
links) and “Choose a property”. Times are targets. Say what is on screen; do not read IDs.

| # | Time | Do | Say | The limitation, said aloud |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:20 | Point at the header: the status button and the line “Not legal advice. Coverage is not a finding of compliance or a violation.” | “This shows which rental rules reach a property on a date you choose, with the exact source text behind each result.” | “The rules were extracted from captured sources and are marked as needing review. This shows applicability, not compliance.” |
| 2 | 0:20–0:55 | Under “Choose a property”, search the chosen property and select it. Set “As of date” to the chosen date. Press “Run lookup”. Scroll to “Rules for this property on *date*”. | “One property, one explicit date. The date is never today’s date unless I type it. Here are the results by status, what is unresolved, and the next step.” | Read the “What is unresolved” lines as written. “Unknown is a result here, not an error.” |
| 3 | 0:55–1:35 | Press “Go to the question”. Read the “Most useful question” and its line “Depending on the answer, … results can change.” Type the documented answer. Press “Apply answer”. Read “Re-evaluated with your answers”. | “It asks only for a fact that can change a result. This is what actually moved, rule by rule, and this is what stayed unknown and why.” | “My answer is unverified, applies to this request only and is never stored. An answer cannot fix a missing source.” |
| 4 | 1:35–2:00 | On one rule under “Rule by rule”, press “Evidence”. Show the quote and “characters *n*–*m*” on “Source text”, then open “Checks”. Press Escape. | “Every result opens onto the exact text it rests on and where that text sits in the source. The checks are separate; there is no single score.” | Read any check that says “Not checked”. “Finding the words in the source is not a check that they mean what the rule encodes. No independent human review is recorded.” |
| 5 | 2:00–2:25 | Scroll to “What remains uncertain”; open one “All *N* statements from the service”. Then, under “Keep this result”, press “Download evidence package”. Point at “Saved as evidence-package-….json” and the label beside it. | “What is still open is grouped by what it needs: a fact, a source, or review. And I can keep this exact result: the service builds a package for this property, this date and my answers.” | Read the label: “Research evidence · not legal validation”. “The hashes identify the content. A package that replays to the same output does not show the law was read correctly.” |
| 6 | 2:25–3:10 | “Portfolio changes”. Set “From date” and “To date” to the chosen dates. Press “Compare”. Scroll to “Impact on sample properties” and read the three counts. Under “By property”, open one row to show “Before · *date*” and “After · *date*”. Point at the “By source and rule” and “Timeline” tabs. | “Across these two dates: this many properties are definitely affected, this many are uncertain, this many carry a conflict flag. Each row shows the result before and after, with its evidence.” | “The three counts are separate lists and they overlap, so they do not add up.” If the tag reads “Partial”, read the “Partial result” notice. |
| 7 | 3:10–3:50 | “Compare sources”. On the first card under “Claims compared across sources”, show “First claim” and “Second claim”, each source’s authority and “Retrieved” date, then “Next action”. | “Where two sources were compared, both exact texts are shown. Nothing here picks one.” | Read the tags: “No source is preferred”, “Meaning not checked”. “A difference between two texts is not yet a legal conflict.” |
| 8 | 3:50–4:00 | Press “Start over”. | “That is one property, the portfolio and the sources, each with its evidence and its open questions.” | |

If “Claims compared across sources” says “No claim comparisons are saved with this snapshot”,
read it and use the alternative for step 7: on a portfolio row tagged “Conflict”, follow
“Compare the conflicting sources” and show “Conflicts flagged by the evaluator”.

### Choosing the real examples

Choose them from actual responses on the snapshot being shown, with Platform and Core, and
write them in before rehearsal. Do not pick an example because it fits this script; pick one
because its result has been checked. Nothing in this table is filled in by the UX lane.

| Step | What the example needs | Chosen (fill in at rehearsal) | Verified by, on |
| --- | --- | --- | --- |
| 2 | A property whose “Legal location” reads “Resolved”, on a date with at least one “Applies” and one “Unknown” result. | | |
| 3 | A lookup whose “Most useful question” says at least one result can change, and whose answer the presenter can document from the property record. Note the value to type. | | |
| 4 | A rule whose “Checks” tab shows a “Pass” on “Exact quote” and something other than a pass elsewhere, so the separate checks are visible. | | |
| 5 | The same lookup. Confirm in rehearsal that “Download evidence package” saves a file and that the package replays (`python -m navigator replay-evidence-package <file>`). | | |
| 6 | Two dates whose comparison has a prepared result (it answers within a few seconds), with status “Complete” or “Partial”, at least one “Definitely affected” and one “Uncertain” property. | | |
| 7 | A snapshot whose “Claims compared across sources” list is not empty; otherwise a property and date with a conflict flag, for the alternative step. | | |

### When a comparison is slow

A pair of dates with no prepared result is recalculated across every sample property. The
screen then shows “Comparing… *N* s” counting up, the sentence “Nothing is shown until it
answers.”, and a “Cancel” button. It waits up to three minutes.

- Say what the screen says: “This pair of dates has no prepared result, so the service is
  recalculating. Nothing is shown until it answers.”
- Then either keep talking over step 7 in another tab, or press “Cancel” and compare the
  prepared dates from the table.
- If it ends with “The service did not answer in time”, read that. Do not describe a result.
- Never switch to Track B to fill the gap without saying so (see below).

### When something is blocked or fails

Read the screen. These are deliberate states, and each says what it does not mean.

| On screen | Say |
| --- | --- |
| “Blocked: this comparison could not be established” with “—” for the counts | “This comparison is blocked. The dashes are not zeros: nothing could be computed, and the notes say why.” |
| “The dataset is not ready” | “This is a service state. It does not mean that no rules apply.” |
| “The service could not be reached” | “The service is not answering. The app does not fill the gap with example data.” |
| Under “Evidence package”: an error with “Nothing was saved.” | “The package was not built. I can still take the working export, which is a different thing: it has no source texts and no hashes.” Then press “Download working export (JSON)”. |
| “No rules were returned for this property on this date” | “That describes the extracted dataset. It is not a statement that no law applies.” |

If the real demo cannot continue, switch to Track B out loud: “The next part is a synthetic
rehearsal on fictional data. None of it is real law.” Then choose “Synthetic demo” in the
header and check that the dark banner is showing before going on.

## Track B — synthetic rehearsal and backup

Open with `npm run dev:demo`, or add `?mode=demo` to the address (`#/lookup?mode=demo`). The
state “ZZ”, its cities, their ordinances and the properties are fictional. The dark “Synthetic
demo” banner and the tag “Synthetic data · not actual law” stay on screen.

The start page has “Start with an example” with three cards. Each opens in one click, and
“Restart demo” in the header returns to this page with nothing carried over.

| # | Time | Do | What the recording shows (fictional) | The limitation, said aloud |
| --- | --- | --- | --- | --- |
| 1 | 0:00–0:20 | Point at the banner and the three cards. | The cards describe their own recordings: “One question about this property can change 2 of its 3 results”, “11 sample properties are definitely affected and 10 are uncertain”, “4 claim comparisons … 2 state different things”. | “This is fictional data, replayed from recordings. Nothing here is real law, and nothing is evaluated in the browser.” |
| 2 | 0:20–0:50 | Card 1, “One fact that changes the answer”. Scroll to “Rules for this property on Dec 15, 2026”. | 19 Birch Court, as of Dec 15, 2026: “3 rules returned”, 2 “Unknown”, 1 “Not yet effective”; “3 open items need evidence or review, not an answer”; “Next: Answer one question about the property.” | “Unknown is a result, not an error.” |
| 3 | 0:50–1:30 | “Go to the question”. Type `6`. “Apply answer”. | “Re-evaluated with your answers”: the fictional deposit cap goes “Unknown” → “Applies”; the fictional just-cause rule stays “Unknown” with “Still unknown: Date uncertain …”; the third rule shows “No change”. “Your answers” lists “Units 6 · You provided · unverified · Applied”. | “The answer is mine and unverified. One rule moved. The other did not, because its source states only a month for its effective date, and no answer of mine can fix that.” |
| 4 | 1:30–1:55 | “Evidence” on the deposit cap. “Source text”, then “Checks”. Escape. | The quote beginning “Beginning November 1, 2026 …” with “characters 154–292”; six separate checks, with “Citation anchor” and “Semantic support” reading “Not checked”. | “The words are in the source. Whether they support the rule is a separate check, and here it has not been done.” |
| 5 | 1:55–2:15 | Scroll to “What remains uncertain”; open one “All *N* statements from the service”. Then “Keep this result”. | Three topics that need a source, interpretation review or more analysis. Under “Evidence package”: “Not available in the synthetic demo: the package is built by the live service …”. “Download working export (JSON)” works. | “The demo has no evidence package, and says so. The working export is a different file: no source texts, no hashes.” |
| 6 | 2:15–3:05 | “Restart demo”. Card 2, “What changes across the portfolio”. Scroll to “Impact on sample properties”. Open one row under “By property”. | Oct 1, 2026 → Jan 15, 2027, tagged “Partial”: 11 “Definitely affected”, 10 “Uncertain”, 10 “Conflict flagged”. A row shows “Before · Oct 1, 2026” and “After · Jan 15, 2027”. The “Timeline” tab shows “Dec 2026” marked “month only”. | “The lists overlap and do not add up. This comparison is partial, and it says so.” |
| 7 | 3:05–3:50 | “Restart demo”. Card 3, “Two sources, side by side”. Read the first card. | “The two claims differ”: an ordinance says Nov 1, 2026 and a clerk’s notice says Dec 1, 2026 for the same effective date. Tags “Unresolved”, “No source is preferred”, “Meaning not checked”. | “Both texts are shown. Nothing here picks one, and a difference between texts is not yet a legal conflict.” |
| 8 | 3:50–4:00 | “Restart demo”. | The start page, with no property, answers or results. | |

Optional, if asked about conflicts inside a lookup: under “Compare sources”, in “Recorded
lookups with a conflict flag”, open “25 Dune Lane · as of Jan 15, 2027”. “Conflicts flagged by
the evaluator” shows two records of one fictional provision that state $50 and $35.

The values in this table are what the recordings contain; the acceptance tests in
`tests/e2e/hackathon-*.spec.ts` read the same recordings and fail if the screen says anything
else. If a recording is re-made, re-check this table against the screen.

The numbered frames and recording in `docs/demo-backup/` were regenerated on the integrated
native build. They show an alternative synthetic rehearsal: DEV-P08 on Jan 15, 2027, answering
the owner-occupancy question with “No” and showing that the source conflict stays unknown,
then the same portfolio, source review and working-export features. They do not depict the
DEV-P04 units-answer example in the table above. See that folder's README before presenting.

## Status of the rough edges this script was first checked against

This script was written against the checkpoint build. The five workarounds it listed are no
longer needed in the merged build: the result and the portfolio totals now scroll into the
first window after a one-click example (F1, F2), the question card counts only the results
listed above it (F7), an answered value in the property header carries a "Your answer ·
unverified, not on record" tag (F3), and the evidence sheet carries its own "Synthetic data ·
not actual law" tag (F6). Each has an active regression test in `tests/e2e/hackathon-*.spec.ts`.
The final native verification and current limitations are recorded in `NATIVE_UX_REVIEW.md`.
Rehearse the chosen real snapshot before presenting; synthetic and mocked-route checks do
not fill in the real-example acceptance table above.

## Words to keep, and words to avoid

- Say “applies”, “not yet determinable”, “unknown”, “uncertain”, “blocked”, “partial”,
  “hypothetical”, “unverified answer”.
- Do not say “compliant”, “violation”, “the law is”, “confidence”, “verified”, “the correct
  source”, or “no rules apply” for a result that is blocked, failed, partial or empty.
- A hypothetical (“if enacted”, or an alternative under “What each answer would mean”) is
  never described as upcoming law or as a fact about the property.
- A model review is never described as a legal or human review.
- A difference between two texts is a difference between two texts until someone decides
  otherwise. Neither source is “right”.
- Fictional data is called fictional every time it is on screen.
