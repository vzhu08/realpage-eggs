/**
 * POST /changes/summary through the live adapter and the demo replay: Core's result stays
 * authoritative, a missing route is a visible fallback, and nothing else falls back.
 */
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { DemoSource } from '../../src/api/demo';
import { CHANGES_TIMEOUT_MS, LiveSource, changeEchoProblems } from '../../src/api/live';
import type { ChangeRequest, ChangeResult, ChangeSummary } from '../../src/api/types';
import { validate } from '../../src/api/validate';
import { DEV_CHANGES, RECORDED_CHANGES } from '../../src/demo/fixtures';
import { NOT_FOUND, cancelled, clone, fakeFetch, hangUntilAborted, readJson, rejects } from './integration-doubles';

const example = readJson<{ request: ChangeRequest; response: ChangeSummary }>('contracts/evidence_examples/change_summary.json');
const REQUEST: ChangeRequest = { ...example.request, scenario: 'actual' };
const summaryRoute = (response: unknown = example.response) => ({ 'POST /changes/summary': () => ({ status: 200, body: response }) });

test('the checked-in summary example matches ChangeSummary and answers its own request', () => {
  assert.deepEqual(validate('ChangeSummary', example.response), { errors: [], warnings: [] });
  assert.deepEqual(changeEchoProblems(REQUEST, example.response.result), []);
});

test('summary: Core’s result is passed through unchanged, with the labels and groups beside it', async () => {
  const { impl, calls } = fakeFetch(summaryRoute());
  const outcome = await new LiveSource('/api/v1', impl).changes(REQUEST);
  assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), ['POST /changes/summary']);
  assert.deepEqual(calls[0]?.body, REQUEST, 'the request is sent as built, with nothing added');
  assert.deepEqual(outcome.request, REQUEST, 'the outcome names the request it answers');
  assert.deepEqual(outcome.result, example.response.result);
  assert.deepEqual(outcome.summary, { property_labels: example.response.property_labels, rule_labels: example.response.rule_labels, by_jurisdiction: example.response.by_jurisdiction, by_category: example.response.by_category, notes: example.response.notes });
  assert.equal('result' in (outcome.summary as object), false);
  assert.deepEqual(outcome.notices, []);
  assert.equal(outcome.origin.detail, 'POST /api/v1/changes/summary');
});

test('summary: status and notes stay authoritative when the groups are empty', async () => {
  const blocked: ChangeSummary = {
    result: { ...example.response.result, status: 'blocked', affected_address_ids: [], uncertain_address_ids: [], differences: {}, notes: ['No extracted rules available'] },
    property_labels: {},
    rule_labels: {},
    by_jurisdiction: {},
    by_category: {},
    notes: example.response.notes,
  };
  const { impl } = fakeFetch(summaryRoute(blocked));
  const outcome = await new LiveSource('/api/v1', impl).changes(REQUEST);
  assert.equal(outcome.result.status, 'blocked');
  assert.deepEqual(outcome.result.notes, ['No extracted rules available']);
  assert.deepEqual(outcome.summary?.by_jurisdiction, {});
  assert.deepEqual(outcome.summary?.notes, example.response.notes, 'the service’s own caution about empty groups is kept');
});

test('summary: labels with missing or extra keys are passed through as sent', async () => {
  const uneven = clone(example.response);
  const [firstProperty] = Object.keys(uneven.property_labels);
  delete uneven.property_labels[firstProperty!];
  uneven.property_labels['NOT-IN-RESULT'] = '9 ELSEWHERE ROAD';
  uneven.rule_labels = {};
  const { impl } = fakeFetch(summaryRoute(uneven));
  const outcome = await new LiveSource('/api/v1', impl).changes(REQUEST);
  assert.deepEqual(outcome.summary?.property_labels, uneven.property_labels);
  assert.deepEqual(outcome.summary?.rule_labels, {});
  assert.deepEqual(outcome.result.affected_address_ids, example.response.result.affected_address_ids, 'a missing label removes nothing from the result');
});

test('summary: a route that does not exist is a visible fallback to POST /changes, probed once', async () => {
  for (const missing of [NOT_FOUND, { status: 405, body: { detail: 'Method Not Allowed' } }]) {
    const { impl, calls } = fakeFetch({ 'POST /changes/summary': () => missing, 'POST /changes': () => ({ status: 200, body: example.response.result }) });
    const live = new LiveSource('/api/v1', impl);
    const outcome = await live.changes(REQUEST);
    assert.deepEqual(calls.map((call) => call.path), ['/changes/summary', '/changes']);
    assert.deepEqual(calls[1]?.body, REQUEST);
    assert.deepEqual(outcome.result, example.response.result);
    assert.equal(outcome.summary, null, 'no labels or groups are made up');
    assert.equal(outcome.notices.length, 1);
    assert.match(outcome.notices[0]!, /POST \/changes\/summary is not available on this backend/);
    assert.equal(outcome.origin.detail, 'POST /api/v1/changes');
    await live.changes(REQUEST);
    assert.equal(calls.filter((call) => call.path === '/changes/summary').length, 1, 'the missing route is remembered');
  }
});

test('summary: an unknown scenario ID is a stale selection, not a missing route', async () => {
  const { impl, calls } = fakeFetch({ 'POST /changes/summary': () => ({ status: 404, body: { detail: { code: 'unknown_id', message: 'Unknown test ID NOPE' } } }), 'POST /changes': () => ({ status: 200, body: example.response.result }) });
  const error = await rejects(new LiveSource('/api/v1', impl).changes({ test_id: 'NOPE' }));
  assert.equal(error.kind, 'not_found');
  assert.match(error.message, /Unknown test ID NOPE/);
  assert.equal(calls.length, 1, 'POST /changes is not asked instead');
});

test('summary: a response that does not match the contract is an error, never a silent fallback', async () => {
  const broken = clone(example.response) as unknown as Record<string, unknown>;
  delete broken.property_labels;
  (broken.result as { status: string }).status = 'done';
  const { impl, calls } = fakeFetch({ 'POST /changes/summary': () => ({ status: 200, body: broken }), 'POST /changes': () => ({ status: 200, body: example.response.result }) });
  const error = await rejects(new LiveSource('/api/v1', impl).changes(REQUEST));
  assert.equal(error.kind, 'contract');
  assert.equal(error.endpoint, 'POST /changes/summary');
  assert.ok(error.details.some((detail) => detail.includes('property_labels')), error.details.join('\n'));
  assert.ok(error.details.some((detail) => detail.includes('"done"')), error.details.join('\n'));
  assert.deepEqual(calls.map((call) => call.path), ['/changes/summary']);
});

test('summary: service failures on the summary route are reported, not routed around', async () => {
  const cases = [
    { reply: { status: 503, body: { detail: { code: 'dataset_unavailable', message: 'Dataset absent; run navigator ingest' } } }, kind: 'unavailable' },
    { reply: { status: 502, body: { detail: { code: 'core_contract_error', message: 'Core output did not satisfy the shared contract' } } }, kind: 'dependency' },
    { reply: { status: 422, body: { detail: { code: 'invalid_input', message: 'Supply test_id or both before and after' } } }, kind: 'invalid_request' },
    { reply: new TypeError('Failed to fetch'), kind: 'transport' },
  ] as const;
  for (const { reply, kind } of cases) {
    const { impl, calls } = fakeFetch({ 'POST /changes/summary': () => reply, 'POST /changes': () => ({ status: 200, body: example.response.result }) });
    const error = await rejects(new LiveSource('/api/v1', impl).changes(REQUEST));
    assert.equal(error.kind, kind);
    assert.equal(calls.length, 1, `${kind}: POST /changes is not asked instead`);
  }
});

test('a result for another comparison is refused on either route', async () => {
  const other: ChangeResult = { ...example.response.result, before: '2026-01-01' };
  assert.deepEqual(changeEchoProblems(REQUEST, other), ['result.before is "2026-01-01"; "2026-11-14" was asked.']);
  assert.equal(changeEchoProblems({ test_id: 'T1' }, { ...example.response.result, test_id: 'T2' }).length, 1);
  assert.deepEqual(changeEchoProblems({ test_id: 'T1' }, { ...example.response.result, test_id: 'T1', before: '2020-01-01', scenario: 'if_enacted' }), [], 'a published scenario brings its own dates and treatment');
  assert.equal(changeEchoProblems({ before: '2026-11-14', after: '2026-11-15', scenario: 'if_enacted' }, example.response.result).length, 1);
  assert.deepEqual(changeEchoProblems({ before: '2026-11-14', after: '2026-11-15' }, example.response.result), [], 'an omitted scenario is the contract default, "actual"');

  const summary = fakeFetch(summaryRoute({ ...example.response, result: other }));
  const first = await rejects(new LiveSource('/api/v1', summary.impl).changes(REQUEST));
  assert.equal(first.kind, 'contract');
  assert.match(first.message, /different comparison/);
  assert.equal(summary.calls.length, 1);

  const plain = fakeFetch({ 'POST /changes': () => ({ status: 200, body: other }) });
  const second = await rejects(new LiveSource('/api/v1', plain.impl).changes(REQUEST));
  assert.equal(second.kind, 'contract');
  assert.equal(second.endpoint, 'POST /changes');
});

test('abort: a caller that is already gone sends nothing', async () => {
  const { impl, calls } = fakeFetch(summaryRoute());
  const gone = new AbortController();
  gone.abort();
  await cancelled(new LiveSource('/api/v1', impl).changes(REQUEST, gone.signal));
  assert.equal(calls.length, 0);
});

test('abort: cancelling a running comparison ends as a cancellation and does not fall back', async () => {
  let asked = 0;
  const { impl, calls } = fakeFetch({
    'POST /changes/summary': (body, call) => ((asked += 1) === 1 ? hangUntilAborted(body, call) : { status: 200, body: example.response }),
    'POST /changes': () => ({ status: 200, body: example.response.result }),
  });
  const live = new LiveSource('/api/v1', impl);
  const leaving = new AbortController();
  const pending = live.changes(REQUEST, leaving.signal);
  leaving.abort();
  await cancelled(pending);
  assert.deepEqual(calls.map((call) => call.path), ['/changes/summary']);
  assert.equal(calls[0]?.signal?.aborted, true, 'the request itself was aborted');
  // The route is not written off because one caller left: the next comparison still uses it.
  const next = await live.changes(REQUEST);
  assert.notEqual(next.summary, null);
  assert.deepEqual(calls.map((call) => call.path), ['/changes/summary', '/changes/summary']);
});

test('abort: a response that lands after the caller left is never handed back', async () => {
  // A transport that ignores cancellation and answers anyway.
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const { impl } = fakeFetch({
    'POST /changes/summary': async () => {
      await gate;
      return { status: 200, body: example.response };
    },
  });
  const leaving = new AbortController();
  const pending = new LiveSource('/api/v1', impl).changes(REQUEST, leaving.signal);
  leaving.abort();
  release();
  await cancelled(pending);
});

test('abort: a cancellation during the fallback request is still a cancellation', async () => {
  const leaving = new AbortController();
  const { impl, calls } = fakeFetch({
    'POST /changes/summary': () => {
      leaving.abort();
      return NOT_FOUND;
    },
    'POST /changes': () => ({ status: 200, body: example.response.result }),
  });
  await cancelled(new LiveSource('/api/v1', impl).changes(REQUEST, leaving.signal));
  assert.deepEqual(calls.map((call) => call.path), ['/changes/summary'], 'the fallback is not sent for a caller that left');
});

test('timeout: after the stated wait it is a timeout with truthful words, not a result and not a fallback', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { impl, calls } = fakeFetch({ 'POST /changes/summary': hangUntilAborted, 'POST /changes': () => ({ status: 200, body: example.response.result }) });
    const pending = rejects(new LiveSource('/api/v1', impl).changes(REQUEST));
    mock.timers.tick(CHANGES_TIMEOUT_MS - 1);
    assert.equal(calls[0]?.signal?.aborted, false, 'still waiting just before the limit');
    mock.timers.tick(1);
    const error = await pending;
    assert.equal(CHANGES_TIMEOUT_MS, 180_000);
    assert.equal(error.kind, 'timeout');
    assert.equal(error.endpoint, 'POST /changes/summary');
    assert.match(error.message, /No response within 180 seconds/);
    assert.ok(error.details.some((detail) => /may still be working/.test(detail)));
    assert.ok(error.details.some((detail) => /not a finding that nothing changed/.test(detail)));
    assert.equal(calls.length, 1, 'POST /changes is not asked instead');
  } finally {
    mock.timers.reset();
  }
});

// ------------------------------------------------------------------ demo replay
test('demo: a recorded comparison replays as the summary route returns it, and validates', async () => {
  const demo = new DemoSource();
  for (const entry of [...DEV_CHANGES, ...RECORDED_CHANGES]) {
    assert.deepEqual(validate('ChangeSummary', { result: entry.response, ...entry.summary }).errors, [], JSON.stringify(entry.request));
    assert.deepEqual(changeEchoProblems(entry.request, entry.response), [], JSON.stringify(entry.request));
  }
  const outcome = await demo.changes({ before: '2026-10-01', after: '2027-01-15', scenario: 'actual' });
  const recorded = DEV_CHANGES.find((entry) => entry.request.after === '2027-01-15' && entry.request.scenario === 'actual')!;
  assert.deepEqual(outcome.result, recorded.response);
  assert.deepEqual(outcome.summary, recorded.summary);
  assert.equal(outcome.recordedStore, 'dev_portfolio');
  assert.equal(outcome.origin.label, 'UX development fixture');
  assert.deepEqual(outcome.notices, []);
});

test('demo: group counts overlap in the recording, so they are never a total', async () => {
  const outcome = await new DemoSource().changes({ before: '2026-10-01', after: '2027-01-15', scenario: 'actual' });
  const groups = Object.values(outcome.summary!.by_jurisdiction);
  const summed = groups.reduce((total, group) => total + group.affected_address_ids.length, 0);
  const distinct = new Set(groups.flatMap((group) => group.affected_address_ids));
  assert.ok(summed > distinct.size, 'a property is counted under more than one jurisdiction');
  assert.deepEqual([...distinct].sort(), [...outcome.result.affected_address_ids].sort(), 'the union of the groups is Core’s own set');
  const both = outcome.result.affected_address_ids.filter((id) => outcome.result.uncertain_address_ids.includes(id));
  assert.ok(both.length > 0, 'a property can be definitely affected by one rule and uncertain under another');
});

test('demo: a blocked scenario keeps its status and notes with empty groups', async () => {
  const outcome = await new DemoSource().changes({ test_id: 'T1' });
  assert.equal(outcome.result.status, 'blocked');
  assert.ok(outcome.result.notes.length > 0);
  assert.deepEqual(outcome.summary?.by_jurisdiction, {});
  assert.deepEqual(outcome.summary?.by_category, {});
  assert.ok(outcome.summary!.notes.some((note) => /empty group does not establish no impact/i.test(note)));
  assert.equal(outcome.recordedStore, 'no_extracted_rules');
});

test('demo: an aborted replay is a cancellation, whether it is cancelled before or during the replay', async () => {
  const leaving = new AbortController();
  const pending = new DemoSource().changes({ test_id: 'T1' }, leaving.signal);
  leaving.abort();
  await cancelled(pending);
  await cancelled(new DemoSource().changes({ test_id: 'T1' }, leaving.signal));
});
