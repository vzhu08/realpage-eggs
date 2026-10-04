/** Adapter behavior: the demo never invents a result, and the live adapter never hides a failure. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DemoSource } from '../../src/api/demo';
import { ApiError } from '../../src/api/errors';
import { LiveSource } from '../../src/api/live';
import type { Answer } from '../../src/api/types';
import { ASSIST_EXAMPLE, DEV_ASSISTS, DEV_CHANGES, DEV_RULES, DEV_SOURCES, ERROR_EXAMPLES, LOOKUP_EXAMPLES, RECORDED_ASSISTS, RECORDED_CHANGES, RECORDED_RULES, RECORDED_SOURCES, RESEARCH_FIXTURES } from '../../src/demo/fixtures';

const rejects = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof ApiError, String(error));
    return error;
  }
  assert.fail('expected the request to fail');
};

interface Call {
  method: string;
  path: string;
  body: unknown;
}

/** A fetch double that answers from a route table and records every call. */
function fakeFetch(routes: Record<string, (body: unknown) => { status: number; body?: unknown; text?: string } | Error>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://api.test');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const path = url.pathname.replace(/^\/api\/v1/, '');
    calls.push({ method, path: path + url.search, body });
    const handler = routes[`${method} ${path}`];
    const result = handler ? handler(body) : { status: 404, body: { detail: 'Not Found' } };
    if (result instanceof Error) throw result;
    const text = result.text ?? (result.body === undefined ? '' : JSON.stringify(result.body));
    return new Response(text, { status: result.status, headers: { 'Content-Type': 'application/json' } });
  }) as typeof fetch;
  return { impl, calls };
}

const unknownExample = LOOKUP_EXAMPLES.find((example) => example.request.address_id === 'SYNTH-003')!;
const decisive = RESEARCH_FIXTURES.find((fixture) => fixture.case === 'decisive_question')!;

// ------------------------------------------------------------------ demo
test('demo: the address list is the contract examples plus the development fixture, and search filters it', async () => {
  const demo = new DemoSource();
  const all = await demo.addresses({ q: '', offset: 0, limit: 25 });
  assert.equal(all.total, 17);
  assert.deepEqual(all.items.map((item) => item.property.address_id).filter((id) => id.startsWith('SYNTH-')), ['SYNTH-001', 'SYNTH-002', 'SYNTH-003']);
  assert.equal(all.items.filter((item) => item.property.address_id.startsWith('DEV-P')).length, 14);
  // Paging works the way GET /addresses does.
  const page = await demo.addresses({ q: '', offset: 15, limit: 25 });
  assert.equal(page.items.length, 2);
  const none = await demo.addresses({ q: 'not-present', offset: 0, limit: 25 });
  assert.equal(none.total, 0);
  const one = await demo.addresses({ q: 'synth-002', offset: 0, limit: 25 });
  assert.equal(one.total, 1);
});

test('demo: the API\'s checked-in assist example is served verbatim and labeled with its path', async () => {
  const outcome = await new DemoSource().lookup({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [] });
  assert.deepEqual(outcome.lookup, ASSIST_EXAMPLE.response.lookup);
  assert.deepEqual(outcome.assist?.question_plan, ASSIST_EXAMPLE.response.question_plan);
  assert.equal(outcome.origin.kind, 'checked_in_example');
  assert.equal(outcome.origin.detail, 'contracts/examples/assist.json');
  assert.equal(outcome.planner.kind, 'response');
  assert.equal(outcome.fixture, undefined);
  assert.equal(outcome.assist?.evidence_reports.length, 1);
  assert.equal(outcome.assist?.encoded_rules.length, 1);
});

test('demo: an answer on the API example replays through the planner\'s interval', async () => {
  const outcome = await new DemoSource().lookup({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [{ field: 'units', value: 12, provenance: 'user_provided' }] });
  assert.equal(outcome.lookup.evaluations[0]?.result, 'applies');
  assert.equal(outcome.dispositions[0]?.status, 'applied');
  assert.equal(outcome.origin.kind, 'fixture_replay');
});

test('demo: the ordinary lookup examples show the same evaluations as the recorded responses for those requests', async () => {
  for (const example of LOOKUP_EXAMPLES) {
    const outcome = await new DemoSource().lookup({ ...example.request, answers: [] });
    const summary = (evaluations: typeof outcome.lookup.evaluations) => evaluations.map((item) => [item.team_rule_id, item.result, item.missing_facts, item.uncertainty_reasons, item.explanation]);
    assert.deepEqual(summary(outcome.lookup.evaluations), summary(example.response.evaluations), example.path);
    assert.deepEqual(outcome.lookup.address, example.response.address, example.path);
  }
});

test('demo: a fixture whose source text is missing is not contradicted by the recorded source', async () => {
  const demo = new DemoSource();
  await demo.lookup({ address_id: 'SYNTH-001', as_of: '2026-11-15', answers: [], fixtureCase: 'missing_support' });
  assert.equal((await demo.source('SYNTHETIC-42')).text, '');
  await demo.lookup({ address_id: 'SYNTH-001', as_of: '2026-11-15', answers: [] });
  assert.match((await demo.source('SYNTHETIC-42')).text ?? '', /^SYNTHETIC TEST DOCUMENT/);
});

test('demo: fact definitions come only from checked-in and recorded questions', async () => {
  const facts = await new DemoSource().facts();
  assert.equal(facts?.units?.data_type, 'integer');
  assert.equal(facts?.certificate_of_occupancy?.data_type, 'date');
});

test('demo: the contract default date is served from recorded backend output', async () => {
  const outcome = await new DemoSource().lookup({ address_id: 'SYNTH-001', as_of: '2026-10-01', answers: [] });
  assert.equal(outcome.origin.kind, 'recorded_replay');
  assert.equal(outcome.lookup.evaluations[0]?.result, 'not_yet_effective');
});

test('demo: a date with no recording is refused with the recorded dates, never answered', async () => {
  const error = await rejects(new DemoSource().lookup({ address_id: 'SYNTH-001', as_of: '2027-03-01', answers: [] }));
  assert.equal(error.kind, 'not_recorded');
  assert.deepEqual(error.suggestions, ['2026-08-31', '2026-10-01', '2026-11-14', '2026-11-15']);
});

test('demo: an unknown address is a stale selection, with the backend wording', async () => {
  const error = await rejects(new DemoSource().lookup({ address_id: 'MISSING', as_of: '2026-11-15', answers: [] }));
  assert.equal(error.kind, 'not_found');
  assert.equal(error.message, ERROR_EXAMPLES.unknown_address.detail.message);
});

test('demo: a fixture case is pinned to its own property and date', async () => {
  const error = await rejects(new DemoSource().lookup({ address_id: 'SYNTH-003', as_of: '2026-10-01', answers: [], fixtureCase: 'decisive_question' }));
  assert.equal(error.kind, 'not_recorded');
  const outcome = await new DemoSource().lookup({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [], fixtureCase: 'decisive_question' });
  assert.equal(outcome.fixture?.contractStatus, 'proposed_core_output_not_live_service');
  assert.equal(outcome.assist?.capabilities.question_planner, 'dependency_unavailable');
});

test('demo: recorded comparisons replay; anything else is refused', async () => {
  const demo = new DemoSource();
  const recorded = await demo.changes({ before: '2026-10-01', after: '2026-11-15', scenario: 'actual' });
  assert.deepEqual(recorded.result.affected_address_ids, ['SYNTH-001']);
  assert.deepEqual(recorded.result.uncertain_address_ids, ['SYNTH-003']);
  const blocked = await demo.changes({ test_id: 'T1' });
  assert.equal(blocked.result.status, 'blocked');
  assert.equal(blocked.recordedStore, 'no_extracted_rules');
  const error = await rejects(demo.changes({ before: '2026-01-01', after: '2026-02-01' }));
  assert.equal(error.kind, 'not_recorded');
  assert.ok(error.suggestions.length >= 9);
});

test('demo: a replayed comparison says which recorded store it came from, with that store’s own summary', async () => {
  const demo = new DemoSource();
  const maple = await demo.changes({ before: '2026-10-01', after: '2026-11-15', scenario: 'actual' });
  assert.equal(maple.recordedStore, 'synthetic');
  assert.equal(maple.origin.label, 'Recorded backend output');
  assert.deepEqual(Object.keys(maple.summary?.by_jurisdiction ?? {}), ['Maple Harbor, CA']);
  assert.deepEqual(maple.notices, []);
  const portfolio = await demo.changes({ before: '2026-10-01', after: '2027-01-15', scenario: 'actual' });
  assert.equal(portfolio.recordedStore, 'dev_portfolio');
  assert.equal(portfolio.origin.label, 'UX development fixture');
  assert.ok(Object.keys(portfolio.summary?.property_labels ?? {}).every((id) => id.startsWith('DEV-P')), 'labels come from the same store as the result');
  // An omitted scenario is the contract default, so it replays the "actual" recording and no other.
  assert.deepEqual((await demo.changes({ before: '2026-10-01', after: '2027-01-15' })).result, portfolio.result);
  assert.notDeepEqual((await demo.changes({ before: '2026-10-01', after: '2027-01-15', scenario: 'if_enacted' })).result, portfolio.result);
});

test('demo: the recorded stores are never mixed', async () => {
  // No request is answerable from two stores, so a replay can only ever come from one.
  const key = (request: { address_id: string; as_of: string }) => `${request.address_id}|${request.as_of}`;
  const overlap = <T>(a: T[], b: T[]) => a.filter((item) => b.includes(item));
  assert.deepEqual(overlap(DEV_ASSISTS.map((entry) => key(entry.request)), RECORDED_ASSISTS.map((entry) => key(entry.request))), []);
  assert.deepEqual(overlap(DEV_CHANGES.map((entry) => JSON.stringify(entry.request)), RECORDED_CHANGES.map((entry) => JSON.stringify(entry.request))), []);
  assert.deepEqual(overlap(Object.keys(DEV_RULES), Object.keys(RECORDED_RULES)), []);
  assert.deepEqual(overlap(Object.keys(DEV_SOURCES), Object.keys(RECORDED_SOURCES)), []);
  // A development-fixture lookup carries only development-fixture rules and sources, and says where it came from.
  const outcome = await new DemoSource().lookup({ address_id: 'DEV-P07', as_of: '2027-01-15', answers: [] });
  assert.equal(outcome.origin.label, 'UX development fixture');
  assert.ok(outcome.lookup.rules.length > 0);
  assert.ok(outcome.lookup.rules.every((rule) => rule.team_rule_id in DEV_RULES && rule.source_doc_id in DEV_SOURCES));
  assert.ok(outcome.lookup.sources.every((source) => source.doc_id in DEV_SOURCES));
  // The claim comparisons are the development fixture's, and cite only its sources.
  const comparisons = await new DemoSource().sourceComparisons();
  assert.equal(comparisons.recordedStore, 'dev_portfolio');
  assert.ok(Object.keys(comparisons.response.source_hashes).every((docId) => docId in DEV_SOURCES));
});

test('demo: a request with no recording is refused in every adapter method, never answered from elsewhere', async () => {
  const demo = new DemoSource();
  assert.equal((await rejects(demo.lookup({ address_id: 'DEV-P07', as_of: '2030-01-01', answers: [] }))).kind, 'not_recorded');
  assert.equal((await rejects(demo.changes({ before: '2030-01-01', after: '2030-02-01' }))).kind, 'not_recorded');
  assert.equal((await rejects(demo.ruleDetail('r-not-recorded'))).kind, 'not_recorded');
  assert.equal((await rejects(demo.source('NOT-RECORDED'))).kind, 'not_recorded');
  assert.equal(await demo.health(), null, 'there is no service, so no health is reported');
  assert.equal((demo as { evidencePackage?: unknown }).evidencePackage, undefined, 'the evidence package is a live-service artifact');
});

test('demo: no evidence report is fabricated', async () => {
  const outcome = await new DemoSource().evidenceReport('r-not-recorded');
  assert.equal(outcome.report, null);
  assert.match(outcome.unavailable ?? '', /dependency_unavailable/);
});

// ------------------------------------------------------------------ live
test('live: fact definitions are read once and shared, and one caller going away does not cancel them', async () => {
  const definition = { field: 'units', meaning: 'Number of dwelling units in this building', data_type: 'integer', unit: 'dwelling units', allowed_values: [], minimum: 1, maximum: null, answer_effort: 1, allow_partial_date: true };
  const signals: Array<AbortSignal | null | undefined> = [];
  const impl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    signals.push(init?.signal);
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return new Response(JSON.stringify({ units: definition, broken: { field: 'broken' } }), { status: 200 });
  }) as typeof fetch;
  const live = new LiveSource('/api/v1', impl);
  // A view that mounts, unmounts and mounts again (React StrictMode does exactly this).
  const leaving = new AbortController();
  const first = (live as { facts: (signal?: AbortSignal) => Promise<unknown> }).facts(leaving.signal);
  leaving.abort();
  const second = await live.facts();
  assert.equal(signals.length, 1, 'one request');
  assert.equal(signals[0], undefined, 'not tied to a caller');
  assert.deepEqual(Object.keys(second ?? {}), ['units'], 'a definition that does not match the contract is left out');
  assert.deepEqual(await first, second);
});

test('live: with no assist route it says so and uses the implemented /lookup with supplemental facts', async () => {
  const { impl, calls } = fakeFetch({ 'POST /lookup': () => ({ status: 200, body: unknownExample.response }) });
  const live = new LiveSource('/api/v1', impl);
  const answers: Answer[] = [
    { field: 'units', value: 12, provenance: 'user_provided' },
    { field: 'owner_occupied', value: null, provenance: 'user_provided' },
  ];
  const outcome = await live.lookup({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers });
  assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), ['POST /lookup/assist', 'POST /lookup']);
  assert.deepEqual(calls[1]?.body, { address_id: 'SYNTH-003', as_of: '2026-11-15', supplemental_facts: { units: 12 } });
  assert.equal(outcome.assist, null);
  assert.equal(outcome.planner.kind, 'endpoint_unavailable');
  assert.deepEqual(outcome.dispositions.map((item) => item.status), ['sent_as_supplemental_fact', 'withheld_unknown']);

  // The missing route is remembered: the next request does not probe it again.
  await live.lookup({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [] });
  assert.equal(calls.filter((call) => call.path === '/lookup/assist').length, 1);
  assert.deepEqual(calls[2]?.body, { address_id: 'SYNTH-003', as_of: '2026-11-15' });
});

test('live: with the assist route, every accumulated answer is resent, including explicit unknowns', async () => {
  const { impl, calls } = fakeFetch({
    'POST /lookup/assist': (body) => ({ status: 200, body: { ...decisive.response, mode: 'synthetic', answers_applied: (body as { answers: unknown[] }).answers } }),
  });
  const live = new LiveSource('/api/v1', impl);
  const answers: Answer[] = [
    { field: 'units', value: 8, provenance: 'demo' },
    { field: 'owner_occupied', value: null, provenance: 'user_provided' },
  ];
  const outcome = await live.lookup({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers });
  assert.deepEqual(calls[0]?.body, {
    address_id: 'SYNTH-003',
    as_of: '2026-11-15',
    answers: [
      { field: 'units', value: 8, provenance: 'demo' },
      { field: 'owner_occupied', value: null, provenance: 'user_provided' },
    ],
  });
  assert.equal(outcome.planner.kind, 'response');
  assert.deepEqual(outcome.dispositions.map((item) => item.status), ['applied', 'applied']);
});

test('live: an unknown address under the assist route is a stale selection, not a missing route', async () => {
  const { impl } = fakeFetch({ 'POST /lookup/assist': () => ({ status: 404, body: ERROR_EXAMPLES.unknown_address }) });
  const error = await rejects(new LiveSource('/api/v1', impl).lookup({ address_id: 'MISSING', as_of: '2026-11-15', answers: [] }));
  assert.equal(error.kind, 'not_found');
  assert.equal(error.code, 'unknown_id');
});

test('live: 503 is "unavailable" with the service message', async () => {
  const { impl } = fakeFetch({
    'POST /lookup/assist': () => ({ status: 404, body: { detail: 'Not Found' } }),
    'POST /lookup': () => ({ status: 503, body: { detail: { code: 'dataset_unavailable', message: 'No completed extraction; configure provider and run navigator extract' } } }),
  });
  const error = await rejects(new LiveSource('/api/v1', impl).lookup({ address_id: 'A0001', as_of: '2026-10-01', answers: [] }));
  assert.equal(error.kind, 'unavailable');
  assert.equal(error.status, 503);
  assert.match(error.message, /No completed extraction/);
});

test('live: 422 validation details are readable', async () => {
  const { impl } = fakeFetch({
    'POST /lookup/assist': () => ({ status: 422, body: ERROR_EXAMPLES.invalid_input }),
  });
  const error = await rejects(new LiveSource('/api/v1', impl).lookup({ address_id: '', as_of: '2026-10-01', answers: [] }));
  assert.equal(error.kind, 'invalid_request');
  assert.deepEqual(error.details, ['Supply exactly one of address_id or address']);
});

test('live: a failing Core service (503 core_unavailable) is a dependency failure, not a missing dataset', async () => {
  const { impl } = fakeFetch({ 'POST /lookup/assist': () => ({ status: 503, body: { detail: { code: 'core_unavailable', message: 'Core service failed; no substitute analysis generated' } } }) });
  const error = await rejects(new LiveSource('/api/v1', impl).lookup({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [] }));
  assert.equal(error.kind, 'dependency');
  assert.match(error.message, /no substitute analysis/);
});

test('live: /facts is a validated map of definitions, and its absence is tolerated', async () => {
  const units = ASSIST_EXAMPLE.response.question_plan.questions[0]!.fact;
  const present = fakeFetch({ 'GET /facts': () => ({ status: 200, body: { units, broken: { field: 'broken' } } }) });
  const live = new LiveSource('/api/v1', present.impl);
  assert.deepEqual(Object.keys((await live.facts()) ?? {}), ['units']);
  await live.facts();
  assert.equal(present.calls.length, 1, 'definitions are fetched once');
  const absent = fakeFetch({});
  assert.equal(await new LiveSource('/api/v1', absent.impl).facts(), null);
});

test('live: 502 is a dependency failure; an empty 500 is treated as an unreachable backend', async () => {
  const dependency = fakeFetch({ 'POST /changes': () => ({ status: 502, body: { detail: { code: 'bad_core_output', message: 'Malformed planner output' } } }) });
  assert.equal((await rejects(new LiveSource('/api/v1', dependency.impl).changes({ test_id: 'T1' }))).kind, 'dependency');
  const proxy = fakeFetch({ 'GET /health': () => ({ status: 500, text: '' }) });
  assert.equal((await rejects(new LiveSource('/api/v1', proxy.impl).health())).kind, 'transport');
});

test('live: a network failure is a transport error', async () => {
  const { impl } = fakeFetch({ 'GET /health': () => new TypeError('Failed to fetch') });
  const error = await rejects(new LiveSource('/api/v1', impl).health());
  assert.equal(error.kind, 'transport');
});

test('live: a 200 that does not match the contract is refused, not rendered', async () => {
  const broken = { ...unknownExample.response, evaluations: [{ ...unknownExample.response.evaluations[0], result: 'compliant' }] };
  const { impl } = fakeFetch({
    'POST /lookup/assist': () => ({ status: 404, body: { detail: 'Not Found' } }),
    'POST /lookup': () => ({ status: 200, body: broken }),
  });
  const error = await rejects(new LiveSource('/api/v1', impl).lookup({ address_id: 'SYNTH-003', as_of: '2026-11-15', answers: [] }));
  assert.equal(error.kind, 'contract');
  assert.ok(error.details.some((detail) => detail.includes('compliant')));
});

test('live: a missing evidence route reports "not available" instead of a report', async () => {
  const { impl, calls } = fakeFetch({});
  const live = new LiveSource('/api/v1', impl);
  const first = await live.evidenceReport('r-1');
  assert.equal(first.report, null);
  assert.match(first.unavailable ?? '', /not available on this backend/);
  await live.evidenceReport('r-2');
  assert.equal(calls.length, 1, 'the missing route is probed once');
});

test('live: address search passes q, offset and limit', async () => {
  const { impl, calls } = fakeFetch({ 'GET /addresses': () => ({ status: 200, body: { total: 0, offset: 0, limit: 25, items: [], disclaimer: 'x' } }) });
  await new LiveSource('http://127.0.0.1:8000/api/v1/', impl).addresses({ q: 'Maple & Co', offset: 0, limit: 25 });
  assert.equal(calls[0]?.path, '/addresses?q=Maple+%26+Co&offset=0&limit=25');
});
