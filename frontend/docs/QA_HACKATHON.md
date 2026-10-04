# Hackathon QA audit: the judge journey

An independent pass over the journey a judge will take: start page, one property and date,
the useful question, the evidence, what stays uncertain, the portfolio, two sources side by
side, keeping the result, and restart.

**What this audit is, and is not.** Everything here was run against recordings (the synthetic
demo) or against routes mocked in the browser with contract examples. No real backend was
reachable from where it ran, and the build was made with a stand-in toolchain (below). The
last section lists the checks that still have to be run against the actual API.

| | |
| --- | --- |
| Date | October 4, 2026 |
| Build audited | Checkpoint commit `2de026f` on branch `ux/polish-qa` (base `6b57710`) |
| Viewports | 1512×744 and 1440×900 (desktop), Pixel 7 emulation (412×839), and 390×844 |
| Browser | Chromium, through Playwright |
| Status of the build | Mid-redesign: styles outside the lookup page and the integrations were still being finished by other lanes. Findings are split into behaviour or content defects and visual rough edges. |

## What was run

The npm registry is not reachable in the cloud container, so Vite and the project’s own
`node_modules` could not be installed there. `npm run verify`, `npm run build` and
`npm run test:e2e` were **not** run. The stand-ins: the real `tsc` with the project’s
`tsconfig.json`, an esbuild bundle of the same entry point and sources, a static server that
answers `/api/*` with an empty HTTP 500, and the project’s Playwright configuration pointed at
that server (`E2E_BASE_URL`).

| Command (from `frontend/`) | Result |
| --- | --- |
| `node scripts/generate-contract-types.mjs --check` | Pass: “Generated contract files match contracts/ (digest 3a71126e3e2733d4, 51 models).” |
| `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` | 8 errors, none in the files of this audit. 6 are in `tests/unit/portfolio.test.ts` (it imports `DEV_PROPOSED_DISAGREEMENTS` and `disagreementFromProposed`, which the checkpoint removed, and builds `Filters` without `jurisdiction`); 2 are in `tests/unit/uncertainty-rendering.test.ts` and come from the container’s React type shims. |
| `tsx --test tests/unit/*.test.ts` | 98 pass, 1 fail: `tests/unit/portfolio.test.ts` does not load, for the reason above. |
| `ROOT=… PORT=4183 e2e.sh tests/e2e/hackathon-*.spec.ts --workers=2` | **desktop:** 45 passed, 12 fixme, 0 failed. **mobile:** 45 passed, 12 fixme, 0 failed. |
| The same with `QA_RUN_DEFECTS=1 … -g DEFECT` | **desktop:** 11 failed, 1 skipped (a phone-only defect). **mobile:** 12 failed. Each fails for the reason in its title. |
| `ROOT=… PORT=4183 e2e.sh --workers=2` (whole suite) | Not completed: stopped at the 10-minute limit while still in the desktop project. Up to that point 37 pre-existing tests had failed (`demo-journey` 11, `portfolio` 8, `live-states` 6, `disagreements` 4, `lookup-races` 4, `accessibility` 3, `changes` 1). They were written for the previous layout and belong to the integrator. |
| `seg.mjs` screenshots at 1512×744 and at phone width, plus scripted measurements of where the result starts | Inspected; file names are in the findings table. They are in the session’s scratch `shots/` directory, not in the repository. |

`e2e.sh`, `build.mjs`, `serve.mjs` and `seg.mjs` are container-only scripts and are not part
of the repository.

## The acceptance tests

Five specs and one helper, all new files under `tests/e2e/`. Each test runs on both Playwright
projects (desktop 1440×900 and Pixel 7).

| File | What it covers | Data |
| --- | --- | --- |
| `hackathon-journey.spec.ts` | Steps 1–5, 8, 9: start page, result, question and answer, evidence dialog, remaining uncertainty, keep, restart, and the labels that must stay on screen | Recordings |
| `hackathon-portfolio.spec.ts` | Step 6: totals, groups, property view, source → rule → property, timeline, blocked, not recorded | Recordings |
| `hackathon-compare.spec.ts` | Step 7: claim observations, evaluator conflicts reached from a lookup, no conflict | Recordings |
| `hackathon-live.spec.ts` | Live mode: evidence-package download and its failures, slow and cancelled comparison, `/changes` fallback, blocked, errors, `GET /source-comparisons` available, unavailable and failing, lookup loading, empty, partial and error, no backend | Mocked routes built from `contracts/examples` and `contracts/evidence_examples` |
| `hackathon-access.spec.ts` | Keyboard-only pass, dialogs, stale requests, 390 px wrapping | Recordings and mocked routes |
| `hackathon-helpers.ts` | Reads the recordings and contract examples, the mocked API, small page helpers | |

Expected values are read from the recording or contract example that the screen is showing,
not typed into the test: the counts are the lengths of the recorded lists, the before → after
rows are the evaluator output recorded for the alternative that contains the typed answer, the
statements are the plan’s recorded statements, and so on.

**Defect tests.** A test whose title starts with `DEFECT:` documents a defect in the audited
build. It is `fixme` by default, with the reproduction in its title and in the comment above
it. `QA_RUN_DEFECTS=1` runs them: each must fail while its defect exists and pass once it is
fixed. When one passes, change `defect(` to `test(` in that spec.

    QA_RUN_DEFECTS=1 npx playwright test hackathon -g DEFECT --workers=2

## Findings

Severity: **blocker** stops the journey; **major** misleads a judge, breaks an honesty rule or
an accessibility guarantee; **minor** is friction or polish. Owner lanes: **A** visual (styles,
shell, property), **B** integrations (API, demo, compare, keep, export), **I** integrator.
No blocker was found.

| # | Sev. | Owner | Reproduction | Expected | Actual | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | major | I (`features/lookup/LookupView.tsx`; A if the header is shortened) | `#/lookup?mode=demo` → click the first example card. | The result leads: counts by status, what is unresolved and “Go to the question” are in the first window. | The page stays at the top with the property header and the date form filling the window. At 1440×900 the counts start at y≈737 and “Go to the question” at y≈934; at 1512×744 the result card starts at y≈670 and its counts and action are below the fold; on a Pixel 7 the card starts at y≈1161 of 839. | `qa-ex1-0.jpg`, `qa-m-ex1-0.jpg`; test “after the one-click example the counts…” |
| F2 | major | I (`features/changes/ChangesView.tsx`) | `#/lookup?mode=demo` → click the second example card (or open `#/changes?mode=demo&before=2026-10-01&after=2027-01-15`). | Totals first. | The window shows the form and the list of recorded comparisons. The totals start ≈1,316 px down on desktop and ≈2,000 px down on a Pixel 7, and the page does not scroll to them. | `qa-chg-0.jpg`, `qa-chg-1.jpg`; test “the one-click portfolio example shows its totals…” |
| F3 | major | A (`features/property/PropertySummary.tsx`) | Live mode against a contract-true service (not reproducible in the demo replay): SYNTH-003, as of 2026-11-15, answer units = 8. | A request-local, unverified answer is never shown as a recorded fact. | The service echoes the answer into `lookup.address.facts` (see `contracts/evidence_examples/property_package.json`), and the property header shows “Units 8” as a plain cell beside “Residential Yes”. Its provenance is only inside the collapsed “Property record”. | `qa-live-answered-top.png`; test “a request-local answer echoed into the property facts is labeled…” |
| F4 | major | B (`features/lookup/KeepResult.tsx`, `lib/exportPackage.ts`) | Answer the question, change “As of date” without running the lookup, press “Download working export (JSON)”. Demo: example 1. Live: SYNTH-003, units = 8. | The export lists the answer its results depend on, as a request-local answer. | The date change clears the session’s answers but the answered result stays on screen. The export then has `request_answers.answers: []` with the answered evaluations, and in live mode it lists `units: 8` under `stored_facts.facts`. | tests “a working export of a result that depends on an answer…” and “a working export never lists a request-local answer as a stored fact” |
| F5 | major (accessibility) | I (`components/usePanelFocus.ts`) | Example 1 → “Change property” → press Tab 19 times. | Focus stays inside the modal chooser. | Focus leaves the dialog for the page behind the scrim (“Skip to content”, “Switch to live API”, …). The trap takes the last match of its selector as the end of the cycle; that match is a button inside the closed “Contract examples” disclosure, which cannot take focus, so Tab on the real last stop is never wrapped. The evidence dialog is not affected in the recordings (its closed disclosures hold no controls). | test “Tab stays inside the modal property chooser” |
| F6 | major | A (styles) or I (`features/evidence/EvidencePanel.tsx`) | Pixel 7 or any window up to 860 px → example 1 → “Evidence” on a rule. | A synthetic label stays in view. | The evidence sheet covers the whole window, including the synthetic banner, and shows the quoted text with no synthetic label in view. The only one inside the sheet is in the collapsed “Rule record” (“Synthetic fixture, not actual law”). On desktop the banner’s tag stays visible beside the drawer. | `qa-m-ev-0.jpg`; test “with the evidence sheet open on a phone a synthetic label is still in the window” |
| F7 | major | I (`features/questions/QuestionCard.tsx`, `considered`) | Example 1 → read the question card. | The same count as the rest of the page: 2 of 3. | “Depending on the answer, 2 of 6 results can change.” under “3 rules returned”; the start card said “2 of its 3 results”. The 6 counts every evaluation inside the alternatives, including three rules that are not in this result. | `qa-ex1-1.jpg`; test “the question’s ‘N of M results can change’…” |
| F8 | minor | I (`QuestionCard.tsx`) | Example 1 → question heading. | The unit once. | “Number of dwelling units in this building (dwelling units)?” | `qa-ex1-1.jpg`; test “the question heading does not repeat the unit…” |
| F9 | minor | I (`features/questions/QuestionsPanel.tsx`) | Example 1 → answer the question. Same in live mode. | The section says the question has been answered. | “Useful questions 0 … Nothing to ask: the plan found no missing property fact that could change a result.” directly under “Re-evaluated with your answers”. | test “after the only question is answered…” |
| F10 | minor | A (shell styles) | Any view at 390 px. | All three view links are in the window, or the strip shows that it scrolls. | “Compare sources” is cut off at the right edge (“Compare sou”). | `qa-m-start-0.jpg`; test “at 390px all three view links…” |
| F11 | minor | A (styles) | 390 px, live mode, a rule title, citation, street address or statement containing one long unbroken token (192 characters in the test; a long URL behaves the same). | The token wraps. | The chooser row, the property title, the “Affects” link in the question card and the evidence dialog title do not break inside the token. The card grows to ≈1,580 px and is clipped; with disclosures open the page scrolls sideways by ≈975 px and the evidence dialog by ≈2,000 px. Hashes and IDs already wrap. | test “a long unbroken token in a title, address or statement wraps…” |
| F12 | minor | A (styles) | “Compare sources” → any card → “What was checked”. | A gap between the label and its sentence. | “First claimEvery passage was found…”, “MeaningNot checked.”, “PrecedenceNone selected.” run together. | `qa-cmp-1.jpg` |
| F13 | minor | A (shell) | Pixel 7, any view. | Content starts near the top. | The banner, brand, restart, mode switch, status button, view links and disclaimer take about 270 of 839 px before any content. This adds to F1. | `qa-m-start-0.jpg` |
| F14 | minor | A (styles) | “Portfolio changes” at desktop width. | Space between the button and its hint. | “Compare” touches “The first date starts at the contract default…”. | `qa-chg-0.jpg` |
| F15 | minor | B (`features/disagreements/ComparisonCard.tsx`) | “Compare sources” → first card → second claim → “Source”. | One label. | “Secondary · secondary”: the authority and the source type are the same word, shown twice. | `qa-cmp-1.jpg` |
| F16 | minor | I (`state/session.ts`, `features/lookup/Results.tsx`) | Example 1 → answer → change “As of date” without running. | The result on screen still says which answer it rests on. | “Your answers” disappears while the answered result stays, under “These results are for Dec 15, 2026”. Only the “Keep this result” line still says “1 request-local answer”. Root of F4. | test “changing the date clears the answers…” passes and describes the current behaviour |
| F17 | minor | I (`lib/openItems.ts`) | Example 1 → “What remains uncertain” → open everything. | Each statement once. | 15 statements for the recording’s 14. The evaluator’s reason “date precision or lifecycle history insufficient” is listed again as its own statement, because the plan’s wording of it starts with “As of 2026-12-15: temporal_uncertainty:” and does not match exactly. Nothing is lost. | `qa-ex1-3.jpg` |
| F18 | minor | I (`features/changes/PortfolioDrillDown.tsx`) | Portfolio example → “By source and rule”. | Sources that can be told apart by name. | Two sources are both titled “Official legal text” and differ only by document ID. | `qa-src-4.jpg` |
| F19 | minor | I (`features/property/PropertyFinder.tsx`) | Live mode, `GET /addresses` returns a street address longer than the contract’s 200 characters. | The failing field is named, as other contract errors do. | “The response does not match the AddressPage contract, so it is not shown.” with no path. | Seen while building a test double |

Not a defect, for the record: following a link to `#/lookup` with a property already open keeps
that property (the brand link and “Property lookup” do not return to the start page). “Restart
demo” and “Start over” do, and that is tested.

## What passed

On both projects, in the audited build:

1. **Start page.** Banner and disclaimer visible; three cards whose sentences equal counts taken
   from the recordings they open; property chooser below.
2. **Result.** Property, date, synthetic tag and disclaimer in the result context; one count per
   status equal to the recorded evaluations; an “unresolved” list; the next action; the stored
   record collapsed; no dialog opens by itself. An unresolved municipality stays visible in the
   header, the result context and the unresolved list, and the postal city is not used in its
   place.
3. **Question.** Heading from the fact definition; a numeric text field for an integer fact;
   “I don’t know”; hypotheticals only behind “What each answer would mean”; after a typed value
   inside a recorded interval, every before → after row equals the evaluator output recorded for
   that interval; a result that stays unknown says why; the answer is labeled “You provided ·
   unverified” with the replay’s provenance; edit and remove work; changing the date clears the
   answers and the next lookup carries none.
4. **Evidence.** Opens only on request; every recorded quote exactly, with offsets and document
   ID; six separate checks with the recorded statuses and messages; no score, percentage or
   “confidence”; Escape closes it and returns focus to the button that opened it.
5. **Remaining uncertainty.** Fewer topics than statements; every recorded statement, remedy,
   rule ID, source quote and hash is present once the disclosures are open; hashes are not on
   the reading path before that.
6. **Portfolio.** Totals equal the three recorded lists; the overlap is stated; “Partial” with
   the comparison’s notes; groups equal the recorded summary groups with definite and uncertain
   in separate columns; one row per recorded difference, each with the comparison’s own
   certainty; before and after explanations and quotes; source → rule → property and the
   timeline as secondary tabs; a month-only date is marked “month only”; a blocked scenario
   shows “—”, never 0; a comparison with no recording is refused.
7. **Compare sources.** One card per recorded observation with both exact texts, offsets,
   authority, retrieval time, classification, “No source is preferred”, “Meaning not checked”
   and the service’s remedy; hashes in a disclosure; no ranking words. Evaluator conflicts are
   reached from the lookup’s “Compare the conflicting sources”; a property with no flag says so
   without claiming the sources agree.
8. **Keep this result.** Demo: says the package is built by the live service and offers no
   package button; the working export downloads, says it is not the package and carries none of
   its hashes. Mocked live: one `POST /lookup/evidence-package` with the displayed property,
   date and the answer with its provenance; the file is the response byte for byte, named from
   `Content-Disposition`; a package that arrives after the result changed, or after Cancel, is
   not saved; a package for a different request is refused; failures say nothing was saved.
9. **Restart.** Returns to the start page from the lookup and from another view, with no
   property, answers or results carried over.

Also: the whole journey from the keyboard with visible focus; the property chooser and status
panel close with Escape and return focus; tabs work with arrow keys; a late lookup response
does not overwrite a newer date, property or unanswered state; a slow comparison shows elapsed
seconds and a working Cancel with no progress bar; live mode with no backend shows the failure
and never falls back to recordings; and at 390 px no step of the journey scrolls sideways with
everything expanded, including long titles made of ordinary words, a 200-character address and
64-character hashes.

## Fixture checks versus actual API checks

**Everything above is a fixture check.** Demo-mode tests replay
`src/demo/recorded/*.json` and `contracts/`. Live-mode tests intercept `/api/v1` in the browser
and answer from `contracts/examples/*.json` and `contracts/evidence_examples/*.json`; their
titles say “mocked live API (fixture check)”. They show what the interface does with
contract-shaped responses, delays and failures. They do not show that the real service returns
those shapes, that real data lays out well, or how long anything takes.

Not checked here at all: the real toolchain, the real backend, real data, real timings, a real
phone, Safari and Firefox.

### To run on the Mac

From the validation checkout, after the integrated branch has been synced into it.

1. **Toolchain.**

       cd frontend
       npm ci
       npm run verify
       npm run test:e2e -- --workers=2
       QA_RUN_DEFECTS=1 npx playwright test hackathon -g DEFECT --workers=2

   `npm run verify` is the contract check, typecheck, unit tests and build. `test:e2e` builds
   and serves the app itself and needs no backend: its live tests are mocked. Report the counts
   per project, and which `DEFECT` tests now pass.

2. **Backend.** Either use the instance the coordinator reports on `127.0.0.1:8014`, or start
   one from the repository root as the README and `docs/PLATFORM_RUNBOOK.md` describe:

       .venv/bin/python -m uvicorn navigator.api:app --host 127.0.0.1 --port 8000
       # or an explicit snapshot:
       .venv/bin/python scripts/platform_ops.py serve --data-dir <snapshot> --port 8000

       curl -s http://127.0.0.1:8014/api/v1/health

   Then run the frontend against it, on one origin:

       cd frontend
       NAVIGATOR_API_ORIGIN=http://127.0.0.1:8014 npm run dev
       # open http://localhost:5173/#/lookup?mode=live

   Confirm there is no “Synthetic demo” banner and that the status button and its panel show the
   counts `/health` returns.

3. **Manual script against the actual API.** Keep the browser’s network panel open.

   | # | Do | Check |
   | --- | --- | --- |
   | 1 | Choose a property, set a date, “Run lookup”. | One `POST /api/v1/lookup/assist`. Counts by status equal the response’s evaluations. No “fields that are not in the checked-in contract” notice under “About this result”. |
   | 2 | Answer the “Most useful question”. Try a yes/no fact too (`owner_occupied`), since the tests here only cover an integer. | The request resends every answer. The control matches the fact type (Yes/No for a boolean). “Re-evaluated with your answers” matches the response. Then look at the property header: this is where F3 appears. |
   | 3 | “Download evidence package”. | Request body is `address_id`, the displayed `as_of`, and every answer with `provenance: "user_provided"` (a boolean answer is a JSON `true`). The saved file is named `evidence-package-<first 12 characters of package_sha256>.json`. Its `request` echoes the same property, date and answers, and `response.answers_applied` keeps the provenance. The receipt shows the label (`RESEARCH_EVIDENCE_NOT_LEGAL_VALIDATION` on real data). |
   | 4 | Replay the saved file. | `.venv/bin/python -m navigator replay-evidence-package <file>` succeeds. |
   | 5 | Press “Download evidence package”, and at once remove the answer under “Your answers”. | No file is saved for the withdrawn request. |
   | 6 | The same request by hand, to compare. | `curl -s -D - -o package.json -X POST http://127.0.0.1:8014/api/v1/lookup/evidence-package -H 'Content-Type: application/json' -d '{"address_id":"<ID>","as_of":"<DATE>","answers":[{"field":"owner_occupied","value":true,"provenance":"user_provided"}]}'` returns `Content-Disposition: attachment; filename="evidence-package-….json"` and the same `package_sha256` as the browser’s file for the same request. |
   | 7 | “Compare sources”. | One `GET /api/v1/source-comparisons`. If `status` is `available`, the number of cards equals `curl -s …/source-comparisons \| jq '.observations \| length'`, and both texts, authorities and retrieval dates on one card equal the response. If `unavailable`, the page says “No claim comparisons are saved with this snapshot” and shows the service’s notes. |
   | 8 | “Portfolio changes” with a published scenario or dates that have a prepared result. | One `POST /api/v1/changes/summary`. The three totals equal the lengths of the response’s lists; the groups equal `by_jurisdiction` and `by_category`. Note the time it took. |
   | 9 | “Portfolio changes” with two dates that have **no** prepared result (a cache miss). | The wait shows “Comparing… *N* s” counting past 20 s with no error (the interface waits 180 s for this route). The result then appears. Note the total time, and whether the Vite proxy or the release server ends the request first. |
   | 10 | The same cache miss, and press “Cancel” after about 10 s; then run a lookup. | The wait disappears with no error and no result. Note how long the lookup takes while the abandoned comparison is still being computed by the server. |
   | 11 | A comparison that is blocked on the real snapshot, if there is one. | “Blocked: this comparison could not be established”, “—” for the counts, the service’s notes. |
   | 12 | A property whose municipality is not resolved. | “Legal municipality not established” stays on the page; local rules are not reported as settled. |
   | 13 | Stop the backend and reload. | “The service could not be reached”, no banner, no example cards, no recorded data. |

   The `/changes` fallback for a backend without `/changes/summary` cannot be exercised on a
   backend that has the route; it stays a fixture check.

4. **Sizes.** Repeat steps 1–3 and 7–8 of the script at 1512×744 and in the device toolbar at
   390×844, on real data: long real titles, citations and URLs are the case F11 is about.
