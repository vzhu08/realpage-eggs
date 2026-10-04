import assert from 'node:assert/strict';
import test from 'node:test';
import { AssistPreload } from '../../src/api/assistPreload';
import { assistRetainedBytes, decodeAssistWire } from '../../src/api/assistWire';
import { validate } from '../../src/api/validate';

test('compact transport preserves false, null, unicode and literal keys without alias mutation', () => {
  const output = decodeAssistWire({ format: 'realpage-assist-dag-v1', nodes: [false, null, 'é', { o: [['a', 0], ['$ref', 1], ['__proto__', 2]] }, { a: [3, 3] }], root: 4 }) as Record<string, unknown>[];
  assert.equal(output[0]?.a, false);
  assert.equal(output[0]?.$ref, null);
  assert.equal(output[0]?.__proto__, 'é');
  assert.equal(output[0], output[1]);
  assert.ok(assistRetainedBytes(output) > 0 && assistRetainedBytes(output) < 2048);
  assert.equal(assistRetainedBytes({}), Infinity);
  assert.throws(() => { output[0]!.a = true; });
  assert.throws(() => decodeAssistWire({ format: 'realpage-assist-dag-v1', nodes: [{ a: [0] }], root: 0 }));
});

test('tab cache keeps input keys, identities, bounds and caller cancellation independent', async () => {
  const cache = new AssistPreload<string>(2, 10);
  let calls = 0;
  const load = async () => ({ value: `result-${++calls}`, identity: 'snapshot-1', bytes: 4 });
  assert.equal((await cache.get('false', null, load)).preloaded, false);
  assert.equal((await cache.get('false', 'snapshot-1', load)).preloaded, true);
  assert.equal((await cache.get('null', 'snapshot-1', load)).value, 'result-2');
  assert.equal((await cache.get('date', 'snapshot-1', load)).value, 'result-3');
  assert.equal(cache.has('false'), false);
  assert.equal((await cache.get('null', 'snapshot-2', load)).preloaded, false);
  const abort = new AbortController(); abort.abort();
  await assert.rejects(cache.get('null', 'snapshot-1', load, abort.signal), { name: 'AbortError' });
});

test('duplicate requests join; cancelling one user does not cancel the other', async () => {
  const cache = new AssistPreload<string>();
  let calls = 0;
  let complete!: (value: { value: string; identity: string; bytes: number }) => void;
  let transport!: AbortSignal;
  const load = (signal: AbortSignal) => { calls++; transport = signal; return new Promise<{ value: string; identity: string; bytes: number }>((resolve) => { complete = resolve; }); };
  const left = new AbortController();
  const first = cache.get('same', null, load, left.signal);
  const second = cache.get('same', null, load);
  left.abort();
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(transport.aborted, false);
  complete({ value: 'result', identity: 'one', bytes: 1 });
  assert.equal((await second).value, 'result');
  assert.equal(calls, 1);
});

test('cancelled completion cannot populate cache, and shared-node validation keeps failures', async () => {
  const cache = new AssistPreload<string>();
  const abort = new AbortController();
  let complete!: (value: { value: string; identity: string; bytes: number }) => void;
  const pending = cache.get('same', null, () => new Promise((resolve) => { complete = resolve; }), abort.signal);
  abort.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  complete({ value: 'stale', identity: 'one', bytes: 1 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(cache.has('same'), false);
  assert.ok(validate('AssistResponse', { lookup: {} }).errors.length > 0);
});
