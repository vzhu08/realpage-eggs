/** Test doubles shared by the integration-*.test.ts files: a recording fetch and contract examples. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../../src/api/errors';

export const readText = (relative: string): string => readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), 'utf8');
export const readJson = <T = any>(relative: string): T => JSON.parse(readText(relative)) as T;
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface Call {
  method: string;
  path: string;
  body: unknown;
  signal: AbortSignal | null | undefined;
}

export interface Reply {
  status: number;
  body?: unknown;
  /** Sent as the body exactly as given (text or bytes) instead of serializing `body`. */
  raw?: string | Uint8Array;
  headers?: Record<string, string>;
}

type Handler = (body: unknown, call: Call) => Reply | Error | Promise<Reply | Error>;

/** A fetch double that answers from a route table and records every call, with its signal. */
export function fakeFetch(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://api.test');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const path = url.pathname.replace(/^\/api\/v1/, '');
    const call: Call = { method, path: path + url.search, body, signal: init?.signal };
    calls.push(call);
    const handler = routes[`${method} ${path}`];
    const result = handler ? await handler(body, call) : { status: 404, body: { detail: 'Not Found' } };
    if (result instanceof Error) throw result;
    const payload = result.raw ?? (result.body === undefined ? '' : JSON.stringify(result.body));
    // Bytes are passed through untouched; the cast is for the DOM typings of typed arrays.
    return new Response(payload as unknown as BodyInit, { status: result.status, headers: { 'Content-Type': 'application/json', ...(result.headers ?? {}) } });
  }) as typeof fetch;
  return { impl, calls };
}

/** A reply that never arrives: it settles only when the request's own signal is aborted, as fetch does. */
export const hangUntilAborted = (_body: unknown, call: Call): Promise<Error> =>
  new Promise((resolve) => {
    const abort = () => resolve(new DOMException('The operation was aborted.', 'AbortError'));
    if (call.signal?.aborted) abort();
    else call.signal?.addEventListener('abort', abort);
  });

export const rejects = async (promise: Promise<unknown>): Promise<ApiError> => {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof ApiError, `expected an ApiError, received ${String(error)}`);
    return error;
  }
  assert.fail('expected the request to fail');
};

/** The request ended as a cancellation: not a result, and not an error to show. */
export const cancelled = async (promise: Promise<unknown>): Promise<void> => {
  try {
    await promise;
  } catch (error) {
    assert.equal((error as { name?: string }).name, 'AbortError', String(error));
    assert.ok(!(error instanceof ApiError), 'a cancellation is not an ApiError');
    return;
  }
  assert.fail('expected the request to be cancelled');
};

export const NOT_FOUND = { status: 404, body: { detail: 'Not Found' } };
