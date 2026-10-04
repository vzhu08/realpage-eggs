# Publication/date and official-court follow-up

This follow-up is **partial; neither remaining gap is closed**. It adds one substantive source
and records the actual access limitations. Original PLAT-11 sources and all live stores remain
unchanged. No clerk or teammate was contacted.

## New New Jersey authority

`P12_NJ_CHARTER` is the official NJ DCA *Optional Municipal Charter Law*, July 2026 edition.
PDF p. 49, section 40:69A-181, supplies adoption/publication and effectiveness provisions, with
conditions/exceptions. The original 57-page PDF, derivative, hashes and retrieval time are saved.
The relevant page was visually inspected. This is general authority, **not evidence that any
particular ordinance was published, satisfied its conditions, or has a specific effective day**.
Core must assess applicability and version. Do not spend on extracting this entire compilation.

Hoboken's official notice index returned an empty listing while still displaying a 2026 filter,
despite a URL requesting all dates. It does not prove absence of 2025 notices. The previous
adopted B-781 texts and July 9 minutes remain available. Jersey City 25-057/25-098/25-105 adoption
and mayoral records remain available, but publication/operative-date certification and complete
subsequent-amendment history have not been obtained.

Ready-to-send request for each municipal clerk (user sends; this task sent nothing):

> Please provide the final signed ordinance, post-adoption legal notice and affidavit/proof of
> publication, mayor approval record, certified effective date, any emergency-effectiveness
> resolution, and subsequent amendments through October 1, 2026 for the ordinance(s) below.

For Hoboken, identify **B-781, adopted July 9, 2025**, titled prohibition against algorithmic rent
fixing; mention its 158-2 title/154-8 body discrepancy. For Jersey City, identify **25-057,
25-098 and 25-105**. Request existing records rather than treating an announcement as publication.

## Massachusetts official verification

Both attempted appellate docket URLs returned HTTP 403. Mass.gov's official single-justice
page links its separate decisions archive; the exact candidate-number search returned zero
results. That archive is not the complete docket, so this is not evidence of no judgment.

**Correction:** county number `SJ-2026-0063` came from search-index text attributed to an
unretrievable official PDF. None of the saved primary texts establishes that number. The record
retains that attempted search, but it must not be called a verified originating docket.

Manual route:

1. Open [Mass.gov court docket access](https://www.mass.gov/search-court-dockets-calendars-and-case-information).
2. Choose **Access SJC and Appeals Court dockets** and search verified full-court **SJC-13893**.
3. Save the docket and its June 23, 2026 opinion/rescript entry, with displayed URL and retrieval time.
4. Follow that docket's originating-case reference, confirm the county number and parties, then
   save the post-remand judgment and its entry date. Do not assume the search-index county number.
5. If ordinary browser access also fails, request those existing records from the court clerk.
   The captured official archive lists 617-557-1100, weekdays 8:30 am-4:30 pm Eastern excluding holidays.

The earlier court-authored mirror remains explicitly a mirror, and its majority/concurrence
remain separate. Access-search pages are stored for provenance only; they are deliberately
excluded from `sources.json`. That additive collection contains only the new NJ authority.

## Checks

`build_verify.py` verifies all five raw/text pairs and regenerates every derivative byte-for-byte
(Python with pypdf 6.10.0). Two failed docket attempts retain their HTTP errors. The resulting
single SourceDocument validates against the repository model. Hashes and successful access
checks do not establish legal accuracy or close the missing-record requests.
