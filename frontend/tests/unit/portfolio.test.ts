/**
 * UX-04: the portfolio model, the development fixture, source disagreements, actionable
 * uncertainty and the working export. Everything checked here regroups or relabels payloads;
 * none of it may evaluate a rule, prefer a source or invent a date.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { DemoSource } from '../../src/api/demo';
import type { AddressItem, ChangeResult, Rule, SourceDocument, Uncertainty } from '../../src/api/types';
import { validate } from '../../src/api/validate';
import { DEV_ADDRESSES, DEV_ASSISTS, DEV_CHANGES, DEV_EVIDENCE_REPORTS, DEV_MANIFEST, DEV_PROPOSED_DISAGREEMENTS, DEV_RULES, DEV_SOURCES, RECORDED_CHANGES } from '../../src/demo/fixtures';
import { expandPooled } from '../../src/demo/pool';
import { dateBounds, shiftDay } from '../../src/lib/dates';
import { disagreementFromProposed, disagreementsFromLookup } from '../../src/lib/disagreements';
import { WORKING_EXPORT_KIND, buildWorkingExport, workingExportFilename } from '../../src/lib/exportPackage';
import { NO_FILTERS, buildTimeline, comparisonsAcross, filterRows, impactRows, propertyLabel, propertyTree, referencedAddressIds, referencedRuleIds, sourceTree, summarizeByCategory, summarizeByPlace, type Lookups } from '../../src/lib/portfolio';
import { ruleDisplayNames } from '../../src/lib/ruleNames';
import { codePointSlice } from '../../src/lib/text';
import { consequenceOf, groupUncertainty, nextStep } from '../../src/lib/uncertainty';

const lookups: Lookups = {
  addresses: new Map(DEV_ADDRESSES.map((item) => [item.property.address_id, item])),
  rules: new Map(Object.entries(DEV_RULES).map(([id, detail]) => [id, detail.rule])),
  sources: new Map(Object.entries(DEV_SOURCES)),
};
const change = (before: string, after: string, scenario = 'actual'): ChangeResult => {
  const entry = DEV_CHANGES.find((candidate) => candidate.request.before === before && candidate.request.after === after && (candidate.request.scenario ?? 'actual') === scenario);
  assert.ok(entry, `recorded comparison ${before} → ${after} (${scenario})`);
  return entry.response;
};
const headline = change('2026-10-01', '2027-01-15');
const ruleByCitation = (citation: string): Rule => {
  const rule = [...lookups.rules.values()].find((candidate) => candidate.citation === citation);
  assert.ok(rule, citation);
  return rule;
};

// ------------------------------------------------------------------ recorded fixture
test('pooled recordings expand to plain data, and a dangling reference is an error', () => {
  assert.deepEqual(expandPooled({ pool: [{ a: 1 }, [{ $pool: 0 }, 2]], data: { x: { $pool: 1 }, y: { $pool: 0 } } }), { x: [{ a: 1 }, 2], y: { a: 1 } });
  const twice = expandPooled<{ x: { a: number }; y: { a: number } }>({ pool: [{ a: 1 }], data: { x: { $pool: 0 }, y: { $pool: 0 } } });
  assert.notEqual(twice.x, twice.y, 'two responses never share an object');
  assert.throws(() => expandPooled({ pool: [], data: { $pool: 3 } }), /missing pooled entry/);
});

test('the development fixture is labeled, and every recorded payload matches the contract', () => {
  assert.equal(DEV_MANIFEST.fixture_mode, 'synthetic');
  assert.equal(DEV_MANIFEST.label, 'UX_DEVELOPMENT_FIXTURE_NOT_ACTUAL_LAW');
  assert.equal(DEV_MANIFEST.fixture_kind, 'ux_development_fixture');
  assert.equal(DEV_ADDRESSES.length, 14);
  for (const item of DEV_ADDRESSES) assert.deepEqual(validate('AddressItem', item).errors, [], item.property.address_id);
  assert.equal(DEV_ASSISTS.length, 42);
  for (const entry of DEV_ASSISTS) {
    assert.deepEqual(validate('AssistResponse', entry.response).errors, [], `${entry.request.address_id} ${entry.request.as_of}`);
    assert.equal(entry.response.mode, 'synthetic');
    assert.equal(entry.response.lookup.as_of, entry.request.as_of);
  }
  for (const entry of DEV_CHANGES) assert.deepEqual(validate('ChangeResult', entry.response).errors, [], JSON.stringify(entry.request));
  for (const [id, detail] of Object.entries(DEV_RULES)) {
    assert.deepEqual(validate('RuleDetail', detail).errors, [], id);
    assert.equal(detail.rule.evidence_mode, 'synthetic');
    assert.equal(detail.rule.semantic_verification, 'synthetic_fixture');
  }
  for (const [id, report] of Object.entries(DEV_EVIDENCE_REPORTS)) assert.deepEqual(validate('EvidenceReport', report).errors, [], id);
  for (const [id, source] of Object.entries(DEV_SOURCES)) {
    assert.deepEqual(validate('SourceDocument', source).errors, [], id);
    assert.equal(source.capture_status, 'synthetic');
    assert.match(source.text ?? '', /^UX DEVELOPMENT FIXTURE\. Fictional .*Not actual law\./);
    assert.match(source.url, /^https:\/\/example\.invalid\//);
  }
});

test('the recording was made from the checked-in fixture texts', () => {
  const recorded = DEV_MANIFEST.source_texts as Record<string, string>;
  assert.deepEqual(Object.keys(recorded).sort(), Object.keys(DEV_SOURCES).sort());
  for (const [docId, hash] of Object.entries(recorded)) {
    const bytes = readFileSync(fileURLToPath(new URL(`../../scripts/dev_fixture/${docId}.txt`, import.meta.url)));
    // Compared with LF endings, as the files are stored in the repository.
    const text = bytes.toString('utf8').replace(/\r\n/g, '\n');
    assert.equal(createHash('sha256').update(text, 'utf8').digest('hex'), hash, `${docId}: re-run frontend/scripts/record_demo.py`);
    assert.equal(DEV_SOURCES[docId]?.sha256, hash);
    assert.equal(DEV_SOURCES[docId]?.text, text);
  }
});

test('every quote in the development fixture sits at its recorded offsets in the source text', () => {
  let checked = 0;
  for (const detail of Object.values(DEV_RULES)) {
    const spans = [...detail.rule.evidence, ...(detail.rule.status_events ?? []).flatMap((event) => event.evidence), ...(detail.rule.interactions ?? []).flatMap((interaction) => interaction.evidence)];
    for (const span of spans) {
      const text = DEV_SOURCES[span.doc_id]?.text ?? '';
      assert.equal(codePointSlice(text, span.start as number, span.end as number), span.quote);
      checked += 1;
    }
  }
  assert.ok(checked >= 20);
});

test('the recorded stores hold no comparison in common, so a request names exactly one dataset', async () => {
  const key = (request: { test_id?: string | null; before?: string | null; after?: string | null; scenario?: string }) => request.test_id ?? `${request.before}:${request.after}:${request.scenario ?? 'actual'}`;
  const development = new Set(DEV_CHANGES.map((entry) => key(entry.request)));
  for (const entry of RECORDED_CHANGES) assert.equal(development.has(key(entry.request)), false, key(entry.request));
  const demo = new DemoSource();
  const fromDevelopment = await demo.changes({ before: '2026-10-01', after: '2027-01-15', scenario: 'actual' });
  assert.equal(fromDevelopment.recordedStore, 'dev_portfolio');
  assert.equal(fromDevelopment.origin.label, 'UX development fixture');
  const fromBackend = await demo.changes({ before: '2026-10-01', after: '2026-11-15', scenario: 'actual' });
  assert.equal(fromBackend.recordedStore, 'synthetic');
  assert.equal(fromBackend.origin.label, 'Recorded backend output');
});

test('demo: development lookups, rules, sources and evidence reports are replayed and labeled', async () => {
  const demo = new DemoSource();
  const outcome = await demo.lookup({ address_id: 'DEV-P08', as_of: '2027-01-15', answers: [] });
  assert.equal(outcome.origin.label, 'UX development fixture');
  assert.equal(outcome.assist?.question_plan.questions[0]?.fact.field, 'owner_occupied');
  const ruleId = outcome.lookup.rules[0]!.team_rule_id;
  assert.equal((await demo.ruleDetail(ruleId)).rule.team_rule_id, ruleId);
  const report = await demo.evidenceReport(ruleId);
  assert.equal(report.report?.rule_id, ruleId);
  assert.equal(report.origin?.label, 'UX development fixture');
  assert.match((await demo.source('DEV-LP-ORD-03')).text ?? '', /screening fee greater than \$35/);
  const catalog = demo.catalog();
  assert.equal(catalog.development.properties.length, 14);
  assert.ok(catalog.development.conflictLookups.some((entry) => entry.address_id === 'DEV-P07' && entry.as_of === '2027-01-15'));
  assert.deepEqual(catalog.lookupDates['DEV-P08'], ['2026-10-01', '2026-12-15', '2027-01-15']);
});

// ------------------------------------------------------------------ dates
test('date ranges keep the precision a source states, and day arithmetic is calendar-safe', () => {
  assert.deepEqual(dateBounds('2026-12'), { low: '2026-12-01', high: '2026-12-31' });
  assert.deepEqual(dateBounds('2028-02'), { low: '2028-02-01', high: '2028-02-29' });
  assert.deepEqual(dateBounds('2027'), { low: '2027-01-01', high: '2027-12-31' });
  assert.deepEqual(dateBounds('2026-11-01'), { low: '2026-11-01', high: '2026-11-01' });
  assert.equal(dateBounds('2026-13'), null);
  assert.equal(dateBounds('soon'), null);
  assert.equal(shiftDay('2027-01-01', -1), '2026-12-31');
  assert.equal(shiftDay('2028-03-01', -1), '2028-02-29');
  assert.equal(shiftDay('2026-10-31', 1), '2026-11-01');
  assert.equal(shiftDay('2026-02-30', 1), null);
});

// ------------------------------------------------------------------ labels
test('a property label never substitutes the postal city for an unresolved municipality', () => {
  const resolved = propertyLabel('DEV-P01', lookups.addresses.get('DEV-P01'));
  assert.deepEqual([resolved.street, resolved.place, resolved.resolved], ['12 Alder Row', 'Cedar Landing, ZZ', true]);
  const open = propertyLabel('DEV-P13', lookups.addresses.get('DEV-P13'));
  assert.equal(open.postalCity, 'Cedar Landing');
  assert.equal(open.resolved, false);
  assert.equal(open.place, 'Municipality unresolved · ZZ');
  assert.doesNotMatch(open.place, /Cedar Landing/);
  assert.notEqual(open.placeKey, resolved.placeKey);
  const ambiguous = propertyLabel('DEV-P14', lookups.addresses.get('DEV-P14'));
  assert.equal(ambiguous.place, 'Municipality ambiguous · ZZ');
  const unloaded = propertyLabel('X-1', undefined);
  assert.deepEqual([unloaded.street, unloaded.place], [null, 'Location not loaded']);
});

test('two records of one provision are told apart by their source document, others keep their title', () => {
  const names = ruleDisplayNames(lookups.rules.values());
  const fee = [...lookups.rules.values()].filter((rule) => rule.category === 'application_screening_fees');
  assert.equal(fee.length, 2);
  assert.deepEqual(fee.map((rule) => names.get(rule.team_rule_id)).sort(), ['Larch Point screening fee cap (fictional) · DEV-LP-CODE-03', 'Larch Point screening fee cap (fictional) · DEV-LP-ORD-03']);
  const state = ruleByCitation('Zenith Tenancy Act 2026, section 4');
  assert.equal(names.get(state.team_rule_id), state.title);
});

// ------------------------------------------------------------------ portfolio model
test('impact rows are the comparison’s own differences, and agree with its address lists', () => {
  for (const entry of DEV_CHANGES) {
    const { rows, unreadable } = impactRows(entry.response);
    assert.deepEqual(unreadable, []);
    const withKind = (kind: string) => [...new Set(rows.filter((row) => row.certainty === kind).map((row) => row.addressId))].sort();
    assert.deepEqual(withKind('definite'), [...entry.response.affected_address_ids].sort(), `definite ${JSON.stringify(entry.request)}`);
    assert.deepEqual(withKind('uncertain'), [...entry.response.uncertain_address_ids].sort(), `uncertain ${JSON.stringify(entry.request)}`);
    for (const row of rows.filter((candidate) => candidate.conflict)) assert.ok(entry.response.conflict_flag_address_ids.includes(row.addressId));
    assert.deepEqual(referencedAddressIds(entry.response).filter((id) => !lookups.addresses.has(id)), []);
    assert.deepEqual(referencedRuleIds(entry.response).filter((id) => !lookups.rules.has(id)), []);
  }
});

test('summaries count distinct properties per group and keep unresolved locations apart', () => {
  const { rows } = impactRows(headline);
  const places = summarizeByPlace(rows, lookups);
  assert.deepEqual(places.map((group) => group.label), ['Cedar Landing, ZZ', 'Larch Point, ZZ', 'Port Alder, ZZ', 'Municipality ambiguous · ZZ', 'Municipality unresolved · ZZ']);
  const cedar = places[0]!;
  assert.deepEqual([cedar.properties, cedar.definite, cedar.uncertain, cedar.conflict], [5, 4, 4, 4]);
  assert.equal(places.reduce((total, group) => total + group.properties, 0), 14);
  assert.match(places.at(-1)!.note ?? '', /postal city is not used/);
  assert.equal(places[0]!.note, undefined);

  const categories = summarizeByCategory(rows, lookups);
  assert.deepEqual(categories.map((group) => group.label), ['Application and screening fees', 'Just-cause eviction', 'Security deposits']);
  assert.equal(categories.find((group) => group.key === 'security_deposits')?.properties, 14);
  // With no rule records yet, nothing is guessed: every row falls under one "not loaded" group.
  const bare = summarizeByCategory(rows, { ...lookups, rules: new Map() });
  assert.deepEqual(bare.map((group) => group.label), ['Rule details not loaded']);
  const unlabeled = summarizeByPlace(rows, { ...lookups, addresses: new Map() });
  assert.deepEqual(unlabeled.map((group) => group.label), ['Location not loaded']);
});

test('filters narrow the rows without changing them', () => {
  const { rows } = impactRows(headline);
  assert.equal(filterRows(rows, NO_FILTERS, lookups).length, rows.length);
  const larch = propertyLabel('DEV-P07', lookups.addresses.get('DEV-P07')).placeKey;
  const filtered = filterRows(rows, { impact: 'conflict', place: larch, category: 'application_screening_fees' }, lookups);
  assert.ok(filtered.length > 0);
  for (const row of filtered) {
    assert.equal(row.conflict, true);
    assert.equal(lookups.addresses.get(row.addressId)?.resolution.municipality, 'Larch Point');
    assert.equal(lookups.rules.get(row.ruleId)?.category, 'application_screening_fees');
    assert.ok(rows.includes(row));
  }
  assert.deepEqual(filterRows(rows, { impact: 'definite', place: null, category: 'application_screening_fees' }, lookups), []);
});

test('the timeline orders the dated statements on the rule records and never sharpens a stated month', () => {
  const rules = referencedRuleIds(headline).map((id) => lookups.rules.get(id) as Rule);
  const timeline = buildTimeline(headline, rules);
  assert.deepEqual(timeline.unreadable, []);
  assert.deepEqual(
    timeline.events.map((event) => [event.date, event.type, event.status, event.position]),
    [
      ['2026-06-10', 'status', 'enacted', 'earlier'],
      ['2026-08-18', 'status', 'enacted', 'earlier'],
      ['2026-09-09', 'status', 'enacted', 'earlier'],
      ['2026-10-15', 'effective', null, 'between'],
      ['2026-11-01', 'effective', null, 'between'],
      ['2026-12', 'effective', null, 'between'],
      ['2027-01-01', 'effective', null, 'between'],
    ],
  );
  const month = timeline.events.find((event) => event.date === '2026-12')!;
  assert.deepEqual([month.precision, month.low, month.high], ['month', '2026-12-01', '2026-12-31']);
  assert.match(month.evidence[0]!.quote, /takes effect in December 2026/);
  assert.deepEqual(comparisonsAcross(month), [
    { before: '2026-11-30', after: '2026-12-01', meaning: 'day_before_to_first_possible_day' },
    { before: '2026-11-30', after: '2026-12-31', meaning: 'day_before_to_last_possible_day' },
  ]);
  const enacted = timeline.events.find((event) => event.date === '2026-08-18')!;
  assert.equal(enacted.ruleIds.length, 2, 'two rules enacted the same day share one entry');
  assert.deepEqual(comparisonsAcross(timeline.events.find((event) => event.date === '2026-11-01')!), [{ before: '2026-10-31', after: '2026-11-01', meaning: 'day_before_to_day' }]);
  // Every offered pair is a comparison the demo holds, so the timeline never leads to a dead end there.
  const recorded = new Set(DEV_CHANGES.map((entry) => `${entry.request.before}:${entry.request.after}`));
  for (const event of timeline.events) for (const offer of comparisonsAcross(event)) assert.ok(recorded.has(`${offer.before}:${offer.after}`), `${offer.before} → ${offer.after}`);

  // A compared date inside the stated month overlaps it rather than falling on one side.
  const inside = buildTimeline(change('2026-10-01', '2026-12-15'), rules);
  assert.equal(inside.events.find((event) => event.date === '2026-12')?.position, 'overlaps');
  assert.equal(inside.events.find((event) => event.date === '2027-01-01')?.position, 'later');
  // A pending proposal carries its recorded status date, not an invented effective date.
  const pending = buildTimeline(headline, [ruleByCitation('Larch Point Proposed Ordinance DEV-19, section 1')]);
  assert.deepEqual(pending.events.map((event) => [event.type, event.status, event.date]), [['status', 'pending', '2026-09-22']]);
  // A snapshot date that no status event explains is kept as its own entry.
  const snapshot = buildTimeline(headline, [{ ...ruleByCitation('Larch Point Proposed Ordinance DEV-19, section 1'), status_events: [] }]);
  assert.deepEqual(snapshot.events.map((event) => [event.type, event.status, event.date]), [['observed', 'pending', '2026-09-22']]);
  assert.deepEqual(buildTimeline(headline, [{ ...ruleByCitation('Zenith Tenancy Act 2026, section 4'), effective_date: 'early 2027' }]).unreadable.map((item) => item.value), ['early 2027']);
});

test('the drill-down goes source → rule → property, and falls back to IDs when records are missing', () => {
  const { rows } = impactRows(headline);
  const tree = sourceTree(rows, lookups);
  assert.deepEqual(tree.map((node) => node.docId), ['DEV-CL-ORD-07', 'DEV-LP-CODE-03', 'DEV-LP-ORD-03', 'DEV-ZZ-ACT-11']);
  const ordinance = tree[0]!;
  assert.equal(ordinance.source?.authority, 'official');
  assert.deepEqual(ordinance.rules.map((rule) => rule.rule?.citation), ['Cedar Landing Ordinance DEV-07, section 3', 'Cedar Landing Ordinance DEV-07, section 5']);
  assert.equal(tree.reduce((total, node) => total + node.rules.reduce((sum, rule) => sum + rule.rows.length, 0), 0), rows.length);
  assert.equal(tree.at(-1)!.properties, 14);

  const bare = sourceTree(rows, { addresses: new Map(), rules: new Map(), sources: new Map() });
  assert.deepEqual(bare.map((node) => [node.docId, node.source]), [['', null]]);
  assert.equal(bare[0]!.rules.every((rule) => rule.rule === null), true);

  const properties = propertyTree(rows, lookups);
  assert.equal(properties.length, 14);
  assert.deepEqual(properties[0]!.rows.map((row) => row.addressId), ['DEV-P01', 'DEV-P01', 'DEV-P01']);
});

test('a hypothetical comparison differs from the actual one only where a pending rule is assumed enacted', () => {
  const hypothetical = change('2026-10-01', '2027-01-15', 'if_enacted');
  assert.equal(hypothetical.scenario, 'if_enacted');
  const pending = ruleByCitation('Larch Point Proposed Ordinance DEV-19, section 1').team_rule_id;
  assert.equal(impactRows(headline).rows.some((row) => row.ruleId === pending), false);
  const assumed = impactRows(hypothetical).rows.filter((row) => row.ruleId === pending);
  assert.ok(assumed.length > 0);
  for (const row of assumed) assert.equal(row.before?.result, 'pending');
});

// ------------------------------------------------------------------ disagreements
test('a lookup’s conflicts are shown as two source-backed claims, with no preferred side', async () => {
  const demo = new DemoSource();
  const versions = disagreementsFromLookup(await demo.lookup({ address_id: 'DEV-P07', as_of: '2027-01-15', answers: [] }));
  assert.equal(versions.length, 1);
  const view = versions[0]!;
  assert.equal(view.basis, 'same_provision');
  assert.deepEqual(view.fields, ['requirement', 'key_value']);
  assert.deepEqual(view.claims.map((claim) => claim.docId).sort(), ['DEV-LP-CODE-03', 'DEV-LP-ORD-03']);
  assert.deepEqual(view.claims.map((claim) => claim.stated.find((item) => item.field === 'key_value')?.value).sort(), ['$35', '$50']);
  for (const claim of view.claims) {
    assert.equal(claim.source?.authority, 'official');
    assert.equal(claim.evaluation?.result, 'unknown');
    assert.equal(codePointSlice(DEV_SOURCES[claim.docId]!.text ?? '', claim.quote!.start!, claim.quote!.end!), claim.quote!.text);
    assert.deepEqual(claim.statusDates, [{ status: 'enacted', on: '2026-09-09' }, { status: 'takes effect', on: '2026-10-15' }]);
  }
  assert.ok(view.reasons.includes('Different supported interpretations of the same provision/version; no automatic precedence'));
  assert.ok(view.remedies.includes('Review source authority; factual answers do not resolve legal conflicts'));
  assert.doesNotMatch(JSON.stringify(view), /preferred|winner|confidence|score/i);

  const interaction = disagreementsFromLookup(await demo.lookup({ address_id: 'DEV-P01', as_of: '2027-01-15', answers: [] }));
  assert.equal(interaction.length, 1);
  assert.equal(interaction[0]!.basis, 'interaction');
  assert.equal(interaction[0]!.relation?.kind, 'conflicts_with');
  assert.match(interaction[0]!.relation!.evidence[0]!.quote, /does not state which limit controls/);
  assert.deepEqual(interaction[0]!.claims.map((claim) => claim.stated.find((item) => item.field === 'key_value')?.value), ["one month's rent", "two months' rent"]);

  // Before the state rule takes effect nothing overlaps, so nothing is flagged and nothing is shown.
  assert.deepEqual(disagreementsFromLookup(await demo.lookup({ address_id: 'DEV-P01', as_of: '2026-12-15', answers: [] })), []);
  // An exempt property: the conflicting records do not reach it, so the lookup reports no conflict.
  assert.deepEqual(disagreementsFromLookup(await demo.lookup({ address_id: 'DEV-P06', as_of: '2027-01-15', answers: [] })), []);
});

test('the proposed field-level disagreement is authored, labeled, anchored in its sources and names no winner', () => {
  assert.equal(DEV_PROPOSED_DISAGREEMENTS.length, 1);
  const entry = DEV_PROPOSED_DISAGREEMENTS[0]!;
  assert.equal(entry.contract_status, 'ux_proposed_shape_awaiting_PLAT-06');
  assert.match(entry.authored_by, /not backend output/);
  assert.equal(entry.status, 'unresolved');
  assert.doesNotMatch(JSON.stringify(entry), /preferred|winner|confidence|score/i);
  for (const claim of entry.claims) {
    const source = DEV_SOURCES[claim.span.doc_id] as SourceDocument;
    assert.equal(claim.span.source_hash, source.sha256);
    assert.equal(codePointSlice(source.text ?? '', claim.span.start, claim.span.end), claim.span.text);
  }
  assert.ok(lookups.rules.has(entry.affected_rule_ids[0]!));
  const view = disagreementFromProposed(entry, lookups.sources);
  assert.equal(view.basis, 'proposed_fixture');
  assert.deepEqual(view.claims.map((claim) => [claim.source?.authority, claim.stated[0]?.value]), [['official', '2026-11-01'], ['secondary', '2026-12-01']]);
  assert.deepEqual(disagreementFromProposed(entry, new Map()).claims.map((claim) => claim.source), [null, null]);
});

// ------------------------------------------------------------------ questions and uncertainty
test('identical uncertainty statements are shown once, with every rule they hold back', () => {
  const item = (rule: string, extra: Partial<Uncertainty> = {}): Uncertainty => ({ kind: 'conflict', message: 'Authority remains in conflict', remedy: 'Review authority', rule_ids: [rule], predicate_ids: [], field: null, source_refs: [], ...extra });
  const grouped = groupUncertainty([item('r-1'), item('r-2'), item('r-2'), item('r-3', { remedy: 'Obtain the adopting record' })]);
  assert.deepEqual(grouped.map((group) => [group.remedy, group.ruleIds]), [['Review authority', ['r-1', 'r-2']], ['Obtain the adopting record', ['r-3']]]);
  const plan = DEV_ASSISTS.find((entry) => entry.request.address_id === 'DEV-P08' && entry.request.as_of === '2027-01-15')!.response.question_plan;
  assert.ok(groupUncertainty(plan.remaining_uncertainty).length < plan.remaining_uncertainty.length);
  assert.deepEqual(['property_fact', 'jurisdiction', 'source_gap', 'conflict', 'interpretation', 'analysis_limit'].map((kind) => nextStep(kind).answerable), [true, false, false, false, false, false]);
  assert.deepEqual(nextStep('something_new'), { label: 'Review', answerable: false, order: 9 });
});

test('a hypothetical answer’s consequence is read from evaluator output on both sides', () => {
  const assist = DEV_ASSISTS.find((entry) => entry.request.address_id === 'DEV-P08' && entry.request.as_of === '2027-01-15')!.response;
  const question = assist.question_plan.questions[0]!;
  const yes = question.alternatives.find((alternative) => alternative.probe_facts.owner_occupied === true)!;
  const no = question.alternatives.find((alternative) => alternative.probe_facts.owner_occupied === false)!;
  const ifYes = consequenceOf(assist.lookup.evaluations, yes.evaluations);
  assert.deepEqual(ifYes.changed.map((item) => [item.before, item.after.result]), [['unknown', 'inapplicable'], ['unknown', 'inapplicable']]);
  assert.equal(ifYes.unchanged.length, 4);
  // "No" removes the exemption but the two records still conflict, so nothing moves.
  const ifNo = consequenceOf(assist.lookup.evaluations, no.evaluations);
  assert.deepEqual(ifNo.changed, []);
  assert.ok(no.remaining_uncertainty.some((item) => item.kind === 'conflict'));
});

// ------------------------------------------------------------------ working export
test('the working export keeps stored facts, request answers, results and review status apart', async () => {
  const demo = new DemoSource();
  const answers = [{ field: 'owner_occupied', value: true, provenance: 'demo' as const }];
  const outcome = await demo.lookup({ address_id: 'DEV-P08', as_of: '2027-01-15', answers });
  const history = [{ seq: 1, field: 'owner_occupied', action: 'answered' as const, value: true, provenance: 'demo' as const }];
  const data = buildWorkingExport({ outcome, answers, history, mode: 'demo', exportedAt: '2031-05-05T12:00:00.000Z' });
  assert.equal(data.export_kind, WORKING_EXPORT_KIND);
  assert.match(data.notice, /not the reproducible evidence package \(PLAT-06\)/);
  assert.equal(data.query.as_of, '2027-01-15', 'the query date comes from the response, not the export clock');
  assert.equal(data.exported_at, '2031-05-05T12:00:00.000Z');
  assert.equal(data.data_origin.synthetic, true);
  assert.equal(data.data_origin.api_base, null);
  assert.equal(data.data_origin.label, 'UX development fixture');
  // The answered field is a request answer, never a stored fact.
  assert.equal('owner_occupied' in data.stored_facts.facts, false);
  assert.equal('owner_occupied' in data.stored_facts.provenance, false);
  assert.equal(data.stored_facts.facts.units, 4);
  assert.deepEqual(data.request_answers.answers.map((answer) => [answer.field, answer.value, answer.provenance, answer.disposition]), [['owner_occupied', true, 'demo', 'applied']]);
  assert.equal(data.request_answers.history.length, 1);
  assert.equal(data.review_status.independent_human_review.recorded, false);
  assert.ok(data.review_status.model_review.rules.every((rule) => rule.semantic_verification === 'synthetic_fixture'));
  assert.equal(data.evaluator_results.evaluations.length, outcome.lookup.evaluations.length);
  assert.ok(data.sources.every((source) => !('text' in source) && source.sha256.length === 64));
  assert.ok(data.rules.every((rule) => rule.quoted_span.length > 0));
  assert.doesNotMatch(JSON.stringify(data), /"confidence"|"score"/);
  assert.equal(workingExportFilename('DEV P/08', '2027-01-15'), 'navigator-working-export_DEV-P-08_2027-01-15.json');
  // No address item is needed to build it, and nothing is mutated.
  const again = buildWorkingExport({ outcome, answers, history, mode: 'demo', exportedAt: '2031-05-05T12:00:00.000Z' });
  assert.deepEqual(again, data);
  const item: AddressItem | undefined = lookups.addresses.get('DEV-P08');
  assert.equal(item?.property.facts?.owner_occupied, undefined, 'the stored record is unchanged');
});
