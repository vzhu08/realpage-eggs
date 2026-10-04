/**
 * Helpers for the integration-*.spec.ts files: a mocked live service that can hold a response
 * back, send exact bytes and set headers, and the synthetic contract examples it answers with.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Download, type Page, type Route, expect } from '@playwright/test';

const path = (relative: string) => fileURLToPath(new URL(`../../../${relative}`, import.meta.url));
export const readJson = (relative: string) => JSON.parse(readFileSync(path(relative), 'utf8'));
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const contract = {
  assist: readJson('contracts/examples/assist.json'),
  unknown: readJson('contracts/examples/unknown.json'),
  normal: readJson('contracts/examples/normal.json'),
  empty: readJson('contracts/examples/empty.json'),
  package: readJson('contracts/evidence_examples/property_package.json'),
  packageMissingSupport: readJson('contracts/evidence_examples/package_missing_support.json'),
  claimComparison: readJson('contracts/evidence_examples/claim_comparison.json'),
  changeSummary: readJson('contracts/evidence_examples/change_summary.json'),
};
export const DISCLAIMER: string = contract.normal.response.disclaimer;
export const SYNTHETIC_RULE = contract.unknown.response.rules[0];

export interface Recorded {
  method: string;
  path: string;
  body: any;
}

export interface Reply {
  status?: number;
  json?: unknown;
  /** Sent as the body exactly as given. */
  text?: string;
  headers?: Record<string, string>;
  /** Resolve to release the response; the request stays pending until then. */
  hold?: Promise<unknown>;
}

export type Handler = (request: { body: any; url: URL }) => Reply | 'abort';

/** A gate a test opens when it wants a held response to arrive. */
export function gate() {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => (open = resolve));
  return { promise, open };
}

/**
 * Intercepts every /api/v1 call. A route with no handler answers like FastAPI does for an
 * unknown path ({"detail": "Not Found"}), which is how a backend without that route looks.
 */
export async function mockService(page: Page, handlers: Record<string, Handler>): Promise<Recorded[]> {
  const calls: Recorded[] = [];
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname.replace(/^.*\/api\/v1/, '');
    const body = request.postDataJSON?.() ?? undefined;
    calls.push({ method: request.method(), path: pathname, body });
    const key = `${request.method()} ${pathname}`;
    const pattern = Object.keys(handlers).find((candidate) => candidate === key || (candidate.endsWith('*') && key.startsWith(candidate.slice(0, -1))));
    try {
      if (!pattern) {
        await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not Found' }) });
        return;
      }
      const reply = handlers[pattern]!({ body, url });
      if (reply === 'abort') {
        await route.abort('connectionrefused');
        return;
      }
      if (reply.hold) await reply.hold;
      await route.fulfill({ status: reply.status ?? 200, contentType: 'application/json', headers: reply.headers, body: reply.text ?? JSON.stringify(reply.json) });
    } catch {
      // The page withdrew the request (or closed) while it was held; there is nothing to answer.
    }
  });
  return calls;
}

/** The fictional Maple Harbor service: three properties, one rule, the API's own assist response. */
export function mapleHarbor(overrides: Record<string, Handler> = {}): Record<string, Handler> {
  const responses = [contract.normal.response, contract.empty.response, contract.unknown.response];
  return {
    'GET /health': () => ({ json: { status: 'ok', version: '0.1.0', dataset_readiness: 'available', sources: 1, rules: 1, addresses: 3, resolved_municipalities: 3, last_extraction_outcome: 'success', disclaimer: DISCLAIMER } }),
    'GET /addresses': () => ({ json: { total: 3, offset: 0, limit: 25, items: responses.map((response) => ({ property: response.address, resolution: response.jurisdiction })), disclaimer: DISCLAIMER } }),
    'GET /facts': () => ({ json: {} }),
    'GET /rules/*': ({ url }) => (url.pathname.endsWith('/evidence') ? { status: 404, json: { detail: 'Not Found' } } : { json: { rule: SYNTHETIC_RULE, versions: [SYNTHETIC_RULE], disclaimer: DISCLAIMER } }),
    'GET /sources/*': () => ({ json: { ...contract.unknown.response.sources[0], text: readFileSync(path('fixtures/synthetic_ordinance.txt'), 'utf8') } }),
    // The implemented API's response for SYNTH-003 on 2026-11-15, echoing the answers it was sent.
    'POST /lookup/assist': ({ body }) => ({ json: { ...clone(contract.assist.response), answers_applied: echoAnswers(body.answers) } }),
    ...overrides,
  };
}

/** Answers as the service echoes them: defaults filled, values untouched. */
export const echoAnswers = (answers: Array<{ field: string; value: unknown; provenance?: string; note?: string }> = []) =>
  answers.map((answer) => ({ field: answer.field, value: answer.value, provenance: answer.provenance ?? 'user_provided', note: answer.note ?? null }));

/**
 * The synthetic contract package, as the service would return it for this request: the same
 * inputs, hashes, label and limitations, with the request and applied answers echoed. A
 * hand-built variant of contracts/evidence_examples/property_package.json for the browser tests.
 */
export function packageFor(body: { address_id: string; as_of: string; answers?: Array<{ field: string; value: unknown; provenance?: string; note?: string }> }) {
  const pack = clone(contract.package.response);
  pack.request.address_id = body.address_id;
  pack.request.as_of = body.as_of;
  pack.request.answers = echoAnswers(body.answers);
  pack.response.answers_applied = echoAnswers(body.answers);
  return pack;
}

export const PACKAGE_NAME = `evidence-package-${String(contract.package.response.package_sha256).slice(0, 12)}.json`;
/** A body with its own formatting, so a re-serialized download would be detectable. */
export const packageText = (pack: unknown) => `${JSON.stringify(pack, null, 1)}\n`;
export const packageReply = (pack: unknown, extra: Partial<Reply> = {}): Reply => ({ text: packageText(pack), headers: { 'Content-Disposition': `attachment; filename="${PACKAGE_NAME}"`, 'Cache-Control': 'no-store', 'Access-Control-Expose-Headers': 'Content-Disposition' }, ...extra });

/** Open a saved property on a date in live mode and wait for its result. */
export async function openLiveResult(page: Page, addressId = 'SYNTH-003', asOf = '2026-11-15') {
  await page.goto(`/#/lookup?mode=live&address=${addressId}&as_of=${asOf}&run=1`);
  await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
  return keep(page);
}

export const keep = (page: Page) => page.getByRole('region', { name: 'Keep this result' });
export const packageCard = (page: Page) => page.getByRole('article', { name: 'Evidence package' });
export const workingCard = (page: Page) => page.getByRole('article', { name: 'Working export' });
export const downloadPackageButton = (page: Page) => packageCard(page).getByRole('button', { name: 'Download evidence package' });

/** Every download the page starts, so a test can assert that none happened. */
export function watchDownloads(page: Page): Download[] {
  const downloads: Download[] = [];
  page.on('download', (download) => downloads.push(download));
  return downloads;
}

export async function downloadedText(download: Download): Promise<string> {
  const file = await download.path();
  return readFileSync(file, 'utf8');
}

/** The page must never scroll sideways, at any width. */
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/** The lead question's answer form (the assist example asks one question: units). */
export const leadQuestion = (page: Page) => page.locator('.question').first();
