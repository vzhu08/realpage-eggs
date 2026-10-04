# Actor inputs behind the property lookup — October 4, 2026

A0001's stored property facts reach the evaluator intact: residential use, 32 units,
and construction year 1927. The 221 unknown results reproduced before additional
runtime evidence preparation; they are not an empty or lost property record.
Raw evaluation finds 210 rules with missing facts, 154 with unsupported predicates,
119 with unresolved temporal status, and 217 with saved review issues. These causes
overlap. Residential use contributes to 81 of the relevant rules and units to eight.

Four fresh AB 325 rule records have no saved or runtime evidence blockers and have
an operative date, but their two actor-classification predicates were absent from
the shared input registry. `/lookup` and `/lookup/assist` rejected explicit answers,
and the planner could not present those inputs as supported questions. The fix
registers only these existing boolean fields:

- `person_under_bpc_16702`: documented classification of one identified actor under
  BPC 16702. The definition is inclusive; its listed entity forms are not treated as
  an exhaustive set or inferred automatically from `owner_type`.
- `end_consumer_of_product_or_service`: whether that same actor is the end consumer
  of the particular product or service in BPC 16729(d)(5). The captured provision
  supplies the exclusion but does not give a further definition of end consumer.
  An unclear or disputed classification must remain unknown.

Both inputs concern the actor and activity being evaluated. Neither is inferred
from a property address, residential use, an ownership name, or software use.
Supplying an answer does not establish that prohibited conduct occurred or that
the actor complied with the obligation. The API records user-provided provenance;
answers stay local to that request. Boolean `false` is an explicit answer; missing
or `null` input remains unknown.

## Captured authority

These anchors were checked against the preserved final research Store distributed
in [the research archive](../change_case_results/final-research-archive.zip).
Offsets are zero-based Unicode character offsets with an exclusive end, not byte
offsets. The captured `(5)` paragraphs contain a nonbreaking space after `(5)`.

| Document | Text offsets | Captured provision |
| --- | --- | --- |
| `P11_CA_BPC_ART1` | `[2016, 2227)` | Section 16702, reproduced below. |
| `P11_CA_BPC_ART2` | `[11752, 11876)` | Section 16729(d)(5), reproduced below. |
| `D022` | `[5198, 5322)` | The same `(5)` paragraph in the AB 325 bill text. |

```text
16702.
As used in this chapter “person” or “persons” includes corporations, firms, partnerships and associations existing under or authorized by the laws of this State or any other State, or any foreign country.
```

```text
(5) “Person” has the same meaning as defined in Section 16702 and does not include the end consumer of a product or service.
```

Captured text SHA-256 and original URL:

- `P11_CA_BPC_ART1`: `2384f2fc2d33b25366bafec58796c99e9abd411446bd61a15ecaea2067329bf5`;
  [official article 1](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=BPC&division=7.&title=&part=2.&chapter=2.&article=1.).
- `P11_CA_BPC_ART2`: `38414eac4117ee05baa3862e842deee70b9b6a47faa1c22a79d6f2e32cc7ebef`;
  [official article 2](https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=BPC&division=7.&title=&part=2.&chapter=2.&article=2.).
- `D022`: `0699980875e6bf3d797abd8b734db7d449b295173e33668cc655e3b394c084ed`;
  [official AB 325 record](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB325).

This input registration is an agent-reviewed contract repair, not an independent
legal review or a change to the captured law, actor facts, or stored rule predicates.

## Validation and limits

`tests/test_actor_status_inputs.py` uses an explicitly synthetic obligation to test
the actual HTTP routes, fact registry, planner and evaluator. It verifies no inferred
classification from existing property facts or `owner_type`, both questions appearing,
explicit answers reaching the evaluator, boolean type enforcement, explicit unknowns,
request isolation, continued source-review gates, and rejection of unrelated
unregistered fields. Together with `test_assist_api.py` and
`test_question_planner.py`, the focused suite passed **90 tests**.

A separate read-only diagnostic used A0001 and the actual 678-rule research Store,
with canonical lookup and evidence preparation. The following supplied answers are
**hypothetical test inputs, not verified facts about A0001 or its owner**:

| Request-local inputs | Relevant lookup output |
| --- | --- |
| Both omitted | 221 unknown |
| Person `true`, end consumer `false` | 4 applies, 217 unknown |
| Person `true`, end consumer `true` | The four records are excluded; 217 unknown remain |
| Both `null` | 221 unknown |

The four records are `r-051bb9b2da004d49ceae`, `r-8f114f5837b83740d942`,
`r-b487ccd24b6e0afe117f`, and `r-be78059fb144c88ea744`: two provisions present in
both the bill and codified source, not four distinct legal obligations. A bounded
planner diagnostic restricted to these four records surfaced both fields in nine
evaluations and remained partial. It does not establish whole-corpus question
priority or complete legal support. Canonical lookup diagnostics used all rules;
no 64-probe assist request, portfolio gate, provider call, or stored fact edit ran.
Consumed input-file hashes were unchanged.

This narrow repair does not resolve the remaining corpus. Before the registration,
618 of 678 stored rules referenced at least one unregistered predicate field;
794 of 820 distinct predicate fields were unregistered. Many require separate
legal interpretation, source repair, or transaction facts rather than aliases for
assessor data. They are not automatically admitted or defaulted to true/false.
All 500 property records have at least residential-use metadata, but public assessor
facts are sparse: precise unit counts exist for 207/250 CA, 1/140 NJ and 50/110 MA
properties, with explicit unit bounds for another 43 CA properties. Construction
year is never substituted for an occupancy or certificate date.

## Integrated local-app verification

The combined change also prioritizes supported questions for otherwise unblocked
rules before the field limit, and adds direct browsing, text search and topic
filters for returned provisions. Neither filtering nor question ranking changes
an evaluation's coverage result.

On October 4, 2026, the running local app was checked against all 678 research
rules and A0001 as of October 1, 2026. A full default `/lookup/assist` request used
64 of 64 permitted evaluations and presented the two actor questions first,
followed by tenancy start, owner occupancy and certificate of occupancy. It
remained explicitly partial. Four actual HTTP `/lookup` requests verified the
baseline, hypothetical answers, null answers and a subsequent unanswered request
with the counts above. Every request returned HTTP 200, and the subsequent
unanswered response exactly matched the original response hash. Stored addresses,
resolutions, rules, sources and extraction-index hashes were unchanged.

Browser checks confirmed that all 221 returned provisions are readable; text
search selected the requested provision, the algorithmic-pricing topic selected
four records, and the evidence drawer displayed captured source quotes. These
checks do not establish coverage for the 217 records that remain unknown after
the hypothetical actor answers. The full backend suite passed 754 tests with one
skip; no provider calls were made for this verification.
