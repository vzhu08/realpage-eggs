# Demo and submission

Current real evidence path: ingest pack -> list A0001 (Los Angeles), A0002 (Hoboken), A0003 (Newark)
with cached Census evidence. A0003 demonstrates a misleading ZIP handled by an evidenced retry.
A0009 demonstrates unresolved geography. Source D001 opens with the original text, URL and retrieval.
Real legal lookup currently returns 503 because no provider is configured. Do not present it as finished legal analysis.

Current **synthetic software demo**: build `data/synthetic`, query SYNTH-001 at 2026-11-14 and 2026-11-15;
show future -> applies; SYNTH-002 is excluded by 2 units; SYNTH-003 is unknown because units are absent.
Compare those dates: one definite impact, one uncertain impact. Show exact quoted spans and source offsets.
The fictional Maple Harbor ordinance is independently authored test data, not T6 or a real extraction.

After CORE-01: select a real source-supported state/local overlap (candidate A0001 or an actually resolved
SF property), a meaningful unknown from missing owner/occupancy facts, and T1/T3 date change with citations.
Verify each candidate against generated rules before adding it to the judge path. No real-law overlap is verified yet.

| Material | Reduced pack | Fuller Downloads PDF |
| --- | --- | --- |
| rules.json, lookups.json, changes.json | Required | Required |
| Live demo and reproducible method | Live demo + one-page method note | Runnable repo/README + live demo URL |
| Change evidence | T1–T5 | T1–T6, hour-16 ordinance |
| Videos | Not specified in reduced pack | Team, demo, technical videos |
| Official score | No scorer/key supplied | Run score.py and show full dev score |

Organizer confirmation is needed; question has not been sent. No official score exists for this build.
Internal validation is not the official scorer. Current partial output is unsuitable as a final legal submission.

Known-good local behavior: recorded in EVALUATION/HANDOFF. Known-good deployment: **none**.
No deployment or submission has been made. Preserve a known-good commit before authorized deployment.
Backup plan: record the final real-data demo and its run manifest, including disclosed cached/replay behavior;
keep the synthetic walkthrough clearly separate and use it only if allowed.

Final checklist for the human coordinator: confirm organizer version/logistics/licensing; run fresh-session
demo on deployed build; verify credentials/failure states/claims; compare deployed commit to reviewed code;
prepare required JSON/method note/videos; start upload by Oct 4 08:15 ET; submit with authority and verify receipt.
