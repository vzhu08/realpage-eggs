# TENENT live pitch

**Three minutes, including a 60-second live demonstration.** The deck contains six slides. Its speaker notes include the script, actions and source citations.

## 0:00–0:15 — Slide 1

“City and state rental rules overlap and change on different dates. TENENT helps a property team investigate which rules might govern one building, why, and which missing fact matters next.”

## 0:15–0:35 — Slide 2

“Imagine your team researching one building today. A state rule may apply, a city rule may add another condition, and a proposal may not yet be law. TENENT brings the property, date and source together in one research workflow.”

## 0:35–1:00 — Slide 3

“These two interface examples use fictional demo data. TENENT asks the next useful question and explains which results your answer could change. Answer it, or say ‘I don’t know.’ The evaluator updates the same research result and keeps the remaining unknowns visible, so you can focus on the fact that matters next.”

## 1:00–1:20 — Slide 4

“Then open the evidence behind a result. TENENT keeps the original quote, its exact location and the review checks together. A researcher can inspect the interpretation and follow up on an open issue without losing the source that started the investigation.”

## 1:20–1:40 — Slide 5

“TENENT also compares dates and supports a clearly labeled ‘if enacted’ scenario. A proposal stays pending in the actual record. For portfolio questions, the system separates definite impacts from uncertain ones, so an incomplete result does not disappear into a confident total.”

## 1:40–1:50 — Slide 6, then switch to the application

“Now I’ll show one property, the next useful question and the evidence behind a result.”

## 1:50–2:50 — Live demonstration

| Time within demo | Action | Suggested narration |
| --- | --- | --- |
| 0–12 seconds | Open the prepared property/date result. | “This starts with a property and an explicit date. The result keeps unknowns visible.” |
| 12–30 seconds | Answer the current useful question. Label the answer as hypothetical. | “I’ll use a hypothetical answer to show how it changes the analysis, without claiming that answer is verified.” |
| 30–45 seconds | Point out the actual change and the remaining open issue. | Say what the current screen shows. If nothing becomes definitive, say so. |
| 45–60 seconds | Open Evidence and show an original source quote. | “And here is the exact source quote behind this result.” |

## 2:50–3:00 — Return to slide 6

“TENENT helps a researcher see what applies, what might change and what still needs evidence. This remains a research prototype with partial coverage, not legal advice.”

## Before presenting

- Rehearse against the exact running snapshot. The documented prepared starting point is **A0001, October 1, 2026**. Open the [prepared live lookup](https://realpage-navigator.onrender.com/?preload=1#/lookup?mode=live&address=A0001&as_of=2026-10-01), wait for preparation and confirm the result before going on stage.
- Confirm that the screen uses **Live API**, the chosen property/date, and the intended snapshot. A repaired dataset can change which question appears. Follow the displayed question, rather than forcing an older owner-occupancy script.
- Keep the demo within the prepared lookup flow. Do not launch an unrehearsed portfolio comparison during the three-minute pitch.
- Slides 3 and 4 use historical **fictional demo screenshots**. They illustrate interface behavior, not real properties or legal conclusions. Their on-slide labels must remain visible.
- If the live service cannot run, say: “The live service is unavailable, so I’ll show the same interaction on labeled fictional data.” Use slides 3 and 4 as the backup. Do not describe them as live results.

## Useful judge answers

**What is different from a legal search or chat answer?**

“The result is tied to a property, date, executable rule conditions and exact captured evidence. TENENT can show the next useful missing fact and reevaluate the same record, while retaining source and interpretation gaps.”

**Is this legally verified or ready for production?**

“No. It is a research prototype. We separate source identity, quote matching, semantic review and unresolved dependencies. The full dataset-readiness gate still reports partial results.”

**Did all five competition cases pass?**

“No. Passing software tests is separate from establishing the evidence and property outcomes for every case. We retain the incomplete-case diagnostics.”

**Are the screenshots real law?**

“No. Those two slides explicitly show fictional demonstration data. The live view uses the selected research snapshot and discloses its own limits.”

## Sources

Source snapshot for this deck: [repository commit 45f8ccf](https://github.com/vzhu08/realpage-eggs/commit/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5), inspected October 4, 2026. Repair work may advance independently.

- Product behavior: [docs/CONTRACTS.md](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/docs/CONTRACTS.md), [docs/ASSIST_CONTRACT.md](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/docs/ASSIST_CONTRACT.md), [navigator/engine.py](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/navigator/engine.py), [navigator/changes.py](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/navigator/changes.py), [navigator/evidence.py](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/navigator/evidence.py), [navigator/question_planner.py](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/navigator/question_planner.py).
- Live rehearsal and limitations: [docs/ASSIST_DEMO.md](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/docs/ASSIST_DEMO.md), [config/demo_requests.json](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/config/demo_requests.json), [frontend/docs/DEMO_SCRIPT.md](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/frontend/docs/DEMO_SCRIPT.md).
- Screenshot provenance: [frontend/docs/demo-backup/README.md](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/frontend/docs/demo-backup/README.md), [frontend/docs/TENENT_PREVIEW.txt](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/frontend/docs/TENENT_PREVIEW.txt).
- Brand assets: [frontend/src/styles/tokens.css](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/frontend/src/styles/tokens.css), [frontend/public/assets/tenent-architecture.png](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/frontend/public/assets/tenent-architecture.png), [frontend/public/assets/brand/tenent-mark-light.svg](https://github.com/vzhu08/realpage-eggs/blob/45f8ccf1b555102fb623eeda8bcaffd48d17ffa5/frontend/public/assets/brand/tenent-mark-light.svg).

Full source links appear in the corresponding slide’s notes. This pitch makes no claims about traction, revenue, all-case completion, independent legal accuracy or general performance benchmarks.
