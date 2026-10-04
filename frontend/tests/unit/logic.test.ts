import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ApiError } from '../../src/api/errors';
import { DEFAULT_AS_OF } from '../../src/api/generated/meta';
import type { AddressItem, Answer, Rule } from '../../src/api/types';
import { LOOKUP_EXAMPLES, RECORDED_ASSISTS, RECORDED_SOURCES, RESEARCH_FIXTURES } from '../../src/demo/fixtures';
import { formFromDefinition, parseAnswer } from '../../src/lib/answers';
import { readDifferences } from '../../src/lib/changes';
import { datePrecision, formatDate, formatTimestamp, isIsoDay } from '../../src/lib/dates';
import { diffOutcomes } from '../../src/lib/diff';
import { describeExpression, inferAnswerForm } from '../../src/lib/expression';
import { parseReason } from '../../src/lib/labels';
import { isSynthetic, readMetadata } from '../../src/lib/metadata';
import { checkQuote, codePointSlice, excerptAround } from '../../src/lib/text';
import { DemoSource } from '../../src/api/demo';
import { initialSession, sessionReducer, withAnswer } from '../../src/state/session';

// ------------------------------------------------------------------ dates
test('the default query date comes from the contract, not the clock', () => {
  assert.equal(DEFAULT_AS_OF, '2026-10-01');
  const openapi = JSON.parse(readFileSync(new URL('../../../contracts/openapi.json', import.meta.url), 'utf8'));
  assert.equal(DEFAULT_AS_OF, openapi.components.schemas.LookupRequest.properties.as_of.default);
  assert.equal(initialSession(DEFAULT_AS_OF).asOf, '2026-10-01');
});

test('ISO days are validated as real calendar dates', () => {
  assert.ok(isIsoDay('2028-02-29'));
  assert.ok(!isIsoDay('2026-02-29'));
  assert.ok(!isIsoDay('2026-13-01'));
  assert.ok(!isIsoDay('2026-1-1'));
  assert.ok(!isIsoDay(''));
});

test('dates format without shifting across time zones and keep their precision', () => {
  assert.equal(formatDate('2026-11-15'), 'Nov 15, 2026');
  assert.equal(formatDate('2026-01-01'), 'Jan 1, 2026');
  assert.equal(formatDate('2020-06'), 'Jun 2020');
  assert.equal(formatDate('2020'), '2020');
  assert.equal(formatDate(null), '—');
  assert.equal(datePrecision('2020-06'), 'month');
  assert.equal(datePrecision('2020-6'), null);
  assert.equal(formatTimestamp('2026-10-03T00:00:00Z'), 'Oct 3, 2026, 00:00 UTC');
  assert.equal(formatTimestamp(null), 'Not recorded');
});

// ------------------------------------------------------------------ answers
test('answers are typed from the fact definition and validated before sending', () => {
  const units = RESEARCH_FIXTURES[0]!.response.question_plan.questions[0]!.fact;
  const form = formFromDefinition(units);
  assert.deepEqual(form, { type: 'integer', minimum: 1 });
  assert.deepEqual(parseAnswer(form, ' 12 '), { ok: true, value: 12 });
  assert.equal(parseAnswer(form, '0').ok, false);
  assert.equal(parseAnswer(form, '7.5').ok, false);
  assert.equal(parseAnswer(form, 'eight').ok, false);
  assert.equal(parseAnswer(form, '').ok, false);
});

test('date answers keep partial precision and reject impossible dates', () => {
  const certificate = RESEARCH_FIXTURES.find((fixture) => fixture.case === 'two_unresolved_exemptions')!.response.question_plan.questions[0]!.fact;
  const form = formFromDefinition(certificate);
  assert.deepEqual(parseAnswer(form, '2020'), { ok: true, value: '2020' });
  assert.deepEqual(parseAnswer(form, '2020-06'), { ok: true, value: '2020-06' });
  assert.deepEqual(parseAnswer(form, '2020-06-30'), { ok: true, value: '2020-06-30' });
  assert.equal(parseAnswer(form, '2020-06-31').ok, false);
  assert.equal(parseAnswer(form, '06/30/2020').ok, false);
  assert.equal(parseAnswer({ type: 'date', allowPartial: false }, '2020-06').ok, false);
});

test('booleans must be explicit and enums exact', () => {
  assert.deepEqual(parseAnswer({ type: 'boolean' }, 'true'), { ok: true, value: true });
  assert.deepEqual(parseAnswer({ type: 'boolean' }, 'false'), { ok: true, value: false });
  assert.equal(parseAnswer({ type: 'boolean' }, 'yes').ok, false);
  assert.deepEqual(parseAnswer({ type: 'enum', options: ['llc', 'trust'] }, 'llc'), { ok: true, value: 'llc' });
  assert.equal(parseAnswer({ type: 'enum', options: ['llc', 'trust'] }, 'LLC').ok, false);
});

test('without a fact definition the control follows how the encoded rule compares the fact', () => {
  const rules = RESEARCH_FIXTURES.find((fixture) => fixture.case === 'two_unresolved_exemptions')!.response.lookup.rules as Rule[];
  assert.deepEqual(inferAnswerForm('units', rules), { type: 'integer' });
  assert.deepEqual(inferAnswerForm('certificate_of_occupancy', rules), { type: 'date', allowPartial: true });
  assert.deepEqual(inferAnswerForm('owner_occupied', rules), { type: 'boolean' });
  assert.deepEqual(inferAnswerForm('never_mentioned', rules), { type: 'string' });
});

// ------------------------------------------------------------------ text and evidence offsets
test('offsets are code points, so astral characters do not shift later quotes', () => {
  const text = 'A🏠B quoted span here';
  assert.equal(codePointSlice(text, 4, 15), 'quoted span');
  assert.equal(text.slice(4, 15), ' quoted spa');
  assert.deepEqual(checkQuote(text, 'quoted span', 4, 15), { state: 'match', start: 4, end: 15 });
  assert.equal(checkQuote(text, 'quoted span', 5, 16).state, 'mismatch');
  assert.equal(checkQuote(text, 'quoted span', null, null).state, 'no_offsets');
  assert.equal(checkQuote('', 'quoted span', 4, 15).state, 'no_text');
});

test('every quote in the recorded lookups is found at its offsets in the recorded source', () => {
  let checked = 0;
  for (const lookup of [...RECORDED_ASSISTS.map((entry) => entry.response.lookup), ...LOOKUP_EXAMPLES.map((entry) => entry.response)]) {
    for (const rule of lookup.rules) {
      for (const item of rule.evidence) {
        const source = RECORDED_SOURCES[item.doc_id];
        assert.ok(source, item.doc_id);
        assert.equal(checkQuote(source.text, item.quote, item.start, item.end).state, 'match', item.quote);
        checked += 1;
      }
    }
  }
  assert.ok(checked > 0);
});

test('surrounding context keeps the quote intact and marks clipped text', () => {
  const source = Object.values(RECORDED_SOURCES)[0]!;
  const rule = LOOKUP_EXAMPLES[0]!.response.rules[0]!;
  const item = rule.evidence[0]!;
  const excerpt = excerptAround(source.text ?? '', item.start!, item.end!, 60);
  assert.equal(excerpt.match, item.quote);
  assert.ok(excerpt.clippedStart);
  assert.ok((source.text ?? '').includes(excerpt.before + excerpt.match + excerpt.after));
});

// ------------------------------------------------------------------ presentation helpers
test('expression display preserves operators, grouping and thresholds', () => {
  const rule = RESEARCH_FIXTURES.find((fixture) => fixture.case === 'two_unresolved_exemptions')!.response.lookup.rules[0]!;
  const coverage = describeExpression(rule.coverage_conditions, 'coverage_conditions');
  assert.equal(coverage.text, 'All of');
  assert.deepEqual(coverage.children.map((child) => child.text), ['units ≥ 4', 'certificate of occupancy is on or before 2020-06-30']);
  assert.equal(coverage.children[1]?.path, 'coverage_conditions/args/1');
  const exemption = describeExpression(rule.exemption_conditions!, 'exemption_conditions');
  assert.equal(exemption.text, 'Any of');
  assert.deepEqual(exemption.children.map((child) => child.text), ['owner occupied = Yes', 'exemption filed = Yes']);
  assert.equal(describeExpression({ op: 'unsupported', reason: 'cross-reference not encoded' }, 'x').kind, 'unsupported');
});

test('uncertainty reasons keep their kind so a source gap is never shown as a question', () => {
  assert.equal(parseReason('missing_property_fact: units').kind, 'missing_property_fact');
  assert.equal(parseReason('jurisdiction_uncertainty: legal municipality unresolved').label, 'Jurisdiction uncertain');
  assert.equal(parseReason('conflicting_legal_evidence: Review source disagreement').label, 'Conflicting evidence');
  assert.equal(parseReason('something new').kind, 'other');
});

test('metadata is read defensively and synthetic data is recognized from the payload', () => {
  const metadata = readMetadata(LOOKUP_EXAMPLES[0]!.response);
  assert.equal(metadata.datasetMode, 'synthetic');
  assert.ok(isSynthetic(metadata));
  assert.equal(metadata.partialData, false);
  const partial = readMetadata({ ...LOOKUP_EXAMPLES[0]!.response, metadata: { partial_data: true, missing_source_ids: ['D1', 2], rule_modes: 'live' } });
  assert.equal(partial.partialData, true);
  assert.deepEqual(partial.missingSourceIds, ['D1']);
  assert.deepEqual(partial.ruleModes, []);
  assert.ok(!isSynthetic(partial));
});

test('change differences are read defensively; malformed entries are kept visible', async () => {
  const outcome = await new DemoSource().changes({ before: '2026-10-01', after: '2026-11-15', scenario: 'actual' });
  const diffs = readDifferences(outcome.result);
  assert.deepEqual(diffs.map((diff) => [diff.addressId, diff.deltas.map((delta) => [delta.certainty, delta.before?.result, delta.after?.result])]), [
    ['SYNTH-001', [['definite', 'not_yet_effective', 'applies']]],
    ['SYNTH-003', [['uncertain', 'not_yet_effective', 'unknown']]],
  ]);
  const odd = readDifferences({ ...outcome.result, differences: { X: [{ team_rule_id: 'r', certainty: 'definite', after: { nope: true } }] } });
  assert.equal(odd[0]?.deltas.length, 0);
  assert.equal(odd[0]?.unreadable.length, 1);
});

test('diffing two results reports moved, unchanged and delisted rules', async () => {
  const demo = new DemoSource();
  const query = { address_id: 'SYNTH-003', as_of: '2026-11-15', fixtureCase: 'decisive_question' };
  const before = await demo.lookup({ ...query, answers: [] });
  const applies = await demo.lookup({ ...query, answers: [{ field: 'units', value: 8, provenance: 'demo' }] });
  const delisted = await demo.lookup({ ...query, answers: [{ field: 'units', value: 7, provenance: 'demo' }] });
  assert.deepEqual(diffOutcomes(before, applies).map((change) => [change.kind, change.before?.result, change.after?.result]), [['changed', 'unknown', 'applies']]);
  const gone = diffOutcomes(before, delisted)[0]!;
  assert.equal(gone.kind, 'no_longer_listed');
  assert.equal(gone.recordedAfter?.result, 'inapplicable');
  assert.equal(diffOutcomes(before, before)[0]?.kind, 'unchanged');
});

// ------------------------------------------------------------------ session
const item = { property: LOOKUP_EXAMPLES[2]!.response.address, resolution: LOOKUP_EXAMPLES[2]!.response.jurisdiction } as AddressItem;
const units: Answer = { field: 'units', value: 8, provenance: 'user_provided' };

test('answers accumulate per field and are replaced, not duplicated', () => {
  let answers = withAnswer([], 'units', units);
  answers = withAnswer(answers, 'owner_occupied', { field: 'owner_occupied', value: null, provenance: 'user_provided' });
  answers = withAnswer(answers, 'units', { ...units, value: 7 });
  assert.deepEqual(answers.map((answer) => [answer.field, answer.value]), [['owner_occupied', null], ['units', 7]]);
  assert.deepEqual(withAnswer(answers, 'units', undefined).map((answer) => answer.field), ['owner_occupied']);
});

test('changing the date or the property clears request-local answers', () => {
  let state = sessionReducer(initialSession(DEFAULT_AS_OF), { type: 'select', item, fixtureCase: null });
  state = sessionReducer(state, { type: 'answers', answers: [units], event: { field: 'units', value: 8, provenance: 'user_provided', action: 'answered' } });
  assert.equal(state.answers.length, 1);
  assert.equal(state.history[0]?.seq, 1);
  const moved = sessionReducer(state, { type: 'asOf', value: '2026-11-15' });
  assert.deepEqual(moved.answers, []);
  assert.equal(moved.asOf, '2026-11-15');
  assert.ok(moved.dirty);
  const reselected = sessionReducer(state, { type: 'select', item, fixtureCase: null });
  assert.deepEqual(reselected.answers, []);
});

test('a failed re-evaluation keeps the earlier result and reports the failure beside it', async () => {
  const outcome = await new DemoSource().lookup({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [] });
  let state = sessionReducer(initialSession('2026-11-15'), { type: 'select', item, fixtureCase: null });
  state = sessionReducer(state, { type: 'start', keepPrevious: false });
  state = sessionReducer(state, { type: 'success', outcome });
  state = sessionReducer(state, { type: 'start', keepPrevious: true });
  assert.ok(state.reevaluating);
  const error = new ApiError({ kind: 'invalid_request', endpoint: 'POST /lookup', message: 'units is below its valid minimum', status: 422 });
  state = sessionReducer(state, { type: 'failure', error, keepOutcome: true });
  assert.equal(state.status, 'ready');
  assert.equal(state.outcome, outcome);
  assert.equal(state.answerError, error);
  const fresh = sessionReducer(state, { type: 'failure', error, keepOutcome: false });
  assert.equal(fresh.status, 'error');
  assert.equal(fresh.outcome, null);
});
