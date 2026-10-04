/**
 * POST /lookup/evidence-package through the live adapter: what is sent, what is refused, and
 * that the saved text is the response body byte for byte.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mock, test } from 'node:test';
import { DemoSource } from '../../src/api/demo';
import { ApiError } from '../../src/api/errors';
import { DEFAULT_PACKAGE_NAME, packageEchoProblems, packageFailure, packageRequestBody, safeAttachmentName, wireAnswer } from '../../src/api/evidencePackage';
import { LiveSource, PACKAGE_TIMEOUT_MS } from '../../src/api/live';
import type { Answer, DataSource, EvidencePackage, LookupQuery } from '../../src/api/types';
import { validate } from '../../src/api/validate';
import { type Reply, NOT_FOUND, cancelled, clone, fakeFetch, hangUntilAborted, readJson, rejects } from './integration-doubles';

interface Example {
  fixture_mode: string;
  request: { address_id: string; as_of: string; answers?: Answer[] };
  response: EvidencePackage;
}
const answered = readJson<Example>('contracts/evidence_examples/property_package.json');
const missingSupport = readJson<Example>('contracts/evidence_examples/package_missing_support.json');
const QUERY: LookupQuery = { address_id: answered.request.address_id, as_of: answered.request.as_of, answers: answered.request.answers ?? [] };
const route = (reply: Reply | Error | (() => Reply)) => ({ 'POST /lookup/evidence-package': typeof reply === 'function' ? reply : () => reply });
const live = (routes: Parameters<typeof fakeFetch>[0]) => {
  const double = fakeFetch(routes);
  return { ...double, source: new LiveSource('/api/v1', double.impl) };
};

/** The example package as the service would return it for a request with these answers. */
function packageFor(answers: Answer[], base: EvidencePackage = answered.response): EvidencePackage {
  const pack = clone(base);
  const echoed = answers.map((answer) => ({ field: answer.field, value: answer.value, provenance: answer.provenance ?? 'user_provided', note: answer.note ?? null }));
  pack.request.answers = echoed;
  pack.response.answers_applied = clone(echoed);
  return pack;
}

test('the checked-in package examples match EvidencePackage and echo their own requests', () => {
  for (const example of [answered, missingSupport]) {
    assert.deepEqual(validate('EvidencePackage', example.response), { errors: [], warnings: [] });
    assert.equal(example.fixture_mode, 'synthetic');
    assert.equal(example.response.artifact_label, 'SYNTHETIC_NOT_FOR_SUBMISSION');
    const query = { address_id: example.request.address_id, as_of: example.request.as_of, answers: example.request.answers ?? [] };
    assert.deepEqual(packageEchoProblems(packageRequestBody(query), example.response), []);
  }
});

test('request: the property, the date and every answer are sent, explicit unknowns included, and nothing else', async () => {
  const answers: Answer[] = [
    { field: 'units', value: 8, provenance: 'demo' },
    { field: 'owner_occupied', value: null, provenance: 'user_provided' },
    { field: 'certificate_of_occupancy', value: '2020-05', provenance: 'user_provided', note: 'From the owner’s copy' },
    { field: 'subsidized', value: false, provenance: 'user_provided' },
  ];
  const { source, calls } = live(route({ status: 200, body: packageFor(answers) }));
  const download = await source.evidencePackage({ ...QUERY, answers, fixtureCase: 'never-sent' });
  assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), ['POST /lookup/evidence-package']);
  assert.deepEqual(calls[0]?.body, {
    address_id: 'SYNTH-003',
    as_of: '2026-11-15',
    answers: [
      { field: 'units', value: 8, provenance: 'demo' },
      { field: 'owner_occupied', value: null, provenance: 'user_provided' },
      { field: 'certificate_of_occupancy', value: '2020-05', provenance: 'user_provided', note: 'From the owner’s copy' },
      { field: 'subsidized', value: false, provenance: 'user_provided' },
    ],
  });
  assert.deepEqual(download.request, calls[0]?.body, 'the outcome carries the request that was sent');
  assert.deepEqual(download.package.request.answers?.map((answer) => answer.value), [8, null, '2020-05', false]);
});

test('request: with no answers an empty list is sent, not an omitted field', async () => {
  const { source, calls } = live(route({ status: 200, body: missingSupport.response }));
  await source.evidencePackage({ address_id: 'SYNTH-001', as_of: '2026-11-15', answers: [] });
  assert.deepEqual(calls[0]?.body, { address_id: 'SYNTH-001', as_of: '2026-11-15', answers: [] });
});

test('wire answers keep their type: an explicit unknown stays null and a default provenance is stated', () => {
  assert.deepEqual(wireAnswer({ field: 'units', value: null, provenance: 'user_provided' }), { field: 'units', value: null, provenance: 'user_provided' });
  assert.deepEqual(wireAnswer({ field: 'units', value: 8 } as Answer), { field: 'units', value: 8, provenance: 'user_provided' });
  assert.deepEqual(wireAnswer({ field: 'units', value: 0, provenance: 'demo', note: '' }), { field: 'units', value: 0, provenance: 'demo' });
});

test('echo: a package the service would legitimately return is never refused', () => {
  const answers: Answer[] = [
    { field: 'units', value: 8, provenance: 'demo' },
    { field: 'owner_occupied', value: null, provenance: 'user_provided' },
    { field: 'certificate_of_occupancy', value: '2020', provenance: 'user_provided', note: 'year only' },
  ];
  const sent = packageRequestBody({ ...QUERY, answers });
  const pack = packageFor(answers);
  assert.deepEqual(packageEchoProblems(sent, pack), []);
  // The service fills defaults: note null, provenance user_provided, empty supplemental facts, null scenario.
  assert.deepEqual(pack.request.answers?.[0], { field: 'units', value: 8, provenance: 'demo', note: null });
  assert.equal(pack.request.scenario_id, null);
  // Defaults left out of an echo are the same request.
  const sparse = clone(pack);
  sparse.request.answers = [{ field: 'units', value: 8, provenance: 'demo' }, { field: 'owner_occupied', value: null }, { field: 'certificate_of_occupancy', value: '2020', note: 'year only' }];
  delete sparse.request.supplemental_facts;
  delete sparse.request.scenario_id;
  delete sparse.request.address;
  assert.deepEqual(packageEchoProblems(sent, sparse), []);
  // The list is compared as a set of answers: one answer per field, in any order.
  const reordered = clone(pack);
  reordered.request.answers?.reverse();
  assert.deepEqual(packageEchoProblems(sent, reordered), []);
  // Limits are the service's own and are not part of what was asked.
  const limits = clone(pack);
  limits.request.limits = { max_questions: 3, max_fields: 8, max_evaluations: 64, max_joint_fields: 3 };
  assert.deepEqual(packageEchoProblems(sent, limits), []);
});

test('echo: any other property, date or answer state is a mismatch', () => {
  const answers: Answer[] = [
    { field: 'units', value: 8, provenance: 'demo' },
    { field: 'owner_occupied', value: null, provenance: 'user_provided' },
  ];
  const sent = packageRequestBody({ ...QUERY, answers });
  const variants: Array<[string, (pack: EvidencePackage) => void, RegExp]> = [
    ['another property', (pack) => (pack.request.address_id = 'SYNTH-001'), /request\.address_id/],
    ['another date', (pack) => (pack.request.as_of = '2026-11-14'), /request\.as_of/],
    ['a missing date', (pack) => delete pack.request.as_of, /request\.as_of/],
    ['an earlier answer state (no answers)', (pack) => (pack.request.answers = []), /request\.answers/],
    ['a dropped unknown', (pack) => (pack.request.answers = pack.request.answers!.slice(0, 1)), /request\.answers/],
    ['an unknown turned into a value', (pack) => (pack.request.answers![1]!.value = false), /request\.answers/],
    ['a value turned into an unknown', (pack) => (pack.request.answers![0]!.value = null), /request\.answers/],
    ['another value', (pack) => (pack.request.answers![0]!.value = 12), /request\.answers/],
    ['a number sent, a string echoed', (pack) => (pack.request.answers![0]!.value = '8'), /request\.answers/],
    ['another provenance', (pack) => (pack.request.answers![0]!.provenance = 'user_provided'), /request\.answers/],
    ['a note that was not sent', (pack) => (pack.request.answers![0]!.note = 'added'), /request\.answers/],
    ['an extra answer', (pack) => pack.request.answers!.push({ field: 'subsidized', value: true, provenance: 'user_provided', note: null }), /request\.answers/],
    ['supplemental facts that were not sent', (pack) => (pack.request.supplemental_facts = { year_built: 1990 }), /supplemental_facts carries year_built/],
    ['a scenario that was not sent', (pack) => (pack.request.scenario_id = 'browser-scenario-1'), /scenario_id/],
    ['a typed address', (pack) => (pack.request.address = { street_address: '1 Test Street', postal_city: 'Maple Harbor', state: 'CA', zip: '' } as EvidencePackage['request']['address']), /request\.address is set/],
    ['inputs for another property', (pack) => (pack.inputs.original_property.address_id = 'SYNTH-001'), /inputs\.original_property/],
    ['a response for another property', (pack) => (pack.response.lookup.address.address_id = 'SYNTH-001'), /response\.lookup\.address/],
    ['a response for another date', (pack) => (pack.response.lookup.as_of = '2026-10-01'), /response\.lookup\.as_of/],
    ['a response computed with other answers', (pack) => (pack.response.answers_applied = []), /answers_applied/],
  ];
  for (const [name, change, expected] of variants) {
    const pack = packageFor(answers);
    change(pack);
    const problems = packageEchoProblems(sent, pack);
    assert.ok(problems.length >= 1, `${name}: must be refused`);
    assert.ok(problems.some((problem) => expected.test(problem)), `${name}: ${problems.join(' | ')}`);
  }
});

test('echo: the adapter refuses a mismatched package and hands back nothing to save', async () => {
  const stale = packageFor([]); // the package for the result before the answer was given
  const { source } = live(route({ status: 200, body: stale, headers: { 'Content-Disposition': 'attachment; filename="evidence-package-000000000000.json"' } }));
  const error = await rejects(source.evidencePackage(QUERY));
  assert.equal(error.kind, 'contract');
  assert.equal(error.endpoint, 'POST /lookup/evidence-package');
  assert.match(error.message, /different property, date or set of answers than the one on screen, so it was not saved/);
  assert.ok(error.details.some((detail) => /request\.answers does not match the 1 answer that were sent/.test(detail)), error.details.join('\n'));
  assert.equal(packageFailure(error).retry, true);
});

test('file name: Content-Disposition is used only when it is a plain JSON file name', () => {
  const accepted: Array<[string, string]> = [
    ['attachment; filename="evidence-package-ef197f5f222c.json"', 'evidence-package-ef197f5f222c.json'],
    ['attachment; filename=evidence-package-ef197f5f222c.json', 'evidence-package-ef197f5f222c.json'],
    ['ATTACHMENT;  FileName = "Package_1.2-final.json" ; size=10', 'Package_1.2-final.json'],
  ];
  for (const [header, name] of accepted) assert.equal(safeAttachmentName(header), name, header);
  const refused = [
    null,
    undefined,
    '',
    'attachment',
    'attachment; filename=""',
    'attachment; filename="../../etc/passwd.json"',
    'attachment; filename="..\\\\evil.json"',
    'attachment; filename="/tmp/evidence.json"',
    'attachment; filename="C:\\\\evidence.json"',
    'attachment; filename="a/b.json"',
    'attachment; filename="evidence..json"',
    'attachment; filename=".hidden.json"',
    'attachment; filename="evidence.json.exe"',
    'attachment; filename="evidence.html"',
    'attachment; filename="evidence package.json"',
    'attachment; filename="evidence.json\r\nX-Injected: 1"',
    'attachment; filename="evid%2Fence.json"',
    "attachment; filename*=UTF-8''evidence.json",
    'attachment; filename="<script>.json"',
    `attachment; filename="${'a'.repeat(200)}.json"`,
    'inline; name="evidence.json"',
  ];
  for (const header of refused) assert.equal(safeAttachmentName(header), DEFAULT_PACKAGE_NAME, String(header));
});

test('file name: the adapter reads the header, and falls back to evidence-package.json', async () => {
  const named = live(route({ status: 200, body: answered.response, headers: { 'Content-Disposition': 'attachment; filename="evidence-package-ef197f5f222c.json"' } }));
  assert.equal((await named.source.evidencePackage(QUERY)).filename, 'evidence-package-ef197f5f222c.json');
  const unsafe = live(route({ status: 200, body: answered.response, headers: { 'Content-Disposition': 'attachment; filename="../evidence.json"' } }));
  assert.equal((await unsafe.source.evidencePackage(QUERY)).filename, 'evidence-package.json');
  const absent = live(route({ status: 200, body: answered.response }));
  assert.equal((await absent.source.evidencePackage(QUERY)).filename, 'evidence-package.json');
});

test('raw text: the saved text is the response body byte for byte, whatever its formatting', async () => {
  const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const encoder = new TextEncoder();
  // An indented body in the service's own key order...
  const indented = JSON.stringify(answered.response, null, 3);
  // ...and bodies no serializer in this app would produce: CRLF, odd spacing, escapes, astral characters.
  const pack = clone(answered.response);
  pack.limitations = [...pack.limitations, 'Sección 4 — «café» 🏛️ \u00a7 12'];
  const odd = JSON.stringify(pack, null, '\t').replace(/\n/g, '\r\n').replace('"limitations":', '"limitations" :  ') + '\r\n\r\n';
  for (const body of [indented, odd, JSON.stringify(pack).replace('café', 'caf\\u00e9')]) {
    const bytes = encoder.encode(body);
    const { source } = live(route({ status: 200, raw: bytes }));
    const download = await source.evidencePackage(QUERY);
    assert.equal(download.text, body, 'not re-serialized');
    assert.equal(download.byteLength, bytes.byteLength);
    assert.equal(sha(encoder.encode(download.text)), sha(bytes), 'the file written from this text has the same bytes');
    assert.notEqual(download.text, JSON.stringify(download.package), 'the parsed package is not what is saved');
  }
});

test('raw text: a body that is not valid UTF-8 cannot be kept exactly, so it is refused', async () => {
  const bytes = new TextEncoder().encode(JSON.stringify(answered.response));
  const corrupt = new Uint8Array(bytes.length + 1);
  corrupt.set(bytes.subarray(0, 40));
  corrupt[40] = 0xff;
  corrupt.set(bytes.subarray(40), 41);
  const { source } = live(route({ status: 200, raw: corrupt }));
  const error = await rejects(source.evidencePackage(QUERY));
  assert.equal(error.kind, 'contract');
  assert.match(error.message, /not valid UTF-8/);
});

test('errors: each failure keeps its own kind, the service’s words, and an honest next step', async () => {
  const cases: Array<{ name: string; reply: Reply | Error; kind: ApiError['kind']; message: RegExp; retry: boolean; advice: RegExp }> = [
    { name: '404 unknown_id', reply: { status: 404, body: { detail: { code: 'unknown_id', message: 'Unknown address ID SYNTH-003' } } }, kind: 'not_found', message: /Unknown address ID SYNTH-003/, retry: false, advice: /no longer has this property/ },
    { name: 'route missing', reply: NOT_FOUND, kind: 'not_implemented', message: /not available on the connected backend/, retry: false, advice: /no evidence-package route.*not a substitute/ },
    { name: '422 with a code', reply: { status: 422, body: { detail: { code: 'invalid_input', message: 'Demo answers require the separate synthetic dataset' } } }, kind: 'invalid_request', message: /Demo answers require the separate synthetic dataset/, retry: false, advice: /would be rejected again/ },
    { name: '422 validation list', reply: { status: 422, body: { detail: [{ loc: ['body', 'answers', 0, 'provenance'], msg: "Input should be 'user_provided' or 'demo'" }] } }, kind: 'invalid_request', message: /answers\.0\.provenance/, retry: false, advice: /built no package/ },
    { name: '502 core_contract_error', reply: { status: 502, body: { detail: { code: 'core_contract_error', message: 'Core output did not satisfy the shared contract' } } }, kind: 'dependency', message: /did not satisfy the shared contract/, retry: true, advice: /could not accept.*partial package is never produced/ },
    { name: '503 core_unavailable', reply: { status: 503, body: { detail: { code: 'core_unavailable', message: 'Core service failed; no substitute analysis generated' } } }, kind: 'dependency', message: /no substitute analysis/, retry: true, advice: /depends on failed/ },
    { name: '503 dataset_unavailable', reply: { status: 503, body: { detail: { code: 'dataset_unavailable', message: 'Dataset changed while packaging; retry against a stable snapshot' } } }, kind: 'unavailable', message: /changed while packaging/, retry: true, advice: /once the dataset is stable/ },
    { name: 'transport', reply: new TypeError('Failed to fetch'), kind: 'transport', message: /Could not reach the API/, retry: true, advice: /could not be reached, so nothing was saved/ },
    { name: 'contract mismatch', reply: { status: 200, body: { ...answered.response, artifact_label: 'VERIFIED_LEGAL_PACKAGE' } }, kind: 'contract', message: /does not match the EvidencePackage contract/, retry: true, advice: /was not saved/ },
    { name: 'empty 200', reply: { status: 200, raw: '' }, kind: 'contract', message: /without a JSON body/, retry: true, advice: /was not saved/ },
  ];
  for (const { name, reply, kind, message, retry, advice } of cases) {
    const { source, calls } = live(route(reply));
    const error = await rejects(source.evidencePackage(QUERY));
    assert.equal(error.kind, kind, name);
    assert.match(error.details.length && kind === 'invalid_request' ? `${error.message} ${error.details.join(' ')}` : error.message, message, name);
    assert.equal(calls.length, 1, `${name}: one request, no substitute route`);
    const failure = packageFailure(error);
    assert.equal(failure.retry, retry, name);
    assert.match(failure.text, advice, name);
  }
});

test('errors: a package with a label the contract does not know is refused, not relabeled', async () => {
  const { source } = live(route({ status: 200, body: { ...answered.response, artifact_label: 'VERIFIED_LEGAL_PACKAGE' } }));
  const error = await rejects(source.evidencePackage(QUERY));
  assert.ok(error.details.some((detail) => detail.includes('artifact_label') && detail.includes('VERIFIED_LEGAL_PACKAGE')), error.details.join('\n'));
});

test('timeout: after 60 seconds it is a timeout, and nothing is handed back', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const { source, calls } = live({ 'POST /lookup/evidence-package': hangUntilAborted });
    const pending = rejects(source.evidencePackage(QUERY));
    mock.timers.tick(PACKAGE_TIMEOUT_MS);
    const error = await pending;
    assert.equal(PACKAGE_TIMEOUT_MS, 60_000);
    assert.equal(error.kind, 'timeout');
    assert.match(error.message, /No response within 60 seconds/);
    assert.ok(error.details.some((detail) => /nothing was saved/.test(detail)));
    assert.equal(calls[0]?.signal?.aborted, true);
    assert.deepEqual(packageFailure(error), { text: 'Nothing was received in time, so nothing was saved.', retry: true });
  } finally {
    mock.timers.reset();
  }
});

test('abort: a withdrawn request is a cancellation, also when the response arrives anyway', async () => {
  const hanging = live({ 'POST /lookup/evidence-package': hangUntilAborted });
  const first = new AbortController();
  const pending = hanging.source.evidencePackage(QUERY, first.signal);
  first.abort();
  await cancelled(pending);

  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const late = live({
    'POST /lookup/evidence-package': async () => {
      await gate;
      return { status: 200, body: answered.response };
    },
  });
  const second = new AbortController();
  const stale = late.source.evidencePackage(QUERY, second.signal);
  second.abort();
  release();
  await cancelled(stale);

  const gone = new AbortController();
  gone.abort();
  const never = live(route({ status: 200, body: answered.response }));
  await cancelled(never.source.evidencePackage(QUERY, gone.signal));
  assert.equal(never.calls.length, 0);
});

test('demo: the synthetic demo offers no evidence package, so none can be fabricated', () => {
  const demo: DataSource = new DemoSource();
  assert.equal(demo.evidencePackage, undefined);
  assert.equal('evidencePackage' in demo, false);
});
