import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Page, type Route, expect } from '@playwright/test';
import { expandPooled } from '../../src/demo/pool';

const read = (relative: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../${relative}`, import.meta.url)), 'utf8'));

/** The checked-in contract examples double as the mocked backend's responses in live-mode tests. */
export const examples = {
  normal: read('contracts/examples/normal.json'),
  empty: read('contracts/examples/empty.json'),
  unknown: read('contracts/examples/unknown.json'),
  errors: read('contracts/examples/errors.json'),
  decisive: read('contracts/research_examples/decisive_question.json'),
  /** The implemented API's own response for SYNTH-003 on 2026-11-15 (Platform + Core). */
  assist: read('contracts/examples/assist.json'),
};

export const RULE_ID: string = examples.unknown.response.rules[0].team_rule_id;
export const RULE_TITLE: string = examples.unknown.response.rules[0].title;

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export const health = (overrides: Record<string, unknown> = {}) => ({
  status: 'ok',
  version: '0.1.0',
  dataset_readiness: 'available',
  sources: 1,
  rules: 1,
  addresses: 3,
  resolved_municipalities: 3,
  last_extraction_outcome: 'success',
  disclaimer: examples.normal.response.disclaimer,
  ...overrides,
});

export const addressPage = (responses = [examples.normal.response, examples.empty.response, examples.unknown.response]) => ({
  total: responses.length,
  offset: 0,
  limit: 25,
  items: responses.map((response) => ({ property: response.address, resolution: response.jurisdiction })),
  disclaimer: examples.normal.response.disclaimer,
});

export interface Recorded {
  method: string;
  path: string;
  body: unknown;
}

type Handler = (request: { body: any; url: URL }) => { status?: number; json?: unknown; text?: string } | 'abort';

/**
 * Intercepts every /api/v1 call at the network boundary. Unhandled routes answer like FastAPI
 * does for an unknown path, which is how the planned assist/evidence routes look today.
 */
export async function mockApi(page: Page, handlers: Record<string, Handler>): Promise<Recorded[]> {
  const calls: Recorded[] = [];
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^.*\/api\/v1/, '');
    const body = request.postDataJSON?.() ?? undefined;
    calls.push({ method: request.method(), path, body });
    const key = `${request.method()} ${path}`;
    const pattern = Object.keys(handlers).find((candidate) => candidate === key || (candidate.endsWith('*') && key.startsWith(candidate.slice(0, -1))));
    if (!pattern) {
      await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ detail: 'Not Found' }) });
      return;
    }
    const result = handlers[pattern]!({ body, url });
    if (result === 'abort') {
      await route.abort('connectionrefused');
      return;
    }
    await route.fulfill({ status: result.status ?? 200, contentType: 'application/json', body: result.text ?? JSON.stringify(result.json) });
  });
  return calls;
}

export const baseHandlers = (): Record<string, Handler> => ({
  'GET /health': () => ({ json: health() }),
  'GET /addresses': () => ({ json: addressPage() }),
  'GET /rules/*': ({ url }) =>
    // The planned evidence route is absent unless a test adds it.
    url.pathname.endsWith('/evidence')
      ? { status: 404, json: { detail: 'Not Found' } }
      : { json: { rule: examples.unknown.response.rules[0], versions: [examples.unknown.response.rules[0]], disclaimer: examples.normal.response.disclaimer } },
  'GET /sources/*': () => ({
    json: { ...examples.unknown.response.sources[0], text: readFileSync(fileURLToPath(new URL('../../../fixtures/synthetic_ordinance.txt', import.meta.url)), 'utf8') },
  }),
});

export async function openDemo(page: Page, hash = '#/lookup?mode=demo') {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('note', { name: 'Synthetic demo notice' })).toBeVisible();
  // The demo adapter loads on demand; wait for the app itself, not just the banner.
  await expect(page.locator('#main')).toBeVisible();
}

export async function openLive(page: Page, hash = '#/lookup?mode=live') {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('radio', { name: 'Live API' })).toBeChecked();
}

/** Open a question-flow fixture from the property list (expanding the list on narrow screens). */
export async function openCase(page: Page, title: string) {
  await showFinder(page);
  await page.getByRole('button', { name: new RegExp(`^${title}`) }).click();
  await expect(page.getByRole('group', { name: 'Result context' })).toBeVisible();
}

export async function showFinder(page: Page) {
  const toggle = page.locator('.finder-toggle');
  if ((await toggle.isVisible()) && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
}

export async function selectProperty(page: Page, address: string) {
  await showFinder(page);
  await page.getByRole('list', { name: 'Sample properties' }).getByRole('button', { name: new RegExp(address) }).click();
}

export const ruleRow = (page: Page, ruleId = RULE_ID) => page.locator(`.rule[data-rule-id="${ruleId}"]`);

export async function openEvidence(page: Page, title = RULE_TITLE) {
  const panel = page.locator('.evidence');
  if (!(await panel.isVisible())) await page.getByRole('button', { name: `Inspect evidence for ${title}` }).click();
  await expect(panel).toBeVisible();
  return panel;
}

/** The page must never scroll sideways, at any width. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

/* ---------- UX development fixture (fictional portfolio, backend-evaluated) ---------- */

interface DevFixture {
  addresses: Array<{ property: { address_id: string }; resolution: unknown }>;
  assists: Array<{ request: { address_id: string; as_of: string }; response: any }>;
  rules: Record<string, unknown>;
  sources: Record<string, unknown>;
  changes: Array<{ request: { before: string; after: string; scenario?: string }; response: any }>;
}

/** The recorded development fixture, expanded the same way the app expands it. */
export function devFixture(): DevFixture {
  return expandPooled<DevFixture>(read('frontend/src/demo/recorded/portfolio-dev-fixture.json'));
}

/**
 * A live-API double that answers from the recorded development fixture: paged addresses, rule
 * and source records, lookups and comparisons. Requests it holds no recording for get a 422.
 */
export function devHandlers(fixture = devFixture()): Record<string, Handler> {
  const tail = (url: URL) => decodeURIComponent(url.pathname.split('/').pop() ?? '');
  return {
    'GET /health': () => ({ json: health({ addresses: fixture.addresses.length, rules: Object.keys(fixture.rules).length, sources: Object.keys(fixture.sources).length, resolved_municipalities: 12, dataset_readiness: 'partial' }) }),
    'GET /addresses': ({ url }) => {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const limit = Number(url.searchParams.get('limit') ?? 25);
      const items = fixture.addresses.filter((item) => JSON.stringify(item.property).toLowerCase().includes(q));
      return { json: { total: items.length, offset, limit, items: items.slice(offset, offset + limit), disclaimer: examples.normal.response.disclaimer } };
    },
    'GET /rules/*': ({ url }) => {
      if (url.pathname.endsWith('/evidence')) return { status: 404, json: { detail: 'Not Found' } };
      const detail = fixture.rules[tail(url)];
      return detail ? { json: detail } : { status: 404, json: { detail: { code: 'unknown_id', message: 'Unknown rule ID' } } };
    },
    'GET /sources/*': ({ url }) => {
      const source = fixture.sources[tail(url)];
      return source ? { json: source } : { status: 404, json: { detail: { code: 'unknown_id', message: 'Unknown document ID' } } };
    },
    'GET /facts': () => ({ json: {} }),
    'POST /lookup/assist': ({ body }) => {
      const entry = fixture.assists.find((candidate) => candidate.request.address_id === body.address_id && candidate.request.as_of === body.as_of);
      return entry ? { json: entry.response } : { status: 422, json: { detail: { code: 'invalid_input', message: 'No recorded response for this request in the test double' } } };
    },
    'POST /changes': ({ body }) => {
      const entry = fixture.changes.find((candidate) => candidate.request.before === body.before && candidate.request.after === body.after && (candidate.request.scenario ?? 'actual') === (body.scenario ?? 'actual'));
      return entry ? { json: entry.response } : { status: 422, json: { detail: { code: 'invalid_input', message: 'No recorded response for this request in the test double' } } };
    },
  };
}

export const comparisonResult = (page: Page) => page.getByRole('article', { name: 'Comparison result' });

/** Open the changes view in the demo and run the development portfolio's headline comparison. */
export async function openPortfolio(page: Page, pill = 'Oct 1, 2026 → Jan 15, 2027') {
  await openDemo(page, '#/changes?mode=demo');
  await page.getByRole('button', { name: pill, exact: true }).click();
  const result = comparisonResult(page);
  await expect(result).toBeVisible();
  // Names arrive after the comparison; wait for the label lookups to settle.
  await expect(result.locator('.detail-status .spinner')).toHaveCount(0);
  return result;
}
