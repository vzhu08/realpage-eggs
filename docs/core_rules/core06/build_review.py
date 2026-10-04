"""Reproduce offline Core A triage and annotated observations, never extract rules.

Annotations are source-review observations, not automatic legal findings. No data
record is corrected by this script. Human/independent legal review remains pending.
"""
from collections import Counter
from datetime import date
import hashlib
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))
from navigator.changes import map_references
from navigator.engine import temporal
from navigator.evidence import all_evidence
from navigator.retrieval import span
from navigator.source_comparison import compare_claims, compare_impacts, compare_rule_versions
from navigator.store import Store, digest, write_json

OUT = ROOT / 'docs/core_rules/core06'
SNAPSHOT = json.loads((OUT / 'snapshot_manifest.json').read_text())
DATA = Path(SNAPSHOT['working_store'])
STORE = Store(DATA)
SOURCES, RULES = STORE.sources(), STORE.rules()
AS_OF = date(2026, 10, 1)


def reference(doc, start, end):
    return span(SOURCES[doc], start, end)


def passage(doc, pattern, *, size=350):
    match = re.search(pattern, SOURCES[doc].text, re.I)
    assert match, (doc, pattern)
    return reference(doc, match.start(), min(len(SOURCES[doc].text), max(match.end(), match.start()+size)))


def metadata(doc):
    source = SOURCES[doc]
    return {**source.model_dump(exclude={'text'}), 'actual_sha256': digest(source.text.encode('utf-8'))}


def evidence(rule):
    output, seen = [], set()
    for item in all_evidence(rule):
        key = (item.doc_id, item.start, item.end, item.quote)
        if key in seen: continue
        seen.add(key)
        source = SOURCES[item.doc_id]
        a = item.start if item.start is not None else source.text.index(item.quote)
        b = item.end if item.end is not None else a + len(item.quote)
        assert source.text[a:b] == item.quote
        output.append({'supports': item.supports, 'span': reference(item.doc_id, a, b).model_dump(mode='json')})
    return output


DOC_ACTIONS = {
 'D003': 'Acquire Fair Chance ordinance and adoption/effective history; current guidance has no operative date. Navigation news dates do not date this ordinance.',
 'D004': 'Review the four legacy procedural/scope rules separately from the dated 2026 payment increases; Jan 1 applies to the increases, not every existing obligation.',
 'D005': 'Acquire BMC 13.78 operative/version history; an unfilled URL and current-tenancy guidance do not date these provisions.',
 'D006': 'Acquire Measure BB certified enactment/operative history and implementing regulations; comparative before/after chart supplies no transition date.',
 'D007': 'Obtain operative histories for the individual deposit duties; do not transfer dates from separately dated rates or California caps.',
 'D008': 'Review which general AGA eligibility obligation is dated; adoption of the 2026 amount is not automatically the effective date of longstanding eligibility restrictions.',
 'D009': 'Acquire underlying Berkeley coverage ordinance and dated amendments; a unit-type chart has neither a lifecycle observation nor an effective date.',
 'D010': 'Acquire underlying Boston/MA authority and dated history; source guidance is not a dated status observation.',
 'D012': 'Acquire the ordinance and dated applicability history behind this undated tenant notice; do not treat retrieval as enactment.',
 'D013': 'D014 [2168,2215) explicitly dates HSNA to 2020-11-06 and supports a notice-duty candidate. Verify same provision/version before assigning it to D013; the online-portal/contact-information duties differ from D014 mail/service-certificate guidance. Keep exemptions and review issues unresolved.',
 'D016': 'Acquire the individual fair-housing authorities and operative histories; AB468 enactment in a FAQ does not date every disability/ESA obligation.',
 'D022': 'Acquire AB325 operative-date authority and BPC16702 person definition; chaptering/approval on 2025-10-06 is not the effective date. No SB763 source located.',
}


def triage():
    rows = []
    tests = STORE.read('change_tests.json')
    mappings = {t['test_id']: map_references(list(RULES.values()), t['rule_ids'] + t.get('conflict_with', [])) for t in tests}
    for rule in RULES.values():
        current = temporal(rule, AS_OF)
        if current in {'in_force', 'not_yet_effective', 'pending', 'failed'}: continue
        missing = []
        if rule.lifecycle == 'unknown': missing.append('lifecycle_unknown')
        if not rule.status_as_of and not rule.status_events and rule.lifecycle == 'unknown': missing.append('dated_lifecycle_observation_or_transition_absent')
        if not rule.effective_date: missing.append('effective_date_absent')
        events = [e.model_dump(mode='json') for e in rule.status_events]
        rows.append({'rule_id': rule.team_rule_id, 'doc_id': rule.source_doc_id,
          'query_date': str(AS_OF), 'temporal_result': current, 'reason_codes': missing,
          'reason': '; '.join(missing) + '; retrieval timestamps and undated enacted labels do not supply an operative interval',
          'dimensions': {'adoption_enactment': {'lifecycle': rule.lifecycle, 'dated_events': events,
              'note': 'No dated transition recorded' if not events else 'Recorded dated events retained at original precision'},
              'effectiveness': rule.effective_date, 'observed_status_date': rule.status_as_of,
              'end_date': rule.end_date, 'repeal': 'No repeal event established; absence of an end date is not itself the export failure',
              'contradiction': 'No conflicting dated transition encoded; missing support is not proof that dates agree'},
          'citation': rule.citation, 'source': metadata(rule.source_doc_id), 'existing_support': evidence(rule),
          'review_issues': rule.review_issues,
          'saved_source_resolution': 'Candidate cross-source HSNA date requires version/scope review; not applied' if rule.source_doc_id=='D013' else 'No verified field-specific operative-date correction established in this review',
          'required_action': DOC_ACTIONS[rule.source_doc_id],
          'affected_cases': [case for case,mapping in mappings.items() if any(rule.team_rule_id in ids for ids in mapping.values())],
          'other_results': ['benchmark temporal projection', f'{rule.jurisdiction}: {rule.category} lookup'],
          'correction_applied': False, 'human_review': 'pending'})
    write_json(OUT / 'temporal_triage.json', {'as_of': str(AS_OF), 'method': 'existing temporal() plus anchored saved-source review; no new extraction',
        'counts': {'unrepresentable': len(rows), 'corrected': 0, 'by_doc': dict(Counter(r['doc_id'] for r in rows)),
                   'by_reason': dict(Counter(reason for r in rows for reason in r['reason_codes']))},
        'limitations': 'Per-rule support is exact-anchor checked, not independently legally verified. Same-source date search is not an exhaustive cross-source legal history review.', 'rules': rows})
    return mappings


def review():
    approval = passage('D069', r'P.L.\s+2026, CHAPTER 43,\s+approved July 20, 2026', size=0)
    operative = passage('D069', r'9\.\s+This act shall take effect[\s\S]*?date of enactment\.', size=0)
    municipal = passage('D069', r'b\.\s+A municipality shall be prohibited', size=229)
    berkeley = passage('D001', r'At a regular meeting of the Council', size=180)
    la1 = passage('D041', r'Effective February 2, 2026, the landlord', size=111)
    la2 = passage('D042', r'Beginning February 2, 2026, a landlord', size=118)
    specs = {
      'D022': ('Agent review of both stored rules complete; no new rule count target or blanket algorithm ban inferred. Independent review pending.', [
        'Both rules preserve distinct restraint-of-trade and coercion clauses. The two-or-more-person/competitor-data definition is retained, not replaced by use of software alone.',
        'Commercial terms, distribution, price and the end-consumer exclusion have separate original support. The incorporated Person definition in BPC16702 remains unavailable.',
        'Subdivision (c) preserves other unlawful-conduct restrictions. It does not establish a directional state/local interaction.',
        'Chaptered/approved/Secretary of State filing evidence supports enactment in October 2025. No operative-date clause establishes Jan 1, 2026 within this capture.',
        'Digest criminal-penalty discussion supplies no fixed fine. Section16756.1 pleading rule is procedural; omission from rental obligations is not automatically an extraction defect.',
        'No construction-year or occupancy predicate occurs in these two rules. Unsupported dependencies stay unsupported. Earlier version names are not earlier version text.'],
        [reference('D022',a,b) for a,b in [(1183,1275),(3785,4003),(4004,4305),(4306,4515),(4516,4742),(4743,4992),(4993,5197),(5198,5322),(5323,5570),(3048,3238)]]),
      'D069': ('Saved enacted text is available, but no extracted NJ rule exists.', [
        'Section6(b) prohibits conflicting municipal ordinances, with an exception for ordinances explicitly authorized or required by other law. This is not a blanket repeal or a supported pairwise supersession.',
        'Approval is July20,2026; section9 uses first day of twelfth following month. Applying that calendar formula with approval as enactment gives July1,2027; this is an annotated derivation, not a stored Rule or independent legal finding.',
        'Review section3 exclusions (spreadsheet without AI AND human analysis; unprocessed database; coordination-only research; public free estimates; qualifying brokerage tools) and section3 government affordability exclusion before compiling coverage.',
        'Section4 has distinct developer and rental-owner acts. Municipality/county presence alone does not demonstrate a conflict with any local ordinance.'], [approval, operative, municipal, passage('D069', r'(?m)^3\.[\s\S]*?(?=^4\.)', size=0), passage('D069', r'(?m)^4\.[\s\S]*?(?=^5\.)', size=0)]),
      'D045': ('H5222 bill landing/history capture only.', ['2026-03-12 favorable report/new draft of H1564 and referral to House Ways and Means are captured. Substantive bill provisions and subsequent disposition are not captured; do not label enacted or failed.'], [passage('D045', r'An Act[\s\S]*?(?=The information contained)', size=0)]),
      'D046': ('S2983 landing/history capture only.', ['March12,2026 report/referral is a status event, not the text of a rent-setting prohibition; full bill and later history required.'], [passage('D046', r'An Act[\s\S]*?(?=The information contained)', size=0)]),
      'D047': ('S2983 BillHistory snapshot.', ['Same procedural history can corroborate the captured referral but supplies no substantive prohibition or final disposition. Retrieval date is not the referral date.'], [passage('D047', r'An Act[\s\S]*?(?=The information contained)', size=0)]),
      'D048': ('MGL chapter40P section4, not IP25-21 failure evidence.', ['Qualified municipal rent-control restriction/voluntary program exception, exclusions and compensation terms are law text. This snapshot does not identify the petition, a judgment striking it, or the claimed June23,2026 failure event.'], [passage('D048', r'Section 4\.[\s\S]*?regulated units only\.', size=0)]),
      'D001': ('Passed-to-print evidence; final adoption/effectiveness absent.', ['The closing vote records November18,2025 passage to print. Neither competing January1/March1,2026 allegation has a captured operative-date provision. Other Berkeley relocation/AGA dates address different obligations.'], [berkeley]),
      'D041': ('LAHD guidance on utility/dependent increases.', ['February2,2026 is expressly attached to eliminating the utility increase (and separately the dependent addition). It does not establish that every RSO change began then.'], [la1, passage('D041', r'Effective February 2, 2026, an additonal', size=175)]),
      'D042': ('LAHD calculator agrees on utility cutoff.', ['The 3% rate is expressly July1,2025–June30,2026; do not extend it to the Oct1 benchmark. February2,2026 utility cutoff agrees with D041. January24 claim and underlying enactment not available.'], [la2, passage('D042', r'Annual rent increases', size=261)]),
    }
    reviews = {}
    for doc,(status,findings,spans) in specs.items():
        reviews[doc] = {'source': metadata(doc), 'disposition': status, 'findings': findings,
            'spans': [s.model_dump(mode='json') for s in spans],
            'stored_rules': [{'rule_id':r.team_rule_id, 'evidence_mode':r.evidence_mode, 'origin_run_id':r.extraction_run_id,
                             'support':evidence(r)} for r in RULES.values() if r.source_doc_id==doc],
            'review_type':'automated anchors plus agent source reading; not model semantic verification or independent legal review',
            'human_review':'pending'}
    write_json(OUT / 'priority_source_review.json', reviews)
    comparisons = {
      'NJ_local': compare_claims('interaction', 'Municipal conflicting ordinances prohibited, with express other-law exception',
          'Local provision/direction/scope unestablished', [municipal], [], SOURCES, SOURCES),
      'Berkeley_dates': compare_claims('effective_date', 'Passed to print 2025-11-18; effective date not established',
          'January1/March1,2026 are unverified investigation claims', [berkeley], [], SOURCES, SOURCES,
          rule_ids=[r.team_rule_id for r in RULES.values() if r.source_doc_id=='D001']),
      'LA_utility_guidance': compare_claims('utility_increase_cutoff', '2026-02-02', '2026-02-02', [la1], [la2], SOURCES, SOURCES),
      'LA_alleged_date_conflict': compare_claims('utility_increase_cutoff', '2026-02-02', '2026-01-24 unverified investigation claim', [la1,la2], [], SOURCES, SOURCES),
    }
    # Compare two real stored encodings without declaring either the legal winner.
    pair = [next(r for r in RULES.values() if r.source_doc_id==doc and r.provision_key=='tenant_rights_notice') for doc in ('D013','D014')]
    comparisons['Boston_HSNA_existing_candidate'] = compare_rule_versions(*pair, SOURCES, SOURCES)
    prop = next(p for _,p in sorted(STORE.addresses().items()) if p.raw_address.state == 'MA')
    comparisons['Boston_HSNA_conditional_impact'] = compare_impacts([pair[0]], [pair[1]], prop, STORE.resolutions()[prop.address_id], AS_OF)
    write_json(OUT / 'source_comparisons.json', {'public_contract':'PLAT-06 unreleased; internal only',
        'applied_to_saved_sources': comparisons, 'human_review':'pending', 'new_rules_created':0})
    return reviews


def cases(mappings, reviews):
    actual = json.loads((DATA / 'core06-results/partial-export/change_details.json').read_text())
    specs = {
      'T1': (['D022'], 'AB325 operative-date authority and BPC16702; actual SB763 text/history missing; some property conditions unsupported.'),
      'T2': ([], 'Hoboken/Jersey City ordinance full text, adoption/effectiveness and exclusions; Platform legal municipality resolution. D036 landlord office page does not supply algorithm ordinance.'),
      'T3': (['D069'], 'NJ extraction paused; local ordinance texts, exact target/direction/scope and conflict analysis absent; qualified clause alone proves no particular supersession.'),
      'T4': (['D045','D046','D047'], 'Substantive MA bills unavailable. Procedure-only history cannot supply proposed requirements. Hypothetical is not actual enactment.'),
      'T5': (['D048'], 'Actual IP25-21 petition and authoritative failed disposition absent; D048 is a different statute, not failed-proposal evidence.'),
    }
    rows = {}
    for ident,(docs,gaps) in specs.items():
        result = actual[ident]
        ids = sorted({rid for values in mappings[ident].values() for rid in values})
        rows[ident] = {'engine_status': result['status'], 'evidence_readiness': 'unestablished',
            'scenario':result['scenario'], 'before':result['before'], 'after':result['after'],
            'mapped_rule_ids':mappings[ident], 'support':[{'rule_id':rid,'spans':evidence(RULES[rid])} for rid in ids],
            'additional_saved_source_spans':{doc:reviews[doc]['spans'] for doc in docs},
            'missing_dependencies':gaps, 'definitely_affected_count':len(result['affected_address_ids']),
            'uncertain_count':len(result['uncertain_address_ids']), 'notes':result['notes'],
            'address_set_method':'existing evaluator with actual saved facts; no organizer expected sets used',
            'human_review':'pending'}
    write_json(OUT / 'change_case_review.json', rows)


def transfer():
    files = {name:{'sha256':hashlib.sha256((DATA/name).read_bytes()).hexdigest(), 'bytes':(DATA/name).stat().st_size}
             for name in SNAPSHOT['working_files']}
    checks = {
      'rule_primary_sources_resolve': all(r.source_doc_id in SOURCES for r in RULES.values()),
      'evidence_sources_and_offsets_resolve': all(SOURCES[e.doc_id].text[e.start:e.end]==e.quote for r in RULES.values() for e in all_evidence(r)),
      'source_hashes_match_text':all(s.sha256==digest(s.text.encode('utf-8')) for s in SOURCES.values()),
      'origin_extraction_runs_present':all((DATA/f'runs/{r.extraction_run_id}.json').exists() for r in RULES.values()),
      'address_and_resolution_ids_equal':set(STORE.addresses())==set(STORE.resolutions()),
      'private_copy_matches_original_files':all(files[name]['sha256']==sha for name,sha in SNAPSHOT['working_files'].items()),
    }
    assert all(checks.values()), checks
    write_json(OUT/'transfer_manifest.json', {'local_root':str(DATA), 'payload_kind':'precise allowlisted file manifest; no upload performed',
      'payload_file_count':len(files), 'payload_manifest_sha256':digest(files), 'files':files, 'integrity':checks,
      'addresses':len(STORE.addresses()), 'rules':len(RULES), 'unresolved_municipalities':500,
      'facts_bounds_provenance':'Contained in addresses.json; unresolved geographic evidence in resolutions.json; no Platform Census data borrowed.',
      'exclude':'No .env, credential files, full old experiment/output directories, or unrelated developer data. Source snapshots/provider outputs remain local.',
      'transfer_dependency':'User-approved Platform destination/method needed; Platform assembles geography after transfer.'})


def main():
    mappings = triage()
    reviews = review()
    cases(mappings, reviews)
    transfer()
    print('Generated exact-span review, temporal triage, comparisons, case reports and transfer manifest; no stored records changed.')


if __name__ == '__main__': main()
