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
