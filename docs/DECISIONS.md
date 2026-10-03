# Decisions and unresolved questions

| Evidence | Decision / next action | Owner |
| --- | --- | --- |
| Empty repo at 0066cb3fd2378aaa35df88373ce7d48141ee056f | FastAPI + Pydantic + atomic JSON, pytest; no frontend | Bootstrap/user |
| Pack README and included PDF p2/p6 specify T1–T5, no surprise release, method note | Implement those definitions; generic supplementary document ingestion supports a later T6 | Platform |
| Downloads/file (7).pdf p4–6 describes T6, dev key, score.py, three videos, 75 automated points | Ask organizers which version governs and where scorer/key/T6 are; no official scorer/key in supplied files. Weights provisional | User/coordinator; question prepared, not sent |
| 87 manifest entries; 54 files, 23 link-only, 9 terms-review, one failed capture D056 | Preserve missingness. No publisher scraping. Prioritize missing NJ state statutes/local Newark text and MA failed-proposal status evidence after provider setup | Core |
| All 54 delivered file byte hashes differ from declared manifest hashes | Retain both; offsets bind to actual delivered text. Organizer should clarify hash basis; do not call this proof of corruption | Platform |
| No OPENAI_API_KEY/OPENAI_MODEL or local .env | User selected OpenAI. Configure locally; explicit model selection, no hidden billable default. No live extraction claim | User / Core |
| Exact quotes alone do not establish semantics | Separate model review and field support checks; unresolved issues stay visible. Independent human spot review still needed after live extraction | Core |
| Legal overlap/version ambiguity | Explicit directed interactions only; overlapping contradictory versions/cycles flagged. No automatic later-retrieval precedence | Core |
| Census geographic API supports named layers | Use legal incorporated places/active legal subdivisions, never CDPs/postal city; save benchmark/vintage/cache payloads | Platform |
| 21 addresses remain unresolved after first complete run | Keep state answers and uncertain local candidates; review ordinal streets, ambiguous matches, fractional/compound addresses without guessing | Platform |
| No published scoring treatment of potentially affected IDs | Required changes export uses definite IDs; companion retains uncertainty. Confirm union/intersection semantics with organizers | User/coordinator |
| Source gaps and missing provider output | Partial export requires explicit flag; blocked T5 is not a verified negative finding | Platform |
| No deployment requested/authorized | Local service only; deployment decision and merge authority remain with user | User |

Integration references consulted for implementation:
[OpenAI JSON output](https://developers.openai.com/api/docs/guides/structured-outputs),
[Census geocoding API](https://geocoding.geo.census.gov/geocoder/Geocoding_Services_API.html),
[Census TIGER layers](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Current/MapServer/layers).
These establish API behavior, not legal interpretations.

## Follow-up provenance and decisions

Retained FastAPI, atomic JSON, the bounded Expression AST, original evaluator, extraction provider
boundary and competition projections. No graph/vector database, second evaluator or generated code.
Input validation and evidence services are separate Platform modules; Core extraction ownership stays intact.

No third-party source code was copied or vendored. Retrieval uses an independently written standard
TF-IDF/cosine implementation over all source units, retaining exact original offsets. No licensing
assumption or architectural dependency on the supplied upstream projects is needed.

The supplied research document identifies Citrus at dcab7bbc3cc8f23f043368db3d1b1359b81478a2 as a
retrieval-pattern candidate, ClauseWise at a414468a1f2e672bf59c645a3799083d8b971dc6 as inventory/renderer
inspiration, and Know Your Rights at 8945d487e901e9db34c4aaf5b0a110ea06b94bee as targeted-question UI
inspiration. These are attributed findings from the supplied research, not a new runtime or license audit.
The reported ClauseWise award identity remains uncertain; no verified public Tracy engine was imported.
Attempts to fetch the pinned upstream pages through the web tool did not return source. Since no code
was imported, work continued independently without asserting license verification.

Rejected policies: semantic support from lexical score, fabrication from corpus absence, chunk-prefix
truncation, generated eval formulas and exceptions silently becoming false/zero. Quote, source identity,
section anchor, semantic support and dependency gaps are machine-readable independent checks.
References are recognized by a bounded explicit-reference parser; unrecognized legal dependencies may
remain. A structural inventory is a coverage-review aid, not complete or human-reviewed law mapping.

The CLI semantic verifier reuses Core's OpenAIProvider transport with a task-specific review instruction;
no new provider dependency or API endpoint. It permits one schema/span repair (two generation attempts;
each uses the provider's existing bounded transport retries). Results record live/fixture/replay,
rule/source/verifier versions, exact spans, model metadata and remaining gaps. A verifier cannot remove
structural failures or turn missing references into support. Model assessment is not independent accuracy.

## User-requested four-developer revision and Git repair

Core is split by stable producer/consumer outputs, not arbitrary file counts: Core A owns source/evaluator/
trace correctness; Core B owns planner/rendering and its adapter. Engine tests and planner tests have different
writers. Platform retains models/routes/generated contracts; UX retains the entire frontend. The full adapted
playbook is docs/Hackathon_Development_Playbook.txt; original reference documents remain unchanged.

The requested Git fetch found main 354089f, deleted remote bootstrap/research branches and Daniel's separate
Core candidate c92ad8f. Current research branch now tracks origin/main; requested non-rebasing pull created
1f12f5b, preserving a034e2b. No force operation, remote push or Core candidate merge was performed.
The separate 'not a git repository' log cannot be attributed to a specific external working directory from the
provided log; rev-parse succeeds for this checkout. It is not evidence this repository needs reinitialization.

Existing Core work is preserved and explicitly reused in the staffing plan. Daniel's candidate reports 96
tests; this pass did not run those tests or certify combined Platform/Core integration. Core B's future scope
requires a recorded handoff from the original writer; no teammate was messaged or launched by this session.
