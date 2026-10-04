/**
 * GET /source-comparisons: how observations are arranged and worded for every outcome the
 * service can report, and that neither adapter adds a verdict of its own.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DemoSource } from '../../src/api/demo';
import { LiveSource } from '../../src/api/live';
import type { ClaimComparison, ComparisonSupport, SourceComparisonsResponse } from '../../src/api/types';
import { validate } from '../../src/api/validate';
import { DEV_SOURCE_COMPARISONS } from '../../src/demo/fixtures';
import { CLASSIFICATION, COUNT_ORDER, STATUS_LABEL, arrangeComparisons, claimValue, comparisonCounts, comparisonFieldLabel, comparisonsForRules, countPhrase, supportIssue, supportProblem, supportState, supportSummary } from '../../src/lib/sourceComparisons';
import { NOT_FOUND, clone, fakeFetch, readJson, rejects } from './integration-doubles';

const example = readJson<{ fixture_mode: string; response: SourceComparisonsResponse }>('contracts/evidence_examples/claim_comparison.json');
const base = example.response.observations.synthetic_missing_support!;
const valid: ComparisonSupport = base.before.support[0]!;
const REMEDY = base.remedy;

const support = (change: (item: ComparisonSupport) => void = () => undefined): ComparisonSupport => {
  const item = clone(valid);
  change(item);
  return item;
};
const observation = (overrides: Partial<ClaimComparison>): ClaimComparison => ({ ...clone(base), ...overrides });
const response = (observations: Record<string, ClaimComparison>): SourceComparisonsResponse => ({ ...clone(example.response), observations });

/** One of every outcome, hand-built from the synthetic contract example's own passage. */
const staleAnchor = support((item) => (item.anchor_valid = false));
const otherVersion = support((item) => {
  item.anchor_valid = false;
  item.span.source_hash = 'a'.repeat(64);
});
const changedSource = support((item) => {
  item.anchor_valid = false;
  item.source!.actual_sha256 = 'b'.repeat(64);
  item.source!.identity_valid = false;
});
const missingSource = support((item) => {
  item.anchor_valid = false;
  item.source = null;
  item.span.doc_id = 'NOT-IN-SNAPSHOT';
});
const OBSERVATIONS: Record<string, ClaimComparison> = {
  z_differ: observation({ classification: 'different_claims', status: 'unresolved', before: { value: '2026-11-15', support: [support()] }, after: { value: '2026-12', support: [support()] } }),
  y_same: observation({ classification: 'same_claim', status: 'same_observation_not_semantically_verified', field: 'utility_increase_cutoff', rule_ids: [], before: { value: '2026-02-02', support: [support()] }, after: { value: '2026-02-02', support: [support()] } }),
  x_one_absent: clone(base),
  w_both_absent: observation({ before: { value: 'Local provision unestablished', support: [] }, after: { value: null, support: [] }, rule_ids: [] }),
  v_stale_anchor: observation({ before: { value: 'A', support: [support()] }, after: { value: 'B', support: [staleAnchor] } }),
  u_other_version: observation({ before: { value: 'A', support: [otherVersion] }, after: { value: 'A', support: [support()] } }),
  t_changed_source: observation({ before: { value: 'A', support: [changedSource] }, after: { value: 'B', support: [support()] } }),
  s_missing_source: observation({ before: { value: 'A', support: [support(), missingSource] }, after: { value: 'B', support: [] } }),
};

test('the checked-in claim comparison example and every hand-built variant match the contract', () => {
  assert.deepEqual(validate('SourceComparisonsResponse', example.response), { errors: [], warnings: [] });
  assert.equal(example.fixture_mode, 'synthetic');
  assert.deepEqual(validate('SourceComparisonsResponse', response(OBSERVATIONS)), { errors: [], warnings: [] });
});

test('arrangement: differing claims first, then missing support, then same claims; counted apart', () => {
  const views = arrangeComparisons(response(OBSERVATIONS));
  assert.deepEqual(views.map((view) => view.id), ['z_differ', 's_missing_source', 't_changed_source', 'u_other_version', 'v_stale_anchor', 'w_both_absent', 'x_one_absent', 'y_same']);
  assert.deepEqual(comparisonCounts(views), { different_claims: 1, missing_support: 6, same_claim: 1 });
  assert.deepEqual(COUNT_ORDER.map((kind) => countPhrase(kind, comparisonCounts(views)[kind])), ['1 differs', '6 with support missing or not checking out', '1 is the same']);
  assert.equal(countPhrase('different_claims', 2), '2 differ');
  assert.equal(countPhrase('same_claim', 3), '3 are the same');
  // The order of the two claims is the response's own: nothing reorders a pair.
  for (const view of views) assert.deepEqual(view.sides.map((side) => side.key), ['before', 'after']);
});

test('different_claims: a literal difference between two recorded claims, each with a located passage', () => {
  const [view] = arrangeComparisons(response({ z_differ: OBSERVATIONS.z_differ! }));
  assert.equal(view!.headline, 'The two claims differ');
  assert.deepEqual(view!.sides.map((side) => side.value), ['Nov 15, 2026', 'Dec 2026 · month only']);
  assert.deepEqual(view!.sides.map((side) => side.state), ['supported', 'supported']);
  assert.match(view!.sides[0]!.summary, /found at its recorded position, in a stored source whose hash matches/);
  assert.match(view!.classification.gloss, /literally different/);
  assert.match(view!.classification.gloss, /not checked/);
  assert.match(view!.classification.gloss, /whether the difference is a legal conflict has not been decided/);
  assert.equal(STATUS_LABEL[view!.observation.status], 'Unresolved');
});

test('same_claim: the same observation, with meaning explicitly not verified', () => {
  const [view] = arrangeComparisons(response({ y_same: OBSERVATIONS.y_same! }));
  assert.equal(view!.headline, 'The two claims are the same');
  assert.equal(STATUS_LABEL[view!.observation.status], 'Same observation · meaning not verified');
  assert.match(view!.classification.gloss, /not a check of meaning/);
  assert.match(view!.classification.gloss, /not a finding that the sources agree/);
  assert.equal(view!.fieldLabel, 'Utility increase cutoff', 'an unlisted field keeps its own name');
  assert.deepEqual(view!.observation.rule_ids, [], 'an observation may name no rule');
});

test('missing_support: an absent passage, a stale passage and a missing source are told apart', () => {
  const views = Object.fromEntries(arrangeComparisons(response(OBSERVATIONS)).map((view) => [view.id, view]));

  assert.equal(views.x_one_absent!.headline, 'One claim has no captured passage');
  assert.deepEqual(views.x_one_absent!.sides.map((side) => side.state), ['supported', 'none']);
  assert.match(views.x_one_absent!.sides[1]!.summary, /No passage was captured/);
  assert.equal(views.x_one_absent!.sides[1]!.value, 'unestablished', 'free text is shown as written');

  assert.equal(views.w_both_absent!.headline, 'Neither claim has a captured passage');
  assert.deepEqual(views.w_both_absent!.sides.map((side) => side.value), ['Local provision unestablished', 'No value recorded']);

  assert.equal(views.v_stale_anchor!.headline, 'A cited passage no longer checks out against its source');
  assert.deepEqual(views.v_stale_anchor!.sides.map((side) => side.state), ['supported', 'stale']);
  assert.equal(supportIssue(staleAnchor), 'anchor_invalid');
  assert.equal(supportProblem(staleAnchor), 'The service did not confirm this passage at its recorded position in the stored source.');
  assert.match(views.v_stale_anchor!.sides[1]!.summary, /did not pass the check.*does not count as support/);

  assert.equal(supportIssue(otherVersion), 'anchor_invalid');
  assert.match(supportProblem(otherVersion)!, /The source hash recorded with the passage is not the stored source’s hash\.$/);

  assert.equal(supportIssue(changedSource), 'identity_mismatch');
  assert.match(supportProblem(changedSource)!, /does not hash to the hash recorded for it/);
  assert.deepEqual(views.t_changed_source!.sides.map((side) => side.state), ['stale', 'supported']);

  assert.equal(supportIssue(missingSource), 'source_missing');
  assert.match(supportProblem(missingSource)!, /not in the snapshot/);
  assert.equal(views.s_missing_source!.headline, 'One claim has no captured passage, and a cited passage no longer checks out');
  assert.equal(views.s_missing_source!.sides[0]!.summary, '1 of 2 passages did not pass the check against the stored source, so the claim is not supported as recorded.');

  // A passage that passed its check has no problem to report, and nothing is inferred beyond the flags.
  assert.equal(supportIssue(valid), null);
  assert.equal(supportProblem(valid), null);
  for (const view of Object.values(views)) {
    if (view.observation.classification !== 'missing_support') continue;
    assert.ok(view.sides.some((side) => side.state !== 'supported'), `${view.id}: the reading agrees with the service’s classification`);
    assert.doesNotMatch(view.headline, /agree|conflict|winner|prefer/i);
  }
});

test('support state reads only the three flags the service returns', () => {
  assert.equal(supportState({ value: 'x', support: [] }), 'none');
  assert.equal(supportState({ value: 'x', support: [valid, valid] }), 'supported');
  assert.equal(supportState({ value: 'x', support: [valid, staleAnchor] }), 'stale');
  assert.equal(supportSummary({ value: 'x', support: [valid, valid] }), 'All 2 passages were found at their recorded positions, in stored sources whose hashes match.');
  // A source whose identity fails is stale even if a payload called its anchor valid.
  assert.equal(supportState({ value: 'x', support: [support((item) => (item.source!.identity_valid = false))] }), 'stale');
});

test('a classification the page cannot explain from the flags falls back to the service’s own label', () => {
  const [view] = arrangeComparisons(response({ odd: observation({ before: { value: 'A', support: [support()] }, after: { value: 'B', support: [support()] } }) }));
  assert.equal(view!.observation.classification, 'missing_support');
  assert.equal(view!.headline, CLASSIFICATION.missing_support.label);
});

test('claimed values: free text as written, dates in their own precision, nothing invented for an empty value', () => {
  const long = 'Municipal conflicting ordinances prohibited, with express other-law exception; January1/March1,2026 are unverified investigation claims';
  assert.equal(claimValue(long), long);
  assert.equal(claimValue('2026-01-24 unverified investigation claim'), '2026-01-24 unverified investigation claim', 'text that merely starts with a date is not reformatted');
  assert.equal(claimValue('2026-02-02'), 'Feb 2, 2026');
  assert.equal(claimValue('2026-12'), 'Dec 2026 · month only');
  assert.equal(claimValue('2026'), '2026', 'a bare year or number is not given a day or month');
  assert.equal(claimValue('$35'), '$35');
  assert.equal(claimValue(null), 'No value recorded');
  assert.equal(claimValue(undefined), 'No value recorded');
  assert.equal(claimValue(''), 'No value recorded');
  assert.equal(claimValue(35), '35');
  assert.equal(claimValue(false), 'No');
  assert.equal(claimValue({ kind: 'cap', amount: 35 }), '{"kind":"cap","amount":35}');
  assert.equal(comparisonFieldLabel('effective_date'), 'Effective date');
  assert.equal(comparisonFieldLabel('interaction'), 'Interaction between rules');
});

test('rule filter: an observation with no rule IDs matches no rule', () => {
  const views = arrangeComparisons(response(OBSERVATIONS));
  const ruleId = base.rule_ids[0]!;
  const named = comparisonsForRules(views, [ruleId]);
  assert.ok(named.length > 0);
  assert.ok(named.every((view) => view.observation.rule_ids.includes(ruleId)));
  assert.ok(!named.some((view) => view.id === 'y_same' || view.id === 'w_both_absent'));
  assert.deepEqual(comparisonsForRules(views, []), []);
});

test('unavailable and empty are absences of comparisons, with the service’s notes kept', () => {
  const unavailable: SourceComparisonsResponse = { status: 'unavailable', observations: {}, annotation_sha256: null, source_hashes: {}, notes: ['Core claim annotations are absent from this snapshot.'], disclaimer: example.response.disclaimer };
  assert.deepEqual(validate('SourceComparisonsResponse', unavailable), { errors: [], warnings: [] });
  assert.deepEqual(arrangeComparisons(unavailable), []);
  assert.deepEqual(comparisonCounts(arrangeComparisons(unavailable)), { different_claims: 0, missing_support: 0, same_claim: 0 });
  assert.deepEqual(arrangeComparisons(response({})), []);
});

// ------------------------------------------------------------------ live adapter
test('live: the response is handed on as sent, labeled with where it came from', async () => {
  const { impl, calls } = fakeFetch({ 'GET /source-comparisons': () => ({ status: 200, body: response(OBSERVATIONS) }) });
  const outcome = await new LiveSource('/api/v1', impl).sourceComparisons();
  assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), ['GET /source-comparisons']);
  assert.deepEqual(outcome.response, response(OBSERVATIONS));
  assert.equal(outcome.origin.kind, 'live');
  assert.equal(outcome.origin.detail, 'GET /api/v1/source-comparisons');
  assert.equal(outcome.recordedStore, undefined, 'a live response is never labeled as a fixture');
  assert.deepEqual(outcome.contractWarnings, []);
});

test('live: a response that names a winner, an amendment or a semantic verdict is refused', async () => {
  const cases: Array<[string, (item: Record<string, unknown>) => void, RegExp]> = [
    ['winner', (item) => (item.winner = 'before'), /winner/],
    ['legal amendment', (item) => (item.legal_amendment = true), /legal_amendment/],
    ['semantic verdict', (item) => (item.semantic_support = 'verified'), /semantic_support/],
    ['unknown classification', (item) => (item.classification = 'conflict'), /classification/],
    ['unknown status', (item) => (item.status = 'resolved'), /status/],
  ];
  for (const [name, change, expected] of cases) {
    const body = response({ one: clone(base) });
    change(body.observations.one as unknown as Record<string, unknown>);
    const { impl } = fakeFetch({ 'GET /source-comparisons': () => ({ status: 200, body }) });
    const error = await rejects(new LiveSource('/api/v1', impl).sourceComparisons());
    assert.equal(error.kind, 'contract', name);
    assert.ok(error.details.some((detail) => expected.test(detail)), `${name}: ${error.details.join(' | ')}`);
  }
});

test('live: an added field is visible drift; a missing route, an unready dataset and a dead connection are errors', async () => {
  const drifted = response({ one: { ...clone(base), confidence: 0.9 } as ClaimComparison });
  const drift = fakeFetch({ 'GET /source-comparisons': () => ({ status: 200, body: drifted }) });
  assert.deepEqual((await new LiveSource('/api/v1', drift.impl).sourceComparisons()).contractWarnings, ['SourceComparisonsResponse.observations.one.confidence: field is not in the contract']);

  const missing = fakeFetch({ 'GET /source-comparisons': () => NOT_FOUND });
  assert.equal((await rejects(new LiveSource('/api/v1', missing.impl).sourceComparisons())).kind, 'not_implemented');
  const unready = fakeFetch({ 'GET /source-comparisons': () => ({ status: 503, body: { detail: { code: 'dataset_unavailable', message: 'Dataset absent; run navigator ingest' } } }) });
  assert.equal((await rejects(new LiveSource('/api/v1', unready.impl).sourceComparisons())).kind, 'unavailable');
  const dead = fakeFetch({ 'GET /source-comparisons': () => new TypeError('Failed to fetch') });
  assert.equal((await rejects(new LiveSource('/api/v1', dead.impl).sourceComparisons())).kind, 'transport');
});

// ------------------------------------------------------------------ demo replay
test('demo: the development fixture’s recorded response is replayed unchanged and labeled as a fixture', async () => {
  const demo = new DemoSource();
  const outcome = await demo.sourceComparisons();
  assert.deepEqual(outcome.response, DEV_SOURCE_COMPARISONS);
  assert.deepEqual(validate('SourceComparisonsResponse', outcome.response), { errors: [], warnings: [] });
  assert.equal(outcome.recordedStore, 'dev_portfolio');
  assert.equal(outcome.origin.label, 'UX development fixture');
  assert.equal(outcome.origin.kind, 'recorded_replay');
  assert.equal(outcome.response.status, 'available');
  for (const [id, item] of Object.entries(outcome.response.observations)) {
    assert.equal(item.semantic_support, 'not_checked', id);
    assert.equal(item.winner ?? null, null, id);
    assert.equal(item.legal_amendment ?? null, null, id);
    for (const passage of [...item.before.support, ...item.after.support]) assert.equal(passage.source?.capture_status, 'synthetic', `${id}: fixture sources are labeled synthetic`);
  }
});

test('demo: the recording’s classifications agree with the flags it carries', () => {
  const views = arrangeComparisons(DEV_SOURCE_COMPARISONS);
  assert.deepEqual(comparisonCounts(views), { different_claims: 2, missing_support: 1, same_claim: 1 });
  for (const view of views) {
    const supported = view.sides.every((side) => side.state === 'supported');
    assert.equal(view.observation.classification === 'missing_support', !supported, view.id);
    if (supported) assert.equal(view.observation.classification === 'same_claim', JSON.stringify(view.observation.before.value) === JSON.stringify(view.observation.after.value), view.id);
    assert.equal(view.observation.remedy, REMEDY, 'the remedy is the service’s own sentence');
  }
});

test('demo: the walkthrough example’s sentence is counted from the recording it opens', () => {
  const example = new DemoSource().catalog().examples.find((item) => item.id === 'source_comparison');
  assert.ok(example);
  assert.deepEqual(example.target, { view: 'disagreements' });
  assert.equal(example.detail, '4 pairs of recorded claims with the exact passages they cite: 2 differ, 1 with support missing or not checking out, 1 is the same. None is given a winner, and each says what would settle it.');
  assert.equal(example.meta, `${Object.keys(DEV_SOURCE_COMPARISONS.source_hashes).length} fictional sources re-checked`);
});
